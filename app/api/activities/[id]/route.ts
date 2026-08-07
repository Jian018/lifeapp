import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, readJson, requireAdmin } from "@/lib/api";
import { deleteActivityStored, updateActivityStored } from "@/lib/repository";
import { activityUpdateSchema, idSchema } from "@/lib/schemas";

const updateBodySchema = activityUpdateSchema.omit({ id: true });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const input = await readJson(request, updateBodySchema);
    return NextResponse.json(await updateActivityStored({ id: idSchema.parse(id), ...input }));
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    return NextResponse.json(await deleteActivityStored(idSchema.parse(id)));
  } catch (error) { return apiError(error); }
}
