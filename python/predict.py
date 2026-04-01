#!/usr/bin/env python3
"""
predict.py — Load the trained model and make a rain prediction.

Called from Node.js via child_process.spawn with JSON input on stdin.
Returns JSON output on stdout.

Usage:
    echo '{"temperature":15,"humidity":80,"pressure":1005,"windspeed":12,"weathercode":3,"hour":14,"month":4}' | python3 python/predict.py

Output:
    {"predictionValue":"yes","confidence":0.82,"probability":0.91,"modelVersion":"random_forest_v1"}
"""

import sys
import json
import math
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "rain_model.joblib")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "rain_scaler.joblib")
META_PATH = os.path.join(os.path.dirname(__file__), "model_meta.json")

RAIN_CODES = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99}

def extract_features(data):
    hour = data.get("hour", 12)
    month = data.get("month", 6)
    hour_rad = 2 * math.pi * hour / 24
    month_rad = 2 * math.pi * month / 12
    return [
        data["temperature"],
        data["humidity"],
        data["pressure"],
        data["windspeed"],
        1 if data["weathercode"] in RAIN_CODES else 0,
        math.sin(hour_rad),
        math.cos(hour_rad),
        math.sin(month_rad),
        math.cos(month_rad),
    ]

def main():
    try:
        raw = sys.stdin.read().strip()
        if not raw:
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)

        data = json.loads(raw)

        if not os.path.exists(MODEL_PATH):
            # Fall back to simple heuristic if model not trained yet
            humidity = data.get("humidity", 50)
            pressure = data.get("pressure", 1013)
            weathercode = data.get("weathercode", 0)
            prob = 0.2
            if weathercode in RAIN_CODES:
                prob += 0.5
            if humidity > 85:
                prob += 0.2
            if pressure < 1000:
                prob += 0.15
            prob = min(0.95, prob)
            result = {
                "predictionValue": "yes" if prob >= 0.5 else "no",
                "confidence": round(abs(prob - 0.5) * 2, 3),
                "probability": round(prob, 3),
                "modelVersion": "heuristic_fallback"
            }
            print(json.dumps(result))
            return

        import joblib
        clf = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)

        features = [extract_features(data)]
        features_scaled = scaler.transform(features)
        proba = clf.predict_proba(features_scaled)[0]

        # proba[1] = probability of rain
        rain_prob = float(proba[1]) if len(proba) > 1 else float(proba[0])

        # Load version from metadata
        version = "random_forest_v1"
        if os.path.exists(META_PATH):
            with open(META_PATH) as f:
                meta = json.load(f)
                version = meta.get("version", version)
                acc = meta.get("accuracy", 0)
                version = f"{version}_acc{round(acc*100,1)}"

        result = {
            "predictionValue": "yes" if rain_prob >= 0.5 else "no",
            "confidence": round(abs(rain_prob - 0.5) * 2, 3),
            "probability": round(rain_prob, 3),
            "modelVersion": version
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
