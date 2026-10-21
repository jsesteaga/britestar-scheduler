import type { Day } from "../types";

export const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const DAY_FULL_NAMES: Record<Day, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

/** The Monday of the week `offsetWeeks` away from today (0 = this week, -1 = last week, ...). */
export function getMondayOfWeek(offsetWeeks: number, today: Date = new Date()): Date {
  const date = new Date(today);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  date.setDate(date.getDate() - daysSinceMonday + offsetWeeks * 7);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Maps each Day name to its actual calendar date within the week starting `monday`. */
export function getDatesForWeek(monday: Date): Record<Day, Date> {
  const dates = {} as Record<Day, Date>;
  DAYS.forEach((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    dates[day] = date;
  });
  return dates;
}

export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${format(monday)} – ${format(sunday)}`;
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

/** The weekday name (Mon..Sun) a given calendar date falls on. */
export function dateToDayName(date: Date): Day {
  const jsDay = date.getDay(); // 0 = Sunday ... 6 = Saturday
  const index = jsDay === 0 ? 6 : jsDay - 1; // convert to Mon=0..Sun=6
  return DAYS[index];
}

export function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** How many weeks away (relative to today) the week containing `date` is — feeds getMondayOfWeek's offset. */
export function weekOffsetForDate(date: Date, today: Date = new Date()): number {
  const mondayOfDate = getMondayOfWeek(0, date);
  const mondayOfToday = getMondayOfWeek(0, today);
  const diffDays = Math.round(
    (mondayOfDate.getTime() - mondayOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.round(diffDays / 7);
}

/** A 6-row x 7-col month grid (Mon-start), including the leading/trailing days from neighboring months. */
export function getMonthGrid(offsetMonths: number, today: Date = new Date()): Date[][] {
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1);
  const firstWeekday = firstOfMonth.getDay();
  const daysFromMonday = firstWeekday === 0 ? 6 : firstWeekday - 1;

  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - daysFromMonday);

  const weeks: Date[][] = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function formatMonthTitle(offsetMonths: number, today: Date = new Date()): string {
  const base = new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1);
  return base.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function isInMonth(date: Date, offsetMonths: number, today: Date = new Date()): boolean {
  const base = new Date(today.getFullYear(), today.getMonth() + offsetMonths, 1);
  return date.getFullYear() === base.getFullYear() && date.getMonth() === base.getMonth();
}

/** "YYYY-MM-DD" in local time (not UTC, so it matches the calendar day shown on screen). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" -> "Sat, Sep 12". */
export function formatFriendlyDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** The ISO date ("YYYY-MM-DD") of the Monday starting the week `isoDate` falls in — the key posted weeks are stored under. */
export function mondayKeyFor(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return toISODate(getMondayOfWeek(0, new Date(y, m - 1, d)));
}

/** Parses an ISO date ("YYYY-MM-DD") as a local calendar date (not UTC midnight). */
export function fromISODate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Today", "Tomorrow", "in 3 days", "Yesterday", "2 days ago" — how soon a date is. */
export function relativeDayLabel(isoDate: string, today: Date = new Date()): string {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((fromISODate(isoDate).getTime() - start.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
