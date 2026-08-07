import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { taskDefinitionSchema } from "@/lib/schemas";
import { updateTaskStored } from "@/lib/repository";

export async function PATCH(request: NextRequest) {
  try { requireAdmin(request); const input = await readJson(request, taskDefinitionSchema); return NextResponse.json(await updateTaskStored(input)); }
  catch (error) { return apiError(error); }
}
