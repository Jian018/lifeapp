import { describe, expect, it } from "vitest";
import { addDays, singaporeDate } from "@/lib/date";
import { createDefaultDatabase } from "@/lib/local-db";
import { calorieStats, carryTask, completeTask, createFood, createSmoking, deleteFood, deleteSmoking, lifecycleView, revertCarry, taskDayView, uncompleteTask, updateFood, updateLifecycleRules, updateTaskDefinition } from "@/lib/service";

function cleanDatabase() {
  const db = createDefaultDatabase();
  db.dailyTaskRecords = []; db.taskCarryovers = []; db.foodEntries = []; db.smokingEntries = []; db.lifecycleEffects = []; db.lifecycleAdjustments = [];
  db.settings.exploreWorldScore = 33; db.settings.relationshipScore = 33; db.settings.familyScore = 33;
  return db;
}

describe("task transactions", () => {
  it("accumulates the full carried target over consecutive days", () => {
    const db = cleanDatabase(); const first = addDays(singaporeDate(), -2); const second = addDays(first, 1); const third = addDays(second, 1);
    const pushup = db.taskDefinitions.find((task) => task.taskKey === "push_up")!;
    carryTask(db, pushup.id, first);
    expect(taskDayView(db, second).tasks.find((task) => task.definition.id === pushup.id)?.record.totalTarget).toBe(40);
    carryTask(db, pushup.id, second);
    expect(taskDayView(db, third).tasks.find((task) => task.definition.id === pushup.id)?.record.totalTarget).toBe(60);
  });

  it("prevents duplicate carryovers", () => {
    const db = cleanDatabase(); const date = addDays(singaporeDate(), -1); const task = db.taskDefinitions[0];
    carryTask(db, task.id, date);
    expect(() => carryTask(db, task.id, date)).toThrow("already been carried");
  });

  it("reverts a carryover and restores tomorrow's target", () => {
    const db = cleanDatabase(); const date = addDays(singaporeDate(), -1); const task = db.taskDefinitions[0];
    carryTask(db, task.id, date); revertCarry(db, task.id, date);
    expect(taskDayView(db, addDays(date, 1)).tasks[0].record.carriedTarget).toBe(0);
  });

  it("calculates completion by task count", () => {
    const db = cleanDatabase(); const date = singaporeDate(); completeTask(db, db.taskDefinitions[0].id, date);
    expect(taskDayView(db, date).summary.completionRate).toBe(25);
  });

  it("rewards all directions once when all tasks complete", () => {
    const db = cleanDatabase(); const date = singaporeDate();
    db.taskDefinitions.forEach((task) => completeTask(db, task.id, date));
    completeTask(db, db.taskDefinitions.at(-1)!.id, date);
    expect([db.settings.exploreWorldScore, db.settings.relationshipScore, db.settings.familyScore]).toEqual([34, 34, 34]);
    expect(lifecycleView(db).energized).toBe(100);
    expect(db.lifecycleEffects.filter((effect) => !effect.isReverted)).toHaveLength(1);
  });

  it("withdraws and can re-award the daily exercise effect", () => {
    const db = cleanDatabase(); const date = singaporeDate(); db.taskDefinitions.forEach((task) => completeTask(db, task.id, date));
    uncompleteTask(db, db.taskDefinitions[0].id, date);
    expect(db.settings.exploreWorldScore).toBe(33);
    expect(lifecycleView(db).energized).toBe(99);
    completeTask(db, db.taskDefinitions[0].id, date);
    expect(db.settings.exploreWorldScore).toBe(34);
  });
});

describe("food and smoking effects", () => {
  const baseFood = { entryDate: singaporeDate(), entryTime: "12:00", mealName: "Cake", mealType: "snack" as const, confirmedCalories: 420, aiEstimatedCalories: 410, minimumCalories: 350, maximumCalories: 500, foodItems: [], isDessert: true, confidence: "medium" as const, assumptions: [] };

  it("deducts a dessert only once", () => {
    const db = cleanDatabase(); const entry = createFood(db, baseFood);
    updateFood(db, { id: entry.id, mealName: "Chocolate cake" });
    expect(db.settings.exploreWorldScore).toBe(32);
    expect(db.lifecycleEffects.filter((effect) => !effect.isReverted)).toHaveLength(1);
  });

  it("reverses dessert impact when changed to non-dessert", () => {
    const db = cleanDatabase(); const entry = createFood(db, baseFood); updateFood(db, { id: entry.id, isDessert: false });
    expect(db.settings.exploreWorldScore).toBe(33);
  });

  it("reverses dessert impact when deleted", () => {
    const db = cleanDatabase(); const entry = createFood(db, baseFood); deleteFood(db, entry.id);
    expect(db.settings.exploreWorldScore).toBe(33);
  });

  it("makes smoking creation idempotent", () => {
    const db = cleanDatabase(); const input = { requestId: crypto.randomUUID(), entryDate: singaporeDate(), entryTime: "18:00" };
    createSmoking(db, input); createSmoking(db, input);
    expect(db.settings.exploreWorldScore).toBe(32);
    expect(db.smokingEntries).toHaveLength(1);
  });

  it("reverses smoking impact on deletion", () => {
    const db = cleanDatabase(); const result = createSmoking(db, { requestId: crypto.randomUUID(), entryDate: singaporeDate(), entryTime: "18:00" }); deleteSmoking(db, result.entry.id);
    expect(db.settings.exploreWorldScore).toBe(33);
  });

  it("keeps unrecorded dates distinct from zero kcal", () => {
    const db = cleanDatabase(); const stats = calorieStats(db, singaporeDate());
    expect(stats.week.series.every((day) => day.calories === null)).toBe(true);
  });

  it("uses updated rules only for new effects and preserves old deltas", () => {
    const db = cleanDatabase();
    const first = createFood(db, { ...baseFood, mealName: "First cake" });
    updateLifecycleRules(db, { exerciseWorldDelta: 1, exerciseRelationshipDelta: 1, exerciseFamilyDelta: 1, dessertWorldDelta: -.5, dessertRelationshipDelta: -.5, dessertFamilyDelta: -.5, smokingWorldDelta: -1, smokingRelationshipDelta: -1, smokingFamilyDelta: -1 });
    const second = createFood(db, { ...baseFood, mealName: "Second cake" });
    expect(db.lifecycleEffects.find((effect) => effect.sourceId === first.id)?.worldDelta).toBe(-1);
    expect(db.lifecycleEffects.find((effect) => effect.sourceId === second.id)?.worldDelta).toBe(-.5);
  });
});

describe("task definition history", () => {
  it("applies a new target to new dates without changing historical records", () => {
    const db = cleanDatabase();
    const task = db.taskDefinitions.find((definition) => definition.taskKey === "plank")!;
    task.baseTarget = 3;
    const historicalDate = addDays(singaporeDate(), -1);
    completeTask(db, task.id, historicalDate);
    updateTaskDefinition(db, { ...task, baseTarget: 30 });
    const historical = taskDayView(db, historicalDate).tasks.find((item) => item.definition.id === task.id)!.record;
    const next = taskDayView(db, singaporeDate()).tasks.find((item) => item.definition.id === task.id)!.record;
    expect(historical.baseTarget).toBe(3);
    expect(next.baseTarget).toBe(30);
  });
});
