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

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── weather-app/        # React + Vite frontend (Microclimate AI Weather Predictor)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## App: Microclimate AI Weather Predictor

A full-stack AI-powered microclimate weather prediction system.

### Features
- Real-time weather data from Open-Meteo (free, no API key required)
- Rule-based AI prediction engine with confidence scores and reasoning
- PostgreSQL storage of all weather readings for historical analysis
- Three-page React frontend: Dashboard, History Log, Analytics
- Browser geolocation support

### Pages
- `/` — Dashboard with live weather scan and recent readings
- `/history` — Historical log of all weather readings
- `/stats` — Analytics with prediction distribution chart

### AI Logic (aiService.ts)
Rule-based prediction engine in `artifacts/api-server/src/lib/aiService.ts`:
- Thunderstorm code → "Thunderstorm in progress" (0.97 confidence)
- Humidity > 80% + Pressure < 1000 hPa → "Rain likely soon"
- Windspeed > 20 km/h → "Storm possible"
- Active precipitation code → "Active precipitation"
- Moderate instability → "Changing conditions"
- Default → "Stable weather"

The AI service is modular and replaceable with an ML model when training data accumulates.

### Database Schema
Table: `weather_data`
- id, latitude, longitude, temperature, windspeed, humidity, pressure, weathercode
- prediction (text), confidence (float), reasoning (text)
- created_at (timestamp)

### API Endpoints
- `GET /api/weather?lat=&lon=` — Fetch, predict, store, and return weather
- `GET /api/weather/history?limit=&lat=&lon=` — Historical readings
- `GET /api/weather/stats` — Aggregated statistics

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

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health`; `src/routes/weather.ts` exposes weather prediction endpoints
- Services: `src/lib/weatherService.ts` (Open-Meteo fetching), `src/lib/aiService.ts` (rule-based prediction)
- Depends on: `@workspace/db`, `@workspace/api-zod`

### `artifacts/weather-app` (`@workspace/weather-app`)

React + Vite frontend for the weather predictor.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/schema/weatherData.ts` — weather_data table definition

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec. Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`.
