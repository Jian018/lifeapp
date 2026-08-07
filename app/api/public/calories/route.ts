import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ApiError, apiError } from "@/lib/api";
import { readDatabase } from "@/lib/repository";
import { calorieStats } from "@/lib/service";
import { dateInTimezone } from "@/lib/date";
import { isoDateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const db = await readDatabase();
    const date = request.nextUrl.searchParams.get("date") ?? dateInTimezone(new Date(), db.settings.timezone);
    if (!isoDateSchema.safeParse(date).success) throw new ApiError(400, "Invalid date.", "VALIDATION_ERROR");
    return NextResponse.json(calorieStats(db, date));
  } catch (error) { return apiError(error); }
}
