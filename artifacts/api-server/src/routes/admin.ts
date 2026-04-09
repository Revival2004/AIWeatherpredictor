import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  createAdminToken,
  getAdminAuthStatus,
  getAdminSessionFromToken,
  getBearerToken,
  requireAdminAuth,
  validateAdminCredentials,
} from "../lib/adminAuth.js";
import { getStoreHealth, getWeatherStats, listWeatherRecords } from "../lib/store.js";

const router: IRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function roundMaybe(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(2));
}

router.post("/admin/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!getAdminAuthStatus().configured) {
    res.status(503).json({
      error: "Admin authentication is not configured on this server.",
    });
    return;
  }

  if (!validateAdminCredentials(parsed.data.email, parsed.data.password)) {
    res.status(401).json({ error: "Invalid admin credentials." });
    return;
  }

  const { token, session } = createAdminToken();
  res.json({
    token,
    admin: {
      email: session.email,
      role: session.role,
    },
    expiresAt: new Date(session.expiresAt).toISOString(),
  });
});

router.get("/admin/session", (req, res) => {
  const session = getAdminSessionFromToken(getBearerToken(req));
  if (!session) {
    res.status(401).json({ authenticated: false });
    return;
  }

  res.json({
    authenticated: true,
    admin: {
      email: session.email,
      role: session.role,
    },
    expiresAt: new Date(session.expiresAt).toISOString(),
  });
});

router.post("/admin/logout", (_req, res) => {
  res.json({ success: true });
});

router.get("/admin/history", requireAdminAuth, async (req, res): Promise<void> => {
  const limit = Number(req.query.limit ?? 50);
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
  const records = await listWeatherRecords({ limit: safeLimit });
  res.json(records);
});

router.get("/admin/stats", requireAdminAuth, async (_req, res): Promise<void> => {
  const stats = await getWeatherStats();
  res.json({
    totalReadings: stats.totalReadings,
    avgTemperature: roundMaybe(stats.avgTemperature),
    avgWindspeed: roundMaybe(stats.avgWindspeed),
    avgHumidity: roundMaybe(stats.avgHumidity),
    predictionBreakdown: stats.predictionBreakdown,
    lastReading: stats.lastReading ? stats.lastReading.toISOString() : null,
    store: getStoreHealth(),
  });
});

export default router;
