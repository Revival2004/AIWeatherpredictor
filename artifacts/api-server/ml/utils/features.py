from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

RAIN_CODES = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99}

P_TEND_PATTERN = re.compile(r"p_tend=([-\d.]+)")
PRECIP_PATTERN = re.compile(r"precip=([-\d.]+)")

FEATURE_COLUMNS = [
    "temperature",
    "humidity",
    "pressure",
    "windspeed",
    "is_raining_now",
    "pressure_tendency",
    "lat",
    "lon",
    "elevation",
    "hour",
    "month",
    "day_of_year",
    "hour_sin",
    "hour_cos",
    "month_sin",
    "month_cos",
    "day_of_year_sin",
    "day_of_year_cos",
    "dew_point",
    "dewpoint_depression",
    "temperature_lag_1h",
    "temperature_lag_3h",
    "humidity_lag_3h",
    "pressure_lag_3h",
    "rain_lag_1h",
    "rain_lag_3h",
    "rain_lag_24h",
    "rain_rolling_24h",
    "rain_rolling_72h",
    "rain_rolling_168h",
    "temperature_rolling_6h",
    "humidity_rolling_6h",
    "pressure_rolling_6h",
    "temperature_trend_3h",
    "pressure_trend_3h",
    "humidity_trend_6h",
    "rain_trend_24h",
    "long_rains",
    "short_rains",
]


def _extract_metric(reasoning: str | None, pattern: re.Pattern[str]) -> float | None:
    if not reasoning:
        return None
    match = pattern.search(reasoning)
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def _rounded_series_id(lat: pd.Series, lon: pd.Series) -> pd.Series:
    return lat.round(1).astype(str) + ":" + lon.round(1).astype(str)


def normalize_observation_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Return a clean, ordered weather frame with consistent column names."""
    if frame is None or frame.empty:
        return pd.DataFrame(
            columns=[
                "created_at",
                "lat",
                "lon",
                "temperature",
                "humidity",
                "pressure",
                "windspeed",
                "weathercode",
                "is_raining_now",
                "pressure_tendency",
                "precipitation_proxy",
                "elevation",
                "series_id",
            ]
        )

    df = frame.copy()

    rename_map = {
        "latitude": "lat",
        "longitude": "lon",
        "wind_speed_10m": "windspeed",
        "weather_code": "weathercode",
        "precipitation": "precipitation_mm",
        "time": "created_at",
    }
    df = df.rename(columns=rename_map)

    for column in [
        "lat",
        "lon",
        "temperature",
        "humidity",
        "pressure",
        "windspeed",
        "weathercode",
        "elevation",
        "pressure_tendency",
        "precipitation_mm",
    ]:
        if column not in df.columns:
            df[column] = np.nan
        df[column] = pd.to_numeric(df[column], errors="coerce")

    if "created_at" not in df.columns:
        df["created_at"] = pd.Timestamp.utcnow()
    df["created_at"] = pd.to_datetime(df["created_at"], utc=True, errors="coerce")

    if "reasoning" not in df.columns:
        df["reasoning"] = None

    if "is_raining_now" not in df.columns:
        df["is_raining_now"] = df["weathercode"].isin(RAIN_CODES)
    else:
        df["is_raining_now"] = df["is_raining_now"].fillna(False).astype(bool)

    parsed_p_tend = df["reasoning"].map(lambda value: _extract_metric(value, P_TEND_PATTERN))
    parsed_precip = df["reasoning"].map(lambda value: _extract_metric(value, PRECIP_PATTERN))

    df["precipitation_mm"] = df["precipitation_mm"].fillna(parsed_precip)
    df["precipitation_proxy"] = df["precipitation_mm"].fillna(df["is_raining_now"].astype(float))

    if "series_id" not in df.columns or df["series_id"].isna().all():
        df["series_id"] = _rounded_series_id(df["lat"], df["lon"])
    else:
        df["series_id"] = df["series_id"].fillna(_rounded_series_id(df["lat"], df["lon"]))

    df = df.dropna(subset=["created_at", "lat", "lon", "temperature", "humidity", "pressure", "windspeed"])
    df = df.sort_values(["series_id", "created_at"]).reset_index(drop=True)

    grouped = df.groupby("series_id", group_keys=False, sort=False)
    inferred_p_tend = grouped["pressure"].transform(lambda series: series - series.shift(3))
    df["pressure_tendency"] = df["pressure_tendency"].fillna(parsed_p_tend).fillna(inferred_p_tend).fillna(0.0)
    df["elevation"] = df["elevation"].fillna(1000.0)
    df["weathercode"] = df["weathercode"].fillna(0).astype(int)
    df["is_raining_now"] = df["is_raining_now"].astype(float)

    return df


def engineer_feature_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Build lag, rolling, seasonal, and trend features for a weather frame."""
    df = normalize_observation_frame(frame)
    if df.empty:
        return df

    grouped = df.groupby("series_id", group_keys=False, sort=False)

    df["hour"] = df["created_at"].dt.hour.astype(float)
    df["month"] = df["created_at"].dt.month.astype(float)
    df["day_of_year"] = df["created_at"].dt.dayofyear.astype(float)

    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24.0)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24.0)
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12.0)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12.0)
    df["day_of_year_sin"] = np.sin(2 * np.pi * df["day_of_year"] / 366.0)
    df["day_of_year_cos"] = np.cos(2 * np.pi * df["day_of_year"] / 366.0)

    humidity_ratio = np.clip(df["humidity"], 1, 100) / 100.0
    gamma = (17.27 * df["temperature"] / (237.7 + df["temperature"])) + np.log(humidity_ratio)
    df["dew_point"] = (237.7 * gamma) / (17.27 - gamma)
    df["dewpoint_depression"] = df["temperature"] - df["dew_point"]

    lag_map = {
        "temperature_lag_1h": ("temperature", 1),
        "temperature_lag_3h": ("temperature", 3),
        "humidity_lag_3h": ("humidity", 3),
        "pressure_lag_3h": ("pressure", 3),
        "rain_lag_1h": ("precipitation_proxy", 1),
        "rain_lag_3h": ("precipitation_proxy", 3),
        "rain_lag_24h": ("precipitation_proxy", 24),
    }
    for feature_name, (source_column, lag_hours) in lag_map.items():
        df[feature_name] = grouped[source_column].shift(lag_hours)

    rolling_map = {
        "rain_rolling_24h": ("precipitation_proxy", 24, "mean"),
        "rain_rolling_72h": ("precipitation_proxy", 72, "mean"),
        "rain_rolling_168h": ("precipitation_proxy", 168, "mean"),
        "temperature_rolling_6h": ("temperature", 6, "mean"),
        "humidity_rolling_6h": ("humidity", 6, "mean"),
        "pressure_rolling_6h": ("pressure", 6, "mean"),
    }
    for feature_name, (source_column, window, aggregation) in rolling_map.items():
        if aggregation == "mean":
            df[feature_name] = grouped[source_column].transform(
                lambda series: series.shift(1).rolling(window=window, min_periods=1).mean()
            )
        else:
            df[feature_name] = grouped[source_column].transform(
                lambda series: series.shift(1).rolling(window=window, min_periods=1).sum()
            )

    df["temperature_trend_3h"] = df["temperature"] - df["temperature_lag_3h"]
    df["pressure_trend_3h"] = df["pressure"] - df["pressure_lag_3h"]
    df["humidity_trend_6h"] = df["humidity"] - grouped["humidity"].shift(6)
    df["rain_trend_24h"] = df["rain_rolling_24h"] - df["rain_rolling_72h"]

    df["long_rains"] = df["month"].isin([3.0, 4.0, 5.0]).astype(float)
    df["short_rains"] = df["month"].isin([10.0, 11.0, 12.0]).astype(float)

    fill_map = {
        "temperature_lag_1h": df["temperature"],
        "temperature_lag_3h": df["temperature"],
        "humidity_lag_3h": df["humidity"],
        "pressure_lag_3h": df["pressure"],
        "rain_lag_1h": 0.0,
        "rain_lag_3h": 0.0,
        "rain_lag_24h": 0.0,
        "rain_rolling_24h": 0.0,
        "rain_rolling_72h": 0.0,
        "rain_rolling_168h": 0.0,
        "temperature_rolling_6h": df["temperature"],
        "humidity_rolling_6h": df["humidity"],
        "pressure_rolling_6h": df["pressure"],
        "temperature_trend_3h": 0.0,
        "pressure_trend_3h": 0.0,
        "humidity_trend_6h": 0.0,
        "rain_trend_24h": 0.0,
    }
    for column_name, fill_value in fill_map.items():
        df[column_name] = df[column_name].fillna(fill_value)

    return df


def ensure_feature_columns(frame: pd.DataFrame) -> pd.DataFrame:
    """Return the model feature matrix in the expected column order."""
    df = frame.copy()
    for column_name in FEATURE_COLUMNS:
        if column_name not in df.columns:
            df[column_name] = 0.0
    return df[FEATURE_COLUMNS].astype(float)


def build_inference_feature_row(
    history_frame: pd.DataFrame,
    current_payload: dict[str, Any],
) -> pd.DataFrame:
    """Append a current row to context history and return one feature row."""
    payload = dict(current_payload)
    payload.setdefault("created_at", pd.Timestamp.utcnow())

    combined = pd.concat(
        [
            normalize_observation_frame(history_frame),
            normalize_observation_frame(pd.DataFrame([payload])),
        ],
        ignore_index=True,
        sort=False,
    )
    feature_frame = engineer_feature_frame(combined)
    if feature_frame.empty:
        raise ValueError("Could not build inference features from the provided payload.")
    return ensure_feature_columns(feature_frame.tail(1))
