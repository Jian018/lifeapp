import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "mls_admin_session";
export const SESSION_TTL_SECONDS = 10 * 60;

type SessionPayload = { exp: number; issued: number; nonce: string };

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters");
  return value;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", secret()).update(encodedPayload).digest("base64url");
}

export function createAdminToken(now = Date.now()) {
  const payload: SessionPayload = { exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS, issued: Math.floor(now / 1000), nonce: crypto.randomUUID() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAdminToken(token: string | undefined, now = Date.now()) {
  if (!token) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;
  const expected = Buffer.from(sign(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(now / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function adminFromRequest(request: NextRequest) {
  return verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value);
}

export function securePinMatches(candidate: string) {
  const actual = process.env.ADMIN_PIN;
  if (!actual || !/^\d{4}$/.test(actual) || !/^\d{4}$/.test(candidate)) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(actual));
}

export function rateLimitKey(clientAddress: string) {
  return createHmac("sha256", secret()).update(`pin-rate-limit:${clientAddress}`).digest("hex");
}
