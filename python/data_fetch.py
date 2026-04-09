from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
import requests


OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
DAILY_VARIABLES = [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
]


def validate_date_range(start_date: str, end_date: str) -> tuple[str, str]:
    """Validate YYYY-MM-DD inputs and ensure start_date <= end_date."""
    start = pd.to_datetime(start_date, format="%Y-%m-%d", errors="raise")
    end = pd.to_datetime(end_date, format="%Y-%m-%d", errors="raise")
    if start > end:
        raise ValueError("start_date must be earlier than or equal to end_date.")
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


def build_session(use_env_proxy: bool = False) -> requests.Session:
    """
    Build a requests session.

    By default we ignore environment proxy settings because broken local proxy
    values can block Open-Meteo calls entirely. Enable them explicitly when needed.
    """
    session = requests.Session()
    session.trust_env = use_env_proxy
    return session


def _frame_from_daily_payload(
    payload: dict,
    *,
    latitude: float,
    longitude: float,
) -> pd.DataFrame:
    daily = payload.get("daily")
    if not daily:
        raise ValueError("Open-Meteo response did not include daily weather data.")

    required_columns = ["time", *DAILY_VARIABLES]
    missing_columns = [column for column in required_columns if column not in daily]
    if missing_columns:
        raise ValueError(
            f"Open-Meteo response is missing required daily fields: {', '.join(missing_columns)}"
        )

    frame = pd.DataFrame(
        {
            "date": pd.to_datetime(daily["time"], errors="coerce"),
            "temperature_2m_max": daily["temperature_2m_max"],
            "temperature_2m_min": daily["temperature_2m_min"],
            "precipitation_sum": daily["precipitation_sum"],
        }
    )

    frame = frame.dropna(subset=["date"]).copy()
    frame["temperature_2m_max"] = pd.to_numeric(frame["temperature_2m_max"], errors="coerce")
    frame["temperature_2m_min"] = pd.to_numeric(frame["temperature_2m_min"], errors="coerce")
    frame["precipitation_sum"] = pd.to_numeric(frame["precipitation_sum"], errors="coerce")
    frame["temperature_2m_mean"] = (
        frame["temperature_2m_max"] + frame["temperature_2m_min"]
    ) / 2.0
    frame["latitude"] = float(latitude)
    frame["longitude"] = float(longitude)
    return frame


def fetch_historical_weather(
    latitude: float,
    longitude: float,
    start_date: str,
    end_date: str,
    *,
    use_env_proxy: bool = False,
) -> pd.DataFrame:
    """Fetch daily historical weather data from Open-Meteo."""
    start_date, end_date = validate_date_range(start_date, end_date)
    session = build_session(use_env_proxy=use_env_proxy)

    response = session.get(
        OPEN_METEO_ARCHIVE_URL,
        params={
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start_date,
            "end_date": end_date,
            "daily": ",".join(DAILY_VARIABLES),
            "timezone": "auto",
        },
        timeout=30,
    )
    response.raise_for_status()
    return _frame_from_daily_payload(
        response.json(),
        latitude=latitude,
        longitude=longitude,
    )


def fetch_recent_weather(
    latitude: float,
    longitude: float,
    *,
    history_days: int = 30,
    forecast_days: int = 1,
    use_env_proxy: bool = False,
) -> pd.DataFrame:
    """Fetch recent daily weather needed to build prediction-time features."""
    if history_days < 7:
        raise ValueError("history_days must be at least 7 to support lag features.")
    if forecast_days < 1:
        raise ValueError("forecast_days must be at least 1.")

    session = build_session(use_env_proxy=use_env_proxy)
    response = session.get(
        OPEN_METEO_FORECAST_URL,
        params={
            "latitude": latitude,
            "longitude": longitude,
            "daily": ",".join(DAILY_VARIABLES),
            "past_days": history_days,
            "forecast_days": forecast_days,
            "timezone": "auto",
        },
        timeout=30,
    )
    response.raise_for_status()
    return _frame_from_daily_payload(
        response.json(),
        latitude=latitude,
        longitude=longitude,
    )


def load_weather_csv(csv_path: str | Path) -> pd.DataFrame:
    """Load an existing dataset from CSV."""
    frame = pd.read_csv(csv_path)
    if "date" not in frame.columns:
        raise ValueError("Dataset must include a 'date' column.")

    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame = frame.dropna(subset=["date"]).copy()
    return frame


def save_weather_csv(frame: pd.DataFrame, output_path: str | Path) -> Path:
    """Save the DataFrame to CSV and return the written path."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)
    return path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Fetch historical weather data from Open-Meteo and save it to CSV."
    )
    parser.add_argument("--latitude", type=float, required=True, help="Latitude value")
    parser.add_argument("--longitude", type=float, required=True, help="Longitude value")
    parser.add_argument("--start-date", required=True, help="Start date in YYYY-MM-DD format")
    parser.add_argument("--end-date", required=True, help="End date in YYYY-MM-DD format")
    parser.add_argument(
        "--output",
        default="historical_weather.csv",
        help="CSV output path. Defaults to historical_weather.csv",
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

    frame = fetch_historical_weather(
        latitude=args.latitude,
        longitude=args.longitude,
        start_date=args.start_date,
        end_date=args.end_date,
        use_env_proxy=args.use_env_proxy,
    )
    output_path = save_weather_csv(frame, args.output)

    print(frame.head())
    print(f"\nSaved {len(frame)} rows to {output_path}")


if __name__ == "__main__":
    main()
