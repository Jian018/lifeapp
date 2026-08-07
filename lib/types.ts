export type TaskStatus = "pending" | "completed" | "carried";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "unknown";
export type Confidence = "low" | "medium" | "high";
export type LifecycleCategory = "explore_world" | "relationship" | "family";
export type AppLanguage = "en" | "zh";
export type DefaultMealType = MealType | "auto";
export type DefaultLandingPage = "/" | "/tasks" | "/lifecycle" | "/calories";
export type DesktopSidebarMode = "expanded" | "compact";

export type TaskDefinition = {
  id: string;
  taskKey: string;
  name: string;
  unit: string;
  baseTarget: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DailyTaskRecord = {
  id: string;
  taskDefinitionId: string;
  recordDate: string;
  baseTarget: number;
  carriedTarget: number;
  totalTarget: number;
  status: TaskStatus;
  completedAt: string | null;
  carriedToDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskCarryover = {
  id: string;
  taskDefinitionId: string;
  sourceRecordId: string;
  sourceDate: string;
  targetDate: string;
  amount: number;
  isReverted: boolean;
  createdAt: string;
  revertedAt: string | null;
};

export type FoodItem = {
  name: string;
  estimated_portion: string;
  estimated_calories: number;
};

export type FoodAnalysisResult = {
  meal_name: string;
  foods: FoodItem[];
  total_estimated_calories: number;
  minimum_estimated_calories: number;
  maximum_estimated_calories: number;
  meal_type: MealType;
  is_dessert: boolean;
  dessert_reason: string | null;
  confidence: Confidence;
  assumptions: string[];
};

export type FoodEntry = {
  id: string;
  entryDate: string;
  entryTime: string;
  mealName: string;
  mealType: MealType;
  confirmedCalories: number;
  aiEstimatedCalories: number | null;
  minimumCalories: number | null;
  maximumCalories: number | null;
  foodItems: FoodItem[];
  isDessert: boolean;
  confidence: Confidence | null;
  assumptions: string[];
  createdAt: string;
  updatedAt: string;
};

export type SmokingEntry = {
  id: string;
  entryDate: string;
  entryTime: string;
  createdAt: string;
  updatedAt: string;
};

export type LifecycleEffect = {
  id: string;
  sourceType: "daily_exercise" | "dessert" | "smoking" | "manual_adjustment";
  sourceId: string;
  worldDelta: number;
  relationshipDelta: number;
  familyDelta: number;
  effectDate: string;
  reason: string;
  isReverted: boolean;
  createdAt: string;
  revertedAt: string | null;
};

export type LifecycleAdjustment = {
  id: string;
  category: LifecycleCategory;
  delta: number;
  reason: string;
  createdAt: string;
};

export type SystemSettings = {
  id: "singleton";
  websiteName: string;
  language: AppLanguage;
  birthDate: string;
  targetAge: number;
  targetDate: string;
  timezone: string;
  exploreWorldScore: number;
  relationshipScore: number;
  familyScore: number;
  exerciseWorldDelta: number;
  exerciseRelationshipDelta: number;
  exerciseFamilyDelta: number;
  dessertWorldDelta: number;
  dessertRelationshipDelta: number;
  dessertFamilyDelta: number;
  smokingWorldDelta: number;
  smokingRelationshipDelta: number;
  smokingFamilyDelta: number;
  defaultMealType: DefaultMealType;
  aiFoodAnalysisEnabled: boolean;
  requireAiConfirmation: boolean;
  defaultLandingPage: DefaultLandingPage;
  desktopSidebarMode: DesktopSidebarMode;
  mobileDateRange: 5 | 7;
  createdAt: string;
  updatedAt: string;
};

export type LocalDatabase = {
  schemaVersion: number;
  settings: SystemSettings;
  taskDefinitions: TaskDefinition[];
  dailyTaskRecords: DailyTaskRecord[];
  taskCarryovers: TaskCarryover[];
  foodEntries: FoodEntry[];
  smokingEntries: SmokingEntry[];
  lifecycleEffects: LifecycleEffect[];
  lifecycleAdjustments: LifecycleAdjustment[];
};
