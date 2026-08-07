import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { createAdminToken } from "@/lib/admin-session";
import { createDefaultDatabase, readDatabase, withDatabaseTransaction } from "@/lib/local-db";
import { createFood, resetLifecycleScores, updateCalorieSettings, updateDisplaySettings, updateGeneralSettings, updateLifecycleRules, updateLifecycleScores, updateTimelineSettings } from "@/lib/service";
import { energizedScore } from "@/lib/lifecycle";
import { POST as exportSettings } from "@/app/api/settings/export/route";
import { PATCH as patchGeneral } from "@/app/api/settings/general/route";
import { POST as resetAll } from "@/app/api/settings/reset-all/route";

describe("persistent app settings", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
    process.env.ADMIN_PIN = "2468";
  });

  it("updates General settings in the server model", () => {
    const db = createDefaultDatabase();
    updateGeneralSettings(db, { websiteName: "Life Console", language: "zh", timezone: "Asia/Tokyo" });
    expect(db.settings).toMatchObject({ websiteName: "Life Console", language: "zh", timezone: "Asia/Tokyo" });
  });

  it("recalculates target date when birth date or target age changes", () => {
    const db = createDefaultDatabase();
    updateTimelineSettings(db, { birthDate: "2000-06-15", targetAge: 65 });
    expect(db.settings.targetDate).toBe("2065-06-15");
  });

  it("saves three Lifecycle score changes with audit adjustments", () => {
    const db = createDefaultDatabase(); db.lifecycleAdjustments = []; db.lifecycleEffects = [];
    updateLifecycleScores(db, { exploreWorldScore: 30, relationshipScore: 29, familyScore: 34, reason: "Quarterly reflection" });
    expect(energizedScore(db.settings)).toBe(93);
    expect(db.lifecycleAdjustments).toHaveLength(3);
    expect(db.lifecycleEffects.every((effect) => effect.reason === "Quarterly reflection")).toBe(true);
  });

  it("persists behavior rules without rewriting historical effects", () => {
    const db = createDefaultDatabase(); db.lifecycleEffects = []; db.foodEntries = [];
    const first = createFood(db, { entryDate: "2026-08-07", entryTime: "12:00", mealName: "Cake", mealType: "snack", confirmedCalories: 400, aiEstimatedCalories: null, minimumCalories: null, maximumCalories: null, foodItems: [], isDessert: true, confidence: null, assumptions: [] });
    updateLifecycleRules(db, { exerciseWorldDelta: 2, exerciseRelationshipDelta: 1, exerciseFamilyDelta: 1, dessertWorldDelta: -.5, dessertRelationshipDelta: -.5, dessertFamilyDelta: -.5, smokingWorldDelta: -2, smokingRelationshipDelta: -1, smokingFamilyDelta: -1 });
    expect(db.lifecycleEffects.find((effect) => effect.sourceId === first.id)?.worldDelta).toBe(-1);
    expect(db.settings.dessertWorldDelta).toBe(-.5);
  });

  it("persists calorie and display settings", () => {
    const db = createDefaultDatabase();
    updateCalorieSettings(db, { defaultMealType: "dinner", aiFoodAnalysisEnabled: false, activityAiEnabled: false, bodyWeightKg: 70, defaultCaloriesView: "week", requireAiConfirmation: false });
    updateDisplaySettings(db, { defaultLandingPage: "/lifecycle", desktopSidebarMode: "compact", mobileDateRange: 5 });
    expect(db.settings).toMatchObject({ defaultMealType: "dinner", aiFoodAnalysisEnabled: false, activityAiEnabled: false, bodyWeightKg: 70, defaultCaloriesView: "week", requireAiConfirmation: false, defaultLandingPage: "/lifecycle", desktopSidebarMode: "compact", mobileDateRange: 5 });
  });

  it("resets only Lifecycle scores and keeps business history", () => {
    const db = createDefaultDatabase();
    db.settings.exploreWorldScore = 70; db.settings.relationshipScore = 40; db.settings.familyScore = 20;
    const foodCount = db.foodEntries.length; const taskCount = db.dailyTaskRecords.length;
    resetLifecycleScores(db);
    expect([db.settings.exploreWorldScore, db.settings.relationshipScore, db.settings.familyScore]).toEqual([33, 33, 33]);
    expect(db.foodEntries).toHaveLength(foodCount); expect(db.dailyTaskRecords).toHaveLength(taskCount);
    expect(db.lifecycleAdjustments.at(-1)?.reason).toContain("Lifecycle reset");
  });

  it("creates a real JSON export", async () => {
    const request = new NextRequest("http://localhost/api/settings/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: "json", dataset: "all" }) });
    const response = await exportSettings(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("my-life-system.json");
    expect((await response.json()).settings).toBeTruthy();
  });

  it("creates a real CSV export", async () => {
    const request = new NextRequest("http://localhost/api/settings/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: "csv", dataset: "food" }) });
    const response = await exportSettings(request);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("confirmed_calories");
  });

  it("rejects a settings mutation without management authorization", async () => {
    const request = new NextRequest("http://localhost/api/settings/general", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ websiteName: "Nope", language: "en", timezone: "UTC" }) });
    expect((await patchGeneral(request)).status).toBe(401);
  });

  it("requires the exact full reset confirmation on the server", async () => {
    const token = createAdminToken();
    const request = new NextRequest("http://localhost/api/settings/reset-all", { method: "POST", headers: { "Content-Type": "application/json", Cookie: `mls_admin_session=${token}` }, body: JSON.stringify({ confirmation: "RESET" }) });
    expect((await resetAll(request)).status).toBe(400);
  });

  it("persists settings across a fresh datastore read", async () => {
    const before = await readDatabase();
    try {
      await withDatabaseTransaction((db) => { db.settings.websiteName = "Persistence Check"; db.settings.updatedAt = new Date().toISOString(); });
      expect((await readDatabase()).settings.websiteName).toBe("Persistence Check");
    } finally { await withDatabaseTransaction((db) => { Object.assign(db, before); }); }
  });

  it("keeps every settings write route behind requireAdmin", () => {
    const routes = ["general", "timeline", "lifecycle", "tasks", "lifecycle-rules", "calories", "display", "reset-lifecycle", "reset-all"];
    for (const route of routes) {
      const source = readFileSync(path.join(process.cwd(), `app/api/settings/${route}/route.ts`), "utf8");
      expect(source).toContain("requireAdmin(request)");
    }
  });

  it("does not render placeholder links or disabled fake controls", () => {
    const source = readFileSync(path.join(process.cwd(), "app/settings/page.tsx"), "utf8");
    expect(source).not.toContain('href="#"');
    expect(source).not.toContain("TODO");
    expect(source).not.toContain("placeholder button");
  });
});
