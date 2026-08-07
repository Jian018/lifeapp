import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { foodEntrySchema } from "@/lib/schemas";
import { createFoodStored } from "@/lib/repository";

export async function POST(request: NextRequest) {
  try { requireAdmin(request); const input = await readJson(request, foodEntrySchema); return NextResponse.json(await createFoodStored({ ...input, aiEstimatedCalories: input.aiEstimatedCalories ?? null, minimumCalories: input.minimumCalories ?? null, maximumCalories: input.maximumCalories ?? null, confidence: input.confidence ?? null }), { status: 201 }); }
  catch (error) { return apiError(error); }
}
