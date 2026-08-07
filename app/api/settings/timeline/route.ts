import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { timelineSettingsSchema } from "@/lib/schemas";
import { updateTimelineStored } from "@/lib/repository";

export async function PATCH(request: NextRequest) {
  try { requireAdmin(request); const input = await readJson(request, timelineSettingsSchema); return NextResponse.json(await updateTimelineStored(input)); }
  catch (error) { return apiError(error); }
}
