import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { createActivityStored } from "@/lib/repository";
import { activityEntrySchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const input = await readJson(request, activityEntrySchema);
    return NextResponse.json(await createActivityStored({ ...input, aiEstimatedCaloriesBurned: input.aiEstimatedCaloriesBurned ?? null, minimumCaloriesBurned: input.minimumCaloriesBurned ?? null, maximumCaloriesBurned: input.maximumCaloriesBurned ?? null, confidence: input.confidence ?? null }), { status: 201 });
  } catch (error) { return apiError(error); }
}
