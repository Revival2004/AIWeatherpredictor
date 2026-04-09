from __future__ import annotations

import numpy as np
import pandas as pd


TARGET_COLUMN = "target_precipitation_sum"
FEATURE_COLUMNS = [
    "latitude",
    "longitude",
    "temperature_2m_max",
    "temperature_2m_min",
    "temperature_2m_mean",
    "temperature_range",
    "precipitation_sum",
    "month",
    "day_of_year",
    "precipitation_lag_1",
    "precipitation_lag_2",
    "precipitation_lag_3",
    "precipitation_lag_7",
    "temperature_mean_lag_1",
    "temperature_mean_lag_2",
    "temperature_mean_lag_3",
    "temperature_mean_lag_7",
    "precipitation_roll_3",
    "precipitation_roll_7",
    "temperature_roll_3",
    "temperature_roll_7",
    "precipitation_trend_1",
    "precipitation_trend_3",
    "temperature_trend_1",
    "temperature_trend_3",
]

_REQUIRED_COLUMNS = {
    "date",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
}


def clean_weather_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Standardize types, remove duplicates, and fill basic missing values."""
    if frame.empty:
        raise ValueError("Weather dataset is empty.")

    missing_columns = sorted(_REQUIRED_COLUMNS - set(frame.columns))
    if missing_columns:
        raise ValueError(
            f"Dataset is missing required columns: {', '.join(missing_columns)}"
        )

    cleaned = frame.copy()
    cleaned["date"] = pd.to_datetime(cleaned["date"], errors="coerce")
    cleaned = cleaned.dropna(subset=["date"]).copy()
    cleaned = cleaned.sort_values("date").drop_duplicates(subset=["date"], keep="last")
    cleaned = cleaned.reset_index(drop=True)

    for column in [
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_sum",
        "latitude",
        "longitude",
    ]:
        if column not in cleaned.columns:
            cleaned[column] = np.nan
        cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce")

    cleaned["temperature_2m_max"] = cleaned["temperature_2m_max"].interpolate(
        limit_direction="both"
    )
    cleaned["temperature_2m_min"] = cleaned["temperature_2m_min"].interpolate(
        limit_direction="both"
    )
    cleaned["precipitation_sum"] = cleaned["precipitation_sum"].fillna(0.0).clip(lower=0.0)
    cleaned["latitude"] = cleaned["latitude"].ffill().bfill()
    cleaned["longitude"] = cleaned["longitude"].ffill().bfill()

    cleaned["temperature_2m_mean"] = (
        cleaned["temperature_2m_max"] + cleaned["temperature_2m_min"]
    ) / 2.0
    cleaned["temperature_range"] = (
        cleaned["temperature_2m_max"] - cleaned["temperature_2m_min"]
    )

    if cleaned[["temperature_2m_max", "temperature_2m_min"]].isna().any().any():
        raise ValueError("Temperature columns still contain missing values after cleaning.")
    if cleaned[["latitude", "longitude"]].isna().any().any():
        raise ValueError("Latitude/longitude columns contain missing values.")

    return cleaned


def engineer_weather_features(frame: pd.DataFrame) -> pd.DataFrame:
    """Add seasonal, lag, rolling, and simple trend features."""
    engineered = clean_weather_frame(frame)

    engineered["month"] = engineered["date"].dt.month
    engineered["day_of_year"] = engineered["date"].dt.dayofyear

    for lag in (1, 2, 3, 7):
        engineered[f"precipitation_lag_{lag}"] = engineered["precipitation_sum"].shift(lag)
        engineered[f"temperature_mean_lag_{lag}"] = engineered["temperature_2m_mean"].shift(lag)

    engineered["precipitation_roll_3"] = engineered["precipitation_sum"].rolling(
        window=3,
        min_periods=1,
    ).mean()
    engineered["precipitation_roll_7"] = engineered["precipitation_sum"].rolling(
        window=7,
        min_periods=1,
    ).mean()
    engineered["temperature_roll_3"] = engineered["temperature_2m_mean"].rolling(
        window=3,
        min_periods=1,
    ).mean()
    engineered["temperature_roll_7"] = engineered["temperature_2m_mean"].rolling(
        window=7,
        min_periods=1,
    ).mean()

    engineered["precipitation_trend_1"] = engineered["precipitation_sum"].diff()
    engineered["temperature_trend_1"] = engineered["temperature_2m_mean"].diff()
    engineered["precipitation_trend_3"] = (
        engineered["precipitation_roll_3"] - engineered["precipitation_roll_7"]
    )
    engineered["temperature_trend_3"] = (
        engineered["temperature_roll_3"] - engineered["temperature_roll_7"]
    )

    engineered["prediction_date"] = engineered["date"] + pd.Timedelta(days=1)
    engineered[TARGET_COLUMN] = engineered["precipitation_sum"].shift(-1)
    return engineered


def prepare_training_dataset(frame: pd.DataFrame) -> pd.DataFrame:
    """Return a clean training dataset with engineered features and target."""
    prepared = engineer_weather_features(frame)
    prepared = prepared.dropna(subset=FEATURE_COLUMNS + [TARGET_COLUMN]).copy()
    prepared[TARGET_COLUMN] = prepared[TARGET_COLUMN].clip(lower=0.0)

    if prepared.empty:
        raise ValueError("No usable rows remain after feature engineering.")

    return prepared.reset_index(drop=True)


def prepare_prediction_features(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.Timestamp]:
    """Return the latest fully-formed feature row for prediction."""
    prepared = engineer_weather_features(frame)
    prepared = prepared.dropna(subset=FEATURE_COLUMNS).copy()
    if prepared.empty:
        raise ValueError("Not enough recent weather history to build prediction features.")

    latest_row = prepared.iloc[[-1]].copy()
    latest_date = pd.Timestamp(latest_row["date"].iloc[0])
    return latest_row, latest_date
