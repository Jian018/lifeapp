import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { deleteSchema } from "@/lib/schemas";
import { deleteSmokingStored } from "@/lib/repository";

export async function DELETE(request: NextRequest) {
  try { requireAdmin(request); const input = await readJson(request, deleteSchema); return NextResponse.json(await deleteSmokingStored(input.id)); }
  catch (error) { return apiError(error); }
}
