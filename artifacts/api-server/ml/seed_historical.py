"""
FarmPal Historical Weather Seed
---------------------------------
Fetches 1 full year (2024) of real hourly weather data from
Open-Meteo's free historical archive for 7 major Kenyan farming
locations and inserts it into weather_data so the sklearn ensemble
(LR + RF + GB) has thousands of training pairs from day one on any
fresh deployment — Railway, Render, or any server.

Usage (run once after deploy, from repo root):
    python3 artifacts/api-server/ml/seed_historical.py

Safe to re-run — uses ON CONFLICT DO NOTHING so no duplicates.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable is not set.")
    sys.exit(1)

# ── 7 major Kenyan farming regions ──────────────────────────────────────────
LOCATIONS = [
    {"name": "Nakuru",  "lat": -0.3031, "lon": 36.0800},
    {"name": "Nairobi", "lat": -1.2921, "lon": 36.8219},
    {"name": "Kisumu",  "lat": -0.1022, "lon": 34.7617},
    {"name": "Eldoret", "lat":  0.5143, "lon": 35.2698},
    {"name": "Meru",    "lat":  0.0469, "lon": 37.6490},
    {"name": "Kisii",   "lat": -0.6817, "lon": 34.7667},
    {"name": "Nyeri",   "lat": -0.4167, "lon": 36.9500},
]

# 1 full year — gives ~8 760 hourly observations per location
# and thousands of rain/no-rain labeled pairs for the ensemble
START_DATE = "2024-01-01"
END_DATE   = "2024-12-31"

# WMO weather codes that mean rain is happening
RAIN_CODES = {51,53,55,61,63,65,71,73,75,80,81,82,95,96,99}


def fetch_hourly(lat: float, lon: float) -> dict:
    """Fetch one year of hourly data from Open-Meteo historical API."""
    params = "&".join([
        f"latitude={lat}",
        f"longitude={lon}",
        f"start_date={START_DATE}",
        f"end_date={END_DATE}",
        "hourly=temperature_2m,relativehumidity_2m,pressure_msl,windspeed_10m,weathercode,precipitation",
        "timezone=Africa%2FNairobi",
    ])
    url = f"https://archive-api.open-meteo.com/v1/archive?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "FarmPal/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())["hourly"]


def insert_rows(conn, lat: float, lon: float, hourly: dict) -> int:
    """Insert hourly rows into weather_data. Returns count inserted."""
    times       = hourly["time"]
    temps       = hourly["temperature_2m"]
    humidities  = hourly["relativehumidity_2m"]
    pressures   = hourly["pressure_msl"]
    windspeeds  = hourly["windspeed_10m"]
    codes       = hourly["weathercode"]

    inserted = 0
    with conn.cursor() as cur:
        for i, ts in enumerate(times):
            temp     = temps[i]
            humidity = humidities[i]
            pressure = pressures[i]
            wind     = windspeeds[i] or 0.0
            code     = codes[i] or 0

            # Skip hours with missing core readings
            if temp is None or humidity is None or pressure is None:
                continue

            is_rain    = int(code) in RAIN_CODES
            prediction = "rain" if is_rain else "no_rain"
            confidence = 0.75   # historical archive = ground truth

            cur.execute("""
                INSERT INTO weather_data
                  (latitude, longitude, temperature, windspeed, humidity,
                   pressure, weathercode, prediction, confidence, reasoning, created_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT DO NOTHING
            """, (
                lat, lon,
                float(temp),
                float(wind),
                float(humidity),
                float(pressure),
                int(code),
                prediction,
                float(confidence),
                "Historical seed — Open-Meteo 2024 archive",
                datetime.fromisoformat(ts).replace(tzinfo=timezone.utc),
            ))
            inserted += cur.rowcount
    conn.commit()
    return inserted


def trigger_training() -> None:
    """Ask the ML service to retrain the ensemble now."""
    try:
        req = urllib.request.Request(
            "http://localhost:5000/train",
            data=b"",
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode())
            samples  = result.get("trainingSamples", "?")
            accuracy = result.get("accuracy", "?")
            print(f"\n  Ensemble trained on {samples} samples — accuracy {accuracy}%")
    except Exception as exc:
        print(f"\n  Could not reach ML service: {exc}")
        print("  Run POST /train manually after the server starts.")


def main():
    print("=" * 56)
    print("  FarmPal Historical Weather Seed")
    print(f"  Range    : {START_DATE}  ->  {END_DATE}")
    print(f"  Locations: {', '.join(l['name'] for l in LOCATIONS)}")
    print("=" * 56)

    conn = psycopg2.connect(DATABASE_URL)

    # Guard — skip if historical data already seeded (>1000 rows means it ran before)
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM weather_data WHERE reasoning LIKE 'Historical seed%'")
        existing = cur.fetchone()[0]
    if existing > 1000:
        print(f"\nHistorical seed already present ({existing:,} rows). Skipping insert.")
        print("Triggering ensemble retrain on existing data...", end="", flush=True)
        trigger_training()
        conn.close()
        return

    total = 0

    for loc in LOCATIONS:
        name, lat, lon = loc["name"], loc["lat"], loc["lon"]
        print(f"\nFetching {name} ({lat}, {lon}) ...", end="", flush=True)
        try:
            hourly   = fetch_hourly(lat, lon)
            inserted = insert_rows(conn, lat, lon, hourly)
            total   += inserted
            print(f"  inserted {inserted:,} rows")
        except urllib.error.URLError as exc:
            print(f"  NETWORK ERROR — {exc.reason}")
        except Exception as exc:
            print(f"  FAILED — {exc}")

        time.sleep(1)   # be polite to the free API

    conn.close()

    print(f"\nTotal rows inserted : {total:,}")
    print("Training ensemble   ...", end="", flush=True)
    trigger_training()
    print("\nSeed complete — first-time farmers will get accurate predictions.")


if __name__ == "__main__":
    main()
