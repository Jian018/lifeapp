import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { smokingCreateSchema } from "@/lib/schemas";
import { createSmokingStored } from "@/lib/repository";

export async function POST(request: NextRequest) {
  try { requireAdmin(request); const input = await readJson(request, smokingCreateSchema); return NextResponse.json(await createSmokingStored(input), { status: 201 }); }
  catch (error) { return apiError(error); }
}
