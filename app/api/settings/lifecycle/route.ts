import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { lifecycleSettingsSchema } from "@/lib/schemas";
import { updateLifecycleScoresStored } from "@/lib/repository";

export async function PATCH(request: NextRequest) {
  try { requireAdmin(request); const input = await readJson(request, lifecycleSettingsSchema); return NextResponse.json(await updateLifecycleScoresStored(input)); }
  catch (error) { return apiError(error); }
}
