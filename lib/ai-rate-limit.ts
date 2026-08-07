import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;

export function assertAiRateLimit(request: NextRequest, now = Date.now()) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const current = buckets.get(address);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : current;
  bucket.count += 1;
  buckets.set(address, bucket);
  if (bucket.count > MAX_REQUESTS) throw new ApiError(429, "Too many AI requests. Wait a minute and try again.", "AI_RATE_LIMITED");
}

export function resetAiRateLimitsForTests() { buckets.clear(); }
