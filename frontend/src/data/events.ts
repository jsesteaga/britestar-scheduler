import type { Day } from "../types";

/**
 * The little promo/event notes shown under each day's date ("Paint Night").
 * `weekly` is the recurring note for every week's Monday, Tuesday, ...;
 * `dates` holds one-off notes for a specific ISO date that replace the weekly
 * one just that day — an empty string there means "nothing this week".
 *
 * Same DEMO-ONLY localStorage persistence as data/scheduleStore.ts.
 */
export type DayEvents = {
  weekly: Partial<Record<Day, string>>;
  dates: Record<string, string>;
};

const STORAGE_KEY = "britestar-day-events";

const DEFAULT_EVENTS: DayEvents = {
  weekly: {
    Mon: "Paint Night",
    Tue: "Porque Si",
    Wed: "Free Pool • $2 off Pitchers • Jesus Night",
    Thu: "Tayraoke™",
  },
  dates: {},
};

export function getDayEvents(): DayEvents {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DayEvents;
  } catch {
    // fall through to defaults
  }
  return DEFAULT_EVENTS;
}

export function saveDayEvents(events: DayEvents): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // localStorage unavailable (private browsing, etc.) — changes just won't persist
  }
}

/** The note to show for a given day/date: a one-off for that date wins over the weekly one. */
export function eventFor(events: DayEvents, day: Day, date: string): string {
  return date in events.dates ? events.dates[date] : (events.weekly[day] ?? "");
}
