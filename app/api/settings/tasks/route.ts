import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { taskSettingsSchema } from "@/lib/schemas";
import { updateTasksStored } from "@/lib/repository";

export async function PATCH(request: NextRequest) {
  try { requireAdmin(request); const input = await readJson(request, taskSettingsSchema); return NextResponse.json(await updateTasksStored(input.tasks)); }
  catch (error) { return apiError(error); }
}
