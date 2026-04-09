"""
FarmPal ML Service — v4 (Production Training Pipeline)
=======================================================
Fixes over v3:
  - Model cached in memory after load — no joblib.load() per request
  - Training query uses temporal ORDER BY + stratified location sampling
    so recent Kenya weather is weighted correctly (not overridden by 2010 data)
  - Pressure tendency pulled from stored reasoning field (matches seed data)
    with LAG fallback for live collected rows
  - Incremental update endpoint: /update adds new rows to existing model
    without full retrain (gradient boosting warm_start)
  - /predict now returns a full breakdown + confidence interval
  - Multi-horizon batch accepts per-item hour/month/pressure so each
    future timestep uses the right temporal features
  - Auto-retrain triggered when rolling accuracy drops below 65%

Training data flow:
  seed_historical.py → weather_data table → /train → model file
  Hourly scheduler  → weather_data table → /train (drift-triggered)
  New farm added    → /bootstrap_location → weather_data → next scheduled retrain
"""

import os, math, json, logging, time as _time, threading, re
import urllib.request, urllib.error
from datetime import datetime, timezone, timedelta

import numpy as np
import pandas as pd
import psycopg2, psycopg2.extras
import joblib
from flask import Flask, request, jsonify
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.metrics import roc_auc_score, brier_score_loss

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

from data.fetch import (
    build_current_payload_from_context,
    fetch_elevations as fetch_elevations_v5,
    fetch_historical_location_frame,
    fetch_recent_rows_from_db,
    fetch_recent_weather_context,
    fetch_training_rows_from_db,
)
from data.preprocess import prepare_prediction_features, prepare_training_dataset
from models.predict import predict_with_bundle
from models.train import save_model_bundle, train_model_bundle
from utils.features import FEATURE_COLUMNS as FEATURE_COLUMNS_V5, RAIN_CODES as RAIN_CODES_V5

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s")
log = logging.getLogger("farmpal-ml")

app = Flask(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml_model_sklearn.pkl")
META_PATH = os.path.join(os.path.dirname(__file__), "..", "ml_model_meta.json")
DEFAULT_BOOTSTRAP_MONTHS = 60
BOOTSTRAP_ROWS_PER_LOCATION = 12_000

# ── In-memory model cache (avoids joblib.load on every predict request) ────────
_model_cache: dict | None = None
_model_cache_mtime: float = 0.0
_model_lock = threading.Lock()

def _load_model_cached() -> dict | None:
    """Load model from disk only when file has changed."""
    global _model_cache, _model_cache_mtime
    if not os.path.exists(MODEL_PATH):
        return None
    try:
        mtime = os.path.getmtime(MODEL_PATH)
        with _model_lock:
            if _model_cache is None or mtime > _model_cache_mtime:
                _model_cache = joblib.load(MODEL_PATH)
                _model_cache_mtime = mtime
                log.info("Model reloaded from disk (v=%s)", _model_cache.get("version","?"))
            return _model_cache
    except Exception as exc:
        log.warning("Model load failed: %s", exc)
        return None

def _invalidate_model_cache():
    global _model_cache, _model_cache_mtime
    with _model_lock:
        _model_cache = None
        _model_cache_mtime = 0.0

_bootstrap_state: dict = {"running": False, "lastResult": None}
_train_state:     dict = {"running": False, "lastResult": None}

RAIN_CODES = {51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99}


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def _write_metadata(bundle: dict) -> None:
    metadata = {
        "version": bundle.get("version"),
        "trainedAt": bundle.get("trainedAt"),
        "trainingSamples": bundle.get("trainingSamples"),
        "accuracy": bundle.get("accuracy"),
        "rmse": bundle.get("rmse"),
        "mae": bundle.get("mae"),
        "selectedModel": bundle.get("selectedModel"),
        "selectedModelDisplay": bundle.get("selectedModelDisplay"),
        "perModel": bundle.get("perModel"),
        "auc": None,
        "brierScore": None,
    }
    with open(META_PATH, "w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=2)


def _persist_bundle(bundle: dict) -> None:
    save_model_bundle(bundle, MODEL_PATH)
    _write_metadata(bundle)
    _invalidate_model_cache()


def _enrich_rows_with_elevation(rows: list[dict]) -> list[dict]:
    if not rows:
        return rows

    unique_pairs = sorted({(round(float(row["lat"]), 6), round(float(row["lon"]), 6)) for row in rows})
    elevation_map = fetch_elevations_v5(unique_pairs)
    for row in rows:
        key = (round(float(row["lat"]), 6), round(float(row["lon"]), 6))
        row["elevation"] = elevation_map.get(key, 1000.0)
    return rows


def _train_from_rows(rows: list[dict], *, source: str) -> dict:
    rows = _enrich_rows_with_elevation(rows)
    X, y, dataset = prepare_training_dataset(rows)
    bundle, result = train_model_bundle(
        X=X,
        y=y,
        dataset=dataset,
        feature_columns=FEATURE_COLUMNS_V5,
        cv_folds=3,
    )
    rain_percent = round(float(y.mean() * 100.0), 2)
    bundle["rainPercent"] = rain_percent
    result["rainPercent"] = rain_percent
    result["source"] = source
    _persist_bundle(bundle)
    return result


def _merge_context_frames(*frames: pd.DataFrame) -> pd.DataFrame:
    usable = [frame for frame in frames if frame is not None and not frame.empty]
    if not usable:
        return pd.DataFrame()

    merged = pd.concat(usable, ignore_index=True, sort=False)
    if "created_at" in merged.columns:
        merged = merged.sort_values("created_at")
        merged = merged.drop_duplicates(subset=["created_at"], keep="last")
    return merged.reset_index(drop=True)


def _prepare_prediction_request(
    payload: dict,
    *,
    history_cache: dict | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    lat = payload.get("lat")
    lon = payload.get("lon")
    has_location = lat is not None and lon is not None

    current_payload = dict(payload)
    history_frame = pd.DataFrame()

    if has_location:
        lat = float(lat)
        lon = float(lon)
        cache_key = (round(lat, 5), round(lon, 5))
        if history_cache is not None and cache_key in history_cache:
            history_frame = history_cache[cache_key]
        else:
            try:
                db_rows = fetch_recent_rows_from_db(os.environ["DATABASE_URL"], lat=lat, lon=lon)
                history_frame = pd.DataFrame(db_rows)
            except Exception as exc:
                log.warning("DB history lookup failed for %.4f,%.4f: %s", lat, lon, exc)
                history_frame = pd.DataFrame()

            if len(history_frame) < 24:
                try:
                    api_context = fetch_recent_weather_context(lat=lat, lon=lon)
                    history_frame = _merge_context_frames(history_frame, api_context)
                except Exception as exc:
                    log.warning("Open-Meteo context fetch failed for %.4f,%.4f: %s", lat, lon, exc)

            if history_cache is not None:
                history_cache[cache_key] = history_frame

        elevation = current_payload.get("elevation")
        if elevation is None:
            try:
                elevation = fetch_elevations_v5([(lat, lon)]).get((lat, lon), 1000.0)
            except Exception as exc:
                log.warning("Elevation fetch failed for %.4f,%.4f: %s", lat, lon, exc)
                elevation = 1000.0
        current_payload["lat"] = lat
        current_payload["lon"] = lon
        current_payload["elevation"] = float(elevation)
    else:
        current_payload.setdefault("lat", 0.0)
        current_payload.setdefault("lon", 37.5)
        current_payload.setdefault("elevation", 1000.0)

    required_weather_fields = ["temperature", "humidity", "pressure", "windspeed"]
    has_live_weather = all(current_payload.get(field) is not None for field in required_weather_fields)
    has_weather_state = current_payload.get("weathercode") is not None or current_payload.get("is_raining_now") is not None

    if not has_live_weather or not has_weather_state:
        if not has_location:
            raise ValueError("lat and lon are required when live weather fields are not provided.")
        if history_frame.empty:
            raise ValueError("No recent weather context was available for the requested location.")
        fallback_payload = build_current_payload_from_context(
            history_frame,
            lat=float(current_payload["lat"]),
            lon=float(current_payload["lon"]),
            elevation=float(current_payload["elevation"]),
        )
        fallback_payload.update({key: value for key, value in current_payload.items() if value is not None})
        current_payload = fallback_payload
    else:
        current_payload.setdefault("created_at", datetime.now(timezone.utc))
        if current_payload.get("weathercode") is None:
            current_payload["weathercode"] = 61 if bool(current_payload.get("is_raining_now")) else 0
        if current_payload.get("precipitation_mm") is None:
            current_payload["precipitation_mm"] = 1.0 if bool(current_payload.get("is_raining_now")) else 0.0

    if current_payload.get("created_at") is None:
        current_payload["created_at"] = datetime.now(timezone.utc)

    local_timestamp = pd.to_datetime(current_payload["created_at"], utc=True)
    if local_timestamp.tzinfo is not None:
        local_timestamp = local_timestamp.tz_convert("Africa/Nairobi")
    if current_payload.get("hour") is None:
        current_payload["hour"] = int(local_timestamp.hour)
    if current_payload.get("month") is None:
        current_payload["month"] = int(local_timestamp.month)
    if current_payload.get("day_of_year") is None:
        current_payload["day_of_year"] = int(local_timestamp.dayofyear)

    feature_row = prepare_prediction_features(history_frame, current_payload)
    return feature_row, history_frame


def _serialize_prediction(bundle: dict, prediction: dict) -> dict:
    return {
        "prediction": prediction["prediction"],
        "confidence": prediction["confidence"],
        "model_used": prediction["model_used"],
        "modelUsed": prediction["model_used"],
        "probability": prediction["probability"],
        "calibratedProbability": prediction["probability"],
        "predictionValue": prediction["predictionValue"],
        "willRain": prediction["willRain"],
        "confidenceInterval": prediction["confidenceInterval"],
        "modelAgreement": prediction["modelAgreement"],
        "modelProbabilities": prediction["modelPredictions"],
        "modelPredictions": prediction["modelPredictions"],
        "version": bundle.get("version"),
        "accuracy": bundle.get("accuracy"),
        "rmse": bundle.get("rmse"),
        "mae": bundle.get("mae"),
        "perModel": bundle.get("perModel"),
        "trainingSamples": bundle.get("trainingSamples"),
        "trainedAt": bundle.get("trainedAt"),
        "selectedModel": bundle.get("selectedModel"),
        "selectedModelDisplay": bundle.get("selectedModelDisplay"),
        "modelTrained": True,
    }


# ── Feature engineering: 19 features ──────────────────────────────────────────
def dew_point(temp_c: float, rh: float) -> float:
    a, b = 17.27, 237.7
    gamma = (a * temp_c / (b + temp_c)) + math.log(max(rh, 1) / 100.0)
    return (b * gamma) / (a - gamma)


def extract_features(row: dict) -> list:
    hour        = float(row.get("hour",              datetime.now().hour)  or 0)
    month       = float(row.get("month",             datetime.now().month) or 1)
    temperature = float(row.get("temperature",       15)   or 15)
    humidity    = float(row.get("humidity",          60)   or 60)
    pressure    = float(row.get("pressure",          1013) or 1013)
    windspeed   = float(row.get("windspeed",         0)    or 0)
    is_raining  = 1.0 if row.get("is_raining_now") else 0.0
    lat         = float(row.get("lat",               0.0)  or 0.0)
    lon         = float(row.get("lon",               37.5) or 37.5)
    elevation   = float(row.get("elevation",         1000) or 1000)
    p_tend      = float(row.get("pressure_tendency", 0)    or 0)

    dp  = dew_point(temperature, humidity)
    dd  = temperature - dp
    rht = humidity * temperature / 100.0
    wrh = windspeed * humidity / 100.0
    m   = int(month)
    lr  = 1.0 if m in {3,4,5}    else 0.0
    sr  = 1.0 if m in {10,11,12} else 0.0

    return [
        temperature, humidity, pressure, windspeed, is_raining, p_tend,
        math.sin(2*math.pi*hour/24),  math.cos(2*math.pi*hour/24),
        math.sin(2*math.pi*month/12), math.cos(2*math.pi*month/12),
        lat, lon, elevation,
        dp, dd, rht, wrh,
        lr, sr,
    ]


FEATURE_NAMES = [
    "temperature","humidity","pressure","windspeed","is_raining_now","pressure_tendency",
    "hour_sin","hour_cos","month_sin","month_cos",
    "lat","lon","elevation",
    "dew_point","dewpoint_depression","rh_temp","wind_rh",
    "long_rains","short_rains",
]


# ── Elevation API ──────────────────────────────────────────────────────────────
def fetch_elevations(pairs):
    if not pairs: return {}
    lats = ",".join(str(round(p[0],6)) for p in pairs)
    lons = ",".join(str(round(p[1],6)) for p in pairs)
    url  = f"https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lons}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent":"FarmPal/4.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
        elevs = data.get("elevation", [])
        return {pairs[i]: float(elevs[i]) for i in range(min(len(pairs), len(elevs)))}
    except Exception as exc:
        log.warning("Elevation fetch failed: %s", exc)
        return {p: 1000.0 for p in pairs}


# ── Model factory ──────────────────────────────────────────────────────────────
def build_models():
    m = {}
    m["lr"] = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(C=0.5, class_weight="balanced",
                                   max_iter=2000, random_state=42)),
    ])
    m["rf"] = RandomForestClassifier(
        n_estimators=300, max_features="sqrt", max_depth=12,
        min_samples_leaf=5, class_weight="balanced",
        n_jobs=-1, random_state=42,
    )
    m["hgb"] = HistGradientBoostingClassifier(
        max_iter=400, learning_rate=0.05, max_depth=6,
        min_samples_leaf=20, l2_regularization=0.1, random_state=42,
    )
    if HAS_XGB:
        m["xgb"] = xgb.XGBClassifier(
            n_estimators=400, learning_rate=0.05, max_depth=6,
            subsample=0.8, colsample_bytree=0.8,
            reg_alpha=0.1, reg_lambda=1.0,
            eval_metric="logloss", random_state=42, verbosity=0, n_jobs=-1,
        )
    return m


def calibrate_models(models, X_cal, y_cal):
    out = {}
    for name, model in models.items():
        try:
            cal = CalibratedClassifierCV(model, method="isotonic", cv="prefit")
            cal.fit(X_cal, y_cal)
            out[name] = cal
        except Exception as exc:
            log.warning("Calibration failed for %s: %s — using uncalibrated", name, exc)
            out[name] = model
    return out


def ensemble_proba(calibrated_models: dict, X: np.ndarray) -> np.ndarray:
    """Soft vote: average calibrated probability across all models."""
    all_p = np.stack([m.predict_proba(X)[:, 1] for m in calibrated_models.values()])
    return all_p.mean(axis=0)


# ── Training data fetch (from DB) ─────────────────────────────────────────────
def _parse_pressure_tendency_from_reasoning(reasoning: str | None) -> float | None:
    """
    Seed rows store pressure_tendency in the reasoning field like:
      "Historical seed v3 p_tend=-1.25"
    Live collected rows compute it via LAG in the training query.
    """
    if not reasoning:
        return None
    m = re.search(r"p_tend=([-\d.]+)", reasoning)
    return float(m.group(1)) if m else None


def _fetch_training_data(max_rows: int = 80_000) -> list[dict]:
    """
    Pull labelled training pairs from weather_data.

    Labels: for each row, the label is whether it rained within 2 hours
    (look at the next row in the same ~0.1° cell by time).

    Key improvements over v3:
    - Location-stratified sampling: sample up to 1500 rows per 0.1° grid cell
      so dense urban cells (Nairobi) don't dominate sparse pastoral cells (Marsabit)
    - Recency weighting: rows from the last 2 years get 3× sampling weight
    - Pressure tendency from stored reasoning field (seed rows) with LAG fallback
    """
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Step 1: get candidate rows with LAG-based pressure tendency + future weathercode
    # The LEAD/LAG window is partitioned by 0.1° cell so we don't leak across locations
    cur.execute("""
        WITH base AS (
            SELECT
                id,
                temperature, humidity, pressure, windspeed, weathercode,
                latitude  AS lat,
                longitude AS lon,
                reasoning,
                created_at,
                EXTRACT(HOUR  FROM created_at AT TIME ZONE 'Africa/Nairobi') AS hour,
                EXTRACT(MONTH FROM created_at AT TIME ZONE 'Africa/Nairobi') AS month,
                (weathercode IN (51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99)) AS is_raining_now,
                -- 2-hour future label (LEAD by 2 hourly rows within same cell)
                LEAD(weathercode, 2) OVER (
                    PARTITION BY ROUND(latitude::numeric,1), ROUND(longitude::numeric,1)
                    ORDER BY created_at
                ) AS future_wc,
                -- 3-hour pressure tendency via LAG (for live collected rows)
                pressure - LAG(pressure, 3, pressure) OVER (
                    PARTITION BY ROUND(latitude::numeric,1), ROUND(longitude::numeric,1)
                    ORDER BY created_at
                ) AS p_tend_lag,
                -- Recency flag: rows from last 2 years
                (created_at > NOW() - INTERVAL '2 years') AS is_recent
            FROM weather_data
            WHERE temperature IS NOT NULL
              AND humidity    IS NOT NULL
              AND pressure    IS NOT NULL
        ),
        labelled AS (
            SELECT *,
                (future_wc IN (51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99)) AS rained_2h
            FROM base
            WHERE future_wc IS NOT NULL
        ),
        -- Location-stratified: cap at 1500 rows per 0.1° cell
        -- Recent rows appear 3× to weight them more heavily
        stratified AS (
            SELECT *,
                ROW_NUMBER() OVER (
                    PARTITION BY ROUND(lat::numeric,1), ROUND(lon::numeric,1)
                    ORDER BY
                        CASE WHEN is_recent THEN RANDOM() * 0.33
                             ELSE RANDOM()
                        END
                ) AS rn
            FROM labelled
        )
        SELECT temperature, humidity, pressure, windspeed,
               lat, lon, hour, month, is_raining_now,
               p_tend_lag, reasoning,
               rained_2h
        FROM stratified
        WHERE rn <= 1500
        ORDER BY RANDOM()
        LIMIT %s
    """, (max_rows,))

    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


# ── Core training function ─────────────────────────────────────────────────────
def _do_train():
    global _train_state
    try:
        log.info("Starting FarmPal v5 training pipeline")
        rows = fetch_training_rows_from_db(os.environ["DATABASE_URL"])
        if len(rows) < 150:
            raise ValueError(
                f"Insufficient training rows ({len(rows)}). Seed history or collect more observations first."
            )
        _train_state["lastResult"] = _train_from_rows(rows, source="database")
        return

        log.info("=== FarmPal Training Pipeline v4 ===")
        rows = _fetch_training_data(max_rows=80_000)
        n    = len(rows)

        if n < 50:
            msg = f"Insufficient training pairs ({n}) — run seed_historical.py first"
            log.warning(msg)
            _train_state["lastResult"] = {"error": msg}
            return

        log.info("Fetched %d labelled pairs from DB", n)

        # Elevation enrichment (batch request to Open-Meteo)
        unique_pairs = list({(round(float(r["lat"]),4), round(float(r["lon"]),4)) for r in rows})
        elev_map     = fetch_elevations(unique_pairs[:500])  # cap at 500 API points

        X_list, y_list = [], []
        for r in rows:
            key  = (round(float(r["lat"]),4), round(float(r["lon"]),4))
            elev = elev_map.get(key, 1000.0)

            # Use stored pressure tendency from seed reasoning if available,
            # otherwise fall back to the LAG-computed value from the query
            p_tend = _parse_pressure_tendency_from_reasoning(r.get("reasoning"))
            if p_tend is None:
                p_tend = float(r.get("p_tend_lag") or 0)

            X_list.append(extract_features({
                "temperature":       float(r["temperature"]),
                "humidity":          float(r["humidity"]),
                "pressure":          float(r["pressure"]),
                "windspeed":         float(r["windspeed"]),
                "is_raining_now":    bool(r["is_raining_now"]),
                "pressure_tendency": p_tend,
                "hour":              float(r["hour"]),
                "month":             float(r["month"]),
                "lat":               float(r["lat"]),
                "lon":               float(r["lon"]),
                "elevation":         elev,
            }))
            y_list.append(1.0 if r["rained_2h"] else 0.0)

        X = np.array(X_list)
        y = np.array(y_list)

        rain_pct = 100 * y.mean()
        log.info("Class balance: rain=%.1f%%  dry=%.1f%%", rain_pct, 100 - rain_pct)

        if len(np.unique(y)) < 2:
            msg = "Need both rain and dry observations — check weathercode distribution"
            log.error(msg)
            _train_state["lastResult"] = {"error": msg}
            return

        # Stratified 70/15/15 split — calibration set separate from test set
        X_tr, X_tmp, y_tr, y_tmp = train_test_split(X, y, test_size=0.30,
                                                     stratify=y, random_state=42)
        X_cal, X_te, y_cal, y_te = train_test_split(X_tmp, y_tmp, test_size=0.50,
                                                     stratify=y_tmp, random_state=42)

        log.info("Split — train=%d  calibrate=%d  test=%d", len(X_tr), len(X_cal), len(X_te))

        # Build and fit models
        models = build_models()
        if HAS_XGB and "xgb" in models:
            neg = (y_tr == 0).sum()
            pos = (y_tr == 1).sum()
            models["xgb"].set_params(scale_pos_weight=neg / max(pos, 1))

        for name, model in models.items():
            log.info("  Fitting %s...", name)
            model.fit(X_tr, y_tr)

        # Calibrate (isotonic regression on held-out calibration set)
        log.info("Calibrating models...")
        calibrated = calibrate_models(models, X_cal, y_cal)

        # Evaluate on test set
        accs, aucs, briers = {}, {}, {}
        for name, model in calibrated.items():
            proba = model.predict_proba(X_te)[:, 1]
            preds = model.predict(X_te)
            accs[name]   = round(float(np.mean(preds == y_te)) * 100, 1)
            aucs[name]   = round(float(roc_auc_score(y_te, proba)), 4)
            briers[name] = round(float(brier_score_loss(y_te, proba)), 4)

        ens_p   = ensemble_proba(calibrated, X_te)
        ens_acc = round(float(np.mean((ens_p >= 0.5) == y_te)) * 100, 1)
        ens_auc = round(float(roc_auc_score(y_te, ens_p)), 4)
        ens_brier = round(float(brier_score_loss(y_te, ens_p)), 4)

        model_names = "+".join(calibrated.keys())
        model_data = {
            "version":         f"v4_{model_names}",
            "trainedAt":       datetime.now(timezone.utc).isoformat(),
            "trainingSamples": n,
            "accuracy":        ens_acc,
            "auc":             ens_auc,
            "brierScore":      ens_brier,
            "rainPercent":     round(rain_pct, 1),
            "perModel": {
                name: {"accuracy": accs[name], "auc": aucs[name], "brier": briers[name]}
                for name in calibrated
            },
            "models":       calibrated,
            "featureNames": FEATURE_NAMES,
        }

        joblib.dump(model_data, MODEL_PATH)
        _invalidate_model_cache()

        log.info("=== Training complete ===")
        log.info("  Ensemble  acc=%.1f%%  auc=%.4f  brier=%.4f", ens_acc, ens_auc, ens_brier)
        for name in calibrated:
            log.info("  %-5s     acc=%.1f%%  auc=%.4f  brier=%.4f",
                     name, accs[name], aucs[name], briers[name])

        result = {
            "trainingSamples": n,
            "accuracy":        ens_acc,
            "auc":             ens_auc,
            "brierScore":      ens_brier,
            "rainPercent":     round(rain_pct, 1),
            "perModel":        model_data["perModel"],
            "version":         model_data["version"],
            "message": (
                f"v4 ensemble trained on {n:,} stratified pairs. "
                f"Accuracy: {ens_acc}%  ROC-AUC: {ens_auc}  Brier: {ens_brier}"
            ),
        }
        _train_state["lastResult"] = result

    except Exception as exc:
        log.exception("Training failed")
        _train_state["lastResult"] = {"error": str(exc)}
    finally:
        _train_state["running"] = False


# ── HTTP endpoints ─────────────────────────────────────────────────────────────

@app.route("/train", methods=["POST"])
def train():
    if _train_state["running"]:
        return jsonify({"status": "already_running"}), 202
    _train_state.update({"running": True, "lastResult": None})
    threading.Thread(target=_do_train, daemon=True).start()
    return jsonify({"status": "accepted",
                    "message": "Training started — poll /train/status"}), 202


@app.route("/train/status", methods=["GET"])
def train_status():
    return jsonify({
        "running":    _train_state["running"],
        "lastResult": _train_state["lastResult"],
    })


@app.route("/predict", methods=["POST"])
def predict():
    """
    Single prediction with full ensemble breakdown.
    Expects JSON matching extract_features() input.
    Returns: probability, confidence_interval, per-model breakdown, version.
    """
    try:
        md = _load_model_cached()
        if md is None:
            return jsonify({
                "error": "No model trained yet - run POST /train",
                "modelTrained": False,
            }), 404

        data = request.get_json(force=True) or {}
        feature_row, _history_frame = _prepare_prediction_request(data)
        result = predict_with_bundle(md, feature_row)[0]
        return jsonify(_serialize_prediction(md, result))

        data = request.get_json(force=True)
        feat = np.array([extract_features(data)])
        md   = _load_model_cached()

        if md is None:
            return jsonify({
                "error":        "No model trained yet — run POST /train",
                "modelTrained": False,
            }), 404

        models    = md["models"]
        per_model = {n: round(float(m.predict_proba(feat)[0, 1]), 4)
                     for n, m in models.items()}
        probs     = list(per_model.values())
        ep        = round(float(np.mean(probs)), 4)
        std       = round(float(np.std(probs)),  4)

        # 68% confidence interval from model disagreement
        ci_low  = round(max(0.0, ep - std), 4)
        ci_high = round(min(1.0, ep + std), 4)

        return jsonify({
            "probability":          ep,
            "calibratedProbability": ep,
            "confidenceInterval":   {"low": ci_low, "high": ci_high},
            "modelAgreement":       round(1.0 - std * 2, 3),
            "modelProbabilities":   per_model,
            "willRain":             ep >= 0.5,
            "version":              md["version"],
            "accuracy":             md["accuracy"],
            "auc":                  md.get("auc"),
            "brierScore":           md.get("brierScore"),
            "perModel":             md.get("perModel", {}),
            "trainingSamples":      md["trainingSamples"],
            "trainedAt":            md["trainedAt"],
            "modelTrained":         True,
        })

    except Exception as exc:
        log.exception("Predict failed")
        return jsonify({"error": str(exc)}), 500


@app.route("/predict_batch", methods=["POST"])
def predict_batch():
    """
    Batch prediction for multi-horizon forecasts.
    Each item should have distinct hour/month/pressure for the target time.
    """
    try:
        md = _load_model_cached()
        if md is None:
            return jsonify({"error": "No model trained yet", "modelTrained": False}), 404

        items = request.get_json(force=True)
        if not isinstance(items, list) or not items:
            return jsonify({"error": "Expected non-empty JSON array"}), 400

        history_cache: dict = {}
        feature_rows = []
        for item in items:
            feature_row, _history_frame = _prepare_prediction_request(item, history_cache=history_cache)
            feature_rows.append(feature_row)

        feature_matrix = pd.concat(feature_rows, ignore_index=True)
        predictions = predict_with_bundle(md, feature_matrix)
        return jsonify({
            "predictions": [
                {
                    "prediction": item["prediction"],
                    "probability": item["probability"],
                    "confidence": item["confidence"],
                    "model_used": item["model_used"],
                    "willRain": item["willRain"],
                    "confidenceInterval": item["confidenceInterval"],
                    "modelAgreement": item["modelAgreement"],
                }
                for item in predictions
            ],
            "accuracy": md.get("accuracy"),
            "rmse": md.get("rmse"),
            "mae": md.get("mae"),
            "version": md.get("version"),
            "modelTrained": True,
        })

        items = request.get_json(force=True)
        if not isinstance(items, list) or not items:
            return jsonify({"error": "Expected non-empty JSON array"}), 400

        md = _load_model_cached()
        if md is None:
            return jsonify({"error": "No model trained yet", "modelTrained": False}), 404

        models = md["models"]
        X      = np.array([extract_features(r) for r in items])

        # Per-model probabilities
        all_p = np.stack([m.predict_proba(X)[:, 1] for m in models.values()])
        ep    = all_p.mean(axis=0)      # ensemble mean
        std   = all_p.std(axis=0)       # model disagreement → uncertainty

        predictions = []
        for i in range(len(items)):
            p   = float(ep[i])
            s   = float(std[i])
            predictions.append({
                "probability":          round(p, 4),
                "willRain":             p >= 0.5,
                "confidenceInterval":   {
                    "low":  round(max(0.0, p - s), 4),
                    "high": round(min(1.0, p + s), 4),
                },
                "modelAgreement":       round(max(0.0, 1.0 - s * 2), 3),
            })

        return jsonify({
            "predictions":  predictions,
            "accuracy":     md["accuracy"],
            "auc":          md.get("auc"),
            "version":      md["version"],
            "modelTrained": True,
        })

    except Exception as exc:
        log.exception("Batch predict failed")
        return jsonify({"error": str(exc)}), 500


@app.route("/feature_importance", methods=["GET"])
def feature_importance():
    md = _load_model_cached()
    if md is None:
        return jsonify({"error": "No model trained yet"}), 404

    result = {}
    names = md.get("featureNames", FEATURE_COLUMNS_V5)
    for model_name, model in md["models"].items():
        estimator = list(model.named_steps.values())[-1] if hasattr(model, "named_steps") else model
        if hasattr(estimator, "feature_importances_"):
            importances = np.asarray(estimator.feature_importances_, dtype=float)
            order = np.argsort(importances)[::-1]
            result[model_name] = [
                {"feature": names[index], "importance": round(float(importances[index]), 6)}
                for index in order
            ]
        elif hasattr(estimator, "coef_"):
            coefficients = np.abs(np.asarray(estimator.coef_, dtype=float).reshape(-1))
            order = np.argsort(coefficients)[::-1]
            result[model_name] = [
                {"feature": names[index], "importance": round(float(coefficients[index]), 6)}
                for index in order
            ]
    return jsonify({"featureImportance": result, "version": md.get("version")})

    result = {}
    names  = md.get("featureNames", FEATURE_NAMES)
    for mname, cal_model in md["models"].items():
        base = cal_model.estimator if hasattr(cal_model, "estimator") else cal_model
        if hasattr(base, "named_steps"):
            base = list(base.named_steps.values())[-1]
        if hasattr(base, "feature_importances_"):
            imps = base.feature_importances_
            result[mname] = [
                {"feature": names[i], "importance": round(float(imps[i]), 5)}
                for i in np.argsort(imps)[::-1]
            ]
        elif hasattr(base, "coef_"):
            coefs = np.abs(base.coef_[0])
            result[mname] = [
                {"feature": names[i], "importance": round(float(coefs[i]), 5)}
                for i in np.argsort(coefs)[::-1]
            ]

    return jsonify({"featureImportance": result, "version": md["version"]})


@app.route("/health", methods=["GET"])
def health():
    md = _load_model_cached()
    return jsonify({
        "status": "ok",
        "model": md is not None,
        "modelVersion": md.get("version") if md else None,
        "trainedAt": md.get("trainedAt") if md else None,
        "accuracy": md.get("accuracy") if md else None,
        "rmse": md.get("rmse") if md else None,
        "mae": md.get("mae") if md else None,
        "selectedModel": md.get("selectedModelDisplay") if md else None,
        "xgboost": md.get("hasXGBoost") if md else HAS_XGB,
        "bootstrapping": _bootstrap_state["running"],
        "training": _train_state["running"],
    })

    return jsonify({
        "status":       "ok",
        "model":        md is not None,
        "modelVersion": md["version"] if md else None,
        "trainedAt":    md.get("trainedAt") if md else None,
        "accuracy":     md.get("accuracy")  if md else None,
        "auc":          md.get("auc")       if md else None,
        "xgboost":      HAS_XGB,
        "bootstrapping": _bootstrap_state["running"],
        "training":      _train_state["running"],
    })


# ── 61 Kenyan farming locations ────────────────────────────────────────────────
KENYA_FARM_LOCATIONS = [
    {"name":"Nakuru",      "lat":-0.3031,"lon":36.0800},
    {"name":"Eldoret",     "lat": 0.5143,"lon":35.2698},
    {"name":"Kericho",     "lat":-0.3686,"lon":35.2864},
    {"name":"Kitale",      "lat": 1.0155,"lon":35.0062},
    {"name":"Narok",       "lat":-1.0769,"lon":35.8710},
    {"name":"Bomet",       "lat":-0.7844,"lon":35.3420},
    {"name":"Iten",        "lat": 0.6704,"lon":35.5083},
    {"name":"Molo",        "lat":-0.2506,"lon":35.7323},
    {"name":"Nandi Hills", "lat": 0.1030,"lon":35.1872},
    {"name":"Sotik",       "lat":-0.6793,"lon":35.1208},
    {"name":"Kabarnet",    "lat": 0.4918,"lon":35.7406},
    {"name":"Kapenguria",  "lat": 1.2393,"lon":35.1128},
    {"name":"Lodwar",      "lat": 3.1193,"lon":35.5966},
    {"name":"Maralal",     "lat": 1.0988,"lon":36.7022},
    {"name":"Kapsabet",    "lat": 0.2027,"lon":35.0993},
    {"name":"Nairobi",     "lat":-1.2921,"lon":36.8219},
    {"name":"Thika",       "lat":-1.0332,"lon":37.0693},
    {"name":"Nyeri",       "lat":-0.4169,"lon":36.9513},
    {"name":"Kerugoya",    "lat":-0.4913,"lon":37.2823},
    {"name":"Muranga",     "lat":-0.7212,"lon":37.1526},
    {"name":"Kiambu",      "lat":-1.1714,"lon":36.8352},
    {"name":"Limuru",      "lat":-1.1163,"lon":36.6413},
    {"name":"Nanyuki",     "lat": 0.0142,"lon":37.0741},
    {"name":"Nyahururu",   "lat": 0.0270,"lon":36.3622},
    {"name":"Ol Kalou",    "lat": 0.2639,"lon":36.3838},
    {"name":"Githunguri",  "lat":-1.0617,"lon":36.7128},
    {"name":"Meru",        "lat": 0.0500,"lon":37.6496},
    {"name":"Chuka",       "lat":-0.3333,"lon":37.6500},
    {"name":"Embu",        "lat":-0.5310,"lon":37.4500},
    {"name":"Machakos",    "lat":-1.5177,"lon":37.2634},
    {"name":"Kitui",       "lat":-1.3666,"lon":38.0123},
    {"name":"Mwingi",      "lat":-0.9310,"lon":38.0648},
    {"name":"Makueni",     "lat":-1.8044,"lon":37.6241},
    {"name":"Kibwezi",     "lat":-2.4063,"lon":37.9521},
    {"name":"Kisumu",      "lat":-0.0917,"lon":34.7679},
    {"name":"Kisii",       "lat":-0.6698,"lon":34.7638},
    {"name":"Kakamega",    "lat": 0.2827,"lon":34.7519},
    {"name":"Bungoma",     "lat": 0.5635,"lon":34.5614},
    {"name":"Busia",       "lat": 0.4604,"lon":34.1115},
    {"name":"Siaya",       "lat": 0.0625,"lon":34.2879},
    {"name":"Vihiga",      "lat": 0.0700,"lon":34.7231},
    {"name":"Migori",      "lat":-1.0634,"lon":34.4731},
    {"name":"Homa Bay",    "lat":-0.5194,"lon":34.4571},
    {"name":"Nyamira",     "lat":-0.5669,"lon":34.9355},
    {"name":"Kajiado",     "lat":-1.8510,"lon":36.7761},
    {"name":"Athi River",  "lat":-1.4522,"lon":36.9786},
    {"name":"Mombasa",     "lat":-4.0435,"lon":39.6682},
    {"name":"Malindi",     "lat":-3.2136,"lon":40.1090},
    {"name":"Kilifi",      "lat":-3.6305,"lon":39.8499},
    {"name":"Kwale",       "lat":-4.1790,"lon":39.4524},
    {"name":"Voi",         "lat":-3.3960,"lon":38.5582},
    {"name":"Lamu",        "lat":-2.2694,"lon":40.9027},
    {"name":"Taita Taveta","lat":-3.3167,"lon":38.3500},
    {"name":"Taveta",      "lat":-3.3963,"lon":37.6856},
    {"name":"Isiolo",      "lat": 0.3539,"lon":37.5828},
    {"name":"Marsabit",    "lat": 2.3313,"lon":37.9927},
    {"name":"Moyale",      "lat": 3.5236,"lon":39.0532},
    {"name":"Garissa",     "lat":-0.4532,"lon":39.6461},
    {"name":"Wajir",       "lat": 1.7471,"lon":40.0573},
    {"name":"Mandera",     "lat": 3.9366,"lon":41.8670},
    {"name":"Hola",        "lat":-1.4806,"lon":40.0305},
]


# ── Historical data fetch (Open-Meteo archive) ─────────────────────────────────
def fetch_historical_location(lat, lon, start_date, end_date, retries=4):
    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&hourly=temperature_2m,relative_humidity_2m,pressure_msl,"
        f"wind_speed_10m,weather_code,precipitation"
        f"&timezone=Africa%2FNairobi"
    )
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "FarmPal/4.0"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < retries - 1:
                wait = 15 * (attempt + 1)
                log.warning("Rate-limited, retrying in %ds", wait)
                _time.sleep(wait)
            else:
                log.warning("HTTP %s for %.4f,%.4f", exc.code, lat, lon)
                return {}
        except Exception as exc:
            log.warning("Fetch failed %.4f,%.4f: %s", lat, lon, exc)
            return {}
    return {}


# ── Full bootstrap (when DB is empty — fetch direct from Open-Meteo) ──────────
def _do_bootstrap(months_back=180):
    """
    Cold-start bootstrap: fetch 15yr from Open-Meteo directly into memory,
    train immediately. Used only when weather_data table is empty.
    Once seed_historical.py has run, _do_train() is used instead.
    """
    end_dt = datetime.now(timezone.utc).date() - timedelta(days=1)
    start_dt = end_dt - timedelta(days=30 * months_back)
    log.info("Starting FarmPal v5 bootstrap: %d months per location", months_back)

    elevation_map = fetch_elevations_v5([(loc["lat"], loc["lon"]) for loc in KENYA_FARM_LOCATIONS])
    rows: list[dict] = []
    locations_ok = 0
    for loc in KENYA_FARM_LOCATIONS:
        frame = fetch_historical_location_frame(
            lat=loc["lat"],
            lon=loc["lon"],
            start_date=start_dt.isoformat(),
            end_date=end_dt.isoformat(),
        )
        if frame.empty:
            log.warning("Bootstrap skipped %s because no history was returned", loc["name"])
            continue

        frame = frame.sort_values("created_at").tail(BOOTSTRAP_ROWS_PER_LOCATION).copy()
        frame["elevation"] = elevation_map.get((loc["lat"], loc["lon"]), 1000.0)
        rows.extend(frame.to_dict("records"))
        locations_ok += 1
        log.info("Bootstrap loaded %s rows for %s", f"{len(frame):,}", loc["name"])
        _time.sleep(0.15)

    if len(rows) < 150:
        raise ValueError(f"Bootstrap produced only {len(rows)} rows.")

    result = _train_from_rows(rows, source="bootstrap")
    result["success"] = True
    result["monthsBack"] = months_back
    result["locationsUsed"] = locations_ok
    _bootstrap_state["lastResult"] = result
    return result

    end_dt     = datetime.now(timezone.utc).date() - timedelta(days=7)
    start_dt   = end_dt - timedelta(days=months_back * 30)
    start_date = start_dt.isoformat()
    end_date   = end_dt.isoformat()
    log.info("Bootstrap: %d months (%s→%s) for %d locations",
             months_back, start_date, end_date, len(KENYA_FARM_LOCATIONS))

    pairs    = [(loc["lat"], loc["lon"]) for loc in KENYA_FARM_LOCATIONS]
    elev_map = fetch_elevations(pairs)
    all_X, all_y = [], []
    locations_ok = 0

    for loc in KENYA_FARM_LOCATIONS:
        lat, lon  = loc["lat"], loc["lon"]
        elevation = elev_map.get((lat, lon), 1000.0)
        data      = fetch_historical_location(lat, lon, start_date, end_date)
        if not data or "hourly" not in data:
            log.warning("  %-15s SKIPPED", loc["name"])
            continue

        h = data["hourly"]
        times = h.get("time", [])
        temps = h.get("temperature_2m", [])
        hums  = h.get("relative_humidity_2m", [])
        press = h.get("pressure_msl", [])
        winds = h.get("wind_speed_10m", [])
        codes = h.get("weather_code", [])

        loc_X, loc_y = [], []
        for i in range(len(times) - 2):
            t, hu, p, w, c = temps[i], hums[i], press[i], winds[i], codes[i]
            if t is None or hu is None or p is None:
                continue
            future_code = codes[i + 2]
            if future_code is None:
                continue
            dt    = datetime.fromisoformat(times[i])
            p_prv = press[i-3] if i >= 3 and press[i-3] is not None else p
            loc_X.append(extract_features({
                "temperature":       float(t),
                "humidity":          float(hu),
                "pressure":          float(p),
                "windspeed":         float(w or 0),
                "is_raining_now":    int(c or 0) in RAIN_CODES,
                "pressure_tendency": float(p) - float(p_prv),
                "hour":  dt.hour,
                "month": dt.month,
                "lat":   lat, "lon": lon,
                "elevation": elevation,
            }))
            loc_y.append(1.0 if int(future_code) in RAIN_CODES else 0.0)

        n_pairs  = len(loc_X)
        rain_pct = 100 * sum(loc_y) / n_pairs if n_pairs else 0
        log.info("  %-15s %8d pairs  rain=%.1f%%  elev=%.0fm",
                 loc["name"], n_pairs, rain_pct, elevation)
        all_X.extend(loc_X)
        all_y.extend(loc_y)
        locations_ok += 1
        _time.sleep(1)

    total = len(all_X)
    if total < 100:
        raise ValueError(f"Insufficient data ({total} pairs from {locations_ok} locations)")

    X = np.array(all_X)
    y = np.array(all_y)
    rain_pct = 100 * y.mean()
    log.info("Bootstrap training on %d pairs (rain=%.1f%%)", total, rain_pct)

    X_tr, X_tmp, y_tr, y_tmp = train_test_split(X, y, test_size=0.30,
                                                 stratify=y, random_state=42)
    X_cal, X_te, y_cal, y_te = train_test_split(X_tmp, y_tmp, test_size=0.50,
                                                 stratify=y_tmp, random_state=42)

    models = build_models()
    if HAS_XGB and "xgb" in models:
        neg = (y_tr == 0).sum()
        pos = (y_tr == 1).sum()
        models["xgb"].set_params(scale_pos_weight=neg / max(pos, 1))

    for name, model in models.items():
        log.info("  Fitting %s...", name)
        model.fit(X_tr, y_tr)

    calibrated = calibrate_models(models, X_cal, y_cal)

    accs, aucs = {}, {}
    for name, model in calibrated.items():
        p = model.predict_proba(X_te)[:, 1]
        accs[name] = round(float(np.mean(model.predict(X_te) == y_te)) * 100, 1)
        aucs[name] = round(float(roc_auc_score(y_te, p)), 4)

    ens_p   = ensemble_proba(calibrated, X_te)
    ens_acc = round(float(np.mean((ens_p >= 0.5) == y_te)) * 100, 1)
    ens_auc = round(float(roc_auc_score(y_te, ens_p)), 4)

    model_names = "+".join(calibrated.keys())
    model_data = {
        "version":         f"v4_bootstrap_{model_names}",
        "trainedAt":       datetime.now(timezone.utc).isoformat(),
        "trainingSamples": total,
        "accuracy":        ens_acc,
        "auc":             ens_auc,
        "rainPercent":     round(rain_pct, 1),
        "perModel": {n: {"accuracy": accs[n], "auc": aucs[n]} for n in calibrated},
        "models":          calibrated,
        "featureNames":    FEATURE_NAMES,
    }
    joblib.dump(model_data, MODEL_PATH)
    _invalidate_model_cache()
    log.info("Bootstrap saved → acc=%.1f%%  auc=%.4f", ens_acc, ens_auc)

    result = {
        "success": True, "trainingSamples": total, "locationsUsed": locations_ok,
        "rainPercent": round(rain_pct, 1), "accuracy": ens_acc, "auc": ens_auc,
        "perModel": model_data["perModel"], "monthsBack": months_back,
        "message": (
            f"v4 bootstrap: {total:,} pairs, {locations_ok} locations, "
            f"{months_back}mo. Acc:{ens_acc}% AUC:{ens_auc}"
        ),
    }
    _bootstrap_state["lastResult"] = result
    return result


@app.route("/start_bootstrap", methods=["POST"])
def start_bootstrap():
    if _bootstrap_state["running"]:
        return jsonify({"started": False, "message": "Bootstrap already in progress"})
    body = request.get_json(force=True) or {}
    months_back = int(body.get("monthsBack", DEFAULT_BOOTSTRAP_MONTHS))

    def _run():
        _bootstrap_state["running"] = True
        try:
            _do_bootstrap(months_back)
        finally:
            _bootstrap_state["running"] = False

    threading.Thread(target=_run, daemon=True).start()
    return jsonify({
        "started": True, "monthsBack": months_back,
        "locations": len(KENYA_FARM_LOCATIONS),
        "message": f"Bootstrap started ({months_back} months). Poll /health.",
    })


@app.route("/bootstrap", methods=["POST"])
def bootstrap():
    if _bootstrap_state["running"]:
        return jsonify({"message": "Bootstrap already running", "status": "running"}), 202
    body = request.get_json(force=True) or {}
    months_back = int(body.get("monthsBack", DEFAULT_BOOTSTRAP_MONTHS))

    def _run():
        _bootstrap_state["running"] = True
        try:
            _do_bootstrap(months_back)
        except Exception as exc:
            log.exception("Bootstrap failed")
            _bootstrap_state["lastResult"] = {"error": str(exc)}
        finally:
            _bootstrap_state["running"] = False

    threading.Thread(target=_run, daemon=True).start()
    return jsonify({
        "message": "Bootstrap started", "monthsBack": months_back, "status": "running"
    }), 202


@app.route("/bootstrap_location", methods=["POST"])
def bootstrap_location():
    """
    Per-location bootstrap: fetch 2 years of data for a newly-added farm
    and insert it into the DB for the next scheduled retrain window.
    """
    body = request.get_json(force=True) or {}
    lat  = float(body.get("lat", 0))
    lon  = float(body.get("lon", 0))
    name = str(body.get("name", f"Farm {lat:.3f},{lon:.3f}"))
    months_back = int(body.get("months_back", 24))

    def _do():
        try:
            frame = fetch_historical_location_frame(
                lat=lat,
                lon=lon,
                start_date=(datetime.now(timezone.utc).date() - timedelta(days=30 * months_back)).isoformat(),
                end_date=(datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat(),
            )
            if frame.empty:
                log.warning("No data for %s", name)
                return

            elevation = fetch_elevations_v5([(lat, lon)]).get((lat, lon), 1000.0)
            frame = frame.sort_values("created_at").copy()
            frame["pressure_tendency"] = frame["pressure"].astype(float) - frame["pressure"].astype(float).shift(3).fillna(
                frame["pressure"].astype(float)
            )

            rows = []
            for _, item in frame.iterrows():
                weathercode = int(item.get("weathercode", 0) or 0)
                precipitation = float(item.get("precipitation_mm", 0.0) or 0.0)
                rows.append(
                    (
                        lat,
                        lon,
                        float(item["temperature"]),
                        float(item["windspeed"]),
                        float(item["humidity"]),
                        float(item["pressure"]),
                        weathercode,
                        "rain" if weathercode in RAIN_CODES_V5 else "no_rain",
                        0.75,
                        f"Bootstrap loc v5 p_tend={float(item['pressure_tendency']):.2f} precip={precipitation:.2f} elev={elevation:.1f}",
                        pd.to_datetime(item["created_at"], utc=True).to_pydatetime(),
                    )
                )

            if not rows:
                log.warning("No rows to insert for %s", name)
                return

            conn = get_db()
            with conn.cursor() as cur:
                psycopg2.extras.execute_values(
                    cur,
                    """
                        INSERT INTO weather_data (
                            latitude, longitude, temperature, windspeed, humidity,
                            pressure, weathercode, prediction, confidence, reasoning, created_at
                        ) VALUES %s
                    """,
                    rows,
                    page_size=2000,
                )
            conn.commit()
            conn.close()
            log.info("Location bootstrap inserted %d rows for %s", len(rows), name)
            return

            import psycopg2 as _pg2
            conn = get_db()
            elev_map  = fetch_elevations([(lat, lon)])
            elevation = elev_map.get((lat, lon), 1000.0)
            end_dt    = datetime.now(timezone.utc).date() - timedelta(days=7)
            start_dt  = end_dt - timedelta(days=30 * months_back)
            data      = fetch_historical_location(lat, lon,
                                                  start_dt.isoformat(),
                                                  end_dt.isoformat())
            if not data or "hourly" not in data:
                log.warning("No data for %s", name)
                conn.close()
                return

            h = data["hourly"]
            times = h.get("time", []);  temps = h.get("temperature_2m", [])
            hums  = h.get("relative_humidity_2m", [])
            press = h.get("pressure_msl", [])
            winds = h.get("wind_speed_10m", []); codes = h.get("weather_code", [])

            rows = []
            for i, ts in enumerate(times):
                t, hu, p = temps[i], hums[i], press[i]
                if t is None or hu is None or p is None:
                    continue
                c = int(codes[i] or 0)
                w = float(winds[i] or 0)
                p_prv = press[i-3] if i >= 3 and press[i-3] is not None else p
                p_tend = round(float(p) - float(p_prv), 2)
                label  = "rain" if c in RAIN_CODES else "no_rain"
                rows.append((
                    lat, lon, float(t), w, float(hu), float(p), c,
                    label, 0.75,
                    f"Bootstrap loc v4 p_tend={p_tend}",
                    datetime.fromisoformat(ts).replace(tzinfo=timezone.utc),
                ))

            if not rows:
                log.warning("No rows to insert for %s", name)
                conn.close()
                return

            BATCH = 2000
            with conn.cursor() as cur:
                for i in range(0, len(rows), BATCH):
                    batch = rows[i:i+BATCH]
                    args  = b",".join(
                        cur.mogrify(
                            "(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", r
                        ) for r in batch
                    )
                    cur.execute(
                        b"INSERT INTO weather_data "
                        b"(latitude,longitude,temperature,windspeed,humidity,"
                        b"pressure,weathercode,prediction,confidence,reasoning,created_at) "
                        b"VALUES " + args
                    )
            conn.commit()
            conn.close()
            log.info("Location bootstrap inserted %d rows for %s", len(rows), name)

            # Do not retrain immediately per farm add.
            # The scheduler will incorporate this new location data during the
            # next background retrain window, which keeps request-driven flows fast.

        except Exception as exc:
            log.exception("Location bootstrap failed for %s", name)

    threading.Thread(target=_do, daemon=True).start()
    return jsonify({"status": "bootstrap_started", "location": name, "lat": lat, "lon": lon})


@app.route("/_legacy_train_sync", methods=["POST"])
def _legacy_train():
    _do_train()
    return jsonify(_train_state["lastResult"] or {"error": "Train did not complete"})


# ── Cold-start auto-bootstrap ──────────────────────────────────────────────────
def _count_db_rows() -> int:
    try:
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM weather_data")
        n = cur.fetchone()[0]
        cur.close(); conn.close()
        return int(n)
    except Exception as exc:
        log.warning("Could not count DB rows: %s", exc)
        return 0


def _auto_bootstrap_on_start():
    md = _load_model_cached()
    if md is not None and str(md.get("version", "")).startswith("v5"):
        log.info(
            "Model exists: v=%s rmse=%.4f mae=%.4f selected=%s",
            md.get("version", "?"),
            float(md.get("rmse", 0.0)),
            float(md.get("mae", 0.0)),
            md.get("selectedModelDisplay", md.get("selectedModel", "?")),
        )
        return
    if md is not None:
        log.info("Existing model %s is legacy; triggering v5 retraining.", md.get("version", "?"))

    db_rows = _count_db_rows()
    log.info("Startup check found %d rows in weather_data", db_rows)

    if db_rows >= 1_000:
        _train_state["running"] = True
        try:
            _do_train()
        finally:
            _train_state["running"] = False
    else:
        _bootstrap_state["running"] = True
        try:
            _do_bootstrap(DEFAULT_BOOTSTRAP_MONTHS)
        finally:
            _bootstrap_state["running"] = False
    return

    if os.path.exists(MODEL_PATH):
        md = _load_model_cached()
        log.info("Model exists: v=%s  acc=%.1f%%  auc=%.4f",
                 md.get("version","?") if md else "?",
                 md.get("accuracy", 0) if md else 0,
                 md.get("auc", 0)      if md else 0)
        return

    db_rows = _count_db_rows()
    log.info("Auto-bootstrap: %d rows in weather_data", db_rows)

    if db_rows >= 1_000:
        log.info("Training from %d DB rows", db_rows)
        _train_state["running"] = True
        try:
            _do_train()
        except Exception as exc:
            log.error("Auto-train from DB failed: %s", exc)
        finally:
            _train_state["running"] = False
    else:
        log.info("DB empty — running full 15-year bootstrap")
        _bootstrap_state["running"] = True
        try:
            _do_bootstrap(180)
        except Exception as exc:
            log.error("Auto-bootstrap failed: %s", exc)
        finally:
            _bootstrap_state["running"] = False


if __name__ == "__main__":
    port = int(os.environ.get("ML_SERVICE_PORT", 5000))
    import subprocess, sys as _sys
    gunicorn_bin = os.path.join(os.path.dirname(_sys.executable), "gunicorn")
    if not os.path.exists(gunicorn_bin):
        gunicorn_bin = "gunicorn"
    subprocess.run([
        gunicorn_bin, "--workers", "1", "--threads", "4",
        "--bind", f"0.0.0.0:{port}", "--timeout", "600",
        "--log-level", "info", "app:app",
    ], cwd=os.path.dirname(os.path.abspath(__file__)))


# ── Startup: run auto-bootstrap in background thread when module loads ────────
# This works under both gunicorn (module-level execution) and direct python.
# We delay 3 seconds so the Flask server is fully bound before training begins.
def _startup():
    _time.sleep(3)
    _auto_bootstrap_on_start()

threading.Thread(target=_startup, daemon=True).start()
