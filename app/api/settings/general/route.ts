import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { generalSettingsSchema } from "@/lib/schemas";
import { updateGeneralStored } from "@/lib/repository";

export async function PATCH(request: NextRequest) {
  try { requireAdmin(request); const input = await readJson(request, generalSettingsSchema); return NextResponse.json(await updateGeneralStored(input)); }
  catch (error) { return apiError(error); }
}
