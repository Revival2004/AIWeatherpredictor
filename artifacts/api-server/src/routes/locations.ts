import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  addLocation,
  getLocations,
  deactivateLocation,
  activateLocation,
  deleteLocation,
} from "../lib/locationService.js";
import { db, trackedLocationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const AddLocationBody = z.object({
  name: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const UpdateCropBody = z.object({
  cropType: z.string().optional(),
  plantingDate: z.string().optional(),
});

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:5000";

/** Fetch elevation from Open-Meteo elevation API for a single point. */
async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return null;
    const data = (await r.json()) as { elevation?: number[] };
    return data.elevation?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Trigger per-location bootstrap in Python ML service (fire-and-forget). */
function triggerLocationBootstrap(lat: number, lon: number, name: string): void {
  fetch(`${ML_SERVICE_URL}/bootstrap_location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon, name, months_back: 24 }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => {});
}

/**
 * GET /locations
 * Returns all tracked locations.
 */
router.get("/locations", async (_req, res): Promise<void> => {
  const locations = await getLocations();
  res.json({ locations });
});

/**
 * POST /locations
 * Add a new tracked location.
 * Auto-fetches elevation and triggers a 24-month per-location bootstrap.
 */
router.post("/locations", async (req, res): Promise<void> => {
  const parsed = AddLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, latitude, longitude } = parsed.data;

  // Fetch elevation for this exact farm point
  const elevation = await fetchElevation(latitude, longitude);

  // Add the location (with elevation if we got it)
  let location = await addLocation(name, latitude, longitude);

  // Save elevation if fetched
  if (elevation !== null) {
    try {
      const [updated] = await db
        .update(trackedLocationsTable)
        .set({ elevation })
        .where(eq(trackedLocationsTable.id, location.id))
        .returning();
      if (updated) location = updated;
    } catch {}
  }

  // Fire-and-forget: bootstrap 24 months of history for this farm's microclimate
  triggerLocationBootstrap(latitude, longitude, name);

  res.status(201).json({
    location,
    elevation,
    bootstrapTriggered: true,
  });
});

/**
 * PUT /locations/:id/crop
 * Set crop type and planting date for a tracked location.
 */
router.put("/locations/:id/crop", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid location ID" });
    return;
  }

  const parsed = UpdateCropBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { cropType, plantingDate } = parsed.data;

  try {
    const [updated] = await db
      .update(trackedLocationsTable)
      .set({
        ...(cropType !== undefined ? { cropType } : {}),
        ...(plantingDate !== undefined ? { plantingDate } : {}),
      })
      .where(eq(trackedLocationsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    res.json({ location: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update crop info." });
  }
});

/**
 * PUT /locations/:id/deactivate
 * Deactivate a location (stops auto-collection).
 */
router.put("/locations/:id/deactivate", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid location ID" });
    return;
  }
  const location = await deactivateLocation(id);
  if (!location) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json({ location });
});

/**
 * PUT /locations/:id/activate
 * Re-activate a location.
 */
router.put("/locations/:id/activate", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid location ID" });
    return;
  }
  const location = await activateLocation(id);
  if (!location) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json({ location });
});

/**
 * DELETE /locations/:id
 * Remove a tracked location permanently.
 */
router.delete("/locations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid location ID" });
    return;
  }
  const location = await deleteLocation(id);
  if (!location) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json({ deleted: true, location });
});

export default router;
