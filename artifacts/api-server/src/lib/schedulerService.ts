/**
 * Scheduler Service — runs hourly jobs using node-cron:
 *   1. Fetch current weather for all active tracked locations
 *   2. Store observations in weather_data
 *   3. Make rain predictions for each location (saved to weather_predictions)
 *   4. Run the feedback loop on past predictions
 *
 * Also exports a manual trigger for /api/collect.
 */

import cron from "node-cron";
import type { Logger } from "pino";
import { db, weatherPredictionsTable } from "@workspace/db";
import { fetchWeather } from "./weatherService.js";
import { predictWithHistory } from "./aiService.js";
import { predictRain } from "./mlService.js";
import { runFeedbackLoop } from "./feedbackService.js";
import { getActiveLocations } from "./locationService.js";
import { desc, eq } from "drizzle-orm";
import { weatherDataTable } from "@workspace/db";

let schedulerStarted = false;

export function startScheduler(logger: Logger): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Run every hour at minute 5 (e.g., 1:05, 2:05, ...)
  cron.schedule("5 * * * *", async () => {
    logger.info("Hourly weather collection starting");
    try {
      const collected = await collectAllLocations(logger);
      logger.info({ collected }, "Hourly collection completed");
    } catch (err) {
      logger.error({ err }, "Hourly collection failed");
    }
  });

  // Run feedback loop every hour at minute 15 (after collection has had time to land)
  cron.schedule("15 * * * *", async () => {
    logger.info("Running prediction feedback loop");
    try {
      const resolved = await runFeedbackLoop(logger);
      logger.info({ resolved }, "Feedback loop completed");
    } catch (err) {
      logger.error({ err }, "Feedback loop failed");
    }
  });

  logger.info("Scheduler started — weather collection every hour at :05, feedback at :15");
}

export interface CollectionResult {
  location: string;
  lat: number;
  lon: number;
  success: boolean;
  error?: string;
}

export async function collectAllLocations(logger?: Logger): Promise<CollectionResult[]> {
  const locations = await getActiveLocations();

  if (locations.length === 0) {
    return [];
  }

  const results: CollectionResult[] = [];

  for (const location of locations) {
    try {
      // Fetch current weather
      const weatherData = await fetchWeather(location.latitude, location.longitude);

      // Fetch recent history for kNN
      const history = await db
        .select({
          temperature: weatherDataTable.temperature,
          windspeed: weatherDataTable.windspeed,
          humidity: weatherDataTable.humidity,
          pressure: weatherDataTable.pressure,
          weathercode: weatherDataTable.weathercode,
          prediction: weatherDataTable.prediction,
          confidence: weatherDataTable.confidence,
        })
        .from(weatherDataTable)
        .orderBy(desc(weatherDataTable.createdAt))
        .limit(100);

      // Run adaptive AI prediction
      const aiResult = predictWithHistory(
        {
          temperature: weatherData.temperature,
          windspeed: weatherData.windspeed,
          humidity: weatherData.humidity,
          pressure: weatherData.pressure,
          weathercode: weatherData.weathercode,
        },
        history
      );

      // Store observation in weather_data
      const [stored] = await db
        .insert(weatherDataTable)
        .values({
          latitude: location.latitude,
          longitude: location.longitude,
          temperature: weatherData.temperature,
          windspeed: weatherData.windspeed,
          humidity: weatherData.humidity,
          pressure: weatherData.pressure,
          weathercode: weatherData.weathercode,
          prediction: aiResult.prediction,
          confidence: aiResult.confidence,
          reasoning: aiResult.reasoning,
        })
        .returning({ id: weatherDataTable.id });

      // Make and store a rain prediction for +2 hours (for the feedback loop)
      const rainPrediction = predictRain(
        weatherData.temperature,
        weatherData.humidity,
        weatherData.pressure,
        weatherData.windspeed,
        weatherData.weathercode
      );

      const targetTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      if (rainPrediction.predictionValue !== null && rainPrediction.predictionValue !== undefined) {
        await db.insert(weatherPredictionsTable).values({
          latitude: location.latitude,
          longitude: location.longitude,
          predictedAt: new Date(),
          targetTime,
          predictionType: "rain_2h",
          predictionValue: rainPrediction.predictionValue,
          confidence: rainPrediction.confidence,
          modelVersion: rainPrediction.modelVersion,
        });
      }

      results.push({ location: location.name, lat: location.latitude, lon: location.longitude, success: true });

      logger?.info(
        {
          location: location.name,
          weathercode: weatherData.weathercode,
          rainPrediction: rainPrediction.predictionValue,
          confidence: rainPrediction.confidence,
        },
        "Collected and predicted"
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({
        location: location.name,
        lat: location.latitude,
        lon: location.longitude,
        success: false,
        error: errorMsg,
      });
      logger?.warn({ err, location: location.name }, "Failed to collect for location");
    }
  }

  return results;
}
