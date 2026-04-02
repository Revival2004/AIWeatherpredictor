import { pgTable, serial, doublePrecision, text, timestamp } from "drizzle-orm/pg-core";

export const farmerFeedbackTable = pgTable("farmer_feedback", {
  id: serial("id").primaryKey(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  locationName: text("location_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InsertFarmerFeedback = typeof farmerFeedbackTable.$inferInsert;
export type FarmerFeedback = typeof farmerFeedbackTable.$inferSelect;
