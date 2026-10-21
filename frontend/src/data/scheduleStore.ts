import type { Availability, CoverageRequest, Shift, SwapRequest, TimeOffRequest } from "../types";
import { getMondayOfWeek, toISODate } from "../utils/week";
import { generateShiftsForWeek, mockTimeOff } from "./mockSchedule";

/**
 * Same DEMO-ONLY localStorage pattern as `data/workers.ts` — this is the
 * only reason schedule changes (shift edits, PTO, coverage/swap requests)
 * survive a logout/login instead of resetting to the hardcoded mock data
 * every time the schedule page remounts. A real backend replaces all of
 * this with actual persisted storage shared across everyone, not just one
 * browser.
 */

const KEYS = {
  shifts: "britestar-shifts",
  generatedWeeks: "britestar-generated-weeks",
  timeOff: "britestar-timeoff",
  coverage: "britestar-coverage-requests",
  swap: "britestar-swap-requests",
  availability: "britestar-availability",
} as const;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // fall through to seeding defaults below
  }
  save(key, fallback);
  return fallback;
}

function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (private browsing, etc.) — changes just won't persist
  }
}

type LegacyShift = Partial<Shift> & { day?: string };

// Shifts used to be a single weekday-based template shared by every week
// ("Mon" meant the SAME shift object for every Monday ever viewed) — that
// was the actual bug reported: editing one week silently edited all of
// them. Now each week gets its own dated instances, generated from
// `shiftTemplate` the first time that week is viewed (see
// ensureWeekGenerated). A returning browser's old weekday-based shifts have
// no specific date to recover, so they're dropped and this week is
// (re)seeded fresh from the template instead of crashing on a missing date.
export function getShifts(): Shift[] {
  const loaded = load<LegacyShift[]>(KEYS.shifts, []);
  const isOldFormat = loaded.length > 0 && loaded.some((s) => typeof s.date !== "string");
  if (loaded.length === 0 || isOldFormat) {
    const monday = getMondayOfWeek(0);
    const fresh = generateShiftsForWeek(monday);
    saveShifts(fresh);
    saveGeneratedWeeks([toISODate(monday)]);
    return fresh;
  }
  return loaded as Shift[];
}
export const saveShifts = (shifts: Shift[]) => save(KEYS.shifts, shifts);

export const getGeneratedWeeks = () => load<string[]>(KEYS.generatedWeeks, []);
export const saveGeneratedWeeks = (weeks: string[]) => save(KEYS.generatedWeeks, weeks);

/**
 * Makes sure every week in `mondays` has its shifts populated, generating
 * from the template for any that don't yet. Call this whenever the visible
 * week(s) change (week nav, month nav) — already-generated weeks are left
 * completely alone, including any edits/deletions made to them.
 */
export function ensureWeeksGenerated(
  mondays: Date[],
  currentShifts: Shift[],
  generatedWeeks: string[],
): { shifts: Shift[]; generatedWeeks: string[] } | null {
  const missing = mondays.filter((m) => !generatedWeeks.includes(toISODate(m)));
  if (missing.length === 0) return null;

  const newShifts = missing.flatMap((monday) => generateShiftsForWeek(monday));
  const newGeneratedWeeks = [...generatedWeeks, ...missing.map((m) => toISODate(m))];
  const shifts = [...currentShifts, ...newShifts];
  saveShifts(shifts);
  saveGeneratedWeeks(newGeneratedWeeks);
  return { shifts, generatedWeeks: newGeneratedWeeks };
}

// Legacy shapes this has gone through: weekday-based (`day`), then a single
// `date`, now a `startDate`/`endDate` range. A returning browser might have
// either older shape sitting in localStorage.
type LegacyTimeOffRecord = Partial<TimeOffRequest> & { date?: string; day?: string };

export function getTimeOff(): TimeOffRequest[] {
  const loaded = load<LegacyTimeOffRecord[]>(KEYS.timeOff, mockTimeOff);
  let changed = false;
  const migrated: TimeOffRequest[] = [];

  for (const r of loaded) {
    if (!r.id || !r.workerId || !r.status) {
      changed = true;
      continue;
    }
    if (typeof r.startDate === "string" && typeof r.endDate === "string") {
      migrated.push({
        id: r.id,
        workerId: r.workerId,
        startDate: r.startDate,
        endDate: r.endDate,
        reason: r.reason,
        status: r.status,
      });
    } else if (typeof r.date === "string") {
      // Upgrade a single-date record into a one-day range instead of dropping it.
      migrated.push({
        id: r.id,
        workerId: r.workerId,
        startDate: r.date,
        endDate: r.date,
        reason: r.reason,
        status: r.status,
      });
      changed = true;
    } else {
      // Oldest weekday-based shape — no real date to recover, drop it.
      changed = true;
    }
  }

  if (changed) saveTimeOff(migrated);
  return migrated;
}
export const saveTimeOff = (timeOff: TimeOffRequest[]) => save(KEYS.timeOff, timeOff);

export const getCoverageRequests = () => load<CoverageRequest[]>(KEYS.coverage, []);
export const saveCoverageRequests = (requests: CoverageRequest[]) => save(KEYS.coverage, requests);

export const getSwapRequests = () => load<SwapRequest[]>(KEYS.swap, []);
export const saveSwapRequests = (requests: SwapRequest[]) => save(KEYS.swap, requests);

export const getAvailability = () => load<Availability[]>(KEYS.availability, []);
export const saveAvailability = (availability: Availability[]) =>
  save(KEYS.availability, availability);
