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
import { db, weatherPredictionsTable, weatherDataTable } from "@workspace/db";
import { fetchWeather } from "./weatherService.js";
import { predictWithHistory } from "./aiService.js";
import { predictRain, trainModel } from "./mlService.js";
import { runFeedbackLoop, getRollingAccuracy } from "./feedbackService.js";
import { getActiveLocations } from "./locationService.js";
import { desc } from "drizzle-orm";

// ─── Drift detection config ───────────────────────────────────────────────────
// If rolling accuracy over the last 48 hours falls below this threshold,
// the model has drifted — weather patterns have shifted and retraining is needed.
const DRIFT_THRESHOLD_PCT  = 65;   // retrain if accuracy drops below 65%
const DRIFT_WINDOW_HOURS   = 48;   // look back 48 hours to compute rolling accuracy
const MIN_RETRAIN_GAP_MS   = 6 * 60 * 60 * 1000; // never retrain more than once per 6 hours

let lastRetrainAt: number = 0;       // timestamp of last retrain (0 = never)
let schedulerStarted = false;

async function runDriftCheck(logger: Logger): Promise<void> {
  const { accuracy, total } = await getRollingAccuracy(DRIFT_WINDOW_HOURS);

  if (accuracy === null) {
    // Not enough resolved predictions yet — skip check
    logger.debug({ total }, "Drift check skipped — insufficient samples");
    return;
  }

  logger.info({ accuracy, total, threshold: DRIFT_THRESHOLD_PCT }, "Rolling accuracy check");

  const drifted = accuracy < DRIFT_THRESHOLD_PCT;
  const cooldownOk = Date.now() - lastRetrainAt > MIN_RETRAIN_GAP_MS;

  if (drifted && cooldownOk) {
    logger.warn(
      { accuracy, threshold: DRIFT_THRESHOLD_PCT, windowHours: DRIFT_WINDOW_HOURS },
      "Model drift detected — triggering immediate retrain"
    );
    try {
      const result = await trainModel(logger);
      lastRetrainAt = Date.now();
      logger.info(
        { accuracy: result.accuracy, samples: result.trainingSamples, trigger: "drift" },
        "Drift-triggered retrain completed"
      );
    } catch (err) {
      logger.error({ err }, "Drift-triggered retrain failed");
    }
  } else if (drifted && !cooldownOk) {
    const waitMins = Math.round((MIN_RETRAIN_GAP_MS - (Date.now() - lastRetrainAt)) / 60000);
    logger.info({ accuracy, waitMins }, "Drift detected but in cooldown — will retry");
  }
}

export function startScheduler(logger: Logger): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // ── Hourly weather collection — every hour at :05 ─────────────────────────
  cron.schedule("5 * * * *", async () => {
    logger.info("Hourly weather collection starting");
    try {
      const collected = await collectAllLocations(logger);
      logger.info({ collected }, "Hourly collection completed");
    } catch (err) {
      logger.error({ err }, "Hourly collection failed");
    }
  });

  // ── Feedback + drift detection — every hour at :15 ────────────────────────
  // After comparing predictions to actuals, immediately check if the model
  // has drifted and retrain on the spot if needed. No more fixed monthly schedule.
  cron.schedule("15 * * * *", async () => {
    logger.info("Running prediction feedback loop");
    try {
      const resolved = await runFeedbackLoop(logger);
      logger.info({ resolved }, "Feedback loop completed");
    } catch (err) {
      logger.error({ err }, "Feedback loop failed");
      return; // skip drift check if feedback itself failed
    }

    // Drift check: if rolling accuracy has dropped, retrain immediately
    try {
      await runDriftCheck(logger);
    } catch (err) {
      logger.error({ err }, "Drift check failed");
    }
  });

  // ── Safety-net retrain — weekly on Sundays at 3:00 AM ─────────────────────
  // Drift detection handles most cases. This weekly job ensures the model
  // is always refreshed with recent data even in low-traffic periods
  // where drift detection might not have enough samples to trigger.
  cron.schedule("0 3 * * 0", async () => {
    const cooldownOk = Date.now() - lastRetrainAt > MIN_RETRAIN_GAP_MS;
    if (!cooldownOk) {
      logger.info("Weekly retrain skipped — recent drift-triggered retrain already ran");
      return;
    }
    logger.info("Weekly scheduled retrain starting");
    try {
      const result = await trainModel(logger);
      lastRetrainAt = Date.now();
      logger.info({ accuracy: result.accuracy, samples: result.trainingSamples, trigger: "weekly" }, "Weekly retrain completed");
    } catch (err) {
      logger.error({ err }, "Weekly retrain failed");
    }
  });

  logger.info(
    "Scheduler started — collection :05, feedback+drift-check :15, weekly safety retrain Sundays 03:00"
  );
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
      const rainPrediction = await predictRain(
        weatherData.temperature,
        weatherData.humidity,
        weatherData.pressure,
        weatherData.windspeed,
        weatherData.weathercode,
        new Date(),
        location.latitude,
        location.longitude,
        weatherData.elevation ?? 1000,
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
