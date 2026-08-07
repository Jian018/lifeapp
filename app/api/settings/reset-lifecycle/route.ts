import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, ApiError, readJson, requireAdmin } from "@/lib/api";
import { resetSettingsSchema } from "@/lib/schemas";
import { resetLifecycleStored } from "@/lib/repository";

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const input = await readJson(request, resetSettingsSchema);
    if (input.confirmation !== "RESET LIFECYCLE") throw new ApiError(400, "Type RESET LIFECYCLE to continue.", "CONFIRMATION_REQUIRED");
    return NextResponse.json(await resetLifecycleStored());
  } catch (error) { return apiError(error); }
}
