import { pgTable, serial, doublePrecision, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const farmerFeedbackTable = pgTable("farmer_feedback", {
  id: serial("id").primaryKey(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  locationName: text("location_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFarmerFeedbackSchema = createInsertSchema(farmerFeedbackTable).omit({
  id: true,
  createdAt: true,
});

export type InsertFarmerFeedback = z.infer<typeof insertFarmerFeedbackSchema>;
export type FarmerFeedback = typeof farmerFeedbackTable.$inferSelect;
