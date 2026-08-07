import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { foodUpdateSchema } from "@/lib/schemas";
import { updateFoodStored } from "@/lib/repository";

export async function PATCH(request: NextRequest) {
  try { requireAdmin(request); const input = await readJson(request, foodUpdateSchema); return NextResponse.json(await updateFoodStored(input)); }
  catch (error) { return apiError(error); }
}
