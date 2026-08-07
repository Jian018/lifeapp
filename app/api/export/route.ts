import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readDatabase } from "@/lib/repository";
import { apiError } from "@/lib/api";

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export async function GET(request: NextRequest) {
  try {
    const db = await readDatabase();
    const format = request.nextUrl.searchParams.get("format") ?? "json";
    if (format === "csv") {
      const rows = [["date", "time", "meal", "meal_type", "calories", "dessert"], ...db.foodEntries.map((entry) => [entry.entryDate, entry.entryTime, entry.mealName, entry.mealType, entry.confirmedCalories, entry.isDessert])];
      return new NextResponse(rows.map((row) => row.map(csvCell).join(",")).join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=life-system-calories.csv" } });
    }
    return new NextResponse(JSON.stringify(db, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=life-system-export.json" } });
  } catch (error) { return apiError(error); }
}
