import os
import math
import json
import logging
from datetime import datetime, timezone

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


if __name__ == "__main__":
    port = int(os.environ.get("ML_SERVICE_PORT", 5000))
    log.info("Starting sklearn ML service on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
