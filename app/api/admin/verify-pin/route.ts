import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, createAdminToken, securePinMatches, SESSION_TTL_SECONDS } from "@/lib/admin-session";
import { clearPinFailures, getPinAttemptState, recordPinFailure } from "@/lib/rate-limit";
import { apiError, readJson } from "@/lib/api";

const schema = z.object({ pin: z.string().regex(/^\d{4}$/) });

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
    const state = getPinAttemptState(ip);
    if (state.locked) return NextResponse.json({ error: "Too many attempts. Try again later.", code: "PIN_LOCKED", retryAfterSeconds: state.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(state.retryAfterSeconds) } });
    const { pin } = await readJson(request, schema);
    if (!securePinMatches(pin)) {
      const next = recordPinFailure(ip);
      const response = NextResponse.json({ error: next.locked ? "Too many attempts. Try again later." : "Management code is incorrect. Please try again.", code: next.locked ? "PIN_LOCKED" : "INVALID_PIN", retryAfterSeconds: next.retryAfterSeconds }, { status: next.locked ? 429 : 401 });
      if (next.locked) response.headers.set("Retry-After", String(next.retryAfterSeconds));
      return response;
    }
    clearPinFailures(ip);
    const response = NextResponse.json({ authorized: true, expiresIn: SESSION_TTL_SECONDS });
    response.cookies.set(ADMIN_COOKIE, createAdminToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: SESSION_TTL_SECONDS, path: "/" });
    return response;
  } catch (error) { return apiError(error); }
}
