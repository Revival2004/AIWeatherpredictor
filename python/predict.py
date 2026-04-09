#!/usr/bin/env python3
"""
predict.py — Load the trained model and make a rain prediction.

The script accepts either CLI coordinates or JSON on stdin, fetches recent
Open-Meteo data, rebuilds the engineered feature row, and returns the saved
model's next-day rainfall prediction.

Usage:
    python python/predict.py --latitude -0.3031 --longitude 36.08

Output:
    {"prediction": 3.42, "confidence": 0.71, "model_used": "RandomForestRegressor"}
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from data_fetch import fetch_recent_weather
from features import prepare_prediction_features


DEFAULT_MODEL_PATH = Path(__file__).with_name("models") / "farmpal_best_model.joblib"


def load_model_bundle(model_path: str | Path) -> dict[str, Any]:
    """Load the persisted best-model bundle from disk."""
    bundle = joblib.load(model_path)
    if not isinstance(bundle, dict) or "model" not in bundle:
        raise ValueError("Model bundle is invalid or missing the trained model.")
    return bundle


def calculate_confidence(bundle: dict[str, Any]) -> float:
    """Convert validation error into a simple 0-1 confidence score."""
    metrics = bundle.get("metrics", {})
    target_stats = bundle.get("target_statistics", {})

    rmse = float(metrics.get("rmse", 0.0))
    scale = max(
        float(target_stats.get("std", 0.0)),
        float(target_stats.get("mean", 0.0)),
        1.0,
    )
    confidence = 1.0 / (1.0 + (rmse / scale))
    return round(max(0.05, min(0.99, confidence)), 3)


def predict_from_frame(bundle: dict[str, Any], recent_frame: pd.DataFrame) -> dict[str, Any]:
    """Generate a prediction from an already-loaded recent weather frame."""
    feature_row, _ = prepare_prediction_features(recent_frame)
    feature_columns = bundle["feature_columns"]
    prediction = float(bundle["model"].predict(feature_row[feature_columns])[0])
    prediction = round(max(0.0, prediction), 3)

    return {
        "prediction": prediction,
        "confidence": calculate_confidence(bundle),
        "model_used": bundle.get("model_name", "unknown"),
    }


def predict_from_coordinates(
    latitude: float,
    longitude: float,
    *,
    model_path: str | Path = DEFAULT_MODEL_PATH,
    history_days: int = 30,
    forecast_days: int = 1,
    use_env_proxy: bool = False,
) -> dict[str, Any]:
    """Fetch recent data, build features, and return a prediction payload."""
    bundle = load_model_bundle(model_path)
    recent_frame = fetch_recent_weather(
        latitude=latitude,
        longitude=longitude,
        history_days=history_days,
        forecast_days=forecast_days,
        use_env_proxy=use_env_proxy,
    )
    return predict_from_frame(bundle, recent_frame)


def parse_request(args: argparse.Namespace) -> tuple[float, float]:
    """Read coordinates from CLI arguments or JSON stdin."""
    if args.latitude is not None and args.longitude is not None:
        return float(args.latitude), float(args.longitude)

    raw = sys.stdin.read().strip()
    if not raw:
        raise ValueError("Provide latitude/longitude via CLI flags or JSON on stdin.")

    data = json.loads(raw)
    if "latitude" not in data or "longitude" not in data:
        raise ValueError("Input JSON must include latitude and longitude.")
    return float(data["latitude"]), float(data["longitude"])


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Load FarmPal's best model and predict next-day precipitation."
    )
    parser.add_argument("--latitude", type=float, help="Latitude value")
    parser.add_argument("--longitude", type=float, help="Longitude value")
    parser.add_argument(
        "--model",
        default=str(DEFAULT_MODEL_PATH),
        help=f"Path to the trained model bundle. Defaults to {DEFAULT_MODEL_PATH}",
    )
    parser.add_argument(
        "--history-days",
        type=int,
        default=30,
        help="How many recent days to fetch for feature generation. Defaults to 30.",
    )
    parser.add_argument(
        "--forecast-days",
        type=int,
        default=1,
        help="How many forecast days to request from Open-Meteo. Defaults to 1.",
    )
    parser.add_argument(
        "--use-env-proxy",
        action="store_true",
        help="Use HTTP/HTTPS proxy values from the environment",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    try:
        latitude, longitude = parse_request(args)
        result = predict_from_coordinates(
            latitude=latitude,
            longitude=longitude,
            model_path=args.model,
            history_days=args.history_days,
            forecast_days=args.forecast_days,
            use_env_proxy=args.use_env_proxy,
        )
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
