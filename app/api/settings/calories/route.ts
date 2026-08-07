import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { calorieSettingsSchema } from "@/lib/schemas";
import { updateCaloriesStored } from "@/lib/repository";

export async function PATCH(request: NextRequest) {
  try { requireAdmin(request); const input = await readJson(request, calorieSettingsSchema); return NextResponse.json(await updateCaloriesStored(input)); }
  catch (error) { return apiError(error); }
}
