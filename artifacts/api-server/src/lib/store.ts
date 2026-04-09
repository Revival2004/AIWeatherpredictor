export interface TrackedLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  cropType: string | null;
  plantingDate: string | null;
  active: boolean;
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

interface StoreState {
  locations: TrackedLocation[];
  weatherRecords: StoredWeatherRecord[];
  predictions: StoredPredictionRecord[];
  feedback: FarmerFeedbackRecord[];
}

const state: StoreState = {
  locations: [],
  weatherRecords: [],
  predictions: [],
  feedback: [],
};

const counters = {
  location: 1,
  weather: 1,
  prediction: 1,
  feedback: 1,
};

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

export function addLocationRecord(input: {
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number | null;
  cropType?: string | null;
  plantingDate?: string | null;
  active?: boolean;
}): TrackedLocation {
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
    createdAt: now,
    updatedAt: now,
  };

  state.locations.push(location);
  return location;
}

export function listLocations(): TrackedLocation[] {
  return sortNewestFirst(state.locations);
}

export function listActiveLocations(): TrackedLocation[] {
  return sortNewestFirst(state.locations.filter((location) => location.active));
}

export function updateLocationRecord(
  id: number,
  patch: Partial<Omit<TrackedLocation, "id" | "createdAt">>,
): TrackedLocation | null {
  const location = state.locations.find((entry) => entry.id === id);
  if (!location) {
    return null;
  }

  Object.assign(location, patch, { updatedAt: new Date() });
  return location;
}

export function deleteLocationRecord(id: number): TrackedLocation | null {
  const index = state.locations.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return null;
  }

  const [deleted] = state.locations.splice(index, 1);
  return deleted ?? null;
}

export function addWeatherRecord(input: Omit<StoredWeatherRecord, "id" | "createdAt">): StoredWeatherRecord {
  const record: StoredWeatherRecord = {
    id: counters.weather++,
    createdAt: new Date(),
    ...input,
  };

  state.weatherRecords.push(record);
  return record;
}

export function listWeatherRecords(options?: {
  limit?: number;
  lat?: number;
  lon?: number;
  radiusDegrees?: number;
}): StoredWeatherRecord[] {
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
  if (options?.limit === undefined) {
    return sorted;
  }

  return sorted.slice(0, options.limit);
}

export function getLatestWeatherRecordNear(
  lat: number,
  lon: number,
  radiusDegrees = 2.7,
): StoredWeatherRecord | null {
  return listWeatherRecords({ lat, lon, radiusDegrees, limit: 1 })[0] ?? null;
}

export function addPredictionRecord(
  input: Omit<StoredPredictionRecord, "id">,
): StoredPredictionRecord {
  const record: StoredPredictionRecord = {
    id: counters.prediction++,
    ...input,
  };

  state.predictions.push(record);
  return record;
}

export function listPredictionRecords(): StoredPredictionRecord[] {
  return [...state.predictions].sort(
    (a, b) => b.predictedAt.getTime() - a.predictedAt.getTime(),
  );
}

export function addFeedbackRecord(
  input: Omit<FarmerFeedbackRecord, "id" | "createdAt">,
): FarmerFeedbackRecord {
  const record: FarmerFeedbackRecord = {
    id: counters.feedback++,
    createdAt: new Date(),
    ...input,
  };

  state.feedback.push(record);
  return record;
}

export function listFeedbackRecords(): FarmerFeedbackRecord[] {
  return sortNewestFirst(state.feedback);
}

export function getWeatherStats() {
  const weatherRecords = listWeatherRecords();
  const predictionBreakdown = weatherRecords.reduce<Record<string, number>>(
    (totals, record) => {
      totals[record.prediction] = (totals[record.prediction] ?? 0) + 1;
      return totals;
    },
    {},
  );

  return {
    totalReadings: weatherRecords.length,
    avgTemperature: average(weatherRecords.map((record) => record.temperature)),
    avgWindspeed: average(weatherRecords.map((record) => record.windspeed)),
    avgHumidity: average(weatherRecords.map((record) => record.humidity)),
    predictionBreakdown,
    lastReading: weatherRecords[0]?.createdAt ?? null,
  };
}
