import { NextResponse } from "next/server";
import { readDatabase } from "@/lib/repository";
import { dashboardView } from "@/lib/service";
import { apiError } from "@/lib/api";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(dashboardView(await readDatabase())); }
  catch (error) { return apiError(error); }
}
