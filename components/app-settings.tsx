"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { SystemSettings, TaskDefinition } from "@/lib/types";

type SettingsPayload = { settings: SystemSettings; taskDefinitions: TaskDefinition[] };
type ContextValue = SettingsPayload & {
  ready: boolean;
  refreshSettings: () => Promise<void>;
  text: (english: string, chinese: string) => string;
};

const now = new Date().toISOString();
export const defaultClientSettings: SystemSettings = {
  id: "singleton", websiteName: "My Life System", language: "en", timezone: "Asia/Singapore",
  birthDate: "2003-01-08", targetAge: 60, targetDate: "2063-01-08",
  exploreWorldScore: 33, relationshipScore: 33, familyScore: 33,
  exerciseWorldDelta: 1, exerciseRelationshipDelta: 1, exerciseFamilyDelta: 1,
  dessertWorldDelta: -1, dessertRelationshipDelta: -1, dessertFamilyDelta: -1,
  smokingWorldDelta: -1, smokingRelationshipDelta: -1, smokingFamilyDelta: -1,
  defaultMealType: "auto", aiFoodAnalysisEnabled: true, requireAiConfirmation: true,
  activityAiEnabled: true, bodyWeightKg: null, defaultCaloriesView: "today",
  defaultLandingPage: "/", desktopSidebarMode: "expanded", mobileDateRange: 7,
  createdAt: now, updatedAt: now,
};

const AppSettingsContext = createContext<ContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<SettingsPayload>({ settings: defaultClientSettings, taskDefinitions: [] });
  const [ready, setReady] = useState(false);
  const refreshSettings = useCallback(async () => {
    const response = await fetch("/api/settings", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load settings.");
    setPayload(await response.json() as SettingsPayload);
    setReady(true);
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/settings", { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<SettingsPayload>; })
      .then((data) => { if (active) { setPayload(data); setReady(true); } })
      .catch(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  const text = useCallback((english: string, chinese: string) => payload.settings.language === "zh" ? chinese : english, [payload.settings.language]);
  return <AppSettingsContext.Provider value={{ ...payload, ready, refreshSettings, text }}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) throw new Error("useAppSettings must be used within AppSettingsProvider");
  return context;
}
