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
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Scheduler**: node-cron (hourly weather collection + feedback loop)
- **ML**: TypeScript logistic regression trained on historical observations

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   ├── weather-app/        # React + Vite frontend (Microclimate AI Weather Predictor)
│   └── weather-mobile/     # Expo mobile app (Android/iOS, leaf green + soil brown theme)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── python/                 # Python reference scripts (train_model.py, predict.py)
├── scripts/                # Utility scripts
│   └── src/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## App: Microclimate AI Weather Predictor

A full-stack AI-powered microclimate weather prediction system.

### Features
- Real-time weather data from Open-Meteo (free, no API key required)
- Adaptive kNN+rules AI prediction engine with confidence scores and reasoning
- TypeScript logistic regression ML model — trains on historical DB data
- Feedback loop: compares predictions with actual observations automatically
- Tracked locations with auto-collection (hourly scheduler via node-cron)
- PostgreSQL storage of all weather readings, tracked locations, and predictions
- Three-page React frontend: Dashboard, History Log, Analytics
- Browser geolocation support

### Web App Pages
- `/` — Dashboard with live weather scan and recent readings
- `/history` — Historical log of all weather readings
- `/stats` — Analytics with prediction distribution chart

### AI Logic
**kNN + Rules** (`aiService.ts`):
- `predictWithHistory()` — adaptive: uses kNN when history available, falls back to rules
- Rule-based: humidity+pressure thresholds, precipitation codes, wind speed
- Model version progresses: "rules" → "rules+patterns" → "pattern-learned"

**Logistic Regression ML** (`mlService.ts`):
- Features: temperature, humidity, pressure, windspeed, is_raining_now, hour_sin/cos, month_sin/cos
- Binary target: will it rain in the next 2 hours?
- Training: gradient descent on labeled historical pairs
- Falls back to heuristic rules if no model is trained yet
- Model saved to `ml_model.json` in the api-server directory

### Database Schema
Tables:
- `weather_data` — observations: id, lat, lon, temperature, windspeed, humidity, pressure, weathercode, prediction, confidence, reasoning, created_at
- `tracked_locations` — id, name, latitude, longitude, active, created_at
- `weather_predictions` — id, lat, lon, predicted_at, target_time, prediction_type, prediction_value, confidence, model_version, actual_value, is_correct, feedback_at, created_at

### API Endpoints

**Weather:**
- `GET /api/weather?lat=&lon=` — Fetch, predict, store, and return weather (kNN+rules)
- `GET /api/weather/history?limit=&lat=&lon=` — Historical readings
- `GET /api/weather/stats` — Aggregated statistics
- `GET /api/weather/forecast?lat=&lon=` — 7-day farm forecast (field day scores, frost/heat risk, GDD, farm actions)
- `GET /api/weather/alerts?lat=&lon=` — Prioritized crop warnings (frost, heat, rain, wind, disease, spray windows)
- `GET /api/weather/rain?lat=&lon=` — Binary rain prediction using ML model + feedback storage

**Locations:**
- `GET /api/locations` — List all tracked locations
- `POST /api/locations` — Add a tracked location `{ name, latitude, longitude }`
- `PUT /api/locations/:id/activate` — Activate auto-collection for a location
- `PUT /api/locations/:id/deactivate` — Pause auto-collection
- `DELETE /api/locations/:id` — Remove a location

**ML:**
- `POST /api/collect` — Manually trigger weather collection for all active locations
- `GET /api/metrics` — Prediction accuracy metrics and model status
- `POST /api/train` — Retrain logistic regression model on all historical data

### Backend Services
- `forecastService.ts` — 7-day Open-Meteo daily data, per-day agriculture intelligence
- `alertsService.ts` — prioritized WeatherAlert objects with actionRequired steps
- `locationService.ts` — CRUD for tracked locations
- `schedulerService.ts` — node-cron: collection at :05/hr, feedback at :15/hr
- `feedbackService.ts` — resolves past predictions against actual observations
- `mlService.ts` — logistic regression training and inference in TypeScript

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express, starts node-cron scheduler
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `health.ts`, `weather.ts`, `locations.ts`
- Services: `weatherService.ts`, `aiService.ts`, `forecastService.ts`, `alertsService.ts`, `locationService.ts`, `schedulerService.ts`, `feedbackService.ts`, `mlService.ts`
- Depends on: `@workspace/db`, `@workspace/api-zod`, `zod`, `node-cron`

### `artifacts/weather-app` (`@workspace/weather-app`)

React + Vite frontend for the weather predictor. Atmospheric blue/teal design.

### `artifacts/weather-mobile` (`@workspace/weather-mobile`)

Expo mobile app for Android/iOS. Leaf green (#3D8B37) and soil brown (#8B5A2B) color scheme on a warm parchment background (#F5F0E8). Four tabs:
- **Dashboard** — geolocation fetch, hero weather card, live AlertsBanner, farming tip, condition cards
- **Forecast** — 7-day farm forecast with CropSelector, ForecastDayCard (field day score, farm actions, risk pills), GDDWidget (GDD + irrigation deficit), AlertsBanner
- **History** — paginated list of past readings with WMO condition icons
- **Analytics** — weather averages, AI prediction breakdown, ML accuracy ring, model info, tracked locations manager (add/remove/pause), Collect Now + Train Model buttons
Connects to the shared API via `@workspace/api-client-react` hooks. Sets `setBaseUrl` from `EXPO_PUBLIC_DOMAIN` in `_layout.tsx`.

New components: `AlertsBanner`, `ForecastDayCard`, `GDDWidget`, `CropSelector`

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/schema/weatherData.ts` — weather_data table
- `src/schema/trackedLocations.ts` — tracked_locations table
- `src/schema/weatherPredictions.ts` — weather_predictions table (with feedback loop fields)

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec. Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

### `scripts` (`@workspace/scripts`)

Utility scripts package.

## Python Reference Scripts

`python/train_model.py` and `python/predict.py` implement a scikit-learn RandomForest classifier.
These require Python 3 + `pip install scikit-learn psycopg2-binary pandas numpy joblib`.
The TypeScript `mlService.ts` is the active implementation; Python scripts are for reference/future use.

## Important Notes

- **zod imports in api-server source**: Use `import { z } from "zod"` (NOT `zod/v4`) — esbuild bundles api-server source directly and needs the package to be a direct dependency
- **`zod/v4`** works in `lib/db` schemas because that package is treated as external by esbuild
- **Color scheme (mobile)**: Always use `useColors()` from `@/hooks/useColors`. `colors.mutedForeground` for muted text (NOT `colors.muted`)
- **useColorScheme**: Import from `"react-native"` or use `useColors()` — do NOT import from `@/hooks/useColorScheme` (doesn't exist)
- **WMO**: windspeed (not windSpeed), weathercode (not weatherCode)
- **Scheduler**: Runs at minute 5 (collection) and minute 15 (feedback) of every hour
- **ML training**: Needs ≥10 observations with ≥5 labeled pairs (T, T+2h). New installs won't have enough data immediately — keep the scheduler running to collect data
