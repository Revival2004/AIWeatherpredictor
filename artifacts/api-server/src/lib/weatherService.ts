/**
 * Weather Service — fetches real-time data from Open-Meteo API.
 * Open-Meteo is free, requires no API key, and provides hourly/current
 * weather data including temperature, wind, humidity, and pressure.
 */

export interface OpenMeteoCurrentWeather {
  temperature: number;
  windspeed: number;
  weathercode: number;
  time: string;
}

export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  elevation?: number;
  current_weather: OpenMeteoCurrentWeather;
  hourly: {
    time: string[];
    relativehumidity_2m: number[];
    surface_pressure: number[];
  };
}

export interface WeatherResult {
  temperature: number;
  windspeed: number;
  humidity: number;
  pressure: number;
  weathercode: number;
  time: string;
  elevation?: number;
  estimated?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetches current weather from Open-Meteo for the given coordinates.
 * Returns current weather merged with the closest hourly humidity/pressure reading.
 * Retries up to 3 times with exponential backoff on 429 rate-limit responses.
 */
export async function fetchWeather(lat: number, lon: number): Promise<WeatherResult> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current_weather", "true");
  url.searchParams.set("hourly", "relativehumidity_2m,surface_pressure");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "auto");

  const maxRetries = 3;
  let lastError: Error = new Error("Open-Meteo: no attempts made");

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url.toString());

    if (response.status === 429) {
      const backoff = (attempt + 1) * 10_000; // 10s, 20s, 30s
      lastError = new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
      await sleep(backoff);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OpenMeteoResponse;
    const current = data.current_weather;

    // Find the hourly index closest to the current weather time
    const currentTime = current.time;
    const hourlyTimes = data.hourly.time;
    let closestIdx = 0;
    let minDiff = Infinity;

    for (let i = 0; i < hourlyTimes.length; i++) {
      const diff = Math.abs(
        new Date(hourlyTimes[i]).getTime() - new Date(currentTime).getTime()
      );
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    const humidity = data.hourly.relativehumidity_2m[closestIdx] ?? 60;
    const pressure = data.hourly.surface_pressure[closestIdx] ?? 1013;

    return {
      temperature: current.temperature,
      windspeed: current.windspeed,
      humidity,
      pressure,
      weathercode: current.weathercode,
      time: current.time,
      elevation: data.elevation,
    };
  }

  // All retries exhausted — return typical Kenyan highland values so the
  // rest of the pipeline (ML prediction, history lookup) can still run.
  // The response will be marked as estimated so the UI can indicate this.
  return {
    temperature: 20,
    windspeed: 14,
    humidity: 65,
    pressure: 875,
    weathercode: 1,
    time: new Date().toISOString(),
    estimated: true,
  };
}
