const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function singaporeDate(now = new Date()) {
  return dateInTimezone(now, "Asia/Singapore");
}

export function dateInTimezone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function timeInTimezone(now: Date, timezone = "Asia/Singapore") {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

export function parseDateOnly(date: string) {
  if (!DATE_RE.test(date)) throw new Error("Invalid date format");
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error("Invalid calendar date");
  }
  return parsed;
}

export function addDays(date: string, amount: number) {
  const parsed = parseDateOnly(date);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

export function targetDateFromAge(birthDate: string, targetAge: number) {
  const parsed = parseDateOnly(birthDate);
  const year = parsed.getUTCFullYear() + targetAge;
  const month = parsed.getUTCMonth();
  const day = parsed.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function differenceInCalendarDays(later: string, earlier: string) {
  return Math.round((parseDateOnly(later).getTime() - parseDateOnly(earlier).getTime()) / 86_400_000);
}

export function lifecycleTimeline(birthDate: string, targetDate: string, today: string) {
  const totalDays = Math.max(0, differenceInCalendarDays(targetDate, birthDate));
  const livedDays = Math.max(0, Math.min(totalDays, differenceInCalendarDays(today, birthDate)));
  const remainingDays = Math.max(0, differenceInCalendarDays(targetDate, today));
  const elapsedPercent = totalDays ? (livedDays / totalDays) * 100 : 100;
  const remainingPercent = totalDays ? (remainingDays / totalDays) * 100 : 0;
  return { totalDays, livedDays, remainingDays, elapsedPercent, remainingPercent };
}

export function startOfWeekMonday(date: string) {
  const parsed = parseDateOnly(date);
  const day = parsed.getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
}

export function monthBounds(date: string) {
  const parsed = parseDateOnly(date);
  const start = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0));
  return { start, end: endDate.toISOString().slice(0, 10), days: endDate.getUTCDate() };
}

export function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("en-SG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parseDateOnly(date));
}

export function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", timeZone: "UTC" }).format(parseDateOnly(date));
}
