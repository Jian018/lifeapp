import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { adminFromRequest } from "@/lib/admin-session";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_FAILED") { super(message); }
}

export function requireAdmin(request: NextRequest) {
  const session = adminFromRequest(request);
  if (!session) throw new ApiError(401, "Management permission is missing or expired.", "ADMIN_REQUIRED");
  return session;
}

export async function readJson<T>(request: NextRequest, schema: ZodType<T>) {
  try { return schema.parse(await request.json()); }
  catch (error) {
    if (error instanceof ZodError) throw new ApiError(400, error.issues[0]?.message ?? "Invalid request.", "VALIDATION_ERROR");
    throw new ApiError(400, "Invalid JSON body.", "INVALID_JSON");
  }
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  console.error("API request failed", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" }, { status: 500 });
}
