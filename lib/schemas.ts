import { z } from "zod";

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
export const idSchema = z.string().min(8).max(100);
export const taskMutationSchema = z.object({ taskDefinitionId: idSchema, date: isoDateSchema });

export const foodItemSchema = z.object({
  name: z.string().min(1).max(100),
  estimated_portion: z.string().min(1).max(100),
  estimated_calories: z.number().min(0).max(20_000),
});

export const foodAnalysisSchema = z.object({
  meal_name: z.string().min(1).max(140),
  foods: z.array(foodItemSchema).min(1).max(20),
  total_estimated_calories: z.number().min(0).max(30_000),
  minimum_estimated_calories: z.number().min(0).max(30_000),
  maximum_estimated_calories: z.number().min(0).max(30_000),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack", "unknown"]),
  is_dessert: z.boolean(),
  dessert_reason: z.string().max(300).nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  assumptions: z.array(z.string().max(240)).max(10),
});

export const foodEntrySchema = z.object({
  entryDate: isoDateSchema,
  entryTime: timeSchema,
  mealName: z.string().min(1).max(140),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "unknown"]),
  confirmedCalories: z.coerce.number().int().min(0).max(30_000),
  aiEstimatedCalories: z.coerce.number().int().min(0).max(30_000).nullable().optional(),
  minimumCalories: z.coerce.number().int().min(0).max(30_000).nullable().optional(),
  maximumCalories: z.coerce.number().int().min(0).max(30_000).nullable().optional(),
  foodItems: z.array(foodItemSchema).max(20).default([]),
  isDessert: z.boolean(),
  confidence: z.enum(["low", "medium", "high"]).nullable().optional(),
  assumptions: z.array(z.string().max(240)).max(10).default([]),
});

export const foodUpdateSchema = foodEntrySchema.partial().extend({ id: idSchema });

export const activityAnalysisSchema = z.object({
  activity_name: z.string().trim().min(1).max(120),
  duration_minutes: z.number().positive().max(1_440),
  intensity: z.enum(["light", "moderate", "vigorous", "unknown"]),
  estimated_calories_burned: z.number().min(0).max(20_000),
  minimum_calories_burned: z.number().min(0).max(20_000),
  maximum_calories_burned: z.number().min(0).max(20_000),
  confidence: z.enum(["low", "medium", "high"]),
  assumptions: z.array(z.string().max(240)).max(10),
}).refine((value) => value.minimum_calories_burned <= value.estimated_calories_burned && value.estimated_calories_burned <= value.maximum_calories_burned, {
  message: "Calorie estimate must be inside its range.",
  path: ["estimated_calories_burned"],
});

export const activityAnalyzeInputSchema = z.object({
  description: z.string().trim().min(2).max(300),
});

export const activityEntrySchema = z.object({
  activityDate: isoDateSchema,
  activityTime: timeSchema,
  activityName: z.string().trim().min(1).max(120),
  durationMinutes: z.coerce.number().positive().max(1_440),
  intensity: z.enum(["light", "moderate", "vigorous", "unknown"]),
  confirmedCaloriesBurned: z.coerce.number().min(0).max(20_000),
  aiEstimatedCaloriesBurned: z.coerce.number().min(0).max(20_000).nullable().optional(),
  minimumCaloriesBurned: z.coerce.number().min(0).max(20_000).nullable().optional(),
  maximumCaloriesBurned: z.coerce.number().min(0).max(20_000).nullable().optional(),
  confidence: z.enum(["low", "medium", "high"]).nullable().optional(),
  assumptions: z.array(z.string().max(240)).max(10).default([]),
  source: z.enum(["ai", "manual"]),
});

export const activityUpdateSchema = activityEntrySchema.pick({
  activityDate: true,
  activityTime: true,
  activityName: true,
  durationMinutes: true,
  confirmedCaloriesBurned: true,
}).extend({ id: idSchema });
export const smokingCreateSchema = z.object({ entryDate: isoDateSchema, entryTime: timeSchema, requestId: z.string().uuid() });
export const deleteSchema = z.object({ id: idSchema });
export const lifecycleAdjustSchema = z.object({
  category: z.enum(["explore_world", "relationship", "family"]),
  delta: z.coerce.number().min(-100).max(100).refine((value) => value !== 0, "Delta cannot be zero"),
  reason: z.string().trim().min(3).max(200),
});
export const settingsSchema = z.object({ birthDate: isoDateSchema, targetDate: isoDateSchema, timezone: z.string().min(3).max(60) }).refine((v) => v.targetDate > v.birthDate, { message: "Target date must be after birth date", path: ["targetDate"] });
export const taskDefinitionSchema = z.object({ id: idSchema, name: z.string().min(1).max(80), unit: z.string().min(1).max(30), baseTarget: z.coerce.number().positive().max(100_000), displayOrder: z.coerce.number().int().min(0).max(100), isActive: z.boolean() });

export const generalSettingsSchema = z.object({
  websiteName: z.string().trim().min(2).max(60),
  language: z.enum(["en", "zh"]),
  timezone: z.enum(["Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Tokyo", "UTC", "Europe/London", "America/New_York"]),
});

export const timelineSettingsSchema = z.object({
  birthDate: isoDateSchema,
  targetAge: z.coerce.number().int().min(1).max(120),
});

export const lifecycleSettingsSchema = z.object({
  exploreWorldScore: z.coerce.number().min(0).max(100),
  relationshipScore: z.coerce.number().min(0).max(100),
  familyScore: z.coerce.number().min(0).max(100),
  reason: z.string().trim().min(3).max(200),
});

const deltaSchema = z.coerce.number().min(-100).max(100);
export const lifecycleRulesSchema = z.object({
  exerciseWorldDelta: deltaSchema,
  exerciseRelationshipDelta: deltaSchema,
  exerciseFamilyDelta: deltaSchema,
  dessertWorldDelta: deltaSchema,
  dessertRelationshipDelta: deltaSchema,
  dessertFamilyDelta: deltaSchema,
  smokingWorldDelta: deltaSchema,
  smokingRelationshipDelta: deltaSchema,
  smokingFamilyDelta: deltaSchema,
});

export const calorieSettingsSchema = z.object({
  defaultMealType: z.enum(["breakfast", "lunch", "dinner", "snack", "auto"]),
  aiFoodAnalysisEnabled: z.boolean(),
  activityAiEnabled: z.boolean(),
  bodyWeightKg: z.coerce.number().min(25).max(350).nullable(),
  defaultCaloriesView: z.enum(["today", "week", "month"]),
  requireAiConfirmation: z.boolean(),
});

export const displaySettingsSchema = z.object({
  defaultLandingPage: z.enum(["/", "/tasks", "/lifecycle", "/calories"]),
  desktopSidebarMode: z.enum(["expanded", "compact"]),
  mobileDateRange: z.union([z.literal(5), z.literal(7)]),
});

export const taskSettingsSchema = z.object({ tasks: z.array(taskDefinitionSchema).min(1).max(20) });
export const settingsExportSchema = z.object({ format: z.enum(["json", "csv"]), dataset: z.enum(["all", "tasks", "food", "activities", "lifecycle", "smoking"]).default("all") });
export const resetSettingsSchema = z.object({ confirmation: z.string() });
