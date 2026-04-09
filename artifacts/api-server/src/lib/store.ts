import pg, { type QueryResultRow } from "pg";

export interface FarmerProfile {
  id: number;
  phoneNumber: string;
  displayName: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrackedLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  cropType: string | null;
  plantingDate: string | null;
  active: boolean;
  farmerId?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredWeatherRecord {
  id: number;
  latitude: number;
  longitude: number;
  temperature: number;
  windspeed: number;
  humidity: number;
  pressure: number;
  weathercode: number;
  prediction: string;
  confidence: number;
  reasoning: string;
  createdAt: Date;
}

export interface StoredPredictionRecord {
  id: number;
  latitude: number;
  longitude: number;
  predictedAt: Date;
  targetTime: Date;
  predictionType: string;
  predictionValue: string;
  confidence: number;
  probability: number;
  modelVersion: string;
  isCorrect: boolean | null;
}

export interface FarmerFeedbackRecord {
  id: number;
  latitude: number;
  longitude: number;
  question: "rain" | "cloudy" | "wind";
  answer: "yes" | "no" | "almost";
  locationName: string | null;
  createdAt: Date;
}

type PersistenceMode = "memory" | "postgres";

interface StoreState {
  farmers: FarmerProfile[];
  locations: TrackedLocation[];
  weatherRecords: StoredWeatherRecord[];
  predictions: StoredPredictionRecord[];
  feedback: FarmerFeedbackRecord[];
}

interface StoreHealth {
  mode: PersistenceMode;
  ready: boolean;
  configured: boolean;
  error: string | null;
}

const DATABASE_URL = process.env.DATABASE_URL?.trim() ?? "";
const STORE_MODE: PersistenceMode = DATABASE_URL ? "postgres" : "memory";
const state: StoreState = {
  farmers: [],
  locations: [],
  weatherRecords: [],
  predictions: [],
  feedback: [],
};

const counters = {
  farmer: 1,
  location: 1,
  weather: 1,
  prediction: 1,
  feedback: 1,
};

let pool: pg.Pool | null = null;
let storeReady = STORE_MODE === "memory";
let storeError: string | null = null;
let initPromise: Promise<StoreHealth> | null = null;
type DbRow = QueryResultRow & Record<string, unknown>;

function getPool(): pg.Pool {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    const shouldUseSsl =
      /sslmode=require|ssl=true/i.test(DATABASE_URL) || process.env.PGSSLMODE === "require";

    pool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }

  return pool;
}

function sortNewestFirst<T extends { createdAt: Date }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function isNearby(
  latitude: number,
  longitude: number,
  targetLat: number,
  targetLon: number,
  radiusDegrees: number,
): boolean {
  return (
    latitude >= targetLat - radiusDegrees &&
    latitude <= targetLat + radiusDegrees &&
    longitude >= targetLon - radiusDegrees &&
    longitude <= targetLon + radiusDegrees
  );
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

function mapLocationRow(row: Record<string, unknown>): TrackedLocation {
  return {
    id: toNumber(row.id),
    name: String(row.name),
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    elevation: row.elevation === null ? null : toNumber(row.elevation),
    cropType: row.crop_type === null ? null : String(row.crop_type),
    plantingDate: row.planting_date === null ? null : String(row.planting_date),
    active: Boolean(row.active),
    farmerId: row.farmer_id === null || row.farmer_id === undefined ? null : toNumber(row.farmer_id),
    createdAt: toDate(row.created_at),
    updatedAt: row.updated_at ? toDate(row.updated_at) : toDate(row.created_at),
  };
}

function mapFarmerRow(row: Record<string, unknown>): FarmerProfile {
  return {
    id: toNumber(row.id),
    phoneNumber: String(row.phone_number),
    displayName: row.display_name === null ? null : String(row.display_name),
    lastLoginAt: row.last_login_at ? toDate(row.last_login_at) : null,
    createdAt: toDate(row.created_at),
    updatedAt: row.updated_at ? toDate(row.updated_at) : toDate(row.created_at),
  };
}

function mapWeatherRow(row: Record<string, unknown>): StoredWeatherRecord {
  return {
    id: toNumber(row.id),
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    temperature: toNumber(row.temperature),
    windspeed: toNumber(row.windspeed),
    humidity: toNumber(row.humidity),
    pressure: toNumber(row.pressure),
    weathercode: toNumber(row.weathercode),
    prediction: String(row.prediction),
    confidence: toNumber(row.confidence),
    reasoning: String(row.reasoning),
    createdAt: toDate(row.created_at),
  };
}

function mapPredictionRow(row: Record<string, unknown>): StoredPredictionRecord {
  return {
    id: toNumber(row.id),
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    predictedAt: toDate(row.predicted_at),
    targetTime: toDate(row.target_time),
    predictionType: String(row.prediction_type),
    predictionValue: String(row.prediction_value),
    confidence: toNumber(row.confidence),
    probability: row.probability === null || row.probability === undefined ? 0 : toNumber(row.probability),
    modelVersion: String(row.model_version),
    isCorrect: row.is_correct === null || row.is_correct === undefined ? null : Boolean(row.is_correct),
  };
}

function mapFeedbackRow(row: Record<string, unknown>): FarmerFeedbackRecord {
  return {
    id: toNumber(row.id),
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    question: String(row.question) as FarmerFeedbackRecord["question"],
    answer: String(row.answer) as FarmerFeedbackRecord["answer"],
    locationName: row.location_name === null ? null : String(row.location_name),
    createdAt: toDate(row.created_at),
  };
}

async function ensureSchema(): Promise<void> {
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS farmer_profiles (
      id SERIAL PRIMARY KEY,
      phone_number TEXT NOT NULL UNIQUE,
      display_name TEXT,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tracked_locations (
      id SERIAL PRIMARY KEY,
      farmer_id INTEGER REFERENCES farmer_profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      elevation REAL,
      crop_type TEXT,
      planting_date TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS weather_data (
      id SERIAL PRIMARY KEY,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      temperature DOUBLE PRECISION NOT NULL,
      windspeed DOUBLE PRECISION NOT NULL,
      humidity DOUBLE PRECISION NOT NULL,
      pressure DOUBLE PRECISION NOT NULL,
      weathercode INTEGER NOT NULL DEFAULT 0,
      prediction TEXT NOT NULL,
      confidence REAL NOT NULL,
      reasoning TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS weather_predictions (
      id SERIAL PRIMARY KEY,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      target_time TIMESTAMPTZ NOT NULL,
      prediction_type TEXT NOT NULL,
      prediction_value TEXT NOT NULL,
      confidence REAL NOT NULL,
      probability REAL NOT NULL DEFAULT 0,
      model_version TEXT NOT NULL DEFAULT 'rules_heuristic',
      actual_value TEXT,
      is_correct BOOLEAN,
      feedback_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS farmer_feedback (
      id SERIAL PRIMARY KEY,
      farmer_id INTEGER REFERENCES farmer_profiles(id) ON DELETE SET NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      location_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    ALTER TABLE tracked_locations
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);
  await db.query(`
    ALTER TABLE tracked_locations
    ADD COLUMN IF NOT EXISTS farmer_id INTEGER REFERENCES farmer_profiles(id) ON DELETE CASCADE;
  `);
  await db.query(`
    ALTER TABLE farmer_feedback
    ADD COLUMN IF NOT EXISTS farmer_id INTEGER REFERENCES farmer_profiles(id) ON DELETE SET NULL;
  `);
  await db.query(`
    ALTER TABLE weather_predictions
    ADD COLUMN IF NOT EXISTS probability REAL NOT NULL DEFAULT 0;
  `);

  await db.query("CREATE INDEX IF NOT EXISTS idx_farmer_profiles_phone_number ON farmer_profiles (phone_number);");
  await db.query("CREATE INDEX IF NOT EXISTS idx_tracked_locations_active ON tracked_locations (active);");
  await db.query("CREATE INDEX IF NOT EXISTS idx_tracked_locations_farmer_id ON tracked_locations (farmer_id);");
  await db.query("CREATE INDEX IF NOT EXISTS idx_weather_data_created_at ON weather_data (created_at DESC);");
  await db.query("CREATE INDEX IF NOT EXISTS idx_weather_data_coords_created_at ON weather_data (latitude, longitude, created_at DESC);");
  await db.query("CREATE INDEX IF NOT EXISTS idx_weather_predictions_target_time ON weather_predictions (target_time DESC);");
  await db.query("CREATE INDEX IF NOT EXISTS idx_weather_predictions_coords ON weather_predictions (latitude, longitude);");
  await db.query("CREATE INDEX IF NOT EXISTS idx_farmer_feedback_coords_created_at ON farmer_feedback (latitude, longitude, created_at DESC);");
}

export async function initializeStore(): Promise<StoreHealth> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    if (STORE_MODE === "memory") {
      return getStoreHealth();
    }

    try {
      const db = getPool();
      await db.query("SELECT 1");
      await ensureSchema();
      storeReady = true;
      storeError = null;
    } catch (error) {
      storeReady = false;
      storeError = error instanceof Error ? error.message : "Unknown database error";
      throw error;
    }

    return getStoreHealth();
  })();

  return initPromise;
}

export function getStoreHealth(): StoreHealth {
  return {
    mode: STORE_MODE,
    ready: storeReady,
    configured: Boolean(DATABASE_URL),
    error: storeError,
  };
}

export async function upsertFarmerProfile(input: {
  phoneNumber: string;
  displayName?: string | null;
}): Promise<FarmerProfile> {
  if (STORE_MODE === "memory") {
    const existing = state.farmers.find((entry) => entry.phoneNumber === input.phoneNumber);
    if (existing) {
      existing.displayName = input.displayName ?? existing.displayName;
      existing.lastLoginAt = new Date();
      existing.updatedAt = new Date();
      return { ...existing };
    }

    const now = new Date();
    const farmer: FarmerProfile = {
      id: counters.farmer++,
      phoneNumber: input.phoneNumber,
      displayName: input.displayName ?? null,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    };
    state.farmers.push(farmer);
    return { ...farmer };
  }

  const result = await getPool().query(
    `
      INSERT INTO farmer_profiles (phone_number, display_name, last_login_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (phone_number)
      DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, farmer_profiles.display_name),
        last_login_at = NOW(),
        updated_at = NOW()
      RETURNING *;
    `,
    [input.phoneNumber, input.displayName ?? null],
  );

  return mapFarmerRow(result.rows[0] as Record<string, unknown>);
}

export async function getFarmerProfileById(id: number): Promise<FarmerProfile | null> {
  if (STORE_MODE === "memory") {
    const farmer = state.farmers.find((entry) => entry.id === id);
    return farmer ? { ...farmer } : null;
  }

  const result = await getPool().query(
    "SELECT * FROM farmer_profiles WHERE id = $1 LIMIT 1;",
    [id],
  );
  return result.rowCount ? mapFarmerRow(result.rows[0] as Record<string, unknown>) : null;
}

export async function getFarmerProfileByPhoneNumber(phoneNumber: string): Promise<FarmerProfile | null> {
  if (STORE_MODE === "memory") {
    const farmer = state.farmers.find((entry) => entry.phoneNumber === phoneNumber);
    return farmer ? { ...farmer } : null;
  }

  const result = await getPool().query(
    "SELECT * FROM farmer_profiles WHERE phone_number = $1 LIMIT 1;",
    [phoneNumber],
  );
  return result.rowCount ? mapFarmerRow(result.rows[0] as Record<string, unknown>) : null;
}

export async function addLocationRecord(input: {
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number | null;
  cropType?: string | null;
  plantingDate?: string | null;
  active?: boolean;
  farmerId?: number | null;
}): Promise<TrackedLocation> {
  if (STORE_MODE === "memory") {
    const now = new Date();
    const location: TrackedLocation = {
      id: counters.location++,
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      elevation: input.elevation ?? null,
      cropType: input.cropType ?? null,
      plantingDate: input.plantingDate ?? null,
      active: input.active ?? true,
      farmerId: input.farmerId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    state.locations.push(location);
    return location;
  }

  const result = await getPool().query(
    `
      INSERT INTO tracked_locations
        (farmer_id, name, latitude, longitude, elevation, crop_type, planting_date, active)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, TRUE))
      RETURNING *;
    `,
    [
      input.farmerId ?? null,
      input.name,
      input.latitude,
      input.longitude,
      input.elevation ?? null,
      input.cropType ?? null,
      input.plantingDate ?? null,
      input.active ?? true,
    ],
  );

  return mapLocationRow(result.rows[0] as Record<string, unknown>);
}

export async function listLocations(options?: { farmerId?: number | null }): Promise<TrackedLocation[]> {
  if (STORE_MODE === "memory") {
    const filtered = options?.farmerId === undefined
      ? state.locations
      : state.locations.filter((location) => (location.farmerId ?? null) === options.farmerId);
    return sortNewestFirst(filtered).map((location) => ({ ...location }));
  }

  const params: unknown[] = [];
  let query = `
      SELECT *
      FROM tracked_locations
  `;
  if (options?.farmerId !== undefined) {
    params.push(options.farmerId);
    query += ` WHERE farmer_id = $${params.length}`;
  }
  query += " ORDER BY updated_at DESC, created_at DESC;";

  const result = await getPool().query(query, params);

  return result.rows.map((row: DbRow) => mapLocationRow(row));
}

export async function listActiveLocations(options?: { farmerId?: number | null }): Promise<TrackedLocation[]> {
  if (STORE_MODE === "memory") {
    const filtered = state.locations.filter((location) => {
      if (!location.active) {
        return false;
      }
      if (options?.farmerId === undefined) {
        return true;
      }
      return (location.farmerId ?? null) === options.farmerId;
    });
    return sortNewestFirst(filtered).map((location) => ({ ...location }));
  }

  const params: unknown[] = [];
  let query = `
      SELECT *
      FROM tracked_locations
      WHERE active = TRUE
  `;
  if (options?.farmerId !== undefined) {
    params.push(options.farmerId);
    query += ` AND farmer_id = $${params.length}`;
  }
  query += " ORDER BY updated_at DESC, created_at DESC;";

  const result = await getPool().query(query, params);

  return result.rows.map((row: DbRow) => mapLocationRow(row));
}

export async function updateLocationRecord(
  id: number,
  patch: Partial<Omit<TrackedLocation, "id" | "createdAt" | "updatedAt">>,
  options?: { farmerId?: number | null },
): Promise<TrackedLocation | null> {
  if (STORE_MODE === "memory") {
    const location = state.locations.find((entry) => {
      if (entry.id !== id) {
        return false;
      }
      if (options?.farmerId === undefined) {
        return true;
      }
      return (entry.farmerId ?? null) === options.farmerId;
    });
    if (!location) {
      return null;
    }

    Object.assign(location, patch, { updatedAt: new Date() });
    return { ...location };
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  const addField = (column: string, value: unknown) => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (patch.elevation !== undefined) addField("elevation", patch.elevation);
  if (patch.cropType !== undefined) addField("crop_type", patch.cropType);
  if (patch.plantingDate !== undefined) addField("planting_date", patch.plantingDate);
  if (patch.active !== undefined) addField("active", patch.active);
  if (patch.name !== undefined) addField("name", patch.name);
  if (patch.latitude !== undefined) addField("latitude", patch.latitude);
  if (patch.longitude !== undefined) addField("longitude", patch.longitude);

  if (fields.length === 0) {
    const params: unknown[] = [id];
    let query = "SELECT * FROM tracked_locations WHERE id = $1";
    if (options?.farmerId !== undefined) {
      params.push(options.farmerId);
      query += ` AND farmer_id = $${params.length}`;
    }
    query += " LIMIT 1;";
    const existing = await getPool().query(query, params);
    return existing.rowCount ? mapLocationRow(existing.rows[0] as Record<string, unknown>) : null;
  }

  fields.push("updated_at = NOW()");
  values.push(id);
  let whereClause = `id = $${values.length}`;
  if (options?.farmerId !== undefined) {
    values.push(options.farmerId);
    whereClause += ` AND farmer_id = $${values.length}`;
  }

  const result = await getPool().query(
    `
      UPDATE tracked_locations
      SET ${fields.join(", ")}
      WHERE ${whereClause}
      RETURNING *;
    `,
    values,
  );

  return result.rowCount ? mapLocationRow(result.rows[0] as Record<string, unknown>) : null;
}

export async function deleteLocationRecord(id: number, options?: { farmerId?: number | null }): Promise<TrackedLocation | null> {
  if (STORE_MODE === "memory") {
    const index = state.locations.findIndex((entry) => {
      if (entry.id !== id) {
        return false;
      }
      if (options?.farmerId === undefined) {
        return true;
      }
      return (entry.farmerId ?? null) === options.farmerId;
    });
    if (index === -1) {
      return null;
    }
    const [deleted] = state.locations.splice(index, 1);
    return deleted ? { ...deleted } : null;
  }

  const params: unknown[] = [id];
  let query = "DELETE FROM tracked_locations WHERE id = $1";
  if (options?.farmerId !== undefined) {
    params.push(options.farmerId);
    query += ` AND farmer_id = $${params.length}`;
  }
  query += " RETURNING *;";

  const result = await getPool().query(query, params);

  return result.rowCount ? mapLocationRow(result.rows[0] as Record<string, unknown>) : null;
}

export async function addWeatherRecord(
  input: Omit<StoredWeatherRecord, "id" | "createdAt">,
): Promise<StoredWeatherRecord> {
  if (STORE_MODE === "memory") {
    const record: StoredWeatherRecord = {
      id: counters.weather++,
      createdAt: new Date(),
      ...input,
    };
    state.weatherRecords.push(record);
    return { ...record };
  }

  const result = await getPool().query(
    `
      INSERT INTO weather_data
        (latitude, longitude, temperature, windspeed, humidity, pressure, weathercode, prediction, confidence, reasoning)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `,
    [
      input.latitude,
      input.longitude,
      input.temperature,
      input.windspeed,
      input.humidity,
      input.pressure,
      input.weathercode,
      input.prediction,
      input.confidence,
      input.reasoning,
    ],
  );

  return mapWeatherRow(result.rows[0] as Record<string, unknown>);
}

export async function listWeatherRecords(options?: {
  limit?: number;
  lat?: number;
  lon?: number;
  radiusDegrees?: number;
}): Promise<StoredWeatherRecord[]> {
  if (STORE_MODE === "memory") {
    const lat = options?.lat;
    const lon = options?.lon;
    const radiusDegrees = options?.radiusDegrees ?? 0.5;
    const filtered = state.weatherRecords.filter((record) => {
      if (lat === undefined || lon === undefined) {
        return true;
      }

      return isNearby(record.latitude, record.longitude, lat, lon, radiusDegrees);
    });
    const sorted = sortNewestFirst(filtered);
    return (options?.limit === undefined ? sorted : sorted.slice(0, options.limit)).map((record) => ({ ...record }));
  }

  const params: unknown[] = [];
  const filters: string[] = [];
  const radiusDegrees = options?.radiusDegrees ?? 0.5;

  if (options?.lat !== undefined && options?.lon !== undefined) {
    params.push(options.lat - radiusDegrees, options.lat + radiusDegrees, options.lon - radiusDegrees, options.lon + radiusDegrees);
    filters.push(
      `latitude BETWEEN $${params.length - 3} AND $${params.length - 2}`,
      `longitude BETWEEN $${params.length - 1} AND $${params.length}`,
    );
  }

  let query = "SELECT * FROM weather_data";
  if (filters.length > 0) {
    query += ` WHERE ${filters.join(" AND ")}`;
  }
  query += " ORDER BY created_at DESC";

  if (options?.limit !== undefined) {
    params.push(options.limit);
    query += ` LIMIT $${params.length}`;
  }

  const result = await getPool().query(query, params);
  return result.rows.map((row: DbRow) => mapWeatherRow(row));
}

export async function getLatestWeatherRecordNear(
  lat: number,
  lon: number,
  radiusDegrees = 2.7,
): Promise<StoredWeatherRecord | null> {
  const rows = await listWeatherRecords({ lat, lon, radiusDegrees, limit: 1 });
  return rows[0] ?? null;
}

export async function addPredictionRecord(
  input: Omit<StoredPredictionRecord, "id">,
): Promise<StoredPredictionRecord> {
  if (STORE_MODE === "memory") {
    const record: StoredPredictionRecord = {
      id: counters.prediction++,
      ...input,
    };
    state.predictions.push(record);
    return { ...record };
  }

  const result = await getPool().query(
    `
      INSERT INTO weather_predictions
        (latitude, longitude, predicted_at, target_time, prediction_type, prediction_value, confidence, probability, model_version, is_correct)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `,
    [
      input.latitude,
      input.longitude,
      input.predictedAt,
      input.targetTime,
      input.predictionType,
      input.predictionValue,
      input.confidence,
      input.probability,
      input.modelVersion,
      input.isCorrect,
    ],
  );

  return mapPredictionRow(result.rows[0] as Record<string, unknown>);
}

export async function listPredictionRecords(): Promise<StoredPredictionRecord[]> {
  if (STORE_MODE === "memory") {
    return [...state.predictions]
      .sort((a, b) => b.predictedAt.getTime() - a.predictedAt.getTime())
      .map((prediction) => ({ ...prediction }));
  }

  const result = await getPool().query(
    `
      SELECT *
      FROM weather_predictions
      ORDER BY predicted_at DESC;
    `,
  );

  return result.rows.map((row: DbRow) => mapPredictionRow(row));
}

export async function addFeedbackRecord(
  input: Omit<FarmerFeedbackRecord, "id" | "createdAt"> & { farmerId?: number | null },
): Promise<FarmerFeedbackRecord> {
  if (STORE_MODE === "memory") {
    const record: FarmerFeedbackRecord = {
      id: counters.feedback++,
      createdAt: new Date(),
      ...input,
    };
    state.feedback.push(record);
    return { ...record };
  }

  const result = await getPool().query(
    `
      INSERT INTO farmer_feedback
        (farmer_id, latitude, longitude, question, answer, location_name)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `,
    [
      input.farmerId ?? null,
      input.latitude,
      input.longitude,
      input.question,
      input.answer,
      input.locationName,
    ],
  );

  return mapFeedbackRow(result.rows[0] as Record<string, unknown>);
}

export async function listFeedbackRecords(): Promise<FarmerFeedbackRecord[]> {
  if (STORE_MODE === "memory") {
    return sortNewestFirst(state.feedback).map((feedback) => ({ ...feedback }));
  }

  const result = await getPool().query(
    `
      SELECT *
      FROM farmer_feedback
      ORDER BY created_at DESC;
    `,
  );

  return result.rows.map((row: DbRow) => mapFeedbackRow(row));
}

export async function getWeatherStats(): Promise<{
  totalReadings: number;
  avgTemperature: number | null;
  avgWindspeed: number | null;
  avgHumidity: number | null;
  predictionBreakdown: Record<string, number>;
  lastReading: Date | null;
}> {
  if (STORE_MODE === "memory") {
    const weatherRecords = await listWeatherRecords();
    const predictionBreakdown = weatherRecords.reduce<Record<string, number>>((totals, record) => {
      totals[record.prediction] = (totals[record.prediction] ?? 0) + 1;
      return totals;
    }, {});

    return {
      totalReadings: weatherRecords.length,
      avgTemperature: average(weatherRecords.map((record) => record.temperature)),
      avgWindspeed: average(weatherRecords.map((record) => record.windspeed)),
      avgHumidity: average(weatherRecords.map((record) => record.humidity)),
      predictionBreakdown,
      lastReading: weatherRecords[0]?.createdAt ?? null,
    };
  }

  const aggregateResult = await getPool().query(
    `
      SELECT
        COUNT(*)::INT AS total_readings,
        AVG(temperature) AS avg_temperature,
        AVG(windspeed) AS avg_windspeed,
        AVG(humidity) AS avg_humidity,
        MAX(created_at) AS last_reading
      FROM weather_data;
    `,
  );

  const breakdownResult = await getPool().query(
    `
      SELECT prediction, COUNT(*)::INT AS count
      FROM weather_data
      GROUP BY prediction;
    `,
  );

  const predictionBreakdown = breakdownResult.rows.reduce<Record<string, number>>((totals: Record<string, number>, row: DbRow) => {
    totals[String(row.prediction)] = toNumber(row.count);
    return totals;
  }, {});

  const aggregate = aggregateResult.rows[0] as Record<string, unknown>;

  return {
    totalReadings: toNumber(aggregate.total_readings ?? 0),
    avgTemperature: aggregate.avg_temperature === null ? null : toNumber(aggregate.avg_temperature),
    avgWindspeed: aggregate.avg_windspeed === null ? null : toNumber(aggregate.avg_windspeed),
    avgHumidity: aggregate.avg_humidity === null ? null : toNumber(aggregate.avg_humidity),
    predictionBreakdown,
    lastReading: aggregate.last_reading ? toDate(aggregate.last_reading) : null,
  };
}
