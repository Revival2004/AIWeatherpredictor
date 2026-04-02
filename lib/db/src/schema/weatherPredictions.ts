import { pgTable, serial, doublePrecision, text, real, boolean, timestamp } from "drizzle-orm/pg-core";

export const weatherPredictionsTable = pgTable("weather_predictions", {
  id: serial("id").primaryKey(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),

  predictedAt: timestamp("predicted_at", { withTimezone: true }).notNull().defaultNow(),
  targetTime: timestamp("target_time", { withTimezone: true }).notNull(),

  predictionType: text("prediction_type").notNull(),
  predictionValue: text("prediction_value").notNull(),
  confidence: real("confidence").notNull(),
  modelVersion: text("model_version").notNull().default("rules"),

  actualValue: text("actual_value"),
  isCorrect: boolean("is_correct"),
  feedbackAt: timestamp("feedback_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InsertWeatherPrediction = typeof weatherPredictionsTable.$inferInsert;
export type WeatherPrediction = typeof weatherPredictionsTable.$inferSelect;
