import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import {
  activateLocation,
  addLocation,
  deactivateLocation,
  deleteLocation,
  getLocations,
  updateLocation,
} from "../lib/locationService.js";
import { requireFarmerOrAdminAuth, type AuthenticatedActor } from "../lib/farmerAuth.js";

const router: IRouter = Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:5001";
const ML_MODE = process.env.ML_SERVICE_URL ? "remote-python" : "fallback";

router.use(requireFarmerOrAdminAuth);

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

function triggerLocationBootstrap(lat: number, lon: number, name: string): void {
  fetch(`${ML_SERVICE_URL}/bootstrap_location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon, name, months_back: 24 }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => {});
}

type AuthenticatedRequest = Request & { authenticatedActor?: AuthenticatedActor };

function getAuthenticatedActorFromRequest(req: AuthenticatedRequest): AuthenticatedActor {
  return req.authenticatedActor as AuthenticatedActor;
}

function getScopedFarmerId(req: AuthenticatedRequest): number | undefined {
  const actor = getAuthenticatedActorFromRequest(req);
  return actor.role === "farmer" ? actor.farmerSession.id : undefined;
}

router.get("/locations", async (req, res): Promise<void> => {
  const locations = await getLocations(getScopedFarmerId(req));
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
  const actor = getAuthenticatedActorFromRequest(req);
  const location = await addLocation(
    name,
    latitude,
    longitude,
    actor.role === "farmer" ? actor.farmerSession.id : null,
    { elevation },
  );
  triggerLocationBootstrap(latitude, longitude, name);

  res.status(201).json({
    location,
    elevation,
    bootstrapTriggered: true,
    mlMode: ML_MODE,
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

  const location = await updateLocation(id, getScopedFarmerId(req), {
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

  const location = await deactivateLocation(id, getScopedFarmerId(req));
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

  const location = await activateLocation(id, getScopedFarmerId(req));
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

  const location = await deleteLocation(id, getScopedFarmerId(req));
  if (!location) {
    res.status(404).json({ error: "Location not found" });
    return;
  }

  res.json({ deleted: true, location });
});

export default router;
