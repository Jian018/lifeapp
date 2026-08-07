import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FoodEntry, LocalDatabase, TaskDefinition } from "@/lib/types";
import { addDays, singaporeDate } from "@/lib/date";
import { clamp } from "@/lib/utils";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "local-db.json");
let transactionQueue: Promise<unknown> = Promise.resolve();

const nowIso = () => new Date().toISOString();
const SCHEMA_VERSION = 3;

function task(id: string, taskKey: string, name: string, unit: string, baseTarget: number, displayOrder: number): TaskDefinition {
  const now = nowIso();
  return { id, taskKey, name, unit, baseTarget, displayOrder, isActive: true, createdAt: now, updatedAt: now };
}

function sampleFood(id: string, date: string, time: string, name: string, type: FoodEntry["mealType"], calories: number): FoodEntry {
  const now = nowIso();
  return { id, entryDate: date, entryTime: time, mealName: name, mealType: type, confirmedCalories: calories, aiEstimatedCalories: calories, minimumCalories: Math.round(calories * .85), maximumCalories: Math.round(calories * 1.18), foodItems: [{ name, estimated_portion: "1 serving", estimated_calories: calories }], isDessert: false, confidence: "medium", assumptions: ["Portion size is estimated from a standard serving."], createdAt: now, updatedAt: now };
}

export function createDefaultDatabase(today = singaporeDate()): LocalDatabase {
  const now = nowIso();
  const taskDefinitions = [
    task("task_running", "running", "Running", "minutes", 15, 1),
    task("task_pushup", "push_up", "Push-up", "reps", 20, 2),
    task("task_situp", "sit_up", "Sit-up", "reps", 20, 3),
    task("task_plank", "plank", "Plank", "seconds", 30, 4),
  ];
  const yesterday = addDays(today, -1);
  const dailyTaskRecords = taskDefinitions.map((definition, index) => ({
    id: `seed_${definition.id}_${yesterday}`,
    taskDefinitionId: definition.id,
    recordDate: yesterday,
    baseTarget: definition.baseTarget,
    carriedTarget: 0,
    totalTarget: definition.baseTarget,
    status: (index < 3 ? "completed" : "carried") as "completed" | "carried",
    completedAt: index < 3 ? now : null,
    carriedToDate: index === 3 ? today : null,
    createdAt: now,
    updatedAt: now,
  }));
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      id: "singleton",
      websiteName: "My Life System",
      language: "en",
      birthDate: "2003-01-08",
      targetAge: 60,
      targetDate: "2063-01-08",
      timezone: "Asia/Singapore",
      exploreWorldScore: 33,
      relationshipScore: 33,
      familyScore: 33,
      exerciseWorldDelta: 1,
      exerciseRelationshipDelta: 1,
      exerciseFamilyDelta: 1,
      dessertWorldDelta: -1,
      dessertRelationshipDelta: -1,
      dessertFamilyDelta: -1,
      smokingWorldDelta: -1,
      smokingRelationshipDelta: -1,
      smokingFamilyDelta: -1,
      defaultMealType: "auto",
      aiFoodAnalysisEnabled: true,
      activityAiEnabled: true,
      bodyWeightKg: null,
      defaultCaloriesView: "today",
      requireAiConfirmation: true,
      defaultLandingPage: "/",
      desktopSidebarMode: "expanded",
      mobileDateRange: 7,
      createdAt: now,
      updatedAt: now,
    },
    taskDefinitions,
    dailyTaskRecords,
    taskCarryovers: [{ id: `carry_seed_${today}`, taskDefinitionId: "task_plank", sourceRecordId: `seed_task_plank_${yesterday}`, sourceDate: yesterday, targetDate: today, amount: 30, isReverted: false, createdAt: now, revertedAt: null }],
    foodEntries: [
      sampleFood("food_seed_1", addDays(today, -1), "08:10", "Greek yogurt & berries", "breakfast", 340),
      sampleFood("food_seed_2", addDays(today, -1), "13:05", "Chicken rice bowl", "lunch", 680),
      sampleFood("food_seed_3", addDays(today, -2), "19:20", "Salmon, rice & greens", "dinner", 610),
      sampleFood("food_seed_4", addDays(today, -3), "12:40", "Beef noodle soup", "lunch", 720),
      sampleFood("food_seed_5", addDays(today, -4), "08:00", "Eggs on sourdough", "breakfast", 430),
      sampleFood("food_seed_6", addDays(today, -5), "19:10", "Tofu grain bowl", "dinner", 560),
    ],
    activityEntries: [],
    smokingEntries: [],
    lifecycleEffects: [],
    lifecycleAdjustments: [],
  };
}

function upgradeDatabase(input: LocalDatabase & { schemaVersion?: number; settings: LocalDatabase["settings"] & { worldScore?: number } }) {
  if (input.schemaVersion === SCHEMA_VERSION) return { db: input, changed: false };
  const defaults = createDefaultDatabase();
  const legacySettings = { ...input.settings } as Record<string, unknown>;
  delete legacySettings.worldScore;
  const activeEffects = (input.lifecycleEffects ?? []).filter((effect) => !effect.isReverted);
  const scoreFromHistory = (field: "worldDelta" | "relationshipDelta" | "familyDelta") => clamp(33 + activeEffects.reduce((sum, effect) => sum + effect[field], 0));
  const sourceVersion = input.schemaVersion ?? 1;
  const db: LocalDatabase = {
    ...defaults,
    ...input,
    schemaVersion: SCHEMA_VERSION,
    settings: {
      ...defaults.settings,
      ...legacySettings,
      exploreWorldScore: sourceVersion < 2 ? scoreFromHistory("worldDelta") : input.settings.exploreWorldScore,
      relationshipScore: sourceVersion < 2 ? scoreFromHistory("relationshipDelta") : input.settings.relationshipScore,
      familyScore: sourceVersion < 2 ? scoreFromHistory("familyDelta") : input.settings.familyScore,
      targetAge: sourceVersion < 2 ? 60 : input.settings.targetAge,
      targetDate: sourceVersion < 2 ? "2063-01-08" : input.settings.targetDate,
      updatedAt: nowIso(),
    } as LocalDatabase["settings"],
    taskDefinitions: (input.taskDefinitions ?? defaults.taskDefinitions).map((definition) => definition.taskKey === "plank" ? { ...definition, baseTarget: 30, updatedAt: nowIso() } : definition),
    activityEntries: input.activityEntries ?? [],
    lifecycleAdjustments: (input.lifecycleAdjustments ?? []).map((adjustment) => ({ ...adjustment, category: adjustment.category === ("world" as typeof adjustment.category) ? "explore_world" : adjustment.category })),
  };
  return { db, changed: true };
}

async function persist(db: LocalDatabase) {
  await mkdir(DATA_DIR, { recursive: true });
  const temp = `${DATA_FILE}.${crypto.randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(db, null, 2), "utf8");
  await rename(temp, DATA_FILE);
}

async function load(): Promise<LocalDatabase> {
  try {
    const parsed = JSON.parse(await readFile(DATA_FILE, "utf8")) as LocalDatabase & { schemaVersion?: number; settings: LocalDatabase["settings"] & { worldScore?: number } };
    const upgraded = upgradeDatabase(parsed);
    if (upgraded.changed) await persist(upgraded.db);
    return upgraded.db;
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const db = createDefaultDatabase();
    await persist(db);
    return db;
  }
}

export async function readDatabase() {
  const db = await load();
  return structuredClone(db);
}

export function withDatabaseTransaction<T>(operation: (db: LocalDatabase) => T | Promise<T>): Promise<T> {
  const next = transactionQueue.then(async () => {
    const db = await load();
    const result = await operation(db);
    await persist(db);
    return result;
  });
  transactionQueue = next.catch(() => undefined);
  return next;
}

export async function resetLocalDatabase() {
  return withDatabaseTransaction((db) => {
    const fresh = createDefaultDatabase();
    Object.assign(db, fresh);
    return structuredClone(db);
  });
}
