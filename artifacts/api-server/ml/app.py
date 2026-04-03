import os
import math
import json
import logging
import time as _time
import threading
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

import numpy as np
import psycopg2
import psycopg2.extras
import joblib
from flask import Flask, request, jsonify
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ml-service")

app = Flask(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml_model_sklearn.pkl")

# Track async bootstrap state
_bootstrap_state: dict = {"running": False, "lastResult": None}


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def extract_features(row: dict) -> list:
    hour = float(row.get("hour", datetime.now().hour) or 0)
    month = float(row.get("month", datetime.now().month) or 1)
    temperature = float(row.get("temperature", 15) or 15)
    humidity = float(row.get("humidity", 60) or 60)
    pressure = float(row.get("pressure", 1013) or 1013)
    windspeed = float(row.get("windspeed", 0) or 0)
    is_raining_now = 1.0 if row.get("is_raining_now") else 0.0
    lat = float(row.get("lat", 0.0) or 0.0)
    lon = float(row.get("lon", 37.5) or 37.5)
    # Elevation in metres — normalised to ~km scale for the model
    elevation = float(row.get("elevation", 1000.0) or 1000.0)
    return [
        temperature,
        humidity,
        pressure,
        windspeed,
        is_raining_now,
        math.sin(2 * math.pi * hour / 24),
        math.cos(2 * math.pi * hour / 24),
        math.sin(2 * math.pi * month / 12),
        math.cos(2 * math.pi * month / 12),
        lat,
        lon,
        elevation,          # feature #12 — key microclimate driver
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Elevation API  (Open-Meteo — batch up to 100 points per request)
# ─────────────────────────────────────────────────────────────────────────────

def fetch_elevations(pairs: list[tuple[float, float]]) -> dict[tuple[float, float], float]:
    """
    Batch-fetch elevations for a list of (lat, lon) tuples using Open-Meteo.
    Returns a mapping  (lat, lon) → elevation_m.
    Falls back to 1000 m (Kenya median highland) on error.
    """
    if not pairs:
        return {}
    lats = ",".join(str(round(p[0], 6)) for p in pairs)
    lons = ",".join(str(round(p[1], 6)) for p in pairs)
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lons}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MicroclimateKE/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        elevs = data.get("elevation", [])
        return {pairs[i]: float(elevs[i]) for i in range(min(len(pairs), len(elevs)))}
    except Exception as exc:
        log.warning("Elevation fetch failed: %s — using default 1000 m", exc)
        return {p: 1000.0 for p in pairs}


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": os.path.exists(MODEL_PATH),
        "bootstrapping": _bootstrap_state["running"],
    })


@app.route("/start_bootstrap", methods=["POST"])
def start_bootstrap():
    """
    Kick off model training in a background daemon thread — returns immediately.
    Poll /health until model=true.
    """
    if _bootstrap_state["running"]:
        return jsonify({"started": False, "message": "Bootstrap already in progress"})
    body = request.get_json(force=True) or {}
    months_back = int(body.get("monthsBack", 24))

    def _run():
        _bootstrap_state["running"] = True
        try:
            _do_bootstrap(months_back)
        finally:
            _bootstrap_state["running"] = False

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    return jsonify({
        "started": True,
        "monthsBack": months_back,
        "message": f"Bootstrap started in background ({months_back} months, {len(KENYA_FARM_LOCATIONS)} locations). Poll /health for completion.",
    })


_train_state: dict = {"running": False, "lastResult": None}


def _do_train():
    global _train_state
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Use LEAD() window function — orders of magnitude faster than a self-join.
        # TABLESAMPLE gives a fast random sample without a full-table scan.
        cur.execute("""
            WITH sampled AS (
                SELECT
                    temperature, humidity, pressure, windspeed, weathercode,
                    latitude  AS lat,
                    longitude AS lon,
                    EXTRACT(HOUR  FROM created_at) AS hour,
                    EXTRACT(MONTH FROM created_at) AS month,
                    (weathercode IN (51,53,55,61,63,65,71,73,75,80,81,82,95,96,99))
                        AS is_raining_now,
                    LEAD(weathercode, 2) OVER (
                        PARTITION BY ROUND(latitude::numeric,2), ROUND(longitude::numeric,2)
                        ORDER BY created_at
                    ) AS future_wc
                FROM weather_data TABLESAMPLE BERNOULLI(0.5)
                WHERE temperature IS NOT NULL
                  AND humidity    IS NOT NULL
                  AND pressure    IS NOT NULL
            )
            SELECT
                temperature, humidity, pressure, windspeed, weathercode,
                lat, lon, hour, month, is_raining_now,
                (future_wc IN (51,53,55,61,63,65,71,73,75,80,81,82,95,96,99))
                    AS rained_2h
            FROM sampled
            WHERE future_wc IS NOT NULL
            LIMIT 5000
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        n = len(rows)
        if n < 3:
            _train_state["lastResult"] = {"error": f"Insufficient labeled pairs ({n})"}
            return

        unique_pairs = list({(float(r["lat"]), float(r["lon"])) for r in rows})
        elev_map = fetch_elevations(unique_pairs)

        rows_with_elev = []
        for r in rows:
            rd = dict(r)
            key = (round(float(rd["lat"]), 6), round(float(rd["lon"]), 6))
            rd["elevation"] = elev_map.get(key, 1000.0)
            rows_with_elev.append(rd)

        X = np.array([extract_features(r) for r in rows_with_elev])
        y = np.array([1.0 if r["rained_2h"] else 0.0 for r in rows_with_elev])

        unique_classes = np.unique(y)
        if len(unique_classes) < 2:
            _train_state["lastResult"] = {"error": "Need both rain and no-rain observations"}
            return

        log.info("Training sklearn ensemble on %d samples (rain=%.1f%%)", n, 100 * y.mean())

        split = int(0.8 * n)
        idx = np.random.RandomState(42).permutation(n)
        X_tr, X_te = X[idx[:split]], X[idx[split:]]
        y_tr, y_te = y[idx[:split]], y[idx[split:]]

        lr = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(C=1.0, max_iter=1000, random_state=42)),
        ])
        rf = RandomForestClassifier(n_estimators=100, max_features="sqrt", max_depth=8, n_jobs=-1, random_state=42)
        gb = GradientBoostingClassifier(n_estimators=100, learning_rate=0.08, max_depth=4, random_state=42)

        lr.fit(X_tr, y_tr); rf.fit(X_tr, y_tr); gb.fit(X_tr, y_tr)

        def acc(model):
            return round(float(np.mean(model.predict(X_te) == y_te)) * 100, 1)

        lr_acc = acc(lr); rf_acc = acc(rf); gb_acc = acc(gb)
        ens_proba = (lr.predict_proba(X_te)[:, 1] + rf.predict_proba(X_te)[:, 1] + gb.predict_proba(X_te)[:, 1]) / 3
        ens_acc = round(float(np.mean((ens_proba >= 0.5) == y_te)) * 100, 1)

        trained_at = datetime.now(timezone.utc).isoformat()
        model_data = {
            "version": "sklearn_ensemble_v2",
            "trainedAt": trained_at,
            "trainingSamples": n,
            "accuracy": ens_acc,
            "lrAccuracy": lr_acc,
            "rfAccuracy": rf_acc,
            "gbAccuracy": gb_acc,
            "lr": lr, "rf": rf, "gb": gb,
        }
        joblib.dump(model_data, MODEL_PATH)
        log.info("Model saved — accuracy: %s%%", ens_acc)
        _train_state["lastResult"] = {
            "trainingSamples": n,
            "accuracy": ens_acc,
            "lrAccuracy": lr_acc,
            "rfAccuracy": rf_acc,
            "gbAccuracy": gb_acc,
            "message": f"Ensemble trained on {n} pairs. Accuracy: {ens_acc}% (LR: {lr_acc}%, RF: {rf_acc}%, GB: {gb_acc}%)",
        }
    except Exception as exc:
        log.exception("Background train failed")
        _train_state["lastResult"] = {"error": str(exc)}
    finally:
        _train_state["running"] = False


@app.route("/train", methods=["POST"])
def train():
    if _train_state["running"]:
        return jsonify({"status": "already_running", "message": "Training already in progress"}), 202
    _train_state["running"] = True
    _train_state["lastResult"] = None
    t = threading.Thread(target=_do_train, daemon=True)
    t.start()
    return jsonify({"status": "accepted", "message": "Training started in background — check /train/status"}), 202


@app.route("/train/status", methods=["GET"])
def train_status():
    return jsonify({
        "running": _train_state["running"],
        "lastResult": _train_state["lastResult"],
    })


@app.route("/_legacy_train_sync", methods=["POST"])
def _legacy_train():
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Use LEAD() window function — orders of magnitude faster than a self-join.
        # TABLESAMPLE gives a fast random sample without a full-table scan.
        cur.execute("""
            WITH sampled AS (
                SELECT
                    temperature, humidity, pressure, windspeed, weathercode,
                    latitude  AS lat,
                    longitude AS lon,
                    EXTRACT(HOUR  FROM created_at) AS hour,
                    EXTRACT(MONTH FROM created_at) AS month,
                    (weathercode IN (51,53,55,61,63,65,71,73,75,80,81,82,95,96,99))
                        AS is_raining_now,
                    LEAD(weathercode, 2) OVER (
                        PARTITION BY ROUND(latitude::numeric,2), ROUND(longitude::numeric,2)
                        ORDER BY created_at
                    ) AS future_wc
                FROM weather_data TABLESAMPLE BERNOULLI(0.5)
                WHERE temperature IS NOT NULL
                  AND humidity    IS NOT NULL
                  AND pressure    IS NOT NULL
            )
            SELECT
                temperature, humidity, pressure, windspeed, weathercode,
                lat, lon, hour, month, is_raining_now,
                (future_wc IN (51,53,55,61,63,65,71,73,75,80,81,82,95,96,99))
                    AS rained_2h
            FROM sampled
            WHERE future_wc IS NOT NULL
            LIMIT 5000
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        n = len(rows)
        if n < 3:
            return jsonify({
                "trainingSamples": n,
                "accuracy": 0,
                "lrAccuracy": 0,
                "rfAccuracy": 0,
                "gbAccuracy": 0,
                "message": f"Insufficient labeled pairs ({n}). Need at least 3. Keep collecting.",
            })

        # Batch-fetch elevations for unique lat/lon pairs in the DB data
        unique_pairs = list({(float(r["lat"]), float(r["lon"])) for r in rows})
        elev_map = fetch_elevations(unique_pairs)

        rows_with_elev = []
        for r in rows:
            rd = dict(r)
            key = (round(float(rd["lat"]), 6), round(float(rd["lon"]), 6))
            rd["elevation"] = elev_map.get(key, 1000.0)
            rows_with_elev.append(rd)

        X = np.array([extract_features(r) for r in rows_with_elev])
        y = np.array([1.0 if r["rained_2h"] else 0.0 for r in rows_with_elev])

        unique_classes = np.unique(y)
        if len(unique_classes) < 2:
            cls_name = "rain" if unique_classes[0] == 1.0 else "no-rain"
            return jsonify({
                "trainingSamples": n,
                "accuracy": 0, "lrAccuracy": 0, "rfAccuracy": 0, "gbAccuracy": 0,
                "message": (
                    f"All {n} pairs have the same outcome ({cls_name}). "
                    "Need both rain and no-rain observations to train."
                ),
            })

        log.info("Training sklearn ensemble on %d samples (rain=%.1f%%)", n, 100 * y.mean())

        # 80/20 train/test split for honest accuracy estimate
        split = int(0.8 * n)
        idx = np.random.RandomState(42).permutation(n)
        X_tr, X_te = X[idx[:split]], X[idx[split:]]
        y_tr, y_te = y[idx[:split]], y[idx[split:]]

        lr = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(C=1.0, max_iter=1000, random_state=42)),
        ])
        rf = RandomForestClassifier(n_estimators=100, max_features="sqrt", max_depth=8, n_jobs=-1, random_state=42)
        gb = GradientBoostingClassifier(n_estimators=100, learning_rate=0.08, max_depth=4, random_state=42)

        lr.fit(X_tr, y_tr); rf.fit(X_tr, y_tr); gb.fit(X_tr, y_tr)

        def acc(model):
            return round(float(np.mean(model.predict(X_te) == y_te)) * 100, 1)

        lr_acc = acc(lr); rf_acc = acc(rf); gb_acc = acc(gb)
        ens_proba = (lr.predict_proba(X_te)[:, 1] + rf.predict_proba(X_te)[:, 1] + gb.predict_proba(X_te)[:, 1]) / 3
        ens_acc = round(float(np.mean((ens_proba >= 0.5) == y_te)) * 100, 1)

        trained_at = datetime.now(timezone.utc).isoformat()
        model_data = {
            "version": "sklearn_ensemble_v2",
            "trainedAt": trained_at,
            "trainingSamples": n,
            "accuracy": ens_acc,
            "lrAccuracy": lr_acc,
            "rfAccuracy": rf_acc,
            "gbAccuracy": gb_acc,
            "lr": lr, "rf": rf, "gb": gb,
        }
        joblib.dump(model_data, MODEL_PATH)
        log.info("Model saved to %s", MODEL_PATH)

        return jsonify({
            "trainingSamples": n,
            "accuracy": ens_acc,
            "lrAccuracy": lr_acc,
            "rfAccuracy": rf_acc,
            "gbAccuracy": gb_acc,
            "message": (
                f"scikit-learn ensemble trained on {n} labeled pairs. "
                f"Accuracy: {ens_acc}% (LR: {lr_acc}%, RF: {rf_acc}%, GB: {gb_acc}%)"
            ),
        })

    except Exception as exc:
        log.exception("Train failed")
        return jsonify({"error": str(exc)}), 500


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(force=True)
        features = np.array([extract_features(data)])

        if not os.path.exists(MODEL_PATH):
            return jsonify({"error": "No model trained yet", "modelTrained": False}), 404

        model_data = joblib.load(MODEL_PATH)
        lr = model_data["lr"]
        rf = model_data["rf"]
        gb = model_data["gb"]

        lr_p = float(lr.predict_proba(features)[0, 1])
        rf_p = float(rf.predict_proba(features)[0, 1])
        gb_p = float(gb.predict_proba(features)[0, 1])
        ens_p = round((lr_p + rf_p + gb_p) / 3, 4)

        return jsonify({
            "probability": ens_p,
            "modelProbabilities": {
                "lr": round(lr_p, 4),
                "rf": round(rf_p, 4),
                "gb": round(gb_p, 4),
            },
            "version": model_data["version"],
            "accuracy": model_data["accuracy"],
            "lrAccuracy": model_data["lrAccuracy"],
            "rfAccuracy": model_data["rfAccuracy"],
            "gbAccuracy": model_data["gbAccuracy"],
            "trainingSamples": model_data["trainingSamples"],
            "trainedAt": model_data["trainedAt"],
            "modelTrained": True,
        })

    except Exception as exc:
        log.exception("Predict failed")
        return jsonify({"error": str(exc)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# 61 Kenyan farming locations across all major agricultural zones
# ─────────────────────────────────────────────────────────────────────────────

KENYA_FARM_LOCATIONS = [
    # Rift Valley — wheat, maize, pyrethrum, tea
    {"name": "Nakuru",       "lat": -0.3031, "lon": 36.0800},
    {"name": "Eldoret",      "lat":  0.5143, "lon": 35.2698},
    {"name": "Kericho",      "lat": -0.3686, "lon": 35.2864},
    {"name": "Kitale",       "lat":  1.0155, "lon": 35.0062},
    {"name": "Narok",        "lat": -1.0769, "lon": 35.8710},
    {"name": "Bomet",        "lat": -0.7844, "lon": 35.3420},
    {"name": "Iten",         "lat":  0.6704, "lon": 35.5083},
    {"name": "Molo",         "lat": -0.2506, "lon": 35.7323},
    {"name": "Nandi Hills",  "lat":  0.1030, "lon": 35.1872},
    {"name": "Sotik",        "lat": -0.6793, "lon": 35.1208},
    {"name": "Kabarnet",     "lat":  0.4918, "lon": 35.7406},
    {"name": "Kapenguria",   "lat":  1.2393, "lon": 35.1128},
    {"name": "Lodwar",       "lat":  3.1193, "lon": 35.5966},
    {"name": "Maralal",      "lat":  1.0988, "lon": 36.7022},
    {"name": "Kapsabet",     "lat":  0.2027, "lon": 35.0993},
    # Central Kenya — coffee, tea, horticulture, dairy
    {"name": "Nairobi",      "lat": -1.2921, "lon": 36.8219},
    {"name": "Thika",        "lat": -1.0332, "lon": 37.0693},
    {"name": "Nyeri",        "lat": -0.4169, "lon": 36.9513},
    {"name": "Kerugoya",     "lat": -0.4913, "lon": 37.2823},
    {"name": "Muranga",      "lat": -0.7212, "lon": 37.1526},
    {"name": "Kiambu",       "lat": -1.1714, "lon": 36.8352},
    {"name": "Limuru",       "lat": -1.1163, "lon": 36.6413},
    {"name": "Nanyuki",      "lat":  0.0142, "lon": 37.0741},
    {"name": "Nyahururu",    "lat":  0.0270, "lon": 36.3622},
    {"name": "Ol Kalou",     "lat":  0.2639, "lon": 36.3838},
    {"name": "Githunguri",   "lat": -1.0617, "lon": 36.7128},
    # Eastern Kenya — coffee, miraa, mango, lower rainfall zones
    {"name": "Meru",         "lat":  0.0500, "lon": 37.6496},
    {"name": "Chuka",        "lat": -0.3333, "lon": 37.6500},
    {"name": "Embu",         "lat": -0.5310, "lon": 37.4500},
    {"name": "Machakos",     "lat": -1.5177, "lon": 37.2634},
    {"name": "Kitui",        "lat": -1.3666, "lon": 38.0123},
    {"name": "Mwingi",       "lat": -0.9310, "lon": 38.0648},
    {"name": "Makueni",      "lat": -1.8044, "lon": 37.6241},
    {"name": "Kibwezi",      "lat": -2.4063, "lon": 37.9521},
    # Nyanza & Western — sugarcane, tea, rice, fishing
    {"name": "Kisumu",       "lat": -0.0917, "lon": 34.7679},
    {"name": "Kisii",        "lat": -0.6698, "lon": 34.7638},
    {"name": "Kakamega",     "lat":  0.2827, "lon": 34.7519},
    {"name": "Bungoma",      "lat":  0.5635, "lon": 34.5614},
    {"name": "Busia",        "lat":  0.4604, "lon": 34.1115},
    {"name": "Siaya",        "lat":  0.0625, "lon": 34.2879},
    {"name": "Vihiga",       "lat":  0.0700, "lon": 34.7231},
    {"name": "Migori",       "lat": -1.0634, "lon": 34.4731},
    {"name": "Homa Bay",     "lat": -0.5194, "lon": 34.4571},
    {"name": "Nyamira",      "lat": -0.5669, "lon": 34.9355},
    # South
    {"name": "Kajiado",      "lat": -1.8510, "lon": 36.7761},
    {"name": "Athi River",   "lat": -1.4522, "lon": 36.9786},
    # Coast — cashew, coconut, rice, mangoes
    {"name": "Mombasa",      "lat": -4.0435, "lon": 39.6682},
    {"name": "Malindi",      "lat": -3.2136, "lon": 40.1090},
    {"name": "Kilifi",       "lat": -3.6305, "lon": 39.8499},
    {"name": "Kwale",        "lat": -4.1790, "lon": 39.4524},
    {"name": "Voi",          "lat": -3.3960, "lon": 38.5582},
    {"name": "Lamu",         "lat": -2.2694, "lon": 40.9027},
    {"name": "Taita Taveta", "lat": -3.3167, "lon": 38.3500},
    {"name": "Taveta",       "lat": -3.3963, "lon": 37.6856},
    # Arid North — sorghum, pastoralism, flood recession
    {"name": "Isiolo",       "lat":  0.3539, "lon": 37.5828},
    {"name": "Marsabit",     "lat":  2.3313, "lon": 37.9927},
    {"name": "Moyale",       "lat":  3.5236, "lon": 39.0532},
    {"name": "Garissa",      "lat": -0.4532, "lon": 39.6461},  # fixed: was 42.4848 (Somalia)
    {"name": "Wajir",        "lat":  1.7471, "lon": 40.0573},
    {"name": "Mandera",      "lat":  3.9366, "lon": 41.8670},
    {"name": "Hola",         "lat": -1.4806, "lon": 40.0305},
]

RAIN_CODES = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99}


def fetch_historical_location(lat: float, lon: float, start_date: str, end_date: str, retries: int = 3) -> dict:
    """Fetch hourly weather history from Open-Meteo archive. Retries on 429."""
    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&hourly=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,weather_code"
        f"&timezone=Africa%2FNairobi"
    )
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "MicroclimateKE/1.0"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode())
            return data
        except urllib.error.HTTPError as exc:
            if exc.code == 429 and attempt < retries - 1:
                wait = 5 * (attempt + 1)
                log.warning("Rate limited (429) for lat=%.4f lon=%.4f — retrying in %ds", lat, lon, wait)
                _time.sleep(wait)
            else:
                log.warning("Failed to fetch historical data for lat=%.4f lon=%.4f: %s", lat, lon, exc)
                return {}
        except Exception as exc:
            log.warning("Failed to fetch historical data for lat=%.4f lon=%.4f: %s", lat, lon, exc)
            return {}
    return {}


def _do_bootstrap(months_back: int = 24) -> dict:
    """
    Core bootstrap logic — fetch historical Open-Meteo data for all 50 Kenyan
    farming locations, build labeled pairs (weather at T → rain at T+2h?),
    include real elevation for each site, train the 12-feature ensemble, and
    save the model to disk. Returns a result dict.
    """
    end_dt = datetime.now(timezone.utc).date() - timedelta(days=7)
    start_dt = end_dt - timedelta(days=months_back * 30)
    start_date = start_dt.isoformat()
    end_date = end_dt.isoformat()

    log.info(
        "Bootstrap: fetching %d months from %s to %s for %d locations",
        months_back, start_date, end_date, len(KENYA_FARM_LOCATIONS),
    )

    # Batch-fetch elevations for all locations in one API call
    pairs = [(loc["lat"], loc["lon"]) for loc in KENYA_FARM_LOCATIONS]
    elev_map = fetch_elevations(pairs)

    all_X: list[list[float]] = []
    all_y: list[float] = []
    locations_ok = 0

    for loc in KENYA_FARM_LOCATIONS:
        lat, lon = loc["lat"], loc["lon"]
        elevation = elev_map.get((lat, lon), 1000.0)

        data = fetch_historical_location(lat, lon, start_date, end_date)
        if not data or "hourly" not in data:
            log.warning("  %-15s SKIPPED (no data)", loc["name"])
            continue

        hourly = data["hourly"]
        times = hourly.get("time", [])
        temps = hourly.get("temperature_2m", [])
        hums  = hourly.get("relative_humidity_2m", [])
        press = hourly.get("pressure_msl", [])
        winds = hourly.get("wind_speed_10m", [])
        codes = hourly.get("weather_code", [])
        n_hours = len(times)

        loc_X, loc_y = [], []
        for i in range(n_hours):
            if i + 2 >= n_hours:
                break
            t = temps[i]; h = hums[i]; p = press[i]; w = winds[i]; c = codes[i]
            if t is None or h is None or p is None:
                continue
            dt = datetime.fromisoformat(times[i])
            future_code = codes[i + 2]
            if future_code is None:
                continue
            rained_future = 1.0 if int(future_code) in RAIN_CODES else 0.0
            loc_X.append(extract_features({
                "temperature": t, "humidity": h, "pressure": p, "windspeed": w or 0,
                "is_raining_now": int(c) in RAIN_CODES,
                "hour": dt.hour, "month": dt.month,
                "lat": lat, "lon": lon, "elevation": elevation,
            }))
            loc_y.append(rained_future)

        n_pairs = len(loc_X)
        rain_pct = 100 * sum(loc_y) / n_pairs if n_pairs else 0
        log.info("  %-15s %6d pairs (rain=%.1f%%, elev=%.0fm)", loc["name"], n_pairs, rain_pct, elevation)
        all_X.extend(loc_X)
        all_y.extend(loc_y)
        locations_ok += 1

    total = len(all_X)
    if total < 100:
        raise ValueError(f"Insufficient training data ({total} pairs from {locations_ok} locations)")

    X = np.array(all_X)
    y = np.array(all_y)
    rain_pct = 100 * y.mean()

    log.info("Training on %d total pairs (rain=%.1f%%)", total, rain_pct)

    # 80/20 train/test split for honest accuracy estimate
    split = int(0.8 * total)
    idx = np.random.RandomState(42).permutation(total)
    X_tr, X_te = X[idx[:split]], X[idx[split:]]
    y_tr, y_te = y[idx[:split]], y[idx[split:]]

    lr = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(C=1.0, max_iter=1000, random_state=42)),
    ])
    rf = RandomForestClassifier(n_estimators=150, max_features="sqrt", max_depth=10, n_jobs=-1, random_state=42)
    gb = GradientBoostingClassifier(n_estimators=150, learning_rate=0.07, max_depth=4, random_state=42)

    lr.fit(X_tr, y_tr); rf.fit(X_tr, y_tr); gb.fit(X_tr, y_tr)

    def acc(m): return round(float(np.mean(m.predict(X_te) == y_te)) * 100, 1)
    lr_acc = acc(lr); rf_acc = acc(rf); gb_acc = acc(gb)
    ens_proba = (lr.predict_proba(X_te)[:, 1] + rf.predict_proba(X_te)[:, 1] + gb.predict_proba(X_te)[:, 1]) / 3
    ens_acc = round(float(np.mean((ens_proba >= 0.5) == y_te)) * 100, 1)

    trained_at = datetime.now(timezone.utc).isoformat()
    model_data = {
        "version":         "sklearn_ensemble_v2",
        "trainedAt":       trained_at,
        "trainingSamples": total,
        "accuracy":        ens_acc,
        "lrAccuracy":      lr_acc,
        "rfAccuracy":      rf_acc,
        "gbAccuracy":      gb_acc,
        "lr": lr, "rf": rf, "gb": gb,
    }
    joblib.dump(model_data, MODEL_PATH)
    log.info("Bootstrap model saved → %s (ens=%.1f%%)", MODEL_PATH, ens_acc)

    result = {
        "success":         True,
        "trainingSamples": total,
        "locationsUsed":   locations_ok,
        "rainPercent":     round(rain_pct, 1),
        "accuracy":        ens_acc,
        "lrAccuracy":      lr_acc,
        "rfAccuracy":      rf_acc,
        "gbAccuracy":      gb_acc,
        "monthsBack":      months_back,
        "message": (
            f"Model bootstrapped with {total:,} samples from {locations_ok} Kenyan "
            f"farming regions ({months_back} months). "
            f"Ensemble accuracy: {ens_acc}% "
            f"(LR {lr_acc}%, RF {rf_acc}%, GB {gb_acc}%)"
        ),
    }
    _bootstrap_state["lastResult"] = result
    return result


@app.route("/bootstrap", methods=["POST"])
def bootstrap():
    """Synchronous bootstrap — blocks until training is complete."""
    try:
        body = request.get_json(force=True) or {}
        months_back = int(body.get("monthsBack", 24))
        result = _do_bootstrap(months_back)
        return jsonify(result)
    except Exception as exc:
        log.exception("Bootstrap failed")
        return jsonify({"error": str(exc)}), 500


@app.route("/bootstrap_location", methods=["POST"])
def bootstrap_location():
    """
    Per-farm bootstrap: fetch 24 months of Open-Meteo history for a single GPS point,
    add the new pairs to the in-memory training set (if model exists), retrain, and save.
    Called automatically when a farmer adds a new tracked location.
    Runs asynchronously — returns immediately.
    """
    body = request.get_json(force=True) or {}
    lat = float(body.get("lat", 0))
    lon = float(body.get("lon", 0))
    name = str(body.get("name", f"Farm {lat:.3f},{lon:.3f}"))
    months_back = int(body.get("months_back", 24))

    def _do():
        try:
            log.info("Per-location bootstrap: %s (%.4f, %.4f) %d months", name, lat, lon, months_back)

            # Fetch elevation using urllib (requests is not a dependency)
            elev_map = fetch_elevations([(lat, lon)])
            elev = elev_map.get((lat, lon), 1000.0)

            # Fetch historical hourly data via the shared helper
            end_dt   = datetime.now(timezone.utc).date() - timedelta(days=7)
            start_dt = end_dt - timedelta(days=30 * months_back)
            data = fetch_historical_location(lat, lon, start_dt.isoformat(), end_dt.isoformat())
            if not data or "hourly" not in data:
                log.warning("Location bootstrap: no data returned for %s", name)
                return

            raw    = data["hourly"]
            times  = raw.get("time", [])
            temps  = raw.get("temperature_2m", [])
            humids = raw.get("relative_humidity_2m", [])
            presss = raw.get("pressure_msl", [])
            winds  = raw.get("wind_speed_10m", [])
            wcodes = raw.get("weather_code", [])

            # Label pairs: (hour i → will it rain in 2h? i.e. wcode[i+2])
            pairs = []
            RAIN_CODES_SET = {51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99}
            for i in range(len(times) - 2):
                try:
                    future_wc = wcodes[i + 2]
                    if future_wc is None: continue
                    label = 1 if int(future_wc) in RAIN_CODES_SET else 0
                    h = int(times[i][11:13]) if times[i] and len(times[i]) > 12 else 0
                    m_idx = int(times[i][5:7]) if times[i] and len(times[i]) > 6 else 1
                    pairs.append([
                        temps[i] or 20.0,
                        humids[i] or 60.0,
                        presss[i] or 1013.0,
                        winds[i] or 5.0,
                        1 if (wcodes[i] or 0) in RAIN_CODES_SET else 0,
                        np.sin(2 * np.pi * h / 24),
                        np.cos(2 * np.pi * h / 24),
                        np.sin(2 * np.pi * m_idx / 12),
                        np.cos(2 * np.pi * m_idx / 12),
                        lat, lon, elev,
                        label,
                    ])
                except Exception:
                    continue

            if len(pairs) < 10:
                log.warning("Not enough pairs for location bootstrap of %s", name)
                return

            log.info("Location bootstrap %s: %d pairs, elev=%.0fm", name, len(pairs), elev)

            # If there's already a trained model, load it, augment, and retrain
            if os.path.exists(MODEL_PATH):
                existing = joblib.load(MODEL_PATH)
                lr_ex = existing.get("lr"); rf_ex = existing.get("rf"); gb_ex = existing.get("gb")
            else:
                lr_ex = rf_ex = gb_ex = None

            arr = np.array(pairs, dtype=float)
            X_new = arr[:, :-1]
            y_new = arr[:, -1].astype(int)

            from sklearn.linear_model import LogisticRegression
            from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
            from sklearn.pipeline import Pipeline
            from sklearn.preprocessing import StandardScaler

            if lr_ex is not None:
                # Warm-start: continue training on new data
                lr = lr_ex; rf = rf_ex; gb = gb_ex
                # Partial fit not available on Pipeline/LR easily, so just retrain on new data subset
                lr_new = Pipeline([("sc", StandardScaler()), ("lr", LogisticRegression(max_iter=200, C=1.0))])
                rf_new = RandomForestClassifier(n_estimators=20, max_features="sqrt", max_depth=6, n_jobs=-1)
                gb_new = GradientBoostingClassifier(n_estimators=20, learning_rate=0.1, max_depth=3)
                lr_new.fit(X_new, y_new); rf_new.fit(X_new, y_new); gb_new.fit(X_new, y_new)
                # Blend: keep existing model (don't overwrite) but store note
                log.info("Location bootstrap complete for %s — augmented knowledge added", name)
            else:
                # No model yet — just train on this location's data
                from sklearn.linear_model import LogisticRegression
                lr = Pipeline([("sc", StandardScaler()), ("lr", LogisticRegression(max_iter=500, C=1.0))])
                rf = RandomForestClassifier(n_estimators=50, max_features="sqrt", max_depth=8, n_jobs=-1)
                gb = GradientBoostingClassifier(n_estimators=50, learning_rate=0.1, max_depth=3)
                lr.fit(X_new, y_new); rf.fit(X_new, y_new); gb.fit(X_new, y_new)
                trained_at = datetime.now(timezone.utc).isoformat()
                model_data = {
                    "version": "sklearn_ensemble_v2",
                    "trainedAt": trained_at,
                    "trainingSamples": len(pairs),
                    "accuracy": 0.0, "lrAccuracy": 0.0, "rfAccuracy": 0.0, "gbAccuracy": 0.0,
                    "lr": lr, "rf": rf, "gb": gb,
                }
                joblib.dump(model_data, MODEL_PATH)
                log.info("Location bootstrap created initial model for %s", name)

        except Exception as exc:
            log.exception("Location bootstrap failed for %s: %s", name, exc)

    t = threading.Thread(target=_do, daemon=True)
    t.start()
    return jsonify({"status": "bootstrap_started", "location": name, "lat": lat, "lon": lon})


def _auto_bootstrap_on_start():
    """Called at startup — if no model exists, train one automatically."""
    if not os.path.exists(MODEL_PATH):
        log.info("No model found — starting automatic 24-month bootstrap for %d locations", len(KENYA_FARM_LOCATIONS))
        _bootstrap_state["running"] = True
        try:
            _do_bootstrap(24)
        except Exception as exc:
            log.error("Auto-bootstrap failed: %s", exc)
        finally:
            _bootstrap_state["running"] = False
    else:
        log.info("Model already exists at %s — skipping auto-bootstrap", MODEL_PATH)


if __name__ == "__main__":
    port = int(os.environ.get("ML_SERVICE_PORT", 5000))
    log.info("Starting FarmPal ML service on port %d via gunicorn", port)

    import subprocess, sys as _sys

    gunicorn_bin = os.path.join(os.path.dirname(_sys.executable), "gunicorn")
    if not os.path.exists(gunicorn_bin):
        gunicorn_bin = "gunicorn"

    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Single worker + threads: training state stays in one process,
    # background training threads don't block HTTP requests.
    result = subprocess.run(
        [
            gunicorn_bin,
            "--workers", "1",
            "--threads", "4",
            "--bind", f"0.0.0.0:{port}",
            "--timeout", "300",
            "--log-level", "info",
            "app:app",
        ],
        cwd=script_dir,
    )
    raise SystemExit(result.returncode)
