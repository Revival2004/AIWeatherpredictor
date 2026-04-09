"""
FarmPal Historical Weather Seed — v3
=====================================
Fetches 15 full years (2010-2024) of real hourly weather data from
Open-Meteo's free historical archive for 61 Kenyan farming locations,
inserts it into the weather_data table, then optionally triggers model
training so the XGBoost/kNN ensemble works on day one — even for
a brand-new deployment.

Key improvements in v3:
  - Parallel fetching  : up to 4 concurrent HTTP requests (rate-limit safe)
  - Checkpointing      : each location is committed independently so a crash
                         mid-run can be resumed without re-fetching everything
  - Smarter resume     : checks the actual row count per location so partial
                         inserts are detected and retried
  - --retrain flag     : after seeding, calls POST /train on the ML service
                         and waits for it to complete (polls /train/status)
  - --workers N        : override the parallel worker count
  - --zone ZONE        : only seed one climate zone (coast, rift, western …)
  - --dry-run          : show what would be done without touching the DB

Expected rows: ~8.06 million  (~1.05 GB uncompressed in PostgreSQL)
Expected time: 15–25 min on a typical server (dominated by Open-Meteo rate limits)

Usage
-----
  # Full seed + train (run once at deploy time, safe to re-run)
  python3 seed_historical.py --retrain

  # Resume interrupted seed
  python3 seed_historical.py --retrain

  # Seed only the coast zone then train
  python3 seed_historical.py --zone coast --retrain

  # Just check what's already seeded
  python3 seed_historical.py --dry-run
"""

import os, sys, json, time, argparse, threading
import urllib.request, urllib.error
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import psycopg2, psycopg2.extras, psycopg2.pool
except ImportError:
    print("psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable is not set.")
    sys.exit(1)

ML_SERVICE_URL = os.environ.get("ML_SERVICE_URL", "http://localhost:5000")

# 15 full years: 2010-01-01 → 2024-12-31
START_DATE = "2010-01-01"
END_DATE   = "2024-12-31"

# Rows per location = 15yr × 8760h = 131,400 rows
# We consider a location "fully seeded" if it has > 120,000 rows
MIN_ROWS_COMPLETE = 120_000

# WMO rain codes
RAIN_CODES = {51,53,55,56,57,61,63,65,66,67,71,73,75,80,81,82,95,96,99}

print_lock = threading.Lock()

def log(msg: str) -> None:
    with print_lock:
        print(msg, flush=True)


# ── 61 Kenyan locations across all climate zones ──────────────────────────────
LOCATIONS = [
    # Rift Valley — wheat, maize, pyrethrum, tea
    {"name": "Nakuru",       "lat": -0.3031, "lon": 36.0800, "zone": "rift"},
    {"name": "Eldoret",      "lat":  0.5143, "lon": 35.2698, "zone": "rift"},
    {"name": "Kericho",      "lat": -0.3686, "lon": 35.2864, "zone": "rift"},
    {"name": "Kitale",       "lat":  1.0155, "lon": 35.0062, "zone": "rift"},
    {"name": "Narok",        "lat": -1.0769, "lon": 35.8710, "zone": "rift"},
    {"name": "Bomet",        "lat": -0.7844, "lon": 35.3420, "zone": "rift"},
    {"name": "Iten",         "lat":  0.6704, "lon": 35.5083, "zone": "rift"},
    {"name": "Molo",         "lat": -0.2506, "lon": 35.7323, "zone": "rift"},
    {"name": "Nandi Hills",  "lat":  0.1030, "lon": 35.1872, "zone": "rift"},
    {"name": "Sotik",        "lat": -0.6793, "lon": 35.1208, "zone": "rift"},
    {"name": "Kabarnet",     "lat":  0.4918, "lon": 35.7406, "zone": "rift"},
    {"name": "Kapenguria",   "lat":  1.2393, "lon": 35.1128, "zone": "rift"},
    {"name": "Lodwar",       "lat":  3.1193, "lon": 35.5966, "zone": "arid_north"},
    {"name": "Maralal",      "lat":  1.0988, "lon": 36.7022, "zone": "rift"},
    {"name": "Kapsabet",     "lat":  0.2027, "lon": 35.0993, "zone": "rift"},
    # Central Kenya — coffee, tea, horticulture, dairy
    {"name": "Nairobi",      "lat": -1.2921, "lon": 36.8219, "zone": "central"},
    {"name": "Thika",        "lat": -1.0332, "lon": 37.0693, "zone": "central"},
    {"name": "Nyeri",        "lat": -0.4169, "lon": 36.9513, "zone": "central"},
    {"name": "Kerugoya",     "lat": -0.4913, "lon": 37.2823, "zone": "central"},
    {"name": "Muranga",      "lat": -0.7212, "lon": 37.1526, "zone": "central"},
    {"name": "Kiambu",       "lat": -1.1714, "lon": 36.8352, "zone": "central"},
    {"name": "Limuru",       "lat": -1.1163, "lon": 36.6413, "zone": "central"},
    {"name": "Nanyuki",      "lat":  0.0142, "lon": 37.0741, "zone": "central"},
    {"name": "Nyahururu",    "lat":  0.0270, "lon": 36.3622, "zone": "central"},
    {"name": "Ol Kalou",     "lat":  0.2639, "lon": 36.3838, "zone": "central"},
    {"name": "Githunguri",   "lat": -1.0617, "lon": 36.7128, "zone": "central"},
    # Mount Kenya zone
    {"name": "Meru",         "lat":  0.0500, "lon": 37.6496, "zone": "mt_kenya"},
    {"name": "Chuka",        "lat": -0.3333, "lon": 37.6500, "zone": "mt_kenya"},
    {"name": "Embu",         "lat": -0.5310, "lon": 37.4500, "zone": "mt_kenya"},
    # Eastern / semi-arid
    {"name": "Machakos",     "lat": -1.5177, "lon": 37.2634, "zone": "eastern"},
    {"name": "Kitui",        "lat": -1.3666, "lon": 38.0123, "zone": "eastern"},
    {"name": "Mwingi",       "lat": -0.9310, "lon": 38.0648, "zone": "eastern"},
    {"name": "Makueni",      "lat": -1.8044, "lon": 37.6241, "zone": "eastern"},
    {"name": "Kibwezi",      "lat": -2.4063, "lon": 37.9521, "zone": "eastern"},
    # Nyanza & Western — sugarcane, tea, rice, fishing
    {"name": "Kisumu",       "lat": -0.0917, "lon": 34.7679, "zone": "western"},
    {"name": "Kisii",        "lat": -0.6698, "lon": 34.7638, "zone": "western"},
    {"name": "Kakamega",     "lat":  0.2827, "lon": 34.7519, "zone": "western"},
    {"name": "Bungoma",      "lat":  0.5635, "lon": 34.5614, "zone": "western"},
    {"name": "Busia",        "lat":  0.4604, "lon": 34.1115, "zone": "western"},
    {"name": "Siaya",        "lat":  0.0625, "lon": 34.2879, "zone": "western"},
    {"name": "Vihiga",       "lat":  0.0700, "lon": 34.7231, "zone": "western"},
    {"name": "Migori",       "lat": -1.0634, "lon": 34.4731, "zone": "western"},
    {"name": "Homa Bay",     "lat": -0.5194, "lon": 34.4571, "zone": "western"},
    {"name": "Nyamira",      "lat": -0.5669, "lon": 34.9355, "zone": "western"},
    # South
    {"name": "Kajiado",      "lat": -1.8510, "lon": 36.7761, "zone": "south"},
    {"name": "Athi River",   "lat": -1.4522, "lon": 36.9786, "zone": "south"},
    # Coast — cashew, coconut, rice, mangoes
    {"name": "Mombasa",      "lat": -4.0435, "lon": 39.6682, "zone": "coast"},
    {"name": "Malindi",      "lat": -3.2136, "lon": 40.1090, "zone": "coast"},
    {"name": "Kilifi",       "lat": -3.6305, "lon": 39.8499, "zone": "coast"},
    {"name": "Kwale",        "lat": -4.1790, "lon": 39.4524, "zone": "coast"},
    {"name": "Voi",          "lat": -3.3960, "lon": 38.5582, "zone": "coast"},
    {"name": "Lamu",         "lat": -2.2694, "lon": 40.9027, "zone": "coast"},
    {"name": "Taita Taveta", "lat": -3.3167, "lon": 38.3500, "zone": "coast"},
    {"name": "Taveta",       "lat": -3.3963, "lon": 37.6856, "zone": "coast"},
    # Arid North — sorghum, pastoralism, flood recession
    {"name": "Isiolo",       "lat":  0.3539, "lon": 37.5828, "zone": "arid_north"},
    {"name": "Marsabit",     "lat":  2.3313, "lon": 37.9927, "zone": "arid_north"},
    {"name": "Moyale",       "lat":  3.5236, "lon": 39.0532, "zone": "arid_north"},
    {"name": "Garissa",      "lat": -0.4532, "lon": 39.6461, "zone": "arid_north"},
    {"name": "Wajir",        "lat":  1.7471, "lon": 40.0573, "zone": "arid_north"},
    {"name": "Mandera",      "lat":  3.9366, "lon": 41.8670, "zone": "arid_north"},
    {"name": "Hola",         "lat": -1.4806, "lon": 40.0305, "zone": "arid_north"},
]


# ── Database helpers ──────────────────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(DATABASE_URL)


def seeded_row_count(conn, lat: float, lon: float) -> int:
    """Return how many historical seed rows exist for this lat/lon."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) FROM weather_data
            WHERE reasoning LIKE 'Historical seed%%'
              AND ABS(latitude  - %s) < 0.01
              AND ABS(longitude - %s) < 0.01
        """, (lat, lon))
        return cur.fetchone()[0]


# ── Open-Meteo fetch ──────────────────────────────────────────────────────────

def fetch_hourly(lat: float, lon: float, retries: int = 6) -> dict:
    """
    Fetch 15 years of hourly data from Open-Meteo archive API.
    Includes temperature, humidity, pressure, wind, weather_code, precipitation.
    Retries with exponential backoff on rate-limit (429) responses.
    """
    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        f"&start_date={START_DATE}&end_date={END_DATE}"
        f"&hourly=temperature_2m,relative_humidity_2m,pressure_msl,"
        f"wind_speed_10m,weather_code,precipitation"
        f"&timezone=Africa%2FNairobi"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "FarmPal/3.0"})

    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode())
                return data["hourly"]
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 20 * (2 ** attempt)   # 20s, 40s, 80s, 160s, 320s, 640s
                log(f"  [rate-limited] retrying in {wait}s…")
                time.sleep(wait)
            elif e.code in (500, 502, 503):
                wait = 30 * (attempt + 1)
                log(f"  [server error {e.code}] retrying in {wait}s…")
                time.sleep(wait)
            else:
                raise
        except Exception as exc:
            if attempt < retries - 1:
                time.sleep(10 * (attempt + 1))
            else:
                raise

    raise Exception(f"Exceeded {retries} retries for lat={lat} lon={lon}")


# ── DB insert ─────────────────────────────────────────────────────────────────

def insert_rows(conn, lat: float, lon: float, hourly: dict) -> int:
    """
    Bulk-insert hourly weather rows into weather_data.
    Computes 3-hour pressure tendency (used as ML feature) per row.
    Inserts in batches of 2000 for throughput; commits per location.
    Returns number of rows inserted.
    """
    times = hourly["time"]
    temps = hourly["temperature_2m"]
    hums  = hourly.get("relative_humidity_2m") or hourly.get("relativehumidity_2m", [])
    press = hourly["pressure_msl"]
    winds = hourly["wind_speed_10m"]
    codes = hourly["weather_code"]
    precipitation = hourly.get("precipitation", [])

    rows = []
    for i, ts in enumerate(times):
        t, h, p = temps[i], hums[i], press[i]
        if t is None or h is None or p is None:
            continue
        c = int(codes[i] or 0)
        precip = float(precipitation[i] or 0)
        w = float(winds[i] or 0)
        # 3-hour pressure tendency: positive = rising, negative = falling
        p_prev   = press[i - 3] if i >= 3 and press[i - 3] is not None else p
        p_tend   = round(float(p) - float(p_prev), 2)
        label    = "rain" if c in RAIN_CODES else "no_rain"
        created  = datetime.fromisoformat(ts).replace(tzinfo=timezone.utc)

        rows.append((
            lat, lon,
            float(t), w, float(h), float(p), c,
            label, 0.75,
            f"Historical seed v5 p_tend={p_tend} precip={precip:.2f}",
            created,
        ))

    if not rows:
        return 0

    inserted = 0
    BATCH = 2000
    with conn.cursor() as cur:
        for i in range(0, len(rows), BATCH):
            batch = rows[i : i + BATCH]
            args  = b",".join(
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


# ── Per-location worker ───────────────────────────────────────────────────────

def seed_location(loc: dict, idx: int, total: int, dry_run: bool) -> dict:
    """
    Fetch and insert one location. Returns a result dict.
    Uses its own DB connection so it's thread-safe.
    """
    name = loc["name"]
    lat  = loc["lat"]
    lon  = loc["lon"]
    zone = loc.get("zone", "?")
    prefix = f"[{idx:>2}/{total}] {name:<16} [{zone:<10}]"

    if dry_run:
        log(f"{prefix} (dry-run)")
        return {"name": name, "status": "dry_run", "rows": 0}

    conn = get_conn()
    try:
        existing = seeded_row_count(conn, lat, lon)
        if existing >= MIN_ROWS_COMPLETE:
            log(f"{prefix} already complete ({existing:,} rows) — skipping")
            conn.close()
            return {"name": name, "status": "skipped", "rows": existing}

        if existing > 0:
            log(f"{prefix} partial ({existing:,} rows) — re-fetching to complete")
            # Delete partial data so we get a clean insert
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM weather_data "
                    "WHERE reasoning LIKE 'Historical seed%%' "
                    "AND ABS(latitude-%s)<0.01 AND ABS(longitude-%s)<0.01",
                    (lat, lon)
                )
            conn.commit()

        log(f"{prefix} fetching 15yr from Open-Meteo…")
        hourly   = fetch_hourly(lat, lon)
        inserted = insert_rows(conn, lat, lon, hourly)
        log(f"{prefix} ✓ {inserted:>9,} rows inserted")
        conn.close()
        return {"name": name, "status": "seeded", "rows": inserted}

    except Exception as exc:
        conn.rollback()
        conn.close()
        log(f"{prefix} ✗ FAILED: {exc}")
        return {"name": name, "status": "failed", "rows": 0, "error": str(exc)}


# ── ML service training ───────────────────────────────────────────────────────

def trigger_training_and_wait(timeout_s: int = 900) -> bool:
    """
    POST /train to the ML service and poll /train/status until done.
    Returns True on success, False on timeout or error.
    `timeout_s` defaults to 15 minutes — enough for 50k rows with XGBoost.
    """
    log("\n  Triggering ML model training…")
    try:
        req = urllib.request.Request(
            f"{ML_SERVICE_URL}/train",
            data=b"", method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode())
            log(f"  Training accepted: {result.get('message', result.get('status'))}")
    except Exception as exc:
        log(f"  Could not start training: {exc}")
        log("  → POST /train manually once the ML service is running.")
        return False

    # Poll /train/status
    deadline = time.time() + timeout_s
    poll_interval = 10
    while time.time() < deadline:
        time.sleep(poll_interval)
        try:
            with urllib.request.urlopen(
                f"{ML_SERVICE_URL}/train/status", timeout=10
            ) as resp:
                status = json.loads(resp.read().decode())
            if not status.get("running", True):
                result = status.get("lastResult", {})
                if result and "error" not in result:
                    acc = result.get("accuracy", "?")
                    auc = result.get("auc", "?")
                    n   = result.get("trainingSamples", "?")
                    log(f"\n  ✓ Training complete — {n:,} samples, accuracy {acc}%, AUC {auc}")
                    return True
                else:
                    log(f"\n  ✗ Training failed: {result.get('error', 'unknown error')}")
                    return False
        except Exception:
            pass  # ML service temporarily busy — keep polling

        elapsed = int(time.time() - deadline + timeout_s)
        log(f"  Training in progress… ({elapsed}s elapsed)")
        poll_interval = min(30, poll_interval + 5)

    log(f"\n  Training timed out after {timeout_s}s — model may still be training.")
    return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="FarmPal 15-year historical weather seed",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--retrain", action="store_true",
        help="After seeding, trigger ML model training and wait for it to complete",
    )
    parser.add_argument(
        "--zone", default=None,
        help="Only seed one climate zone (rift, central, coast, western, eastern, mt_kenya, arid_north, south)",
    )
    parser.add_argument(
        "--workers", type=int, default=3,
        help="Parallel HTTP workers (default 3 — stays under Open-Meteo rate limits)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print what would be seeded without touching the DB or ML service",
    )
    args = parser.parse_args()

    locs = LOCATIONS
    if args.zone:
        locs = [l for l in LOCATIONS if l.get("zone") == args.zone]
        if not locs:
            zones = sorted({l["zone"] for l in LOCATIONS})
            print(f"Unknown zone '{args.zone}'. Available: {zones}")
            sys.exit(1)

    n       = len(locs)
    years   = 15
    est_rows = n * years * 8760

    print("=" * 68)
    print("  FarmPal Historical Weather Seed v3")
    print(f"  Range     : {START_DATE}  →  {END_DATE}  ({years} years)")
    print(f"  Locations : {n} sites across all 47 Kenyan counties")
    print(f"  Est. rows : ~{est_rows:,}  (~{est_rows * 130 // 1_000_000:,} MB)")
    print(f"  Workers   : {args.workers} parallel")
    if args.zone:
        print(f"  Zone      : {args.zone} only")
    if args.dry_run:
        print("  Mode      : DRY RUN — no data written")
    if args.retrain:
        print("  Post-seed : will trigger ML training and wait")
    print("=" * 68)

    start_ts   = time.time()
    results    = []
    total_rows = 0
    skipped    = 0
    failed     = 0

    # Stagger worker starts by 2s each to avoid burst rate-limiting
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {}
        for i, loc in enumerate(locs, 1):
            time.sleep(2)  # stagger submissions
            fut = pool.submit(seed_location, loc, i, n, args.dry_run)
            futures[fut] = loc["name"]

        for fut in as_completed(futures):
            r = fut.result()
            results.append(r)
            if r["status"] == "seeded":
                total_rows += r["rows"]
            elif r["status"] == "skipped":
                skipped += 1
            elif r["status"] == "failed":
                failed += 1

    elapsed = int(time.time() - start_ts)
    seeded  = sum(1 for r in results if r["status"] == "seeded")

    print()
    print("=" * 68)
    print(f"  Seeded    : {seeded} locations  ({total_rows:,} new rows)")
    print(f"  Skipped   : {skipped} (already complete)")
    print(f"  Failed    : {failed} (re-run to retry)")
    print(f"  Time      : {elapsed // 60}m {elapsed % 60}s")
    if failed > 0:
        failed_names = [r["name"] for r in results if r["status"] == "failed"]
        print(f"  Failed    : {', '.join(failed_names)}")
    print("=" * 68)

    if args.retrain and not args.dry_run:
        ok = trigger_training_and_wait()
        if ok:
            print("\n  ✓ FarmPal is ready — first-time users get accurate predictions.")
        else:
            print("\n  ⚠ Seed complete but training may not have finished.")
            print("    POST /train manually or wait for the background process.")
    else:
        print("\n  Seed complete.")
        if not args.dry_run:
            print("  Run with --retrain to train the ML model on this data.")


if __name__ == "__main__":
    main()
