import { Router, type IRouter } from "express";
import { z } from "zod";

import {
  getFarmerAuthStatus,
  getFarmerSessionIdentity,
  requireFarmerAuth,
  requestFarmerOtp,
  updateFarmerSessionProfile,
  verifyFarmerOtp,
} from "../lib/farmerAuth.js";
import { getBearerToken } from "../lib/adminAuth.js";

const router: IRouter = Router();

const requestOtpSchema = z.object({
  phoneNumber: z.string().min(6).max(32),
  displayName: z.string().min(1).max(80).optional(),
});

const verifyOtpSchema = z.object({
  phoneNumber: z.string().min(6).max(32),
  code: z.string().min(4).max(8),
  displayName: z.string().min(1).max(80).optional(),
});

const updateProfileSchema = z
  .object({
    displayName: z.string().trim().max(80).optional(),
    villageName: z.string().trim().max(80).optional(),
  })
  .refine((value) => value.displayName !== undefined || value.villageName !== undefined, {
    message: "Provide at least one profile field to update.",
  });

function authErrorStatus(error: unknown): number {
  return typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
    ? error.status
    : 500;
}

function authErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Authentication request failed.";
}

router.post("/auth/request-otp", async (req, res): Promise<void> => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await requestFarmerOtp(parsed.data);
    res.json({
      requested: true,
      ...result,
      auth: getFarmerAuthStatus(),
    });
  } catch (error) {
    res.status(authErrorStatus(error)).json({ error: authErrorMessage(error) });
  }
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await verifyFarmerOtp(parsed.data);
    res.json({
      ...result,
      authenticated: true,
      auth: getFarmerAuthStatus(),
    });
  } catch (error) {
    res.status(authErrorStatus(error)).json({ error: authErrorMessage(error) });
  }
});

router.get("/auth/session", async (req, res): Promise<void> => {
  try {
    const farmer = await getFarmerSessionIdentity(getBearerToken(req));
    if (!farmer) {
      res.status(401).json({
        authenticated: false,
        auth: getFarmerAuthStatus(),
      });
      return;
    }

    res.json({
      authenticated: true,
      farmer,
      auth: getFarmerAuthStatus(),
    });
  } catch (error) {
    res.status(500).json({ error: authErrorMessage(error) });
  }
});

router.put("/auth/profile", requireFarmerAuth, async (req, res): Promise<void> => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const farmerSession = (req as typeof req & { farmerSession?: { id: number } }).farmerSession;
  if (!farmerSession) {
    res.status(401).json({ error: "Farmer authentication required." });
    return;
  }

  try {
    const farmer = await updateFarmerSessionProfile(farmerSession.id, {
      displayName:
        parsed.data.displayName === undefined ? undefined : parsed.data.displayName.trim() || null,
      villageName:
        parsed.data.villageName === undefined ? undefined : parsed.data.villageName.trim() || null,
    });

    if (!farmer) {
      res.status(404).json({ error: "Farmer profile not found." });
      return;
    }

    res.json({
      updated: true,
      farmer,
      auth: getFarmerAuthStatus(),
    });
  } catch (error) {
    res.status(authErrorStatus(error)).json({ error: authErrorMessage(error) });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.json({ success: true });
});

export default router;
