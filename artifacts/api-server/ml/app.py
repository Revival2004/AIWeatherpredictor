import os
import math
import json
import logging
import time as _time
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
    # Location features — Kenya range: lat -5..5, lon 33..42
    lat = float(row.get("lat", 0.0) or 0.0)
    lon = float(row.get("lon", 37.5) or 37.5)
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
    ]


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": os.path.exists(MODEL_PATH)})


@app.route("/train", methods=["POST"])
def train():
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT
                w.temperature,
                w.humidity,
                w.pressure,
                w.windspeed,
                w.weathercode,
                w.latitude  AS lat,
                w.longitude AS lon,
                EXTRACT(HOUR  FROM w.created_at) AS hour,
                EXTRACT(MONTH FROM w.created_at) AS month,
                (w.weathercode IN (51,53,55,61,63,65,71,73,75,80,81,82,95,96,99)) AS is_raining_now,
                (w2.weathercode IN (51,53,55,61,63,65,71,73,75,80,81,82,95,96,99)) AS rained_2h
            FROM weather_data w
            JOIN weather_data w2 ON (
                ABS(w2.latitude  - w.latitude)  < 0.01
                AND ABS(w2.longitude - w.longitude) < 0.01
                AND w2.created_at >= w.created_at + INTERVAL '30 minutes'
                AND w2.created_at <= w.created_at + INTERVAL '180 minutes'
            )
            WHERE w.temperature IS NOT NULL
              AND w.humidity    IS NOT NULL
              AND w.pressure    IS NOT NULL
            ORDER BY w.created_at DESC
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

        X = np.array([extract_features(dict(r)) for r in rows])
        y = np.array([1.0 if r["rained_2h"] else 0.0 for r in rows])

        unique_classes = np.unique(y)
        if len(unique_classes) < 2:
            cls_name = "rain" if unique_classes[0] == 1.0 else "no-rain"
            return jsonify({
                "trainingSamples": n,
                "accuracy": 0,
                "lrAccuracy": 0,
                "rfAccuracy": 0,
                "gbAccuracy": 0,
                "message": (
                    f"All {n} labeled pairs have the same outcome ({cls_name}). "
                    "Need observations from both rain and no-rain periods to train. "
                    "Keep collecting — the system will train automatically once both classes appear."
                ),
            })

        log.info("Training sklearn ensemble on %d samples (rain=%.1f%%)", n, 100 * y.mean())

        lr = Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(C=1.0, max_iter=1000, random_state=42)),
        ])
        rf = RandomForestClassifier(
            n_estimators=100, max_features="sqrt", max_depth=8,
            n_jobs=-1, random_state=42
        )
        gb = GradientBoostingClassifier(
            n_estimators=100, learning_rate=0.08, max_depth=4,
            random_state=42
        )

        lr.fit(X, y)
        rf.fit(X, y)
        gb.fit(X, y)

        def acc(model):
            return round(float(np.mean(model.predict(X) == y)) * 100, 1)

        lr_acc = acc(lr)
        rf_acc = acc(rf)
        gb_acc = acc(gb)

        ens_proba = (
            lr.predict_proba(X)[:, 1]
            + rf.predict_proba(X)[:, 1]
            + gb.predict_proba(X)[:, 1]
        ) / 3
        ens_acc = round(float(np.mean((ens_proba >= 0.5) == y)) * 100, 1)

        trained_at = datetime.now(timezone.utc).isoformat()
        model_data = {
            "version": "sklearn_ensemble_v1",
            "trainedAt": trained_at,
            "trainingSamples": n,
            "accuracy": ens_acc,
            "lrAccuracy": lr_acc,
            "rfAccuracy": rf_acc,
            "gbAccuracy": gb_acc,
            "lr": lr,
            "rf": rf,
            "gb": gb,
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


RAIN_CODES = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99}

KENYA_FARM_LOCATIONS = [
    {"name": "Nakuru",  "lat": -0.3031, "lon": 36.0800},   # Rift Valley – grain & wheat
    {"name": "Eldoret", "lat":  0.5143, "lon": 35.2698},   # Uasin Gishu – maize breadbasket
    {"name": "Kisumu",  "lat": -0.0917, "lon": 34.7679},   # Nyanza – sugarcane & fish
    {"name": "Meru",    "lat":  0.0500, "lon": 37.6496},   # Eastern – coffee & miraa
    {"name": "Kericho", "lat": -0.3686, "lon": 35.2864},   # Rift Valley – tea country
    {"name": "Kitale",  "lat":  1.0155, "lon": 35.0062},   # Trans-Nzoia – maize & wheat
    {"name": "Nairobi", "lat": -1.2921, "lon": 36.8219},   # Central – peri-urban
    {"name": "Embu",    "lat": -0.5310, "lon": 37.4500},   # Eastern – coffee & horticulture
]


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


@app.route("/bootstrap", methods=["POST"])
def bootstrap():
    """
    Fetch 12 months of Open-Meteo historical data for key Kenyan farming locations,
    build labeled training pairs (weather at T → did it rain at T+2h?), and train
    the ensemble so the model is useful from day one.
    """
    try:
        body = request.get_json(force=True) or {}
        months_back = int(body.get("monthsBack", 12))
        locations = body.get("locations", KENYA_FARM_LOCATIONS)

        end_dt   = datetime.now() - timedelta(days=2)   # archive lags ~2 days
        start_dt = end_dt - timedelta(days=30 * months_back)
        start_date = start_dt.strftime("%Y-%m-%d")
        end_date   = end_dt.strftime("%Y-%m-%d")

        log.info("Bootstrap: fetching %d months from %s to %s for %d locations",
                 months_back, start_date, end_date, len(locations))

        all_X, all_y = [], []
        locations_ok = 0

        for loc in locations:
            api_resp = fetch_historical_location(loc["lat"], loc["lon"], start_date, end_date)
            if not api_resp or "hourly" not in api_resp:
                log.warning("No data for %s", loc["name"])
                continue

            hourly = api_resp["hourly"]
            loc_lat = float(api_resp.get("latitude", loc["lat"]))
            loc_lon = float(api_resp.get("longitude", loc["lon"]))

            times   = hourly.get("time", [])
            temps   = hourly.get("temperature_2m", [])
            humids  = hourly.get("relative_humidity_2m", [])
            presss  = hourly.get("pressure_msl", [])
            winds   = hourly.get("wind_speed_10m", [])
            codes   = hourly.get("weather_code", [])

            n = len(times)
            pairs = 0
            for i in range(n - 2):
                t  = temps[i];  h  = humids[i]
                p  = presss[i]; w  = winds[i]; c = codes[i]
                c2 = codes[i + 2]

                if any(v is None for v in [t, h, p, w, c, c2]):
                    continue

                dt_hour = int(times[i][11:13]) if len(times[i]) >= 13 else 0
                dt_mon  = int(times[i][5:7])   if len(times[i]) >= 7  else 6

                is_raining_now = 1.0 if int(c) in RAIN_CODES else 0.0
                rained_2h      = 1.0 if int(c2) in RAIN_CODES else 0.0

                all_X.append([
                    float(t), float(h), float(p), float(w), is_raining_now,
                    math.sin(2 * math.pi * dt_hour / 24),
                    math.cos(2 * math.pi * dt_hour / 24),
                    math.sin(2 * math.pi * dt_mon  / 12),
                    math.cos(2 * math.pi * dt_mon  / 12),
                    loc_lat,
                    loc_lon,
                ])
                all_y.append(rained_2h)
                pairs += 1

            log.info("  %-10s  %d pairs (rain=%.1f%%)", loc["name"], pairs,
                     100 * sum(1 for y in all_y[-pairs:] if y) / max(pairs, 1))
            if pairs > 0:
                locations_ok += 1

        total = len(all_X)
        if total < 10:
            return jsonify({"error": f"Not enough data fetched ({total} pairs). Check connectivity."}), 400

        X = np.array(all_X)
        y = np.array(all_y)

        if len(np.unique(y)) < 2:
            return jsonify({"error": "Historical data only has one class — cannot train."}), 400

        rain_pct = float(np.mean(y) * 100)
        log.info("Training on %d total pairs (rain=%.1f%%)", total, rain_pct)

        from sklearn.model_selection import train_test_split
        X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.15, random_state=42, stratify=y)

        lr = Pipeline([
            ("scaler", StandardScaler()),
            ("clf",    LogisticRegression(C=1.0, max_iter=1000, random_state=42)),
        ])
        rf = RandomForestClassifier(n_estimators=150, max_features="sqrt",
                                    max_depth=10, n_jobs=-1, random_state=42)
        gb = GradientBoostingClassifier(n_estimators=150, learning_rate=0.07,
                                        max_depth=4, random_state=42)

        lr.fit(X_tr, y_tr); rf.fit(X_tr, y_tr); gb.fit(X_tr, y_tr)

        def acc(m): return round(float(np.mean(m.predict(X_te) == y_te)) * 100, 1)
        lr_acc = acc(lr); rf_acc = acc(rf); gb_acc = acc(gb)

        ens_proba = (lr.predict_proba(X_te)[:, 1] + rf.predict_proba(X_te)[:, 1]
                     + gb.predict_proba(X_te)[:, 1]) / 3
        ens_acc = round(float(np.mean((ens_proba >= 0.5) == y_te)) * 100, 1)

        trained_at = datetime.now(timezone.utc).isoformat()
        model_data = {
            "version":         "sklearn_ensemble_v1",
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

        return jsonify({
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
        })

    except Exception as exc:
        log.exception("Bootstrap failed")
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("ML_SERVICE_PORT", 5000))
    log.info("Starting sklearn ML service on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
