import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ApiError, apiError, readJson } from "@/lib/api";
import { settingsExportSchema } from "@/lib/schemas";
import { readDatabase } from "@/lib/repository";

function cell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function csv(rows: unknown[][]) { return rows.map((row) => row.map(cell).join(",")).join("\n"); }

export async function POST(request: NextRequest) {
  try {
    const input = await readJson(request, settingsExportSchema);
    const db = await readDatabase();
    if (input.format === "json") {
      return new NextResponse(JSON.stringify(db, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=my-life-system.json" } });
    }
    let rows: unknown[][];
    let filename: string;
    if (input.dataset === "tasks") {
      rows = [["date", "task", "base_target", "carried_target", "total_target", "status", "completed_at"], ...db.dailyTaskRecords.map((record) => [record.recordDate, db.taskDefinitions.find((task) => task.id === record.taskDefinitionId)?.name ?? record.taskDefinitionId, record.baseTarget, record.carriedTarget, record.totalTarget, record.status, record.completedAt])];
      filename = "tasks.csv";
    } else if (input.dataset === "food") {
      rows = [["date", "time", "meal", "meal_type", "confirmed_calories", "dessert", "confidence"], ...db.foodEntries.map((entry) => [entry.entryDate, entry.entryTime, entry.mealName, entry.mealType, entry.confirmedCalories, entry.isDessert, entry.confidence])];
      filename = "food-entries.csv";
    } else if (input.dataset === "activities") {
      rows = [["date", "time", "activity", "duration_minutes", "intensity", "confirmed_calories_burned", "source"], ...db.activityEntries.map((entry) => [entry.activityDate, entry.activityTime, entry.activityName, entry.durationMinutes, entry.intensity, entry.confirmedCaloriesBurned, entry.source])];
      filename = "activity-entries.csv";
    } else if (input.dataset === "lifecycle") {
      rows = [["date", "source_type", "reason", "explore_world_delta", "relationship_delta", "family_delta", "reverted"], ...db.lifecycleEffects.map((effect) => [effect.effectDate, effect.sourceType, effect.reason, effect.worldDelta, effect.relationshipDelta, effect.familyDelta, effect.isReverted])];
      filename = "lifecycle-history.csv";
    } else if (input.dataset === "smoking") {
      rows = [["date", "time", "created_at"], ...db.smokingEntries.map((entry) => [entry.entryDate, entry.entryTime, entry.createdAt])];
      filename = "smoking-history.csv";
    } else throw new ApiError(400, "Choose a CSV dataset.", "DATASET_REQUIRED");
    return new NextResponse(csv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename=${filename}` } });
  } catch (error) { return apiError(error); }
}
