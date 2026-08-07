import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, ApiError } from "@/lib/api";
import { readDatabase } from "@/lib/repository";
import { taskCalendar, taskDayView } from "@/lib/service";
import { isoDateSchema } from "@/lib/schemas";
import { dateInTimezone } from "@/lib/date";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const db = await readDatabase();
    const date = request.nextUrl.searchParams.get("date") ?? dateInTimezone(new Date(), db.settings.timezone);
    if (!isoDateSchema.safeParse(date).success) throw new ApiError(400, "Invalid date.", "VALIDATION_ERROR");
    return NextResponse.json({ ...taskDayView(db, date), calendar: taskCalendar(db, date) });
  } catch (error) { return apiError(error); }
}
