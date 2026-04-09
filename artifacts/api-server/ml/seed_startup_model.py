from __future__ import annotations

import argparse
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd
import requests

from data.preprocess import prepare_training_dataset
from models.train import save_model_bundle, train_model_bundle
from utils.features import FEATURE_COLUMNS


SEED_LOCATIONS = [
    {"name": "Nakuru", "lat": -0.3031, "lon": 36.0800},
    {"name": "Eldoret", "lat": 0.5143, "lon": 35.2698},
    {"name": "Nairobi", "lat": -1.2921, "lon": 36.8219},
    {"name": "Meru", "lat": 0.0500, "lon": 37.6496},
    {"name": "Machakos", "lat": -1.5177, "lon": 37.2634},
    {"name": "Kisumu", "lat": -0.0917, "lon": 34.7679},
    {"name": "Kakamega", "lat": 0.2827, "lon": 34.7519},
    {"name": "Mombasa", "lat": -4.0435, "lon": 39.6682},
    {"name": "Garissa", "lat": -0.4532, "lon": 39.6461},
    {"name": "Marsabit", "lat": 2.3313, "lon": 37.9927},
]

OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"


def _disable_proxy_env() -> None:
    for key in (
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
    ):
        os.environ.pop(key, None)


def _build_metadata(bundle: dict[str, Any], *, source: str, months_back: int, locations_used: list[str]) -> dict[str, Any]:
    return {
        "version": bundle.get("version"),
        "trainedAt": bundle.get("trainedAt"),
        "trainingSamples": bundle.get("trainingSamples"),
        "accuracy": bundle.get("accuracy"),
        "rmse": bundle.get("rmse"),
        "mae": bundle.get("mae"),
        "selectedModel": bundle.get("selectedModel"),
        "selectedModelDisplay": bundle.get("selectedModelDisplay"),
        "perModel": bundle.get("perModel"),
        "source": source,
        "monthsBack": months_back,
        "locations": locations_used,
        "auc": None,
        "brierScore": None,
    }


def _open_meteo_get(url: str, *, params: dict[str, Any], timeout: int = 60) -> dict[str, Any]:
    session = requests.Session()
    session.trust_env = False
    response = session.get(
        url,
        params=params,
        timeout=timeout,
        headers={"User-Agent": "FarmPal-SeedModel/1.0"},
    )
    response.raise_for_status()
    return response.json()


def _fetch_elevations(pairs: list[tuple[float, float]]) -> dict[tuple[float, float], float]:
    if not pairs:
        return {}

    payload = _open_meteo_get(
        OPEN_METEO_ELEVATION_URL,
        params={
            "latitude": ",".join(f"{lat:.6f}" for lat, _ in pairs),
            "longitude": ",".join(f"{lon:.6f}" for _, lon in pairs),
        },
        timeout=30,
    )
    values = payload.get("elevation", [])
    result: dict[tuple[float, float], float] = {}
    for index, pair in enumerate(pairs):
        result[pair] = float(values[index]) if index < len(values) else 1000.0
    return result


def _fetch_historical_location_frame(*, lat: float, lon: float, start_date: str, end_date: str) -> pd.DataFrame:
    payload = _open_meteo_get(
        OPEN_METEO_ARCHIVE_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "start_date": start_date,
            "end_date": end_date,
            "hourly": "temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,weather_code,precipitation",
            "timezone": "Africa/Nairobi",
        },
        timeout=120,
    )
    hourly = payload.get("hourly") or {}
    frame = pd.DataFrame(
        {
            "created_at": pd.to_datetime(hourly.get("time", []), utc=True, errors="coerce"),
            "temperature": hourly.get("temperature_2m", []),
            "humidity": hourly.get("relative_humidity_2m", []),
            "pressure": hourly.get("pressure_msl", []),
            "windspeed": hourly.get("wind_speed_10m", []),
            "weathercode": hourly.get("weather_code", []),
            "precipitation_mm": hourly.get("precipitation", []),
        }
    )
    frame["lat"] = lat
    frame["lon"] = lon
    return frame


def _frame_to_training_rows(frame: pd.DataFrame, *, location_name: str, elevation: float) -> list[dict[str, Any]]:
    if frame.empty:
        return []

    ordered = frame.sort_values("created_at").reset_index(drop=True).copy()
    ordered["pressure_tendency"] = ordered["pressure"].astype(float) - ordered["pressure"].astype(float).shift(3)
    ordered["pressure_tendency"] = ordered["pressure_tendency"].fillna(0.0)

    rows: list[dict[str, Any]] = []
    for item in ordered.to_dict(orient="records"):
        precipitation = float(item.get("precipitation_mm", 0.0) or 0.0)
        pressure_tendency = float(item.get("pressure_tendency", 0.0) or 0.0)
        rows.append(
            {
                "lat": float(item["lat"]),
                "lon": float(item["lon"]),
                "temperature": float(item["temperature"]),
                "humidity": float(item["humidity"]),
                "pressure": float(item["pressure"]),
                "windspeed": float(item["windspeed"]),
                "weathercode": int(item.get("weathercode", 0) or 0),
                "created_at": item["created_at"],
                "precipitation_mm": precipitation,
                "elevation": float(elevation),
                "reasoning": (
                    f"Seed startup model {location_name} "
                    f"p_tend={pressure_tendency:.2f} precip={precipitation:.2f}"
                ),
            }
        )
    return rows


def _fetch_rows_for_location(
    location: dict[str, float | str],
    *,
    start_date: str,
    end_date: str,
    elevation: float,
) -> list[dict[str, Any]]:
    frame = _fetch_historical_location_frame(
        lat=float(location["lat"]),
        lon=float(location["lon"]),
        start_date=start_date,
        end_date=end_date,
    )
    return _frame_to_training_rows(frame, location_name=str(location["name"]), elevation=elevation)


def build_seed_dataset(*, months_back: int) -> tuple[list[dict[str, Any]], list[str], str, str]:
    end = pd.Timestamp.now(tz="UTC").normalize()
    start = (end - pd.DateOffset(months=months_back)).normalize()
    start_date = start.strftime("%Y-%m-%d")
    end_date = end.strftime("%Y-%m-%d")

    pairs = [(float(location["lat"]), float(location["lon"])) for location in SEED_LOCATIONS]
    elevations = _fetch_elevations(pairs)

    rows: list[dict[str, Any]] = []
    completed_locations: list[str] = []
    for location in SEED_LOCATIONS:
        lat = float(location["lat"])
        lon = float(location["lon"])
        elevation = float(elevations.get((lat, lon), 1000.0))
        location_rows = _fetch_rows_for_location(
            location,
            start_date=start_date,
            end_date=end_date,
            elevation=elevation,
        )
        if location_rows:
            rows.extend(location_rows)
            completed_locations.append(str(location["name"]))

    return rows, completed_locations, start_date, end_date


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch representative Kenya history from Open-Meteo and build a startup ML model bundle."
    )
    parser.add_argument(
        "--months-back",
        type=int,
        default=18,
        help="How many months of history to fetch per seed location. Defaults to 18.",
    )
    parser.add_argument(
        "--cv-folds",
        type=int,
        default=2,
        help="Time-series cross-validation folds for model selection. Defaults to 2.",
    )
    parser.add_argument(
        "--model-output",
        default=str(Path(__file__).resolve().parents[1] / "ml_model_sklearn.pkl"),
        help="Output path for the saved seed model bundle.",
    )
    parser.add_argument(
        "--meta-output",
        default=str(Path(__file__).resolve().parents[1] / "ml_model_meta.json"),
        help="Output path for the seed model metadata JSON.",
    )
    parser.add_argument(
        "--summary-output",
        default=str(Path(__file__).resolve().parents[1] / "ml_seed_training_summary.json"),
        help="Output path for a lightweight seed training summary JSON.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    _disable_proxy_env()

    rows, locations_used, start_date, end_date = build_seed_dataset(months_back=args.months_back)
    if len(rows) < 500:
        raise ValueError(f"Seed dataset is too small to train reliably: only {len(rows)} rows were fetched.")

    X, y, dataset = prepare_training_dataset(rows)
    bundle, result = train_model_bundle(
        X=X,
        y=y,
        dataset=dataset,
        feature_columns=FEATURE_COLUMNS,
        cv_folds=max(2, int(args.cv_folds)),
    )

    model_path = Path(args.model_output)
    meta_path = Path(args.meta_output)
    summary_path = Path(args.summary_output)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.parent.mkdir(parents=True, exist_ok=True)

    save_model_bundle(bundle, str(model_path))

    metadata = _build_metadata(
        bundle,
        source="open-meteo-seed",
        months_back=int(args.months_back),
        locations_used=locations_used,
    )
    meta_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    summary = {
        **result,
        "source": "open-meteo-seed",
        "monthsBack": int(args.months_back),
        "locations": locations_used,
        "dateRange": {
            "start": start_date,
            "end": end_date,
        },
        "savedModelPath": str(model_path),
        "savedMetaPath": str(meta_path),
        "generatedAt": datetime.now(UTC).isoformat(),
    }
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
