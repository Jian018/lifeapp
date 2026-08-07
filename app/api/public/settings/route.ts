import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { readDatabase } from "@/lib/repository";
import { publicSettingsView } from "@/lib/service";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(publicSettingsView(await readDatabase()));
  } catch (error) { return apiError(error); }
}
