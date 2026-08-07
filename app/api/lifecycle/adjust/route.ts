import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { lifecycleAdjustSchema } from "@/lib/schemas";
import { adjustLifecycleStored } from "@/lib/repository";

export async function POST(request: NextRequest) {
  try { requireAdmin(request); const input = await readJson(request, lifecycleAdjustSchema); return NextResponse.json(await adjustLifecycleStored(input.category, input.delta, input.reason)); }
  catch (error) { return apiError(error); }
}
