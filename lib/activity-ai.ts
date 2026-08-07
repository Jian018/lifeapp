export function activityDescriptionHasDuration(description: string) {
  return /\b\d+(?:\.\d+)?\s*(?:min(?:ute)?s?|mins?|hr(?:s)?|hours?)\b/i.test(description)
    || /\d+(?:\.\d+)?\s*(?:分钟|分(?:钟)?|小时)/.test(description);
}

export function activityAnalysisPrompt(description: string, bodyWeightKg: number | null) {
  const weight = bodyWeightKg === null
    ? "No body weight is saved. Use a clearly stated average-adult assumption."
    : `The user's saved body weight is ${bodyWeightKg} kg. Personalize the estimate using this weight.`;
  return [
    "Estimate a completed exercise activity for a personal calorie log.",
    `User description: ${description}`,
    weight,
    "Return the activity name, duration in minutes, intensity, calorie estimate, a realistic low/high range, confidence, and assumptions.",
    "Calories burned are estimates, never medical-grade measurements. Account for uncertainty from intensity, heart rate, rest time, age, sex, and metabolism.",
    "If intensity is unclear, use moderate and explicitly record that assumption.",
  ].join("\n");
}
