from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pandas as pd
import psycopg2
import psycopg2.extras
import requests

OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"
ML_TIMEZONE = "Africa/Nairobi"


def get_db_connection(database_url: str):
    return psycopg2.connect(database_url)


def fetch_training_rows_from_db(
    database_url: str,
    *,
    per_cell_limit: int = 1_200,
) -> list[dict[str, Any]]:
    """Fetch recent contiguous rows per spatial cell for model training."""
    query = """
        WITH ranked AS (
            SELECT
                latitude AS lat,
                longitude AS lon,
                temperature,
                humidity,
                pressure,
                windspeed,
                weathercode,
                reasoning,
                created_at,
                ROW_NUMBER() OVER (
                    PARTITION BY ROUND(latitude::numeric, 1), ROUND(longitude::numeric, 1)
                    ORDER BY created_at DESC
                ) AS rn
            FROM weather_data
            WHERE temperature IS NOT NULL
              AND humidity IS NOT NULL
              AND pressure IS NOT NULL
              AND windspeed IS NOT NULL
        )
        SELECT lat, lon, temperature, humidity, pressure, windspeed, weathercode, reasoning, created_at
        FROM ranked
        WHERE rn <= %s
        ORDER BY ROUND(lat::numeric, 1), ROUND(lon::numeric, 1), created_at ASC
    """

    connection = get_db_connection(database_url)
    try:
        with connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(query, (per_cell_limit,))
            return [dict(row) for row in cursor.fetchall()]
    finally:
        connection.close()


def fetch_recent_rows_from_db(
    database_url: str,
    *,
    lat: float,
    lon: float,
    limit: int = 240,
    radius_deg: float = 0.25,
) -> list[dict[str, Any]]:
    """Fetch recent nearby rows so inference can reuse FarmPal's local history."""
    query = """
        SELECT
            latitude AS lat,
            longitude AS lon,
            temperature,
            humidity,
            pressure,
            windspeed,
            weathercode,
            reasoning,
            created_at
        FROM weather_data
        WHERE latitude BETWEEN %s AND %s
          AND longitude BETWEEN %s AND %s
        ORDER BY created_at DESC
        LIMIT %s
    """

    connection = get_db_connection(database_url)
    try:
        with connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                query,
                (lat - radius_deg, lat + radius_deg, lon - radius_deg, lon + radius_deg, limit),
            )
            rows = [dict(row) for row in cursor.fetchall()]
    finally:
        connection.close()

    rows.reverse()
    return rows


def _open_meteo_get(url: str, *, params: dict[str, Any], timeout: int = 30) -> dict[str, Any]:
    response = requests.get(
        url,
        params=params,
        timeout=timeout,
        headers={"User-Agent": "FarmPal-ML/5.0"},
    )
    response.raise_for_status()
    return response.json()


def fetch_elevations(pairs: list[tuple[float, float]]) -> dict[tuple[float, float], float]:
    if not pairs:
        return {}

    chunk_size = 100
    result: dict[tuple[float, float], float] = {}
    for start in range(0, len(pairs), chunk_size):
        chunk = pairs[start : start + chunk_size]
        payload = _open_meteo_get(
            OPEN_METEO_ELEVATION_URL,
            params={
                "latitude": ",".join(f"{lat:.6f}" for lat, _ in chunk),
                "longitude": ",".join(f"{lon:.6f}" for _, lon in chunk),
            },
            timeout=20,
        )
        elevations = payload.get("elevation", [])
        for index, pair in enumerate(chunk):
            result[pair] = float(elevations[index]) if index < len(elevations) else 1000.0
    return result


def fetch_recent_weather_context(
    *,
    lat: float,
    lon: float,
    days: int = 8,
) -> pd.DataFrame:
    """Fetch recent hourly context for inference directly from Open-Meteo."""
    payload = _open_meteo_get(
        OPEN_METEO_FORECAST_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,weathercode,precipitation",
            "past_days": days,
            "forecast_days": 1,
            "timezone": "UTC",
        },
        timeout=20,
    )
    hourly = payload.get("hourly") or {}
    frame = pd.DataFrame(
        {
            "created_at": pd.to_datetime(hourly.get("time", []), utc=True, errors="coerce"),
            "temperature": hourly.get("temperature_2m", []),
            "humidity": hourly.get("relative_humidity_2m", []),
            "pressure": hourly.get("pressure_msl", []),
            "windspeed": hourly.get("wind_speed_10m", []),
            "weathercode": hourly.get("weathercode", []),
            "precipitation_mm": hourly.get("precipitation", []),
        }
    )
    frame["lat"] = lat
    frame["lon"] = lon
    return frame


def fetch_historical_location_frame(
    *,
    lat: float,
    lon: float,
    start_date: str,
    end_date: str,
    retries: int = 4,
) -> pd.DataFrame:
    """Fetch hourly history for one location for bootstrap and seeding."""
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            payload = _open_meteo_get(
                OPEN_METEO_ARCHIVE_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "start_date": start_date,
                    "end_date": end_date,
                    "hourly": "temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,weather_code,precipitation",
                    "timezone": ML_TIMEZONE,
                },
                timeout=90,
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
        except Exception as exc:  # pragma: no cover - network failure path
            last_error = exc
            if attempt < retries - 1:
                from time import sleep

                sleep(15 * (attempt + 1))
                continue
            raise

    if last_error:
        raise last_error
    raise RuntimeError("Historical fetch failed without an explicit error.")


def build_current_payload_from_context(
    context_frame: pd.DataFrame,
    *,
    lat: float,
    lon: float,
    elevation: float,
    timestamp: datetime | None = None,
) -> dict[str, Any]:
    """Convert the latest known context row into a prediction payload."""
    if context_frame.empty:
        raise ValueError("Recent weather context is empty.")

    latest = context_frame.sort_values("created_at").iloc[-1]
    payload = {
        "created_at": timestamp or datetime.now(UTC),
        "lat": lat,
        "lon": lon,
        "temperature": float(latest["temperature"]),
        "humidity": float(latest["humidity"]),
        "pressure": float(latest["pressure"]),
        "windspeed": float(latest["windspeed"]),
        "weathercode": int(latest.get("weathercode", 0) or 0),
        "precipitation_mm": float(latest.get("precipitation_mm", 0.0) or 0.0),
        "elevation": float(elevation),
    }
    return payload
