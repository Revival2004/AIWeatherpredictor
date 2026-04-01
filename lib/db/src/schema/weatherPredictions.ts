import { pgTable, serial, doublePrecision, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Stores formal predictions and their outcomes for the feedback loop.
 * Once a prediction's target_time has passed, feedbackService.ts fills in
 * actual_value and is_correct so the model can learn from its mistakes.
 */
export const weatherPredictionsTable = pgTable("weather_predictions", {
  id: serial("id").primaryKey(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),

  predictedAt: timestamp("predicted_at", { withTimezone: true }).notNull().defaultNow(),
  targetTime: timestamp("target_time", { withTimezone: true }).notNull(),

  predictionType: text("prediction_type").notNull(), // e.g. "rain_2h", "rain_6h"
  predictionValue: text("prediction_value").notNull(), // "yes" | "no"
  confidence: real("confidence").notNull(),
  modelVersion: text("model_version").notNull().default("rules"),

  // Feedback fields — filled in by feedbackService after targetTime passes
  actualValue: text("actual_value"),
  isCorrect: boolean("is_correct"),
  feedbackAt: timestamp("feedback_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWeatherPredictionSchema = createInsertSchema(weatherPredictionsTable).omit({
  id: true,
  createdAt: true,
  actualValue: true,
  isCorrect: true,
  feedbackAt: true,
});

export type InsertWeatherPrediction = z.infer<typeof insertWeatherPredictionSchema>;
export type WeatherPrediction = typeof weatherPredictionsTable.$inferSelect;
