"""
FarmPal Historical Weather Seed
---------------------------------
Fetches 10 full years (2015-2024) of real hourly weather data from
Open-Meteo's free historical archive for 61 Kenyan farming locations
covering all counties and key agricultural towns — ~5.3 million labeled rows total.

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

# ── 61 Kenyan locations — all major counties + key agricultural towns ─────────
LOCATIONS = [
    # Rift Valley — wheat, maize, pyrethrum, tea
    {"name": "Nakuru",       "lat": -0.3031, "lon": 36.0800},
    {"name": "Eldoret",      "lat":  0.5143, "lon": 35.2698},
    {"name": "Kericho",      "lat": -0.3686, "lon": 35.2864},
    {"name": "Kitale",       "lat":  1.0155, "lon": 35.0062},
    {"name": "Narok",        "lat": -1.0769, "lon": 35.8710},
    {"name": "Bomet",        "lat": -0.7844, "lon": 35.3420},
    {"name": "Iten",         "lat":  0.6704, "lon": 35.5083},
    {"name": "Molo",         "lat": -0.2506, "lon": 35.7323},
    {"name": "Nandi Hills",  "lat":  0.1030, "lon": 35.1872},
    {"name": "Sotik",        "lat": -0.6793, "lon": 35.1208},
    {"name": "Kabarnet",     "lat":  0.4918, "lon": 35.7406},
    {"name": "Kapenguria",   "lat":  1.2393, "lon": 35.1128},
    {"name": "Lodwar",       "lat":  3.1193, "lon": 35.5966},
    {"name": "Maralal",      "lat":  1.0988, "lon": 36.7022},
    {"name": "Kapsabet",     "lat":  0.2027, "lon": 35.0993},

    # Central Kenya — coffee, tea, horticulture, dairy
    {"name": "Nairobi",      "lat": -1.2921, "lon": 36.8219},
    {"name": "Thika",        "lat": -1.0332, "lon": 37.0693},
    {"name": "Nyeri",        "lat": -0.4169, "lon": 36.9513},
    {"name": "Kerugoya",     "lat": -0.4913, "lon": 37.2823},
    {"name": "Muranga",      "lat": -0.7212, "lon": 37.1526},
    {"name": "Kiambu",       "lat": -1.1714, "lon": 36.8352},
    {"name": "Limuru",       "lat": -1.1163, "lon": 36.6413},
    {"name": "Nanyuki",      "lat":  0.0142, "lon": 37.0741},
    {"name": "Nyahururu",    "lat":  0.0270, "lon": 36.3622},
    {"name": "Ol Kalou",     "lat":  0.2639, "lon": 36.3838},
    {"name": "Githunguri",   "lat": -1.0617, "lon": 36.7128},

    # Eastern Kenya — coffee, miraa, mango, lower rainfall zones
    {"name": "Meru",         "lat":  0.0500, "lon": 37.6496},
    {"name": "Chuka",        "lat": -0.3333, "lon": 37.6500},
    {"name": "Embu",         "lat": -0.5310, "lon": 37.4500},
    {"name": "Machakos",     "lat": -1.5177, "lon": 37.2634},
    {"name": "Kitui",        "lat": -1.3666, "lon": 38.0123},
    {"name": "Mwingi",       "lat": -0.9310, "lon": 38.0648},
    {"name": "Makueni",      "lat": -1.8044, "lon": 37.6241},
    {"name": "Kibwezi",      "lat": -2.4063, "lon": 37.9521},

    # Nyanza & Western — sugarcane, tea, rice, fishing
    {"name": "Kisumu",       "lat": -0.0917, "lon": 34.7679},
    {"name": "Kisii",        "lat": -0.6698, "lon": 34.7638},
    {"name": "Kakamega",     "lat":  0.2827, "lon": 34.7519},
    {"name": "Bungoma",      "lat":  0.5635, "lon": 34.5614},
    {"name": "Busia",        "lat":  0.4604, "lon": 34.1115},
    {"name": "Siaya",        "lat":  0.0625, "lon": 34.2879},
    {"name": "Vihiga",       "lat":  0.0700, "lon": 34.7231},
    {"name": "Migori",       "lat": -1.0634, "lon": 34.4731},
    {"name": "Homa Bay",     "lat": -0.5194, "lon": 34.4571},
    {"name": "Nyamira",      "lat": -0.5669, "lon": 34.9355},

    # South
    {"name": "Kajiado",      "lat": -1.8510, "lon": 36.7761},
    {"name": "Athi River",   "lat": -1.4522, "lon": 36.9786},

    # Coast — cashew, coconut, rice, mangoes
    {"name": "Mombasa",      "lat": -4.0435, "lon": 39.6682},
    {"name": "Malindi",      "lat": -3.2136, "lon": 40.1090},
    {"name": "Kilifi",       "lat": -3.6305, "lon": 39.8499},
    {"name": "Kwale",        "lat": -4.1790, "lon": 39.4524},
    {"name": "Voi",          "lat": -3.3960, "lon": 38.5582},
    {"name": "Lamu",         "lat": -2.2694, "lon": 40.9027},
    {"name": "Taita Taveta", "lat": -3.3167, "lon": 38.3500},
    {"name": "Taveta",       "lat": -3.3963, "lon": 37.6856},

    # Arid North — sorghum, pastoralism, flood recession farming
    {"name": "Isiolo",       "lat":  0.3539, "lon": 37.5828},
    {"name": "Marsabit",     "lat":  2.3313, "lon": 37.9927},
    {"name": "Moyale",       "lat":  3.5236, "lon": 39.0532},
    {"name": "Garissa",      "lat": -0.4532, "lon": 39.6461},
    {"name": "Wajir",        "lat":  1.7471, "lon": 40.0573},
    {"name": "Mandera",      "lat":  3.9366, "lon": 41.8670},
    {"name": "Hola",         "lat": -1.4806, "lon": 40.0305},
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
