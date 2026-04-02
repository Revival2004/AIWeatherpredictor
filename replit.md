# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`import { z } from "zod"` — NOT `zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Scheduler**: node-cron (hourly weather collection + feedback loop)
- **ML**: Python scikit-learn ensemble (Flask on port 5000) + TypeScript kNN fallback

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   │   └── ml/app.py       # Python Flask ML service (port 5000)
│   ├── weather-app/        # React + Vite frontend (Microclimate AI Weather Predictor)
│   └── weather-mobile/     # Expo mobile app (Android/iOS, leaf green + soil brown theme)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## App: Microclimate AI Weather Predictor (Kenya Farmers)

A full-stack AI-powered microclimate weather prediction system for Kenyan farmers.

### Features
- Real-time weather data from Open-Meteo (free, no API key required)
- **Python scikit-learn ensemble** (LR + RF + GB soft-voting) — 12-feature model
- **Location-aware ML**: lat, lon, elevation as features — each farm's geography matters
- **50 Kenyan training locations** across all agricultural zones (Rift Valley, Central, Eastern, Nyanza, Western, Coast, Northern)
- **Auto-bootstrap on startup**: if no model exists, ML service trains automatically from 50 locations × 24 months of historical data
- Feedback loop: farmers mark "did it rain?" → retrains model over time
- Tracked locations with auto-collection (hourly scheduler via node-cron)
- Offline caching: AsyncStorage per location, offline banner
- **Swahili language toggle** (30+ translated strings, persisted preference)
- **Onboarding flow**: 3-step welcome modal on first launch
- **Push notifications**: daily 6 AM farming reminder + rain alert when probability > 70%
- Kenya-specific county/sub-county/town location browsing
- **Map location picker** with CARTO Voyager tiles (tap farm on map → reverse geocode)
- PostgreSQL storage of all weather readings, tracked locations, and predictions

### Web App Pages
- `/` — Dashboard with live weather scan and recent readings
- `/history` — Historical log of all weather readings
- `/stats` — Analytics with prediction distribution chart

### Mobile Tabs (Expo / Android+iOS)
- **Dashboard** — geolocation fetch, hero weather card, rain prediction card, farming tip, alerts
- **Forecast** — 7-day farm forecast with field day scores, GDD widget, alerts
- **History** — paginated list of past readings
- **Analytics** — weather averages, AI prediction breakdown, ML accuracy ring, locations manager

### AI Logic
**Python scikit-learn Ensemble** (`artifacts/api-server/ml/app.py`) on port 5000:
1. **Logistic Regression** — Pipeline(StandardScaler + LogisticRegression, C=1.0, max_iter=1000)
2. **Random Forest** — 150 trees, sqrt features, max_depth 10, n_jobs=-1
3. **Gradient Boosting** — 150 trees, lr=0.07, max_depth 4
- Prediction: average probability from all three (soft voting)
- **12 Features**: temperature, humidity, pressure, windspeed, is_raining_now, sin_hour, cos_hour, sin_month, cos_month, lat, lon, **elevation**
- Binary target: will it rain in the next 2 hours?
- Auto-bootstrap: 50 Kenyan locations × 24 months (≈860k pairs) on first start if no model
- `/start_bootstrap` — async endpoint (returns immediately, trains in background thread)
- `/health` — includes `"bootstrapping": true/false` status
- Model version: `sklearn_ensemble_v2`

**kNN + Rules** (`aiService.ts`) — fallback while ML is bootstrapping or unreachable

### Database Schema
Tables:
- `weather_data` — id, lat, lon, temperature, windspeed, humidity, pressure, weathercode, prediction, confidence, reasoning, created_at
- `tracked_locations` — id, name, latitude, longitude, active, created_at
- `weather_predictions` — id, lat, lon, predicted_at, target_time, prediction_type, prediction_value, confidence, model_version, actual_value, is_correct, feedback_at, created_at

### API Endpoints

**Weather:**
- `GET /api/weather?lat=&lon=` — Fetch, predict, store, and return weather (kNN+rules)
- `GET /api/weather/history?limit=&lat=&lon=` — Historical readings
- `GET /api/weather/stats` — Aggregated statistics
- `GET /api/weather/forecast?lat=&lon=` — 7-day farm forecast
- `GET /api/weather/alerts?lat=&lon=` — Prioritized crop warnings
- `GET /api/weather/rain?lat=&lon=` — Binary rain prediction (ML ensemble + elevation)

**Locations:**
- `GET /api/locations` — List all tracked locations
- `POST /api/locations` — Add `{ name, latitude, longitude }`
- `PUT /api/locations/:id/activate` / `/deactivate` — Toggle auto-collection
- `DELETE /api/locations/:id` — Remove

**ML:**
- `POST /api/collect` — Manual weather collection trigger
- `GET /api/metrics` — Accuracy metrics and model status
- `POST /api/train` — Retrain on accumulated DB data

**Python ML Service (port 5000):**
- `GET /health` — `{ status, model, bootstrapping }`
- `POST /predict` — 12-feature prediction (temp, humidity, pressure, windspeed, is_raining_now, sin/cos hour, sin/cos month, lat, lon, elevation)
- `POST /train` — Retrain from DB data with elevation API lookup
- `POST /bootstrap` — Sync: fetch 50 locations history + train
- `POST /start_bootstrap` — Async: starts bootstrap in background thread, returns immediately

### Backend Services
- `forecastService.ts` — 7-day Open-Meteo daily data, per-day agriculture intelligence
- `alertsService.ts` — prioritized WeatherAlert objects with actionRequired steps
- `locationService.ts` — CRUD for tracked locations
- `schedulerService.ts` — node-cron: collection at :05/hr, feedback at :15/hr
- `feedbackService.ts` — resolves past predictions against actual observations
- `mlService.ts` — thin HTTP client to Python ML service; falls back to rule heuristic

### Mobile Services
- `services/NotificationService.ts` — expo-notifications (v0.32.x)
  - `requestNotificationPermission()` — request once on first load
  - `scheduleDailyFarmingReminder()` — daily 6 AM notification
  - `sendRainAlert(probability, locationName)` — immediate alert if prob ≥ 0.70

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — `pnpm run typecheck`
- **`emitDeclarationOnly`** — JS bundling via esbuild/tsx/vite, not `tsc`

## Root Scripts

- `pnpm run build` — typecheck first, then recursive build
- `pnpm run typecheck` — `tsc --build --emitDeclarationOnly`

## Important Notes

- **zod imports in api-server source**: `import { z } from "zod"` (NOT `zod/v4`)
- **Color scheme (mobile)**: `useColors()` from `@/hooks/useColors`. `colors.mutedForeground` for muted text
- **useColorScheme**: Import from `"react-native"` or use `useColors()` — NOT `@/hooks/useColorScheme`
- **WMO**: windspeed (not windSpeed), weathercode (not weatherCode)
- **ML features**: 12 features — old 11-feature model is incompatible. Delete `ml_model_sklearn.pkl` and restart ML service to auto-retrain if ever mismatch
- **Map tiles**: CARTO Voyager (`basemaps.cartocdn.com/rastertiles/voyager`) — OSM tiles 403 in WebView
- **Expo icons**: Use Feather from `@expo/vector-icons` everywhere. Do NOT use `expo-symbols` (iOS only), `NativeTabs` (unstable), or `expo-glass-effect` (iOS 26+)
- **Offline cache key**: `weather_cache_v1_${lat.toFixed(3)}_${lon.toFixed(3)}`
- **Onboarding**: `microclimate_onboarding_v1` in AsyncStorage
- **Language**: `microclimate_language_v1` in AsyncStorage
- **API base URL (mobile)**: `https://${EXPO_PUBLIC_DOMAIN}` or `http://localhost:8080`
- **Scheduler**: Runs at minute :05 (collection) and :15 (feedback) every hour
- **expo-notifications version**: `~0.32.16` (not v55 — incompatible with current Expo SDK)
