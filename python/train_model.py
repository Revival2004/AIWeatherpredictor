#!/usr/bin/env python3
"""
train_model.py — Train a RandomForest classifier for rain prediction.

This script reads historical weather observations from PostgreSQL,
generates labeled training data (will it rain in 2 hours?), trains
a scikit-learn RandomForestClassifier, and saves the model to disk.

Usage:
    python3 python/train_model.py

Requirements:
    pip install scikit-learn psycopg2-binary pandas numpy joblib

Environment:
    DATABASE_URL — PostgreSQL connection string (from .env or environment)
"""

import os
import sys
import json
import math
import joblib
import pandas as pd
import numpy as np
from datetime import timedelta
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from sklearn.preprocessing import StandardScaler
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable not set", file=sys.stderr)
    sys.exit(1)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "rain_model.joblib")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "rain_scaler.joblib")

RAIN_CODES = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99}

def fetch_observations(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT temperature, humidity, pressure, windspeed, weathercode, created_at
            FROM weather_data
            ORDER BY created_at ASC
        """)
        return cur.fetchall()

def extract_features(row):
    ts = row["created_at"]
    hour = ts.hour
    month = ts.month
    hour_rad = 2 * math.pi * hour / 24
    month_rad = 2 * math.pi * month / 12
    return {
        "temperature": row["temperature"],
        "humidity": row["humidity"],
        "pressure": row["pressure"],
        "windspeed": row["windspeed"],
        "is_raining_now": 1 if row["weathercode"] in RAIN_CODES else 0,
        "hour_sin": math.sin(hour_rad),
        "hour_cos": math.cos(hour_rad),
        "month_sin": math.sin(month_rad),
        "month_cos": math.cos(month_rad),
    }

def build_dataset(records):
    X, y = [], []
    for i, current in enumerate(records):
        t_current = current["created_at"]
        # Find observation ~2 hours ahead
        future = None
        for j in range(i + 1, len(records)):
            delta = records[j]["created_at"] - t_current
            if timedelta(hours=1) <= delta <= timedelta(hours=4):
                future = records[j]
                break
        if future is None:
            continue
        features = extract_features(current)
        label = 1 if future["weathercode"] in RAIN_CODES else 0
        X.append(list(features.values()))
        y.append(label)
    return np.array(X), np.array(y), list(features.keys())

def main():
    print(f"Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)

    print("Fetching observations...")
    records = fetch_observations(conn)
    conn.close()

    if len(records) < 20:
        print(f"ERROR: Need at least 20 observations, found {len(records)}. Keep collecting data.")
        sys.exit(1)

    print(f"Building training dataset from {len(records)} observations...")
    X, y, feature_names = build_dataset(records)

    if len(X) < 10:
        print(f"ERROR: Only {len(X)} labeled pairs. Need more consecutive observations.")
        sys.exit(1)

    print(f"Training on {len(X)} labeled examples ({y.sum()} rain, {(1-y).sum()} no-rain)...")

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Split for evaluation
    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)

    # Train RandomForest
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        min_samples_leaf=2,
        random_state=42,
        class_weight="balanced",
    )
    clf.fit(X_train, y_train)

    # Evaluate
    y_pred = clf.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\nTest accuracy: {accuracy:.2%}")
    print(classification_report(y_test, y_pred, target_names=["no rain", "rain"]))

    # Feature importance
    print("\nFeature importances:")
    for name, imp in sorted(zip(feature_names, clf.feature_importances_), key=lambda x: -x[1]):
        print(f"  {name}: {imp:.3f}")

    # Save
    joblib.dump(clf, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"\nModel saved to: {MODEL_PATH}")
    print(f"Scaler saved to: {SCALER_PATH}")

    # Save metadata
    meta = {
        "trained_at": pd.Timestamp.now().isoformat(),
        "training_samples": len(X),
        "accuracy": round(accuracy, 4),
        "feature_names": feature_names,
        "version": "random_forest_v1"
    }
    with open(os.path.join(os.path.dirname(__file__), "model_meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\nDone! Model ready for predictions.")

if __name__ == "__main__":
    main()
