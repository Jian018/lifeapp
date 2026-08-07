import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { createAdminToken } from "@/lib/admin-session";
import { activityAnalysisPrompt, activityDescriptionHasDuration } from "@/lib/activity-ai";
import { daysPerEnergizedPercent, effectiveDaysRemaining, lifecycleTimeline } from "@/lib/date";
import { createDefaultDatabase, readDatabase, withDatabaseTransaction } from "@/lib/local-db";
import { activityAnalysisSchema } from "@/lib/schemas";
import { calorieStats, createActivity, deleteActivity, lifecycleView, taskDayView, updateActivity } from "@/lib/service";
import { POST as analyzeActivity } from "@/app/api/analyze-activity/route";
import { POST as createActivityRoute } from "@/app/api/activities/create/route";

const rootFile = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
const activityInput = {
  activityDate: "2026-08-07", activityTime: "20:20", activityName: "Basketball", durationMinutes: 30,
  intensity: "moderate" as const, confirmedCaloriesBurned: 240, aiEstimatedCaloriesBurned: 240,
  minimumCaloriesBurned: 190, maximumCaloriesBurned: 290, confidence: "medium" as const,
  assumptions: ["Moderate intensity"], source: "ai" as const,
};

describe("final task and activity model", () => {
  it("uses a 30-second Plank by default", () => {
    const plank = createDefaultDatabase().taskDefinitions.find((task) => task.taskKey === "plank");
    expect(plank).toMatchObject({ baseTarget: 30, unit: "seconds" });
  });

  it("keeps a stored historical 3-second Plank record unchanged", () => {
    const db = createDefaultDatabase();
    const plank = db.taskDefinitions.find((task) => task.taskKey === "plank")!;
    db.dailyTaskRecords.push({ id: "historical-plank", taskDefinitionId: plank.id, recordDate: "2026-08-01", baseTarget: 3, carriedTarget: 0, totalTarget: 3, status: "completed", completedAt: new Date().toISOString(), carriedToDate: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    expect(taskDayView(db, "2026-08-01").tasks.find((task) => task.definition.taskKey === "plank")?.record.baseTarget).toBe(3);
    expect(taskDayView(db, "2026-08-02").tasks.find((task) => task.definition.taskKey === "plank")?.record.baseTarget).toBe(30);
  });

  it("recognizes Chinese and English activity durations", () => {
    expect(activityDescriptionHasDuration("30分钟basketball")).toBe(true);
    expect(activityDescriptionHasDuration("Walking 1 hour")).toBe(true);
    expect(activityDescriptionHasDuration("Basketball")).toBe(false);
  });

  it("validates structured AI burned-calorie output", () => {
    expect(activityAnalysisSchema.safeParse({ activity_name: "Basketball", duration_minutes: 30, intensity: "moderate", estimated_calories_burned: 240, minimum_calories_burned: 190, maximum_calories_burned: 290, confidence: "medium", assumptions: [] }).success).toBe(true);
  });

  it("adds confirmed activity burn without changing the four-task completion or Lifecycle", () => {
    const db = createDefaultDatabase(); db.activityEntries = []; db.lifecycleEffects = [];
    const before = taskDayView(db, activityInput.activityDate).summary;
    const scores = [db.settings.exploreWorldScore, db.settings.relationshipScore, db.settings.familyScore];
    createActivity(db, activityInput);
    expect(taskDayView(db, activityInput.activityDate).summary).toEqual(before);
    expect(taskDayView(db, activityInput.activityDate).activityBurn).toBe(240);
    expect([db.settings.exploreWorldScore, db.settings.relationshipScore, db.settings.familyScore]).toEqual(scores);
    expect(db.lifecycleEffects).toHaveLength(0);
  });

  it("edits and deletes activity burn and recalculates Net Calories", () => {
    const db = createDefaultDatabase(); db.foodEntries = []; db.activityEntries = [];
    db.foodEntries.push({ id: "food", entryDate: activityInput.activityDate, entryTime: "12:00", mealName: "Lunch", mealType: "lunch", confirmedCalories: 2000, aiEstimatedCalories: null, minimumCalories: null, maximumCalories: null, foodItems: [], isDessert: false, confidence: null, assumptions: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    const activity = createActivity(db, activityInput);
    expect(calorieStats(db, activityInput.activityDate).today).toMatchObject({ intake: 2000, burned: 240, net: 1760 });
    updateActivity(db, { id: activity.id, activityDate: activityInput.activityDate, activityTime: "20:20", activityName: "Basketball", durationMinutes: 30, confirmedCaloriesBurned: 100 });
    expect(calorieStats(db, activityInput.activityDate).today.net).toBe(1900);
    deleteActivity(db, activity.id);
    expect(calorieStats(db, activityInput.activityDate).today).toMatchObject({ burned: 0, net: 2000 });
  });

  it("filters an exact date and custom date range", () => {
    const db = createDefaultDatabase(); db.activityEntries = []; db.foodEntries = [];
    createActivity(db, { ...activityInput, activityDate: "2026-08-01" });
    createActivity(db, { ...activityInput, activityDate: "2026-08-07", confirmedCaloriesBurned: 300 });
    expect(calorieStats(db, "2026-08-01").today.burned).toBe(240);
    expect(calorieStats(db, "2026-08-07", "2026-08-01", "2026-08-07").range.totalBurned).toBe(540);
  });
});

describe("effective life math", () => {
  it("calculates natural time from the Singapore business date", () => {
    const first = lifecycleTimeline("2003-01-08", "2063-01-08", "2026-08-07");
    const next = lifecycleTimeline("2003-01-08", "2063-01-08", "2026-08-08");
    expect(next.remainingDays).toBe(first.remainingDays - 1);
  });

  it("uses 100%, 99%, and a 3% drop correctly", () => {
    expect(effectiveDaysRemaining(13_000, 100)).toBe(13_000);
    expect(effectiveDaysRemaining(13_000, 99)).toBe(12_870);
    expect(effectiveDaysRemaining(13_000, 96)).toBe(12_480);
    expect(effectiveDaysRemaining(13_000, 99) - effectiveDaysRemaining(13_000, 96)).toBe(390);
  });

  it("clamps effective time and exposes days per 1%", () => {
    expect(effectiveDaysRemaining(13_000, 120)).toBe(13_000);
    expect(effectiveDaysRemaining(13_000, -10)).toBe(0);
    expect(daysPerEnergizedPercent(13_000)).toBe(130);
  });

  it("returns 99% effective life for the initial 33 + 33 + 33 state", () => {
    const view = lifecycleView(createDefaultDatabase("2026-08-07"));
    expect(view.energized).toBe(99);
    expect(view.effectiveDaysRemaining).toBe(Math.round(view.naturalDaysRemaining * .99));
  });
});

describe("AI, settings, mobile upload, and security contracts", () => {
  it("uses saved body weight in future activity prompts", () => {
    expect(activityAnalysisPrompt("Basketball 30 minutes", 70)).toContain("70 kg");
    expect(activityAnalysisPrompt("Basketball 30 minutes", null)).toContain("average-adult");
  });

  it("renders separate mobile camera and gallery inputs without forcing gallery capture", () => {
    const source = rootFile("app/calories/page.tsx");
    expect(source).toContain("Take Photo");
    expect(source).toContain("Choose from Gallery");
    expect(source).toContain('capture="environment"');
    const gallery = source.slice(source.indexOf("Choose from Gallery"), source.indexOf("Choose from Gallery") + 260);
    expect(gallery).not.toContain("capture=");
  });

  it("never adds a food image storage column or client persistence", () => {
    const schema = rootFile("supabase/migrations/202608070001_initial_schema.sql");
    const calories = rootFile("app/calories/page.tsx");
    const foodTable = schema.match(/create table public\.food_entries \([\s\S]+?\n\);/)?.[0] ?? "";
    expect(foodTable).not.toMatch(/image|base64|storage|blob/i);
    expect(calories).not.toMatch(/localStorage|supabase\.storage|vercel.*blob/i);
  });

  it("links Dashboard intake and Today burn to the selected date", () => {
    expect(rootFile("app/page.tsx")).toContain("/calories?date=${data.today}");
    expect(rootFile("app/tasks/page.tsx")).toContain("/calories?date=${date}&view=activities");
  });

  it("keeps every activity write and AI route behind management authorization", async () => {
    for (const file of ["app/api/analyze-activity/route.ts", "app/api/activities/create/route.ts", "app/api/activities/[id]/route.ts"]) expect(rootFile(file)).toContain("requireAdmin(request)");
    const response = await createActivityRoute(new NextRequest("http://localhost/api/activities/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(activityInput) }));
    expect(response.status).toBe(401);
  });

  it("blocks activity AI when the persisted setting is off", async () => {
    process.env.ADMIN_SESSION_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
    const before = await readDatabase();
    try {
      await withDatabaseTransaction((db) => { db.settings.activityAiEnabled = false; });
      const token = createAdminToken();
      const request = new NextRequest("http://localhost/api/analyze-activity", { method: "POST", headers: { "Content-Type": "application/json", Cookie: `mls_admin_session=${token}` }, body: JSON.stringify({ description: "Basketball 30 minutes" }) });
      expect((await analyzeActivity(request)).status).toBe(409);
    } finally { await withDatabaseTransaction((db) => { Object.assign(db, before); }); }
  });

  it("ships the additive Supabase activity migration without rewriting historical task rows", () => {
    const migration = rootFile("supabase/migrations/202608070004_effective_life_and_activities.sql");
    expect(migration).toContain("create table if not exists public.activity_entries");
    expect(migration).toContain("where task_key = 'plank' and base_target = 3");
    expect(migration).not.toMatch(/update public\.daily_task_records[\s\S]+base_target/i);
    expect(migration).toContain("revoke execute on function public.create_activity_entry");
  });
});
