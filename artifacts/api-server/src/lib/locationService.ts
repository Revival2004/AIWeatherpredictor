/**
 * Location Service — manages tracked locations that get auto-collected hourly.
 */

import { db, trackedLocationsTable, type InsertTrackedLocation } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

export async function addLocation(name: string, latitude: number, longitude: number) {
  const [location] = await db
    .insert(trackedLocationsTable)
    .values({ name, latitude, longitude, active: true })
    .returning();
  return location;
}

export async function getLocations() {
  return db.select().from(trackedLocationsTable).orderBy(desc(trackedLocationsTable.createdAt));
}

export async function getActiveLocations() {
  return db
    .select()
    .from(trackedLocationsTable)
    .where(eq(trackedLocationsTable.active, true))
    .orderBy(desc(trackedLocationsTable.createdAt));
}

export async function deactivateLocation(id: number) {
  const [updated] = await db
    .update(trackedLocationsTable)
    .set({ active: false })
    .where(eq(trackedLocationsTable.id, id))
    .returning();
  return updated;
}

export async function activateLocation(id: number) {
  const [updated] = await db
    .update(trackedLocationsTable)
    .set({ active: true })
    .where(eq(trackedLocationsTable.id, id))
    .returning();
  return updated;
}

export async function deleteLocation(id: number) {
  const [deleted] = await db
    .delete(trackedLocationsTable)
    .where(eq(trackedLocationsTable.id, id))
    .returning();
  return deleted;
}
