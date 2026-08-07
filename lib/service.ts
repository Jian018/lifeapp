import type { ActivityEntry, DailyTaskRecord, FoodEntry, LifecycleCategory, LifecycleEffect, LocalDatabase, SmokingEntry, SystemSettings, TaskDefinition } from "@/lib/types";
import { addDays, dateInTimezone, daysPerEnergizedPercent, differenceInCalendarDays, effectiveDaysRemaining, lifecycleTimeline, monthBounds, startOfWeekMonday, targetDateFromAge } from "@/lib/date";
import { applyScoreDelta, energizedScore, heartStage } from "@/lib/lifecycle";
import { clamp } from "@/lib/utils";
import { ApiError } from "@/lib/api";

const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const nowIso = () => new Date().toISOString();
const todayFor = (db: LocalDatabase) => dateInTimezone(new Date(), db.settings.timezone);

function carriedAmount(db: LocalDatabase, taskDefinitionId: string, date: string) {
  return db.taskCarryovers.filter((carry) => carry.taskDefinitionId === taskDefinitionId && carry.targetDate === date && !carry.isReverted).reduce((sum, carry) => sum + carry.amount, 0);
}

function viewRecord(db: LocalDatabase, definition: TaskDefinition, date: string): DailyTaskRecord {
  const stored = db.dailyTaskRecords.find((record) => record.taskDefinitionId === definition.id && record.recordDate === date);
  const carriedTarget = carriedAmount(db, definition.id, date);
  if (stored) return { ...stored, carriedTarget, totalTarget: stored.baseTarget + carriedTarget };
  const totalTarget = definition.baseTarget + carriedTarget;
  const now = nowIso();
  return { id: `planned_${definition.id}_${date}`, taskDefinitionId: definition.id, recordDate: date, baseTarget: definition.baseTarget, carriedTarget, totalTarget, status: "pending", completedAt: null, carriedToDate: null, createdAt: now, updatedAt: now };
}

function ensureRecord(db: LocalDatabase, taskDefinitionId: string, date: string) {
  const definition = db.taskDefinitions.find((item) => item.id === taskDefinitionId && item.isActive);
  if (!definition) throw new ApiError(404, "Task not found.", "TASK_NOT_FOUND");
  let record = db.dailyTaskRecords.find((item) => item.taskDefinitionId === taskDefinitionId && item.recordDate === date);
  const calculated = viewRecord(db, definition, date);
  if (!record) {
    record = { ...calculated, id: id("task_record") };
    db.dailyTaskRecords.push(record);
  } else {
    Object.assign(record, { carriedTarget: calculated.carriedTarget, totalTarget: record.baseTarget + calculated.carriedTarget, updatedAt: nowIso() });
  }
  return record;
}

function createEffect(db: LocalDatabase, input: Omit<LifecycleEffect, "id" | "createdAt" | "revertedAt" | "isReverted" | "worldDelta" | "relationshipDelta" | "familyDelta"> & { worldDelta: number; relationshipDelta: number; familyDelta: number }) {
  const existing = db.lifecycleEffects.find((effect) => effect.sourceType === input.sourceType && effect.sourceId === input.sourceId && !effect.isReverted);
  if (existing) return existing;
  const worldDelta = clamp(db.settings.exploreWorldScore + input.worldDelta) - db.settings.exploreWorldScore;
  const relationshipDelta = clamp(db.settings.relationshipScore + input.relationshipDelta) - db.settings.relationshipScore;
  const familyDelta = clamp(db.settings.familyScore + input.familyDelta) - db.settings.familyScore;
  const effect: LifecycleEffect = { ...input, id: id("effect"), worldDelta, relationshipDelta, familyDelta, isReverted: false, createdAt: nowIso(), revertedAt: null };
  db.lifecycleEffects.push(effect);
  applyScoreDelta(db.settings, worldDelta, relationshipDelta, familyDelta);
  return effect;
}

function revertEffect(db: LocalDatabase, sourceType: LifecycleEffect["sourceType"], sourceId: string) {
  const effect = db.lifecycleEffects.find((item) => item.sourceType === sourceType && item.sourceId === sourceId && !item.isReverted);
  if (!effect) return null;
  applyScoreDelta(db.settings, -effect.worldDelta, -effect.relationshipDelta, -effect.familyDelta);
  effect.isReverted = true;
  effect.revertedAt = nowIso();
  return effect;
}

function syncExerciseReward(db: LocalDatabase, date: string) {
  const active = db.taskDefinitions.filter((item) => item.isActive);
  const allCompleted = active.length > 0 && active.every((definition) => viewRecord(db, definition, date).status === "completed");
  const existingActive = db.lifecycleEffects.find((effect) => effect.sourceType === "daily_exercise" && effect.sourceId === date && !effect.isReverted);
  if (allCompleted && !existingActive) createEffect(db, { sourceType: "daily_exercise", sourceId: date, worldDelta: db.settings.exerciseWorldDelta, relationshipDelta: db.settings.exerciseRelationshipDelta, familyDelta: db.settings.exerciseFamilyDelta, effectDate: date, reason: "Completed every active movement task" });
  if (!allCompleted && existingActive) revertEffect(db, "daily_exercise", date);
}

export function taskDayView(db: LocalDatabase, date: string) {
  const tasks = db.taskDefinitions.filter((item) => item.isActive).sort((a, b) => a.displayOrder - b.displayOrder).map((definition) => ({ definition, record: viewRecord(db, definition, date) }));
  const completed = tasks.filter(({ record }) => record.status === "completed").length;
  const carried = tasks.filter(({ record }) => record.status === "carried").length;
  const total = tasks.length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  const today = todayFor(db);
  const activities = db.activityEntries.filter((entry) => entry.activityDate === date).sort((a, b) => a.activityTime.localeCompare(b.activityTime));
  const activityBurn = activities.reduce((sum, entry) => sum + entry.confirmedCaloriesBurned, 0);
  return { date, tasks, activities, activityBurn, summary: { total, completed, pending: total - completed, carried, completionRate, incompleteRate: 100 - completionRate }, isFuture: date > today, today };
}

export function taskCalendar(db: LocalDatabase, center: string, range = db.settings.mobileDateRange) {
  const radius = Math.floor(range / 2);
  return Array.from({ length: radius * 2 + 1 }, (_, index) => addDays(center, index - radius)).map((date) => {
    const records = db.dailyTaskRecords.filter((record) => record.recordDate === date);
    if (!records.length || date > todayFor(db)) return { date, state: "empty" as const };
    const view = taskDayView(db, date);
    if (view.summary.completed === view.summary.total) return { date, state: "complete" as const };
    if (view.summary.carried > 0 || view.summary.completed === 0) return { date, state: "warning" as const };
    return { date, state: "partial" as const };
  });
}

export function completeTask(db: LocalDatabase, taskDefinitionId: string, date: string) {
  if (date > todayFor(db)) throw new ApiError(409, "Future tasks cannot be completed early.", "FUTURE_TASK");
  const record = ensureRecord(db, taskDefinitionId, date);
  if (record.status === "carried") throw new ApiError(409, "A carried task must be reverted before completion.", "TASK_CARRIED");
  if (record.status !== "completed") { record.status = "completed"; record.completedAt = nowIso(); record.updatedAt = nowIso(); }
  syncExerciseReward(db, date);
  return taskDayView(db, date);
}

export function uncompleteTask(db: LocalDatabase, taskDefinitionId: string, date: string) {
  const record = ensureRecord(db, taskDefinitionId, date);
  if (record.status !== "completed") throw new ApiError(409, "This task is not completed.", "NOT_COMPLETED");
  record.status = "pending"; record.completedAt = null; record.updatedAt = nowIso();
  syncExerciseReward(db, date);
  return taskDayView(db, date);
}

export function carryTask(db: LocalDatabase, taskDefinitionId: string, date: string) {
  if (date > todayFor(db)) throw new ApiError(409, "Future tasks cannot be carried.", "FUTURE_TASK");
  const record = ensureRecord(db, taskDefinitionId, date);
  if (record.status === "completed") throw new ApiError(409, "Completed tasks cannot be carried.", "TASK_COMPLETED");
  const existing = db.taskCarryovers.find((carry) => carry.sourceRecordId === record.id && !carry.isReverted);
  if (existing) throw new ApiError(409, "This task has already been carried forward.", "ALREADY_CARRIED");
  const targetDate = addDays(date, 1);
  db.taskCarryovers.push({ id: id("carry"), taskDefinitionId, sourceRecordId: record.id, sourceDate: date, targetDate, amount: record.totalTarget, isReverted: false, createdAt: nowIso(), revertedAt: null });
  record.status = "carried"; record.carriedToDate = targetDate; record.updatedAt = nowIso();
  syncExerciseReward(db, date);
  return taskDayView(db, date);
}

export function revertCarry(db: LocalDatabase, taskDefinitionId: string, date: string) {
  const record = ensureRecord(db, taskDefinitionId, date);
  const carry = db.taskCarryovers.find((item) => item.sourceRecordId === record.id && !item.isReverted);
  if (!carry || record.status !== "carried") throw new ApiError(409, "No active carryover was found.", "NO_CARRYOVER");
  carry.isReverted = true; carry.revertedAt = nowIso();
  record.status = "pending"; record.carriedToDate = null; record.updatedAt = nowIso();
  return taskDayView(db, date);
}

export function createFood(db: LocalDatabase, input: Omit<FoodEntry, "id" | "createdAt" | "updatedAt">) {
  const now = nowIso();
  const entry: FoodEntry = { ...input, id: id("food"), createdAt: now, updatedAt: now };
  db.foodEntries.push(entry);
  if (entry.isDessert) createEffect(db, { sourceType: "dessert", sourceId: entry.id, worldDelta: db.settings.dessertWorldDelta, relationshipDelta: db.settings.dessertRelationshipDelta, familyDelta: db.settings.dessertFamilyDelta, effectDate: entry.entryDate, reason: `Dessert: ${entry.mealName}` });
  return entry;
}

export function updateFood(db: LocalDatabase, input: Partial<Omit<FoodEntry, "id" | "createdAt" | "updatedAt">> & { id: string }) {
  const entry = db.foodEntries.find((item) => item.id === input.id);
  if (!entry) throw new ApiError(404, "Food entry not found.", "FOOD_NOT_FOUND");
  const wasDessert = entry.isDessert;
  Object.assign(entry, input, { id: entry.id, updatedAt: nowIso() });
  if (!wasDessert && entry.isDessert) createEffect(db, { sourceType: "dessert", sourceId: entry.id, worldDelta: db.settings.dessertWorldDelta, relationshipDelta: db.settings.dessertRelationshipDelta, familyDelta: db.settings.dessertFamilyDelta, effectDate: entry.entryDate, reason: `Dessert: ${entry.mealName}` });
  if (wasDessert && !entry.isDessert) revertEffect(db, "dessert", entry.id);
  return entry;
}

export function deleteFood(db: LocalDatabase, entryId: string) {
  const index = db.foodEntries.findIndex((item) => item.id === entryId);
  if (index < 0) throw new ApiError(404, "Food entry not found.", "FOOD_NOT_FOUND");
  const [entry] = db.foodEntries.splice(index, 1);
  if (entry.isDessert) revertEffect(db, "dessert", entry.id);
  return entry;
}

export function createActivity(db: LocalDatabase, input: Omit<ActivityEntry, "id" | "createdAt" | "updatedAt">) {
  const now = nowIso();
  const entry: ActivityEntry = { ...input, id: id("activity"), createdAt: now, updatedAt: now };
  db.activityEntries.push(entry);
  return entry;
}

export function updateActivity(db: LocalDatabase, input: Pick<ActivityEntry, "id" | "activityDate" | "activityTime" | "activityName" | "durationMinutes" | "confirmedCaloriesBurned">) {
  const entry = db.activityEntries.find((item) => item.id === input.id);
  if (!entry) throw new ApiError(404, "Activity entry not found.", "ACTIVITY_NOT_FOUND");
  Object.assign(entry, input, { id: entry.id, updatedAt: nowIso() });
  return entry;
}

export function deleteActivity(db: LocalDatabase, entryId: string) {
  const index = db.activityEntries.findIndex((entry) => entry.id === entryId);
  if (index < 0) throw new ApiError(404, "Activity entry not found.", "ACTIVITY_NOT_FOUND");
  return db.activityEntries.splice(index, 1)[0];
}

export function createSmoking(db: LocalDatabase, input: Pick<SmokingEntry, "entryDate" | "entryTime"> & { requestId: string }) {
  const existing = db.smokingEntries.find((entry) => entry.id === input.requestId);
  if (existing) return { entry: existing, created: false };
  const now = nowIso();
  const entry: SmokingEntry = { id: input.requestId, entryDate: input.entryDate, entryTime: input.entryTime, createdAt: now, updatedAt: now };
  db.smokingEntries.push(entry);
  createEffect(db, { sourceType: "smoking", sourceId: entry.id, worldDelta: db.settings.smokingWorldDelta, relationshipDelta: db.settings.smokingRelationshipDelta, familyDelta: db.settings.smokingFamilyDelta, effectDate: entry.entryDate, reason: "Smoking record" });
  return { entry, created: true };
}

export function deleteSmoking(db: LocalDatabase, entryId: string) {
  const index = db.smokingEntries.findIndex((entry) => entry.id === entryId);
  if (index < 0) throw new ApiError(404, "Smoking entry not found.", "SMOKING_NOT_FOUND");
  const [entry] = db.smokingEntries.splice(index, 1);
  revertEffect(db, "smoking", entry.id);
  return entry;
}

export function adjustLifecycle(db: LocalDatabase, category: LifecycleCategory, delta: number, reason: string) {
  const adjustmentId = id("adjustment");
  db.lifecycleAdjustments.push({ id: adjustmentId, category, delta, reason, createdAt: nowIso() });
  createEffect(db, { sourceType: "manual_adjustment", sourceId: adjustmentId, worldDelta: category === "explore_world" ? delta : 0, relationshipDelta: category === "relationship" ? delta : 0, familyDelta: category === "family" ? delta : 0, effectDate: todayFor(db), reason });
  return db.settings;
}

export function lifecycleView(db: LocalDatabase) {
  const today = todayFor(db);
  const timeline = lifecycleTimeline(db.settings.birthDate, db.settings.targetDate, today);
  const energized = energizedScore(db.settings);
  const recent = db.lifecycleEffects.filter((effect) => !effect.isReverted).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  const daysPerPercent = daysPerEnergizedPercent(timeline.remainingDays);
  const latest = recent[0];
  const latestDelta = latest ? latest.worldDelta + latest.relationshipDelta + latest.familyDelta : 0;
  return {
    settings: db.settings,
    timeline,
    naturalDaysRemaining: timeline.remainingDays,
    effectiveDaysRemaining: effectiveDaysRemaining(timeline.remainingDays, energized),
    daysPerPercent,
    energized,
    stage: heartStage(energized),
    recent,
    latestImpact: latest ? { delta: latestDelta, days: Math.round(daysPerPercent * latestDelta), effectId: latest.id, isFresh: Date.now() - new Date(latest.createdAt).getTime() < 15_000 } : null,
  };
}

function dateSeries(start: string, end: string) {
  const days = differenceInCalendarDays(end, start);
  if (days < 0 || days > 366) throw new ApiError(400, "Choose a date range of 366 days or fewer.", "INVALID_DATE_RANGE");
  return Array.from({ length: days + 1 }, (_, index) => addDays(start, index));
}

function caloriePeriod(db: LocalDatabase, start: string, end: string) {
  const foodEntries = db.foodEntries.filter((entry) => entry.entryDate >= start && entry.entryDate <= end).sort((a, b) => `${b.entryDate}${b.entryTime}`.localeCompare(`${a.entryDate}${a.entryTime}`));
  const activityEntries = db.activityEntries.filter((entry) => entry.activityDate >= start && entry.activityDate <= end).sort((a, b) => `${b.activityDate}${b.activityTime}`.localeCompare(`${a.activityDate}${a.activityTime}`));
  const series = dateSeries(start, end).map((date) => {
    const foods = db.foodEntries.filter((entry) => entry.entryDate === date);
    const activities = db.activityEntries.filter((entry) => entry.activityDate === date);
    const intake = foods.reduce((sum, entry) => sum + entry.confirmedCalories, 0);
    const burned = activities.reduce((sum, entry) => sum + entry.confirmedCaloriesBurned, 0);
    return { date, intake, burned, net: intake - burned, calories: foods.length ? intake : null, meals: foods.length, activities: activities.length, desserts: foods.filter((entry) => entry.isDessert).length };
  });
  const totalIntake = series.reduce((sum, day) => sum + day.intake, 0);
  const totalBurned = series.reduce((sum, day) => sum + day.burned, 0);
  const recordedFoodDays = series.filter((day) => day.meals > 0).length;
  const recordedActivityDays = series.filter((day) => day.activities > 0).length;
  const highestIntake = [...series].filter((day) => day.meals > 0).sort((a, b) => b.intake - a.intake)[0] ?? null;
  const lowestIntake = [...series].filter((day) => day.meals > 0).sort((a, b) => a.intake - b.intake)[0] ?? null;
  const highestBurn = [...series].filter((day) => day.activities > 0).sort((a, b) => b.burned - a.burned)[0] ?? null;
  return {
    start, end, series, foodEntries, activityEntries,
    totalIntake, totalBurned, netCalories: totalIntake - totalBurned,
    averageDailyIntake: recordedFoodDays ? Math.round(totalIntake / recordedFoodDays) : null,
    averageDailyBurn: recordedActivityDays ? Math.round(totalBurned / recordedActivityDays) : null,
    highestIntake, lowestIntake, highestBurn, recordedFoodDays, recordedActivityDays,
    meals: series.reduce((sum, day) => sum + day.meals, 0),
    activities: series.reduce((sum, day) => sum + day.activities, 0),
    desserts: series.reduce((sum, day) => sum + day.desserts, 0),
    // Backward-compatible aliases used by older clients.
    total: totalIntake,
    average: recordedFoodDays ? Math.round(totalIntake / recordedFoodDays) : null,
    highest: highestIntake,
    lowest: lowestIntake,
    recordedDays: recordedFoodDays,
  };
}

export function calorieStats(db: LocalDatabase, anchor: string, customStart = anchor, customEnd = anchor) {
  const todayEntries = db.foodEntries.filter((entry) => entry.entryDate === anchor).sort((a, b) => a.entryTime.localeCompare(b.entryTime));
  const todayActivities = db.activityEntries.filter((entry) => entry.activityDate === anchor).sort((a, b) => a.activityTime.localeCompare(b.activityTime));
  const byMeal = (["breakfast", "lunch", "dinner", "snack"] as const).map((type) => ({ type, calories: todayEntries.filter((entry) => entry.mealType === type).reduce((sum, entry) => sum + entry.confirmedCalories, 0) }));
  const weekStart = startOfWeekMonday(anchor); const weekEnd = addDays(weekStart, 6);
  const month = monthBounds(anchor);
  const intake = todayEntries.reduce((sum, entry) => sum + entry.confirmedCalories, 0);
  const burned = todayActivities.reduce((sum, entry) => sum + entry.confirmedCaloriesBurned, 0);
  return {
    anchor,
    today: { entries: todayEntries, activities: todayActivities, byMeal, total: intake, intake, burned, net: intake - burned, meals: todayEntries.length, desserts: todayEntries.filter((entry) => entry.isDessert).length },
    week: caloriePeriod(db, weekStart, weekEnd),
    month: caloriePeriod(db, month.start, month.end),
    range: caloriePeriod(db, customStart, customEnd),
    smokingEntries: db.smokingEntries.sort((a, b) => `${b.entryDate}${b.entryTime}`.localeCompare(`${a.entryDate}${a.entryTime}`)),
  };
}

export function dashboardView(db: LocalDatabase) {
  const today = todayFor(db);
  const tasks = taskDayView(db, today);
  const lifecycle = lifecycleView(db);
  const calories = calorieStats(db, today).today;
  return {
    today,
    tasks: tasks.summary,
    lifecycle: { remainingDays: lifecycle.naturalDaysRemaining, naturalDaysRemaining: lifecycle.naturalDaysRemaining, effectiveDaysRemaining: lifecycle.effectiveDaysRemaining, energized: lifecycle.energized, stage: lifecycle.stage },
    calories: { total: calories.total, intake: calories.intake, burned: calories.burned, net: calories.net, meals: calories.meals, desserts: calories.desserts },
  };
}

export function publicSettingsView(db: LocalDatabase) {
  return { settings: db.settings, taskDefinitions: [...db.taskDefinitions].sort((a, b) => a.displayOrder - b.displayOrder) };
}

export function updateGeneralSettings(db: LocalDatabase, input: Pick<SystemSettings, "websiteName" | "language" | "timezone">) {
  Object.assign(db.settings, input, { updatedAt: nowIso() });
  return db.settings;
}

export function updateTimelineSettings(db: LocalDatabase, input: Pick<SystemSettings, "birthDate" | "targetAge">) {
  Object.assign(db.settings, input, { targetDate: targetDateFromAge(input.birthDate, input.targetAge), updatedAt: nowIso() });
  return db.settings;
}

export function updateLifecycleScores(db: LocalDatabase, input: Pick<SystemSettings, "exploreWorldScore" | "relationshipScore" | "familyScore"> & { reason: string }) {
  const changes: Array<[LifecycleCategory, number]> = [
    ["explore_world", input.exploreWorldScore - db.settings.exploreWorldScore],
    ["relationship", input.relationshipScore - db.settings.relationshipScore],
    ["family", input.familyScore - db.settings.familyScore],
  ];
  for (const [category, delta] of changes) if (delta !== 0) adjustLifecycle(db, category, delta, input.reason);
  return db.settings;
}

export function updateLifecycleRules(db: LocalDatabase, input: Pick<SystemSettings,
  "exerciseWorldDelta" | "exerciseRelationshipDelta" | "exerciseFamilyDelta" |
  "dessertWorldDelta" | "dessertRelationshipDelta" | "dessertFamilyDelta" |
  "smokingWorldDelta" | "smokingRelationshipDelta" | "smokingFamilyDelta">) {
  Object.assign(db.settings, input, { updatedAt: nowIso() });
  return db.settings;
}

export function updateCalorieSettings(db: LocalDatabase, input: Pick<SystemSettings, "defaultMealType" | "aiFoodAnalysisEnabled" | "activityAiEnabled" | "bodyWeightKg" | "defaultCaloriesView" | "requireAiConfirmation">) {
  Object.assign(db.settings, input, { updatedAt: nowIso() });
  return db.settings;
}

export function updateDisplaySettings(db: LocalDatabase, input: Pick<SystemSettings, "defaultLandingPage" | "desktopSidebarMode" | "mobileDateRange">) {
  Object.assign(db.settings, input, { updatedAt: nowIso() });
  return db.settings;
}

export function resetLifecycleScores(db: LocalDatabase) {
  return updateLifecycleScores(db, { exploreWorldScore: 33, relationshipScore: 33, familyScore: 33, reason: "Lifecycle reset to 33 / 33 / 33" });
}

export function updateSettings(db: LocalDatabase, input: Pick<SystemSettings, "birthDate" | "targetDate" | "timezone">) {
  const targetAge = Math.max(1, new Date(`${input.targetDate}T00:00:00Z`).getUTCFullYear() - new Date(`${input.birthDate}T00:00:00Z`).getUTCFullYear());
  Object.assign(db.settings, input, { targetAge, updatedAt: nowIso() });
  return db.settings;
}

export function updateTaskDefinition(db: LocalDatabase, input: Pick<TaskDefinition, "id" | "name" | "unit" | "baseTarget" | "displayOrder" | "isActive">) {
  const definition = db.taskDefinitions.find((item) => item.id === input.id);
  if (!definition) throw new ApiError(404, "Task definition not found.", "TASK_NOT_FOUND");
  Object.assign(definition, input, { updatedAt: nowIso() });
  return definition;
}

export function updateTaskDefinitions(db: LocalDatabase, inputs: Array<Pick<TaskDefinition, "id" | "name" | "unit" | "baseTarget" | "displayOrder" | "isActive">>) {
  return inputs.map((input) => updateTaskDefinition(db, input));
}
