import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, ApiError, readJson, requireAdmin } from "@/lib/api";
import { resetSettingsSchema } from "@/lib/schemas";
import { resetEverythingStored } from "@/lib/repository";

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const input = await readJson(request, resetSettingsSchema);
    if (input.confirmation !== "RESET EVERYTHING") throw new ApiError(400, "Type RESET EVERYTHING to continue.", "CONFIRMATION_REQUIRED");
    await resetEverythingStored();
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
