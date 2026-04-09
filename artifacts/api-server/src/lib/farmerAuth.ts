import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import type { AdminSession } from "./adminAuth.js";
import { getAdminSessionFromToken, getBearerToken } from "./adminAuth.js";
import { getFarmerProfileById, upsertFarmerProfile, type FarmerProfile } from "./store.js";

const isProduction = process.env.NODE_ENV === "production";
const defaultSecret = "farmpal-local-farmer-secret";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;

const FARMER_SESSION_SECRET =
  process.env.FARMER_SESSION_SECRET?.trim() || (!isProduction ? defaultSecret : "");
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID?.trim() ?? "";

type DeliveryMode = "twilio" | "development";

interface DevOtpChallenge {
  code: string;
  expiresAt: number;
  displayName: string | null;
}

export interface FarmerIdentity {
  id: number;
  phoneNumber: string;
  displayName: string | null;
}

export interface FarmerSession extends FarmerIdentity {
  role: "farmer";
  expiresAt: number;
}

export type AuthenticatedActor =
  | { role: "admin"; adminSession: AdminSession }
  | { role: "farmer"; farmerSession: FarmerSession };

export interface RequestOtpResult {
  phoneNumber: string;
  expiresInSeconds: number;
  deliveryMode: DeliveryMode;
  devCode?: string;
}

class FarmerAuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "FarmerAuthError";
  }
}

const devChallenges = new Map<string, DevOtpChallenge>();

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string): string {
  return crypto
    .createHmac("sha256", FARMER_SESSION_SECRET)
    .update(payload)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function getDeliveryMode(): DeliveryMode | null {
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID) {
    return "twilio";
  }
  if (!isProduction) {
    return "development";
  }
  return null;
}

function buildTwilioAuthHeader(): string {
  const token = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

async function twilioRequest(path: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(`https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}${path}`, {
    method: "POST",
    headers: {
      Authorization: buildTwilioAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      (typeof data.message === "string" && data.message) ||
      (typeof data.detail === "string" && data.detail) ||
      "OTP provider request failed.";
    throw new FarmerAuthError(response.status, message);
  }

  return data;
}

function createDevChallenge(phoneNumber: string, displayName: string | null): RequestOtpResult {
  const code = String(crypto.randomInt(100000, 1000000));
  devChallenges.set(phoneNumber, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    displayName,
  });

  return {
    phoneNumber,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    deliveryMode: "development",
    devCode: code,
  };
}

function verifyDevChallenge(phoneNumber: string, code: string): { ok: true; displayName: string | null } {
  const challenge = devChallenges.get(phoneNumber);
  if (!challenge || challenge.expiresAt <= Date.now()) {
    devChallenges.delete(phoneNumber);
    throw new FarmerAuthError(401, "The OTP has expired. Request a new code.");
  }

  if (challenge.code !== code) {
    throw new FarmerAuthError(401, "The OTP code is not valid.");
  }

  devChallenges.delete(phoneNumber);
  return { ok: true, displayName: challenge.displayName };
}

export function normalizeKenyanPhoneNumber(rawPhoneNumber: string): string | null {
  const trimmed = rawPhoneNumber.trim();
  if (!trimmed) {
    return null;
  }

  const compact = trimmed.replace(/[^\d+]/g, "");
  let normalized = compact;
  if (normalized.startsWith("0")) {
    normalized = `+254${normalized.slice(1)}`;
  } else if (normalized.startsWith("254")) {
    normalized = `+${normalized}`;
  } else if (!normalized.startsWith("+") && /^[71]\d{8}$/.test(normalized)) {
    normalized = `+254${normalized}`;
  }

  if (!/^\+254(7\d{8}|1\d{8})$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function getFarmerAuthStatus() {
  const deliveryMode = getDeliveryMode();
  return {
    configured: Boolean(FARMER_SESSION_SECRET && deliveryMode),
    deliveryMode,
    usingDevelopmentOtp: deliveryMode === "development",
  };
}

export async function requestFarmerOtp(input: {
  phoneNumber: string;
  displayName?: string | null;
}): Promise<RequestOtpResult> {
  const phoneNumber = normalizeKenyanPhoneNumber(input.phoneNumber);
  if (!phoneNumber) {
    throw new FarmerAuthError(400, "Enter a valid Kenyan mobile number.");
  }

  const deliveryMode = getDeliveryMode();
  if (!FARMER_SESSION_SECRET || !deliveryMode) {
    throw new FarmerAuthError(
      503,
      "Farmer authentication is not configured. Set FARMER_SESSION_SECRET and Twilio Verify credentials.",
    );
  }

  if (deliveryMode === "development") {
    return createDevChallenge(phoneNumber, input.displayName ?? null);
  }

  await twilioRequest("/Verifications", {
    To: phoneNumber,
    Channel: "sms",
  });

  return {
    phoneNumber,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    deliveryMode,
  };
}

async function ensureFarmerIdentity(phoneNumber: string, displayName?: string | null): Promise<FarmerIdentity> {
  const farmer = await upsertFarmerProfile({
    phoneNumber,
    displayName: displayName ?? null,
  });

  return {
    id: farmer.id,
    phoneNumber: farmer.phoneNumber,
    displayName: farmer.displayName,
  };
}

export async function verifyFarmerOtp(input: {
  phoneNumber: string;
  code: string;
  displayName?: string | null;
}): Promise<{ token: string; farmer: FarmerIdentity; expiresAt: string }> {
  const phoneNumber = normalizeKenyanPhoneNumber(input.phoneNumber);
  if (!phoneNumber) {
    throw new FarmerAuthError(400, "Enter a valid Kenyan mobile number.");
  }

  const code = input.code.trim();
  if (!/^\d{4,8}$/.test(code)) {
    throw new FarmerAuthError(400, "Enter the OTP code you received.");
  }

  const deliveryMode = getDeliveryMode();
  if (!FARMER_SESSION_SECRET || !deliveryMode) {
    throw new FarmerAuthError(
      503,
      "Farmer authentication is not configured. Set FARMER_SESSION_SECRET and Twilio Verify credentials.",
    );
  }

  let displayName = input.displayName ?? null;
  if (deliveryMode === "development") {
    const result = verifyDevChallenge(phoneNumber, code);
    displayName = displayName ?? result.displayName;
  } else {
    const verification = await twilioRequest("/VerificationCheck", {
      To: phoneNumber,
      Code: code,
    });
    if (verification.status !== "approved") {
      throw new FarmerAuthError(401, "The OTP code is not valid.");
    }
  }

  const farmer = await ensureFarmerIdentity(phoneNumber, displayName);
  const session: FarmerSession = {
    ...farmer,
    role: "farmer",
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = signPayload(payload);

  return {
    token: `${payload}.${signature}`,
    farmer,
    expiresAt: new Date(session.expiresAt).toISOString(),
  };
}

export function getFarmerSessionFromToken(token: string | null | undefined): FarmerSession | null {
  if (!token || !FARMER_SESSION_SECRET) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = signPayload(payload);
  if (!safeEqual(signature, expected)) {
    return null;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as FarmerSession;
    if (session.role !== "farmer" || session.expiresAt <= Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function getFarmerSessionIdentity(token: string | null | undefined): Promise<FarmerIdentity | null> {
  const session = getFarmerSessionFromToken(token);
  if (!session) {
    return null;
  }

  const farmer = await getFarmerProfileById(session.id);
  if (!farmer) {
    return null;
  }

  return {
    id: farmer.id,
    phoneNumber: farmer.phoneNumber,
    displayName: farmer.displayName,
  };
}

export function getAuthenticatedActor(req: Request): AuthenticatedActor | null {
  const token = getBearerToken(req);
  const adminSession = getAdminSessionFromToken(token);
  if (adminSession) {
    return { role: "admin", adminSession };
  }

  const farmerSession = getFarmerSessionFromToken(token);
  if (farmerSession) {
    return { role: "farmer", farmerSession };
  }

  return null;
}

export function requireFarmerAuth(req: Request, res: Response, next: NextFunction): void {
  if (!getFarmerAuthStatus().configured) {
    res.status(503).json({
      error: "Farmer authentication is not configured. Set FARMER_SESSION_SECRET and Twilio Verify credentials.",
    });
    return;
  }

  const farmerSession = getFarmerSessionFromToken(getBearerToken(req));
  if (!farmerSession) {
    res.status(401).json({ error: "Farmer authentication required." });
    return;
  }

  (req as Request & { farmerSession?: FarmerSession }).farmerSession = farmerSession;
  next();
}

export function requireFarmerOrAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const actor = getAuthenticatedActor(req);
  if (!actor) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  (req as Request & { authenticatedActor?: AuthenticatedActor }).authenticatedActor = actor;
  next();
}
