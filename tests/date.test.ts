import { describe, expect, it } from "vitest";
import { addDays, dateInTimezone, differenceInCalendarDays, lifecycleTimeline, monthBounds, startOfWeekMonday, targetDateFromAge } from "@/lib/date";

describe("Singapore calendar and lifecycle math", () => {
  it("calculates the exact 60-year span including leap years", () => {
    expect(differenceInCalendarDays("2063-01-08", "2003-01-08")).toBe(21_915);
  });

  it("calculates lived, remaining and total days", () => {
    expect(lifecycleTimeline("2003-01-08", "2063-01-08", "2026-08-07")).toMatchObject({ totalDays: 21_915, livedDays: 8_612, remainingDays: 13_303 });
  });

  it("never reports negative days after the target", () => {
    expect(lifecycleTimeline("2003-01-08", "2063-01-08", "2064-01-01").remainingDays).toBe(0);
  });

  it("reports zero remaining on the target date", () => {
    expect(lifecycleTimeline("2003-01-08", "2063-01-08", "2063-01-08").remainingDays).toBe(0);
  });

  it("changes the business date at Singapore midnight", () => {
    expect(dateInTimezone(new Date("2026-08-07T15:59:59Z"), "Asia/Singapore")).toBe("2026-08-07");
    expect(dateInTimezone(new Date("2026-08-07T16:00:00Z"), "Asia/Singapore")).toBe("2026-08-08");
  });

  it("handles leap day arithmetic", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
  });

  it("uses Monday as the first day of a week", () => {
    expect(startOfWeekMonday("2026-08-09")).toBe("2026-08-03");
    expect(startOfWeekMonday("2026-08-03")).toBe("2026-08-03");
  });

  it("handles month boundaries", () => {
    expect(monthBounds("2024-02-15")).toEqual({ start: "2024-02-01", end: "2024-02-29", days: 29 });
  });

  it("derives target date from birth date and target age", () => {
    expect(targetDateFromAge("2003-01-08", 60)).toBe("2063-01-08");
    expect(targetDateFromAge("2003-01-08", 65)).toBe("2068-01-08");
  });

  it("handles leap-day target ages without an invalid date", () => {
    expect(targetDateFromAge("2004-02-29", 1)).toBe("2005-02-28");
  });
});
