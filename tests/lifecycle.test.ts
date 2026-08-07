import { describe, expect, it } from "vitest";
import { applyScoreDelta, energizedScore, heartStage } from "@/lib/lifecycle";
import { createDefaultDatabase } from "@/lib/local-db";

describe("ENERGIZED scoring", () => {
  it("initializes every Lifecycle category at 33", () => {
    const settings = createDefaultDatabase().settings;
    expect([settings.exploreWorldScore, settings.relationshipScore, settings.familyScore]).toEqual([33, 33, 33]);
  });

  it("starts ENERGIZED at 99", () => expect(energizedScore(createDefaultDatabase().settings)).toBe(99));
  it("adds the categories directly instead of averaging", () => expect(energizedScore({ exploreWorldScore: 30, relationshipScore: 29, familyScore: 34 })).toBe(93));
  it("calculates 33 + 33 + 33 as 99", () => expect(energizedScore({ exploreWorldScore: 33, relationshipScore: 33, familyScore: 33 })).toBe(99));
  it("clamps totals above 100 for display", () => expect(energizedScore({ exploreWorldScore: 35, relationshipScore: 34, familyScore: 34 })).toBe(100));
  it("clamps totals below zero for display", () => expect(energizedScore({ exploreWorldScore: -10, relationshipScore: -5, familyScore: -1 })).toBe(0));

  it.each([
    [0, "💔"], [24.99, "💔"], [25, "🙂"], [49.99, "🙂"],
    [50, "🤩"], [74.99, "🤩"], [75, "🥰"], [99, "🥰"], [99.99, "🥰"], [100, "❤️"],
  ])("maps %s to %s", (score, emoji) => expect(heartStage(score).emoji).toBe(emoji));

  it("clamps every category at zero", () => {
    const settings = createDefaultDatabase().settings;
    applyScoreDelta(settings, -1000, -1000, -1000);
    expect([settings.exploreWorldScore, settings.relationshipScore, settings.familyScore]).toEqual([0, 0, 0]);
  });

  it("clamps every category at one hundred", () => {
    const settings = createDefaultDatabase().settings;
    applyScoreDelta(settings, 1000, 1000, 1000);
    expect([settings.exploreWorldScore, settings.relationshipScore, settings.familyScore]).toEqual([100, 100, 100]);
  });
});
