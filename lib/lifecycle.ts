import { clamp } from "@/lib/utils";
import type { SystemSettings } from "@/lib/types";

export function energizedScore(scores: Pick<SystemSettings, "exploreWorldScore" | "relationshipScore" | "familyScore">) {
  const raw = scores.exploreWorldScore + scores.relationshipScore + scores.familyScore;
  return Math.round(clamp(raw) * 100) / 100;
}

export function heartStage(score: number) {
  if (score >= 100) return { emoji: "❤️", label: "Wholehearted" };
  if (score >= 75) return { emoji: "🥰", label: "Flourishing" };
  if (score >= 50) return { emoji: "🤩", label: "Energized" };
  if (score >= 25) return { emoji: "🙂", label: "Steady" };
  return { emoji: "💔", label: "Needs care" };
}

export function applyScoreDelta(settings: SystemSettings, world: number, relationship: number, family: number) {
  settings.exploreWorldScore = clamp(settings.exploreWorldScore + world);
  settings.relationshipScore = clamp(settings.relationshipScore + relationship);
  settings.familyScore = clamp(settings.familyScore + family);
  settings.updatedAt = new Date().toISOString();
}
