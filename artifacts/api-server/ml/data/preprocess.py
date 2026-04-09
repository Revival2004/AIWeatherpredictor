from __future__ import annotations

import math
from typing import Any

import pandas as pd

from utils.features import build_inference_feature_row, engineer_feature_frame, ensure_feature_columns


def prepare_training_dataset(rows: list[dict[str, Any]]) -> tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
    """Build a reusable training dataset with engineered features and a 2h target."""
    raw_frame = pd.DataFrame(rows)
    feature_frame = engineer_feature_frame(raw_frame)
    if feature_frame.empty:
        raise ValueError("No usable training rows were found.")

    grouped = feature_frame.groupby("series_id", group_keys=False, sort=False)
    future_precip = grouped["precipitation_proxy"].shift(-2)
    feature_frame["target_rain"] = (future_precip > 0.0).astype(float)
    feature_frame.loc[future_precip.isna(), "target_rain"] = pd.NA

    dataset = feature_frame.dropna(subset=["target_rain"]).sort_values("created_at").reset_index(drop=True)
    if dataset.empty:
        raise ValueError("No labelled examples were produced after target generation.")

    X = ensure_feature_columns(dataset)
    y = dataset["target_rain"].astype(float)
    return X, y, dataset


def prepare_prediction_features(
    history_rows: list[dict[str, Any]] | pd.DataFrame,
    payload: dict[str, Any],
) -> pd.DataFrame:
    """Create a single prediction feature row from recent context plus payload."""
    history_frame = history_rows if isinstance(history_rows, pd.DataFrame) else pd.DataFrame(history_rows)
    feature_row = build_inference_feature_row(history_frame, payload)

    if "hour" in payload and payload["hour"] is not None:
        hour = float(payload["hour"])
        feature_row.loc[:, "hour"] = hour
        feature_row.loc[:, "hour_sin"] = math.sin(2 * math.pi * hour / 24.0)
        feature_row.loc[:, "hour_cos"] = math.cos(2 * math.pi * hour / 24.0)

    if "month" in payload and payload["month"] is not None:
        month = float(payload["month"])
        feature_row.loc[:, "month"] = month
        feature_row.loc[:, "month_sin"] = math.sin(2 * math.pi * month / 12.0)
        feature_row.loc[:, "month_cos"] = math.cos(2 * math.pi * month / 12.0)
        feature_row.loc[:, "long_rains"] = 1.0 if month in {3.0, 4.0, 5.0} else 0.0
        feature_row.loc[:, "short_rains"] = 1.0 if month in {10.0, 11.0, 12.0} else 0.0

    if "day_of_year" in payload and payload["day_of_year"] is not None:
        day_of_year = float(payload["day_of_year"])
        feature_row.loc[:, "day_of_year"] = day_of_year
        feature_row.loc[:, "day_of_year_sin"] = math.sin(2 * math.pi * day_of_year / 366.0)
        feature_row.loc[:, "day_of_year_cos"] = math.cos(2 * math.pi * day_of_year / 366.0)

    return feature_row
