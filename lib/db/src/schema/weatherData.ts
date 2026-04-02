import { pgTable, serial, doublePrecision, integer, text, real, timestamp } from "drizzle-orm/pg-core";

export const weatherDataTable = pgTable("weather_data", {
  id: serial("id").primaryKey(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  temperature: doublePrecision("temperature").notNull(),
  windspeed: doublePrecision("windspeed").notNull(),
  humidity: doublePrecision("humidity").notNull(),
  pressure: doublePrecision("pressure").notNull(),
  weathercode: integer("weathercode").notNull().default(0),
  prediction: text("prediction").notNull(),
  confidence: real("confidence").notNull(),
  reasoning: text("reasoning").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InsertWeatherData = typeof weatherDataTable.$inferInsert;
export type WeatherData = typeof weatherDataTable.$inferSelect;
