import type {
  ActivityEntry, DailyTaskRecord, FoodEntry, LifecycleAdjustment, LifecycleCategory, LifecycleEffect, LocalDatabase,
  SmokingEntry, SystemSettings, TaskCarryover, TaskDefinition,
} from "@/lib/types";
import { ApiError } from "@/lib/api";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { readDatabase as readLocalDatabase, resetLocalDatabase, withDatabaseTransaction } from "@/lib/local-db";
import {
  adjustLifecycle, completeTask, createActivity, createFood, createSmoking, deleteActivity, deleteFood, deleteSmoking, resetLifecycleScores,
  revertCarry, taskDayView, uncompleteTask, updateCalorieSettings, updateDisplaySettings, updateFood,
  updateActivity, updateGeneralSettings, updateLifecycleRules, updateLifecycleScores, updateTaskDefinition, updateTaskDefinitions,
  updateTimelineSettings, carryTask,
} from "@/lib/service";

type Row = Record<string, unknown>;
type FoodCreate = Omit<FoodEntry, "id" | "createdAt" | "updatedAt">;
type FoodUpdate = Partial<FoodCreate> & { id: string };
type ActivityCreate = Omit<ActivityEntry, "id" | "createdAt" | "updatedAt">;
type ActivityUpdate = Pick<ActivityEntry, "id" | "activityDate" | "activityTime" | "activityName" | "durationMinutes" | "confirmedCaloriesBurned">;
type TaskUpdate = Pick<TaskDefinition, "id" | "name" | "unit" | "baseTarget" | "displayOrder" | "isActive">;
type LifecycleScores = Pick<SystemSettings, "exploreWorldScore" | "relationshipScore" | "familyScore"> & { reason: string };
type LifecycleRules = Pick<SystemSettings,
  "exerciseWorldDelta" | "exerciseRelationshipDelta" | "exerciseFamilyDelta" |
  "dessertWorldDelta" | "dessertRelationshipDelta" | "dessertFamilyDelta" |
  "smokingWorldDelta" | "smokingRelationshipDelta" | "smokingFamilyDelta">;

export function usesSupabase() { return process.env.DATA_BACKEND === "supabase"; }
const number = (value: unknown) => Number(value ?? 0);
const nullableNumber = (value: unknown) => value == null ? null : Number(value);
const time = (value: unknown) => String(value ?? "00:00").slice(0, 5);

function mapTask(row: Row): TaskDefinition {
  return { id: String(row.id), taskKey: String(row.task_key), name: String(row.name), unit: String(row.unit), baseTarget: number(row.base_target), displayOrder: number(row.display_order), isActive: Boolean(row.is_active), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}
function mapTaskRecord(row: Row): DailyTaskRecord {
  return { id: String(row.id), taskDefinitionId: String(row.task_definition_id), recordDate: String(row.record_date), baseTarget: number(row.base_target), carriedTarget: number(row.carried_target), totalTarget: number(row.total_target), status: row.status as DailyTaskRecord["status"], completedAt: row.completed_at ? String(row.completed_at) : null, carriedToDate: row.carried_to_date ? String(row.carried_to_date) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}
function mapCarryover(row: Row): TaskCarryover {
  return { id: String(row.id), taskDefinitionId: String(row.task_definition_id), sourceRecordId: String(row.source_record_id), sourceDate: String(row.source_date), targetDate: String(row.target_date), amount: number(row.amount), isReverted: Boolean(row.is_reverted), createdAt: String(row.created_at), revertedAt: row.reverted_at ? String(row.reverted_at) : null };
}
function mapFood(row: Row): FoodEntry {
  return { id: String(row.id), entryDate: String(row.entry_date), entryTime: time(row.entry_time), mealName: String(row.meal_name), mealType: row.meal_type as FoodEntry["mealType"], confirmedCalories: number(row.confirmed_calories), aiEstimatedCalories: nullableNumber(row.ai_estimated_calories), minimumCalories: nullableNumber(row.minimum_calories), maximumCalories: nullableNumber(row.maximum_calories), foodItems: (row.food_items ?? []) as FoodEntry["foodItems"], isDessert: Boolean(row.is_dessert), confidence: (row.confidence ?? null) as FoodEntry["confidence"], assumptions: (row.assumptions ?? []) as string[], createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}
function mapActivity(row: Row): ActivityEntry {
  return {
    id: String(row.id), activityDate: String(row.activity_date), activityTime: time(row.activity_time), activityName: String(row.activity_name),
    durationMinutes: number(row.duration_minutes), intensity: row.intensity as ActivityEntry["intensity"],
    confirmedCaloriesBurned: number(row.confirmed_calories_burned), aiEstimatedCaloriesBurned: nullableNumber(row.ai_estimated_calories_burned),
    minimumCaloriesBurned: nullableNumber(row.minimum_calories_burned), maximumCaloriesBurned: nullableNumber(row.maximum_calories_burned),
    confidence: (row.confidence ?? null) as ActivityEntry["confidence"], assumptions: (row.assumptions ?? []) as string[], source: row.source as ActivityEntry["source"],
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}
function mapSmoking(row: Row): SmokingEntry {
  return { id: String(row.id), entryDate: String(row.entry_date), entryTime: time(row.entry_time), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}
function mapEffect(row: Row): LifecycleEffect {
  return { id: String(row.id), sourceType: row.source_type as LifecycleEffect["sourceType"], sourceId: String(row.source_id), worldDelta: number(row.world_delta), relationshipDelta: number(row.relationship_delta), familyDelta: number(row.family_delta), effectDate: String(row.effect_date), reason: String(row.reason), isReverted: Boolean(row.is_reverted), createdAt: String(row.created_at), revertedAt: row.reverted_at ? String(row.reverted_at) : null };
}
function mapAdjustment(row: Row): LifecycleAdjustment {
  return { id: String(row.id), category: row.category as LifecycleCategory, delta: number(row.delta), reason: String(row.reason), createdAt: String(row.created_at) };
}

function resultRow(value: unknown): Row {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") throw new ApiError(500, "Supabase returned an invalid record.", "DATABASE_RESPONSE");
  return row as Row;
}

async function rpc(name: string, params: Record<string, unknown> = {}) {
  const { data, error } = await createServiceRoleClient().rpc(name, params);
  if (error) throw new ApiError(409, error.message, error.code || "DATABASE_ERROR");
  return data;
}

async function readSupabaseDatabase(): Promise<LocalDatabase> {
  const client = createServiceRoleClient();
  const results = await Promise.all([
    client.from("system_settings").select("*").eq("singleton", true).single(),
    client.from("app_settings").select("*").eq("singleton", true).single(),
    client.from("task_definitions").select("*").order("display_order"),
    client.from("daily_task_records").select("*"),
    client.from("task_carryovers").select("*"),
    client.from("food_entries").select("*"),
    client.from("activity_entries").select("*"),
    client.from("smoking_entries").select("*"),
    client.from("lifecycle_effects").select("*"),
    client.from("lifecycle_adjustments").select("*"),
  ]);
  const failure = results.find((result) => result.error)?.error;
  if (failure) throw new ApiError(500, failure.message, failure.code || "DATABASE_READ_ERROR");
  const system = results[0].data as Row; const app = results[1].data as Row;
  const createdAt = String(system.created_at); const updatedAt = [String(system.updated_at), String(app.updated_at)].sort().at(-1)!;
  const settings: SystemSettings = {
    id: "singleton", websiteName: String(app.website_name), language: app.language as SystemSettings["language"],
    birthDate: String(system.birth_date), targetAge: number(app.target_age), targetDate: String(system.target_date), timezone: String(app.timezone),
    exploreWorldScore: number(system.explore_world_score), relationshipScore: number(system.relationship_score), familyScore: number(system.family_score),
    exerciseWorldDelta: number(app.exercise_world_delta), exerciseRelationshipDelta: number(app.exercise_relationship_delta), exerciseFamilyDelta: number(app.exercise_family_delta),
    dessertWorldDelta: number(app.dessert_world_delta), dessertRelationshipDelta: number(app.dessert_relationship_delta), dessertFamilyDelta: number(app.dessert_family_delta),
    smokingWorldDelta: number(app.smoking_world_delta), smokingRelationshipDelta: number(app.smoking_relationship_delta), smokingFamilyDelta: number(app.smoking_family_delta),
    defaultMealType: app.default_meal_type as SystemSettings["defaultMealType"], aiFoodAnalysisEnabled: Boolean(app.ai_food_analysis_enabled),
    activityAiEnabled: Boolean(app.activity_ai_enabled), bodyWeightKg: nullableNumber(app.body_weight_kg), defaultCaloriesView: app.default_calories_view as SystemSettings["defaultCaloriesView"], requireAiConfirmation: Boolean(app.require_ai_confirmation),
    defaultLandingPage: app.default_landing_page as SystemSettings["defaultLandingPage"], desktopSidebarMode: app.desktop_sidebar_mode as SystemSettings["desktopSidebarMode"], mobileDateRange: number(app.mobile_date_range) as 5 | 7,
    createdAt, updatedAt,
  };
  return {
    schemaVersion: 3, settings,
    taskDefinitions: ((results[2].data ?? []) as Row[]).map(mapTask),
    dailyTaskRecords: ((results[3].data ?? []) as Row[]).map(mapTaskRecord),
    taskCarryovers: ((results[4].data ?? []) as Row[]).map(mapCarryover),
    foodEntries: ((results[5].data ?? []) as Row[]).map(mapFood),
    activityEntries: ((results[6].data ?? []) as Row[]).map(mapActivity),
    smokingEntries: ((results[7].data ?? []) as Row[]).map(mapSmoking),
    lifecycleEffects: ((results[8].data ?? []) as Row[]).map(mapEffect),
    lifecycleAdjustments: ((results[9].data ?? []) as Row[]).map(mapAdjustment),
  };
}

export async function readDatabase() { return usesSupabase() ? readSupabaseDatabase() : readLocalDatabase(); }

async function taskResult(name: string, taskDefinitionId: string, date: string) {
  await rpc(name, { p_task_definition_id: taskDefinitionId, p_record_date: date });
  return taskDayView(await readSupabaseDatabase(), date);
}
export async function completeTaskStored(taskDefinitionId: string, date: string) { return usesSupabase() ? taskResult("complete_daily_task", taskDefinitionId, date) : withDatabaseTransaction((db) => completeTask(db, taskDefinitionId, date)); }
export async function uncompleteTaskStored(taskDefinitionId: string, date: string) { return usesSupabase() ? taskResult("uncomplete_daily_task", taskDefinitionId, date) : withDatabaseTransaction((db) => uncompleteTask(db, taskDefinitionId, date)); }
export async function carryTaskStored(taskDefinitionId: string, date: string) { return usesSupabase() ? taskResult("carry_daily_task", taskDefinitionId, date) : withDatabaseTransaction((db) => carryTask(db, taskDefinitionId, date)); }
export async function revertCarryStored(taskDefinitionId: string, date: string) { return usesSupabase() ? taskResult("revert_daily_task_carry", taskDefinitionId, date) : withDatabaseTransaction((db) => revertCarry(db, taskDefinitionId, date)); }

function foodParams(input: FoodCreate) {
  return { p_entry_date: input.entryDate, p_entry_time: input.entryTime, p_meal_name: input.mealName, p_meal_type: input.mealType, p_confirmed_calories: input.confirmedCalories, p_ai_estimated_calories: input.aiEstimatedCalories, p_minimum_calories: input.minimumCalories, p_maximum_calories: input.maximumCalories, p_food_items: input.foodItems, p_is_dessert: input.isDessert, p_confidence: input.confidence, p_assumptions: input.assumptions };
}
export async function createFoodStored(input: FoodCreate) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => createFood(db, input));
  return mapFood(resultRow(await rpc("create_food_entry", foodParams(input))));
}
export async function updateFoodStored(input: FoodUpdate) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => updateFood(db, input));
  const existing = (await readSupabaseDatabase()).foodEntries.find((entry) => entry.id === input.id);
  if (!existing) throw new ApiError(404, "Food entry not found.", "FOOD_NOT_FOUND");
  const merged: FoodCreate = { ...existing, ...input };
  return mapFood(resultRow(await rpc("update_food_entry", { p_id: input.id, ...foodParams(merged) })));
}
export async function deleteFoodStored(id: string) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => deleteFood(db, id));
  return mapFood(resultRow(await rpc("delete_food_entry", { p_id: id })));
}

function activityParams(input: ActivityCreate) {
  return {
    p_activity_date: input.activityDate, p_activity_time: input.activityTime, p_activity_name: input.activityName,
    p_duration_minutes: input.durationMinutes, p_intensity: input.intensity, p_confirmed_calories_burned: input.confirmedCaloriesBurned,
    p_ai_estimated_calories_burned: input.aiEstimatedCaloriesBurned, p_minimum_calories_burned: input.minimumCaloriesBurned,
    p_maximum_calories_burned: input.maximumCaloriesBurned, p_confidence: input.confidence, p_assumptions: input.assumptions, p_source: input.source,
  };
}
export async function createActivityStored(input: ActivityCreate) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => createActivity(db, input));
  return mapActivity(resultRow(await rpc("create_activity_entry", activityParams(input))));
}
export async function updateActivityStored(input: ActivityUpdate) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => updateActivity(db, input));
  return mapActivity(resultRow(await rpc("update_activity_entry", {
    p_id: input.id, p_activity_date: input.activityDate, p_activity_time: input.activityTime, p_activity_name: input.activityName,
    p_duration_minutes: input.durationMinutes, p_confirmed_calories_burned: input.confirmedCaloriesBurned,
  })));
}
export async function deleteActivityStored(id: string) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => deleteActivity(db, id));
  return mapActivity(resultRow(await rpc("delete_activity_entry", { p_id: id })));
}

export async function createSmokingStored(input: Pick<SmokingEntry, "entryDate" | "entryTime"> & { requestId: string }) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => createSmoking(db, input));
  const existed = (await readSupabaseDatabase()).smokingEntries.some((entry) => entry.id === input.requestId);
  const entry = mapSmoking(resultRow(await rpc("create_smoking_entry", { p_id: input.requestId, p_entry_date: input.entryDate, p_entry_time: input.entryTime })));
  return { entry, created: !existed };
}
export async function deleteSmokingStored(id: string) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => deleteSmoking(db, id));
  return mapSmoking(resultRow(await rpc("delete_smoking_entry", { p_id: id })));
}

export async function adjustLifecycleStored(category: LifecycleCategory, delta: number, reason: string) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => adjustLifecycle(db, category, delta, reason));
  await rpc("adjust_lifecycle_score", { p_category: category, p_delta: delta, p_reason: reason });
  return (await readSupabaseDatabase()).settings;
}

export async function updateGeneralStored(input: Pick<SystemSettings, "websiteName" | "language" | "timezone">) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => updateGeneralSettings(db, input));
  await rpc("update_general_settings", { p_website_name: input.websiteName, p_language: input.language, p_timezone: input.timezone });
  return (await readSupabaseDatabase()).settings;
}
export async function updateTimelineStored(input: Pick<SystemSettings, "birthDate" | "targetAge">) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => updateTimelineSettings(db, input));
  await rpc("update_timeline_settings", { p_birth_date: input.birthDate, p_target_age: input.targetAge });
  return (await readSupabaseDatabase()).settings;
}
export async function updateLifecycleScoresStored(input: LifecycleScores) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => updateLifecycleScores(db, input));
  await rpc("update_lifecycle_scores", { p_explore_world_score: input.exploreWorldScore, p_relationship_score: input.relationshipScore, p_family_score: input.familyScore, p_reason: input.reason });
  return (await readSupabaseDatabase()).settings;
}
export async function updateLifecycleRulesStored(input: LifecycleRules) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => updateLifecycleRules(db, input));
  await rpc("update_lifecycle_rules", { p_settings: input });
  return (await readSupabaseDatabase()).settings;
}
export async function updateCaloriesStored(input: Pick<SystemSettings, "defaultMealType" | "aiFoodAnalysisEnabled" | "activityAiEnabled" | "bodyWeightKg" | "defaultCaloriesView" | "requireAiConfirmation">) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => updateCalorieSettings(db, input));
  await rpc("update_calorie_settings", { p_default_meal_type: input.defaultMealType, p_ai_enabled: input.aiFoodAnalysisEnabled, p_activity_ai_enabled: input.activityAiEnabled, p_body_weight_kg: input.bodyWeightKg, p_default_calories_view: input.defaultCaloriesView, p_require_confirmation: input.requireAiConfirmation });
  return (await readSupabaseDatabase()).settings;
}
export async function updateDisplayStored(input: Pick<SystemSettings, "defaultLandingPage" | "desktopSidebarMode" | "mobileDateRange">) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => updateDisplaySettings(db, input));
  await rpc("update_display_settings", { p_landing_page: input.defaultLandingPage, p_sidebar_mode: input.desktopSidebarMode, p_mobile_date_range: input.mobileDateRange });
  return (await readSupabaseDatabase()).settings;
}
export async function updateTaskStored(input: TaskUpdate) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => updateTaskDefinition(db, input));
  const result = await updateTasksStored([input]); return result[0];
}
export async function updateTasksStored(inputs: TaskUpdate[]) {
  if (!usesSupabase()) return withDatabaseTransaction((db) => updateTaskDefinitions(db, inputs));
  await rpc("update_task_definitions", { p_tasks: inputs });
  return (await readSupabaseDatabase()).taskDefinitions;
}
export async function resetLifecycleStored() {
  if (!usesSupabase()) return withDatabaseTransaction((db) => resetLifecycleScores(db));
  await rpc("reset_lifecycle_scores"); return (await readSupabaseDatabase()).settings;
}
export async function resetEverythingStored() {
  if (!usesSupabase()) return resetLocalDatabase();
  await rpc("reset_entire_system"); return readSupabaseDatabase();
}
