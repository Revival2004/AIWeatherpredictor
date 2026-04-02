import { pgTable, serial, doublePrecision, text, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trackedLocationsTable = pgTable("tracked_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  active: boolean("active").notNull().default(true),
  elevation: real("elevation"),
  cropType: text("crop_type"),
  plantingDate: text("planting_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTrackedLocationSchema = createInsertSchema(trackedLocationsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertTrackedLocation = z.infer<typeof insertTrackedLocationSchema>;
export type TrackedLocation = typeof trackedLocationsTable.$inferSelect;
