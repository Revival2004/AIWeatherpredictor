from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor

from data_fetch import fetch_historical_weather, load_weather_csv, save_weather_csv
from features import FEATURE_COLUMNS, TARGET_COLUMN, prepare_training_dataset


DEFAULT_MODEL_OUTPUT = "models/farmpal_best_model.joblib"
DEFAULT_SUMMARY_OUTPUT = "models/training_summary.json"
DEFAULT_PREPARED_OUTPUT = "models/prepared_training_dataset.csv"


def load_raw_training_frame(args: argparse.Namespace) -> pd.DataFrame:
    """Load weather data from CSV or fetch it from Open-Meteo."""
    if args.input:
        return load_weather_csv(args.input)

    missing_arguments = [
        name
        for name in ("latitude", "longitude", "start_date", "end_date")
        if getattr(args, name) is None
    ]
    if missing_arguments:
        missing_list = ", ".join(missing_arguments)
        raise ValueError(
            f"Missing required arguments for remote fetch: {missing_list}. "
            "Provide --input or pass latitude/longitude/start-date/end-date."
        )

    frame = fetch_historical_weather(
        latitude=args.latitude,
        longitude=args.longitude,
        start_date=args.start_date,
        end_date=args.end_date,
        use_env_proxy=args.use_env_proxy,
    )
    if args.raw_output:
        save_weather_csv(frame, args.raw_output)
    return frame


def chronological_train_test_split(
    dataset: pd.DataFrame,
    *,
    test_size: float = 0.2,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split time-ordered weather data into train and test partitions."""
    if not 0 < test_size < 1:
        raise ValueError("test_size must be between 0 and 1.")
    if len(dataset) < 20:
        raise ValueError("Need at least 20 prepared rows to train and evaluate the models.")

    split_index = int(len(dataset) * (1 - test_size))
    split_index = min(max(split_index, 1), len(dataset) - 1)
    train_frame = dataset.iloc[:split_index].copy()
    test_frame = dataset.iloc[split_index:].copy()

    if train_frame.empty or test_frame.empty:
        raise ValueError("Chronological split produced an empty train or test set.")

    return train_frame, test_frame


def build_model_candidates() -> dict[str, Any]:
    """Return the simple production-friendly regressors we want to compare."""
    return {
        "RandomForestRegressor": RandomForestRegressor(
            n_estimators=300,
            max_depth=12,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=1,
        ),
        "XGBRegressor": XGBRegressor(
            n_estimators=300,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.8,
            objective="reg:squarederror",
            random_state=42,
            n_jobs=1,
        ),
    }


def evaluate_model(
    model: Any,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
) -> dict[str, Any]:
    """Fit a model and return predictions plus evaluation metrics."""
    model.fit(X_train, y_train)
    predictions = np.clip(model.predict(X_test), a_min=0.0, a_max=None)

    rmse = float(np.sqrt(mean_squared_error(y_test, predictions)))
    mae = float(mean_absolute_error(y_test, predictions))
    return {
        "model": model,
        "rmse": rmse,
        "mae": mae,
        "predictions": predictions,
    }


def train_models(dataset: pd.DataFrame) -> tuple[dict[str, Any], str]:
    """Train all supported regressors and return the best one."""
    train_frame, test_frame = chronological_train_test_split(dataset)
    X_train = train_frame[FEATURE_COLUMNS]
    y_train = train_frame[TARGET_COLUMN]
    X_test = test_frame[FEATURE_COLUMNS]
    y_test = test_frame[TARGET_COLUMN]

    results: dict[str, Any] = {}
    for model_name, model in build_model_candidates().items():
        results[model_name] = evaluate_model(model, X_train, y_train, X_test, y_test)

    best_model_name = min(
        results,
        key=lambda name: (results[name]["rmse"], results[name]["mae"]),
    )
    return results, best_model_name


def build_model_bundle(
    dataset: pd.DataFrame,
    training_results: dict[str, Any],
    best_model_name: str,
) -> dict[str, Any]:
    """Create the saved bundle consumed by the prediction pipeline."""
    best_result = training_results[best_model_name]
    comparison = {
        name: {
            "rmse": round(result["rmse"], 4),
            "mae": round(result["mae"], 4),
        }
        for name, result in training_results.items()
    }

    return {
        "model": best_result["model"],
        "model_name": best_model_name,
        "feature_columns": FEATURE_COLUMNS,
        "target_column": TARGET_COLUMN,
        "target_description": "next_day_precipitation_sum_mm",
        "metrics": comparison[best_model_name],
        "comparison": comparison,
        "training_rows": int(len(dataset)),
        "trained_at": pd.Timestamp.now("UTC").isoformat(),
        "target_statistics": {
            "mean": float(dataset[TARGET_COLUMN].mean()),
            "std": float(dataset[TARGET_COLUMN].std(ddof=0)),
            "min": float(dataset[TARGET_COLUMN].min()),
            "max": float(dataset[TARGET_COLUMN].max()),
        },
        "date_range": {
            "start": dataset["date"].min().strftime("%Y-%m-%d"),
            "end": dataset["date"].max().strftime("%Y-%m-%d"),
        },
    }


def save_training_outputs(
    bundle: dict[str, Any],
    dataset: pd.DataFrame,
    *,
    model_output: str | Path,
    summary_output: str | Path,
    prepared_output: str | Path,
) -> tuple[Path, Path, Path]:
    """Persist the best model bundle, training summary, and prepared dataset."""
    model_path = Path(model_output)
    summary_path = Path(summary_output)
    prepared_path = Path(prepared_output)

    model_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    prepared_path.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(bundle, model_path)
    dataset.to_csv(prepared_path, index=False)

    summary_payload = {
        "model_used": bundle["model_name"],
        "metrics": bundle["metrics"],
        "comparison": bundle["comparison"],
        "training_rows": bundle["training_rows"],
        "target_column": bundle["target_column"],
        "target_description": bundle["target_description"],
        "date_range": bundle["date_range"],
        "trained_at": bundle["trained_at"],
    }
    summary_path.write_text(json.dumps(summary_payload, indent=2), encoding="utf-8")
    return model_path, summary_path, prepared_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Train FarmPal precipitation regressors and save the best model."
    )
    parser.add_argument(
        "--input",
        help="Optional existing CSV dataset. If omitted, the script fetches Open-Meteo data.",
    )
    parser.add_argument("--latitude", type=float, help="Latitude value for Open-Meteo fetch")
    parser.add_argument("--longitude", type=float, help="Longitude value for Open-Meteo fetch")
    parser.add_argument("--start-date", dest="start_date", help="Start date in YYYY-MM-DD format")
    parser.add_argument("--end-date", dest="end_date", help="End date in YYYY-MM-DD format")
    parser.add_argument(
        "--raw-output",
        help="Optional path to save fetched raw weather data before feature engineering.",
    )
    parser.add_argument(
        "--model-output",
        default=DEFAULT_MODEL_OUTPUT,
        help=f"Best-model joblib output path. Defaults to {DEFAULT_MODEL_OUTPUT}",
    )
    parser.add_argument(
        "--summary-output",
        default=DEFAULT_SUMMARY_OUTPUT,
        help=f"Training summary output path. Defaults to {DEFAULT_SUMMARY_OUTPUT}",
    )
    parser.add_argument(
        "--prepared-output",
        default=DEFAULT_PREPARED_OUTPUT,
        help=f"Prepared dataset output path. Defaults to {DEFAULT_PREPARED_OUTPUT}",
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

    raw_frame = load_raw_training_frame(args)
    dataset = prepare_training_dataset(raw_frame)
    training_results, best_model_name = train_models(dataset)
    bundle = build_model_bundle(dataset, training_results, best_model_name)
    model_path, summary_path, prepared_path = save_training_outputs(
        bundle,
        dataset,
        model_output=args.model_output,
        summary_output=args.summary_output,
        prepared_output=args.prepared_output,
    )

    print(f"Prepared rows: {len(dataset)}")
    print(f"Best model: {bundle['model_name']}")
    print(f"RMSE: {bundle['metrics']['rmse']:.4f}")
    print(f"MAE: {bundle['metrics']['mae']:.4f}")
    print(f"Saved best model to {model_path}")
    print(f"Saved training summary to {summary_path}")
    print(f"Saved prepared dataset to {prepared_path}")


if __name__ == "__main__":
    main()
