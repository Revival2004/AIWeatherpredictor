import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  activateLocation,
  addLocation,
  deactivateLocation,
  deleteLocation,
  getLocations,
  updateLocation,
} from "../lib/locationService.js";

const router: IRouter = Router();

const addLocationBodySchema = z.object({
  name: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const updateCropBodySchema = z.object({
  cropType: z.string().optional(),
  plantingDate: z.string().optional(),
});

async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { elevation?: number[] };
    return data.elevation?.[0] ?? null;
  } catch {
    return null;
  }
}

router.get("/locations", async (_req, res): Promise<void> => {
  const locations = await getLocations();
  res.json({ locations });
});

router.post("/locations", async (req, res): Promise<void> => {
  const parsed = addLocationBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, latitude, longitude } = parsed.data;
  const elevation = await fetchElevation(latitude, longitude);
  const location = await addLocation(name, latitude, longitude, { elevation });

  res.status(201).json({
    location,
    elevation,
    bootstrapTriggered: false,
    mlMode: "mocked",
  });
});

router.put("/locations/:id/crop", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid location ID" });
    return;
  }

  const parsed = updateCropBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const location = await updateLocation(id, {
    cropType: parsed.data.cropType ?? null,
    plantingDate: parsed.data.plantingDate ?? null,
  });

  if (!location) {
    res.status(404).json({ error: "Location not found" });
    return;
  }

  res.json({ location });
});

router.put("/locations/:id/deactivate", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
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

router.put("/locations/:id/activate", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
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

router.delete("/locations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
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
