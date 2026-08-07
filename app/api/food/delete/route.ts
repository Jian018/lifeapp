import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { deleteSchema } from "@/lib/schemas";
import { deleteFoodStored } from "@/lib/repository";

export async function DELETE(request: NextRequest) {
  try { requireAdmin(request); const input = await readJson(request, deleteSchema); return NextResponse.json(await deleteFoodStored(input.id)); }
  catch (error) { return apiError(error); }
}
