import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  addLocation,
  getLocations,
  deactivateLocation,
  activateLocation,
  deleteLocation,
} from "../lib/locationService.js";

const router: IRouter = Router();

const AddLocationBody = z.object({
  name: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

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
 */
router.post("/locations", async (req, res): Promise<void> => {
  const parsed = AddLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, latitude, longitude } = parsed.data;
  const location = await addLocation(name, latitude, longitude);
  res.status(201).json({ location });
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
