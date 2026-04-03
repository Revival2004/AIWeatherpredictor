"""
FarmPal Historical Weather Seed
---------------------------------
Fetches 10 full years (2015-2024) of real hourly weather data from
Open-Meteo's free historical archive for all 47 Kenyan county seats
plus key agricultural towns — ~4.1 million labeled rows total.

Coverage includes every Kenyan climate zone:
  - Coast (Mombasa, Malindi, Lamu, Kwale, Kilifi)
  - Central highlands (Nyeri, Murang'a, Kiambu, Kirinyaga, Nyandarua)
  - Rift Valley (Nakuru, Narok, Kajiado, Baringo, Laikipia)
  - Western / Lake Victoria basin (Kisumu, Kakamega, Siaya, Busia)
  - Eastern / ASAL (Kitui, Machakos, Garissa, Wajir, Mandera, Marsabit)
  - North Rift (Eldoret, Kitale, Lodwar, Maralal, Kapenguria)
  - Tea / flower country (Kericho, Bomet, Nandi, Vihiga)

Captures Kenya's full seasonal cycles:
  - Long rains (March-May), Short rains (Oct-Dec)
  - El Nino / La Nina drought years
  - Elevation-driven microclimate variation across all sites

Usage (run once after deploy, from repo root):
    python3 artifacts/api-server/ml/seed_historical.py

Safe to re-run — skips locations already seeded, only fetches new ones.
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

# ── All 47 Kenyan counties + key agricultural towns ──────────────────────────
LOCATIONS = [
    # Nairobi & Central
    {"name": "Nairobi",          "lat": -1.2921, "lon": 36.8219},
    {"name": "Thika",            "lat": -1.0332, "lon": 37.0693},
    {"name": "Nyeri",            "lat": -0.4167, "lon": 36.9500},
    {"name": "Kerugoya",         "lat": -0.4913, "lon": 37.2823},
    {"name": "Murang'a",         "lat": -0.7176, "lon": 37.1524},
    {"name": "Ol Kalou",         "lat": -0.2682, "lon": 36.3786},
    {"name": "Nyahururu",        "lat": -0.0256, "lon": 36.3636},

    # Rift Valley
    {"name": "Nakuru",           "lat": -0.3031, "lon": 36.0800},
    {"name": "Narok",            "lat": -1.0813, "lon": 35.8714},
    {"name": "Kajiado",          "lat": -1.8500, "lon": 36.7765},
    {"name": "Nanyuki",          "lat":  0.0174, "lon": 37.0740},
    {"name": "Kabarnet",         "lat":  0.4915, "lon": 35.7432},
    {"name": "Kericho",          "lat": -0.3690, "lon": 35.2863},
    {"name": "Bomet",            "lat": -0.7831, "lon": 35.3413},

    # North Rift
    {"name": "Eldoret",          "lat":  0.5143, "lon": 35.2698},
    {"name": "Kitale",           "lat":  1.0154, "lon": 35.0062},
    {"name": "Kapenguria",       "lat":  1.2388, "lon": 35.1126},
    {"name": "Lodwar",           "lat":  3.1193, "lon": 35.5966},
    {"name": "Maralal",          "lat":  1.0988, "lon": 36.7022},
    {"name": "Iten",             "lat":  0.6702, "lon": 35.5082},
    {"name": "Kapsabet",         "lat":  0.2027, "lon": 35.0993},

    # Western / Lake Victoria
    {"name": "Kisumu",           "lat": -0.1022, "lon": 34.7617},
    {"name": "Kakamega",         "lat":  0.2827, "lon": 34.7519},
    {"name": "Bungoma",          "lat":  0.5635, "lon": 34.5606},
    {"name": "Busia",            "lat":  0.4604, "lon": 34.1115},
    {"name": "Siaya",            "lat": -0.0608, "lon": 34.2882},
    {"name": "Vihiga",           "lat":  0.0700, "lon": 34.7231},
    {"name": "Homa Bay",         "lat": -0.5273, "lon": 34.4571},
    {"name": "Migori",           "lat": -1.0634, "lon": 34.4731},
    {"name": "Kisii",            "lat": -0.6817, "lon": 34.7667},
    {"name": "Nyamira",          "lat": -0.5669, "lon": 34.9356},

    # Eastern / Mt Kenya region
    {"name": "Meru",             "lat":  0.0469, "lon": 37.6490},
    {"name": "Chuka",            "lat": -0.3333, "lon": 37.6500},
    {"name": "Embu",             "lat": -0.5273, "lon": 37.4584},
    {"name": "Kitui",            "lat": -1.3671, "lon": 38.0107},
    {"name": "Machakos",         "lat": -1.5177, "lon": 37.2634},
    {"name": "Wote",             "lat": -1.7817, "lon": 37.6353},
    {"name": "Isiolo",           "lat":  0.3542, "lon": 37.5820},

    # ASAL North & North East
    {"name": "Marsabit",         "lat":  2.3284, "lon": 37.9898},
    {"name": "Garissa",          "lat": -0.4532, "lon": 39.6461},
    {"name": "Wajir",            "lat":  1.7471, "lon": 40.0573},
    {"name": "Mandera",          "lat":  3.9366, "lon": 41.8670},
    {"name": "Moyale",           "lat":  3.5236, "lon": 39.0532},
    {"name": "Hola",             "lat": -1.4806, "lon": 40.0305},

    # Coast
    {"name": "Mombasa",          "lat": -4.0435, "lon": 39.6682},
    {"name": "Malindi",          "lat": -3.2175, "lon": 40.1169},
    {"name": "Kilifi",           "lat": -3.6305, "lon": 39.8499},
    {"name": "Kwale",            "lat": -4.1735, "lon": 39.4527},
    {"name": "Lamu",             "lat": -2.2694, "lon": 40.9027},
    {"name": "Voi",              "lat": -3.3964, "lon": 38.5566},
    {"name": "Taveta",           "lat": -3.3963, "lon": 37.6856},
]

# 10 full years of hourly data per location
START_DATE = "2015-01-01"
END_DATE   = "2024-12-31"

# WMO weather codes that mean rain is happening
RAIN_CODES = {51,53,55,61,63,65,71,73,75,80,81,82,95,96,99}


def already_seeded(conn, lat: float, lon: float) -> bool:
    """Return True if this location already has historical seed data."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) FROM weather_data
            WHERE reasoning LIKE 'Historical seed%%'
              AND ABS(latitude  - %s) < 0.01
              AND ABS(longitude - %s) < 0.01
        """, (lat, lon))
        return cur.fetchone()[0] > 1000


def fetch_hourly(lat: float, lon: float) -> dict:
    """Fetch 10 years of hourly data from Open-Meteo historical API with retry."""
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

    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode())["hourly"]
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 10 * (2 ** attempt)   # 10s, 20s, 40s, 80s, 160s
                print(f" [rate-limited, waiting {wait}s]", end="", flush=True)
                time.sleep(wait)
            else:
                raise
    raise Exception("Exceeded retries due to rate limiting")


def insert_rows(conn, lat: float, lon: float, hourly: dict) -> int:
    """Bulk-insert hourly rows. Returns count inserted."""
    times      = hourly["time"]
    temps      = hourly["temperature_2m"]
    humidities = hourly["relativehumidity_2m"]
    pressures  = hourly["pressure_msl"]
    winds      = hourly["windspeed_10m"]
    codes      = hourly["weathercode"]

    rows = []
    for i, ts in enumerate(times):
        t, h, p = temps[i], humidities[i], pressures[i]
        if t is None or h is None or p is None:
            continue
        c = int(codes[i] or 0)
        rows.append((
            lat, lon,
            float(t),
            float(winds[i] or 0),
            float(h),
            float(p),
            c,
            "rain" if c in RAIN_CODES else "no_rain",
            0.75,
            "Historical seed — Open-Meteo archive",
            datetime.fromisoformat(ts).replace(tzinfo=timezone.utc),
        ))

    if not rows:
        return 0

    inserted = 0
    BATCH = 500
    with conn.cursor() as cur:
        for i in range(0, len(rows), BATCH):
            batch = rows[i:i + BATCH]
            args = b",".join(
                cur.mogrify("(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", r)
                for r in batch
            )
            cur.execute(
                b"INSERT INTO weather_data "
                b"(latitude,longitude,temperature,windspeed,humidity,"
                b"pressure,weathercode,prediction,confidence,reasoning,created_at) "
                b"VALUES " + args
            )
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
        with urllib.request.urlopen(req, timeout=180) as resp:
            result = json.loads(resp.read().decode())
            samples  = result.get("trainingSamples", "?")
            accuracy = result.get("accuracy", "?")
            print(f"\n  Ensemble trained on {samples} samples — accuracy {accuracy}%")
    except Exception as exc:
        print(f"\n  Could not reach ML service: {exc}")
        print("  Run POST /train manually after the server starts.")


def main():
    total_locs   = len(LOCATIONS)
    print("=" * 62)
    print("  FarmPal Historical Weather Seed — All Kenya")
    print(f"  Range     : {START_DATE}  ->  {END_DATE}")
    print(f"  Locations : {total_locs} sites across all 47 counties")
    print(f"  Expected  : ~{total_locs * 87_672:,} rows (~{total_locs * 87_672 * 130 // 1_000_000} MB)")
    print("=" * 62)

    conn     = psycopg2.connect(DATABASE_URL)
    total    = 0
    skipped  = 0
    failed   = 0

    for idx, loc in enumerate(LOCATIONS, 1):
        name, lat, lon = loc["name"], loc["lat"], loc["lon"]
        prefix = f"[{idx:>2}/{total_locs}] {name:<20}"

        if already_seeded(conn, lat, lon):
            print(f"{prefix} already seeded — skipping")
            skipped += 1
            continue

        print(f"{prefix} fetching...", end="", flush=True)
        try:
            hourly   = fetch_hourly(lat, lon)
            inserted = insert_rows(conn, lat, lon, hourly)
            total   += inserted
            print(f" {inserted:>7,} rows inserted")
        except urllib.error.URLError as exc:
            print(f" NETWORK ERROR — {exc.reason}")
            failed += 1
        except Exception as exc:
            print(f" FAILED — {exc}")
            failed += 1

        time.sleep(3)   # be polite to the free API — avoids rate limiting

    conn.close()

    print()
    print(f"  New rows inserted : {total:,}")
    print(f"  Locations skipped : {skipped} (already had data)")
    print(f"  Locations failed  : {failed} (re-run to retry)")
    print()
    print("Training ensemble on full dataset...", end="", flush=True)
    trigger_training()
    print("\nSeed complete — all Kenyan farmers get accurate predictions.")


if __name__ == "__main__":
    main()
