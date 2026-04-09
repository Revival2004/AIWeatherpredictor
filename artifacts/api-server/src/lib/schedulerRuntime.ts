import cron from "node-cron";
import type { Logger } from "pino";
import { getActiveLocations } from "./locationService.js";
import { predictRain } from "./mockMlService.js";
import { addPredictionRecord, addWeatherRecord } from "./store.js";
import { fetchWeather } from "./weatherService.js";

let schedulerStarted = false;

export interface CollectionResult {
  location: string;
  lat: number;
  lon: number;
  success: boolean;
  error?: string;
}

export function startScheduler(logger: Logger): void {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  cron.schedule("5 * * * *", async () => {
    logger.info("Running scheduled weather collection");

    try {
      const results = await collectAllLocations(logger);
      logger.info(
        { collected: results.filter((item) => item.success).length, total: results.length },
        "Scheduled weather collection completed",
      );
    } catch (error) {
      logger.error({ err: error }, "Scheduled weather collection failed");
    }
  });

  logger.info("Scheduler started - hourly weather collection at minute 5");
}

export async function collectAllLocations(logger?: Logger): Promise<CollectionResult[]> {
  const locations = await getActiveLocations();

  if (locations.length === 0) {
    return [];
  }

  const results: CollectionResult[] = [];

  for (const location of locations) {
    try {
      const weather = await fetchWeather(location.latitude, location.longitude);
      const rainPrediction = await predictRain(
        weather.temperature,
        weather.humidity,
        weather.pressure,
        weather.windspeed,
        weather.weathercode,
      );

      addWeatherRecord({
        latitude: location.latitude,
        longitude: location.longitude,
        temperature: weather.temperature,
        windspeed: weather.windspeed,
        humidity: weather.humidity,
        pressure: weather.pressure,
        weathercode: weather.weathercode,
        prediction: rainPrediction.mock.rain ? "Rain expected" : "No rain expected",
        confidence: rainPrediction.confidence,
        reasoning: rainPrediction.mock.advice,
      });

      addPredictionRecord({
        latitude: location.latitude,
        longitude: location.longitude,
        predictedAt: new Date(),
        targetTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        predictionType: "rain_2h",
        predictionValue: rainPrediction.predictionValue,
        confidence: rainPrediction.confidence,
        probability: rainPrediction.probability,
        modelVersion: rainPrediction.modelVersion,
        isCorrect: null,
      });

      results.push({
        location: location.name,
        lat: location.latitude,
        lon: location.longitude,
        success: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown collection error";
      logger?.warn({ err: error, location: location.name }, "Weather collection failed for location");
      results.push({
        location: location.name,
        lat: location.latitude,
        lon: location.longitude,
        success: false,
        error: message,
      });
    }
  }

  return results;
}
