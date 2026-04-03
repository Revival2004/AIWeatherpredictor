/**
 * Feedback Service — closes the prediction loop by comparing past predictions
 * with actual observed outcomes. This is how the system learns from its errors.
 *
 * Every hour (after collection), this service looks for predictions whose
 * targetTime has passed, finds the actual observation for that time, and
 * records whether the prediction was correct.
 */

import {
  db,
  weatherPredictionsTable,
  weatherDataTable,
} from "@workspace/db";
import { isNull, lte, and, gte, asc, sql } from "drizzle-orm";
import type { Logger } from "pino";

/**
 * Returns accuracy over the last N hours of resolved predictions.
 * Used by the drift detector to decide whether the model needs retraining.
 * Returns null if there are fewer than minSamples resolved — not enough
 * signal to make a decision.
 */
export async function getRollingAccuracy(
  hoursBack: number,
  minSamples = 20
): Promise<{ accuracy: number | null; total: number; correct: number }> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const rows = await db
    .select({
      total:   sql<number>`count(*)`,
      correct: sql<number>`count(*) filter (where ${weatherPredictionsTable.isCorrect} = true)`,
    })
    .from(weatherPredictionsTable)
    .where(
      and(
        sql`${weatherPredictionsTable.isCorrect} IS NOT NULL`,
        gte(weatherPredictionsTable.feedbackAt, since)
      )
    );

  const { total, correct } = rows[0] ?? { total: 0, correct: 0 };
  const n = Number(total);
  const c = Number(correct);
  const accuracy = n >= minSamples ? Math.round((c / n) * 1000) / 10 : null;

  return { accuracy, total: n, correct: c };
}

const RAIN_CODES = new Set([
  51, 53, 55, 56, 57,
  61, 63, 65, 66, 67,
  80, 81, 82,
  95, 96, 99,
]);

function isRainyCode(code: number): boolean {
  return RAIN_CODES.has(code);
}

export async function runFeedbackLoop(logger?: Logger): Promise<number> {
  const now = new Date();

  // Find all predictions that are due for feedback (targetTime in the past, not yet resolved)
  const pending = await db
    .select()
    .from(weatherPredictionsTable)
    .where(
      and(
        lte(weatherPredictionsTable.targetTime, now),
        isNull(weatherPredictionsTable.isCorrect)
      )
    )
    .limit(50); // process in batches

  if (pending.length === 0) return 0;

  let resolved = 0;

  for (const prediction of pending) {
    try {
      // Find the closest actual observation to the target time within ±1 hour
      const windowStart = new Date(prediction.targetTime.getTime() - 60 * 60 * 1000);
      const windowEnd = new Date(prediction.targetTime.getTime() + 60 * 60 * 1000);

      const observations = await db
        .select({
          weathercode: weatherDataTable.weathercode,
          createdAt: weatherDataTable.createdAt,
        })
        .from(weatherDataTable)
        .where(
          and(
            gte(weatherDataTable.latitude, prediction.latitude - 0.5),
            lte(weatherDataTable.latitude, prediction.latitude + 0.5),
            gte(weatherDataTable.longitude, prediction.longitude - 0.5),
            lte(weatherDataTable.longitude, prediction.longitude + 0.5),
            gte(weatherDataTable.createdAt, windowStart),
            lte(weatherDataTable.createdAt, windowEnd)
          )
        )
        .orderBy(
          asc(
            sql`ABS(EXTRACT(EPOCH FROM (${weatherDataTable.createdAt} - ${prediction.targetTime.toISOString()}::timestamptz)))`
          )
        )
        .limit(1);

      if (observations.length === 0) {
        // No observation available yet — skip, will retry next run
        continue;
      }

      const actual = observations[0];
      const actualRaining = isRainyCode(actual.weathercode);
      const actualValue = actualRaining ? "yes" : "no";
      const isCorrect = prediction.predictionValue === actualValue;

      await db
        .update(weatherPredictionsTable)
        .set({
          actualValue,
          isCorrect,
          feedbackAt: now,
        })
        .where(
          sql`${weatherPredictionsTable.id} = ${prediction.id}`
        );

      resolved++;

      logger?.debug(
        {
          predictionId: prediction.id,
          predicted: prediction.predictionValue,
          actual: actualValue,
          isCorrect,
        },
        "Prediction feedback resolved"
      );
    } catch (err) {
      logger?.warn({ err, predictionId: prediction.id }, "Failed to resolve prediction feedback");
    }
  }

  logger?.info({ resolved, checked: pending.length }, "Feedback loop completed");
  return resolved;
}

export async function getPredictionAccuracy(): Promise<{
  total: number;
  correct: number;
  accuracy: number | null;
}> {
  const rows = await db
    .select({
      total: sql<number>`count(*)`,
      correct: sql<number>`count(*) filter (where ${weatherPredictionsTable.isCorrect} = true)`,
    })
    .from(weatherPredictionsTable)
    .where(sql`${weatherPredictionsTable.isCorrect} IS NOT NULL`);

  const { total, correct } = rows[0] ?? { total: 0, correct: 0 };
  const accuracy = total > 0 ? Math.round((Number(correct) / Number(total)) * 1000) / 10 : null;

  return {
    total: Number(total),
    correct: Number(correct),
    accuracy,
  };
}
