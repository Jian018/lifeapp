import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { taskMutationSchema } from "@/lib/schemas";
import { uncompleteTaskStored } from "@/lib/repository";

export async function POST(request: NextRequest) {
  try { requireAdmin(request); const input = await readJson(request, taskMutationSchema); return NextResponse.json(await uncompleteTaskStored(input.taskDefinitionId, input.date)); }
  catch (error) { return apiError(error); }
}
