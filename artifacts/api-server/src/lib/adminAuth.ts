import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const isProduction = process.env.NODE_ENV === "production";
const defaultEmail = "admin@farmpal.local";
const defaultPassword = "farmpal-admin";
const defaultSecret = "farmpal-local-admin-secret";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim() || (!isProduction ? defaultEmail : "");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || (!isProduction ? defaultPassword : "");
const ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET?.trim() || (!isProduction ? defaultSecret : "");

export interface AdminSession {
  email: string;
  role: "admin";
  expiresAt: number;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string): string {
  return crypto
    .createHmac("sha256", ADMIN_SESSION_SECRET)
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

export function getAdminAuthStatus() {
  const configured = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD && ADMIN_SESSION_SECRET);
  return {
    configured,
    usingDefaultCredentials:
      !isProduction &&
      ADMIN_EMAIL === defaultEmail &&
      ADMIN_PASSWORD === defaultPassword &&
      ADMIN_SESSION_SECRET === defaultSecret,
  };
}

export function validateAdminCredentials(email: string, password: string): boolean {
  if (!getAdminAuthStatus().configured) {
    return false;
  }

  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD;
}

export function createAdminToken(): { token: string; session: AdminSession } {
  const session: AdminSession = {
    email: ADMIN_EMAIL,
    role: "admin",
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = signPayload(payload);

  return {
    token: `${payload}.${signature}`,
    session,
  };
}

export function getAdminSessionFromToken(token: string | null | undefined): AdminSession | null {
  if (!token || !getAdminAuthStatus().configured) {
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
    const session = JSON.parse(base64UrlDecode(payload)) as AdminSession;
    if (session.role !== "admin" || session.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return null;
    }

    if (session.expiresAt <= Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  if (!getAdminAuthStatus().configured) {
    res.status(503).json({
      error: "Admin authentication is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET.",
    });
    return;
  }

  const session = getAdminSessionFromToken(getBearerToken(req));
  if (!session) {
    res.status(401).json({ error: "Admin authentication required." });
    return;
  }

  (req as Request & { adminSession?: AdminSession }).adminSession = session;
  next();
}
