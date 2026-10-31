import type {
  CoverageRequest,
  PostedWeek,
  Shift,
  ShiftTemplateEntry,
  SwapRequest,
  TimeOffRequest,
} from "../types";
import { getDatesForWeek, getMondayOfWeek, toISODate } from "../utils/week";

/**
 * LOCALHOST-ONLY demo data (only runs under `npm run dev`, never in a
 * production build). Fills the week after next with the Test 1–5 accounts,
 * finalizes it, and queues up five pending requests in it so the manager view
 * has something to act on. This week and next week are left to generate from
 * the normal template (data/mockSchedule.ts).
 *
 * Runs once per browser — delete the `britestar-demo-seed` key in
 * localStorage (or bump SEED_VERSION) to reseed.
 */

const SEED_VERSION = "2";
const SEED_KEY = "britestar-demo-seed";

// w14–w18 are Test 1–Test 5 in data/workers.ts.
const T1 = "w14";
const T2 = "w15";
const T3 = "w16";
const T4 = "w17";
const T5 = "w18";

const demoTemplate: ShiftTemplateEntry[] = [
  { day: "Mon", start: "1:00 PM", end: "8:30 PM", workerIds: [T1] },
  { day: "Mon", start: "8:30 PM", end: "2:00 AM", workerIds: [T2] },
  { day: "Tue", start: "1:00 PM", end: "8:30 PM", workerIds: [T3] },
  { day: "Tue", start: "8:30 PM", end: "2:00 AM", workerIds: [T4] },
  { day: "Wed", start: "1:00 PM", end: "8:30 PM", workerIds: [T5] },
  { day: "Wed", start: "8:30 PM", end: "2:00 AM", workerIds: [T1] },
  { day: "Thu", start: "1:00 PM", end: "5:30 PM", workerIds: [T2] },
  { day: "Thu", start: "8:30 PM", end: "2:00 AM", workerIds: [T3, T4] },
  { day: "Fri", start: "1:00 PM", end: "5:30 PM", workerIds: [T1, T5] },
  { day: "Fri", start: "8:30 PM", end: "2:00 AM", workerIds: [T2, T3] },
  { day: "Sat", start: "1:00 PM", end: "5:30 PM", workerIds: [T4, T1] },
  { day: "Sat", start: "8:30 PM", end: "2:00 AM", workerIds: [T2, T3, T5] },
  { day: "Sun", start: "1:00 PM", end: "8:30 PM", workerIds: [T4, T5] },
];

function weekShifts(monday: Date): Shift[] {
  const mondayISO = toISODate(monday);
  const dates = getDatesForWeek(monday);
  return demoTemplate.map((entry, index) => ({
    id: `s-${mondayISO}-${index}`,
    date: toISODate(dates[entry.day]),
    start: entry.start,
    end: entry.end,
    workerIds: [...entry.workerIds],
  }));
}

export function seedDemoData(): void {
  try {
    if (localStorage.getItem(SEED_KEY) === SEED_VERSION) return;

    const demoMonday = getMondayOfWeek(2);
    const demoWeek = weekShifts(demoMonday);
    const days = getDatesForWeek(demoMonday);
    const now = new Date().toISOString();

    const postedWeeks: Record<string, PostedWeek> = {
      [toISODate(demoMonday)]: { postedAt: now, shifts: demoWeek },
    };

    const timeOff: TimeOffRequest[] = [
      {
        id: "demo-pto-1",
        workerId: T5,
        startDate: toISODate(days.Fri),
        endDate: toISODate(days.Fri),
        reason: "Friend's wedding",
        status: "pending",
      },
      {
        id: "demo-pto-2",
        workerId: T4,
        startDate: toISODate(days.Sat),
        endDate: toISODate(days.Sun),
        reason: "Out of town",
        status: "pending",
      },
    ];

    // Index into the template above: 11 = Sat night, 5 = Wed night.
    const coverage: CoverageRequest[] = [
      {
        id: "demo-cov-1",
        shiftId: demoWeek[11].id,
        requestingWorkerId: T3,
        note: "Family in town",
        responses: [{ workerId: T1, canCover: true, at: now }],
      },
      {
        id: "demo-cov-2",
        shiftId: demoWeek[5].id,
        requestingWorkerId: T1,
        note: "Concert tickets",
        responses: [],
      },
    ];

    // Test 2's Mon night ↔ Test 4's Tue night.
    const swaps: SwapRequest[] = [
      {
        id: "demo-swap-1",
        requestingWorkerId: T2,
        requestingShiftId: demoWeek[1].id,
        targetWorkerId: T4,
        targetShiftId: demoWeek[3].id,
      },
    ];

    localStorage.setItem("britestar-shifts", JSON.stringify(demoWeek));
    localStorage.setItem("britestar-generated-weeks", JSON.stringify([toISODate(demoMonday)]));
    localStorage.setItem("britestar-posted-weeks", JSON.stringify(postedWeeks));
    localStorage.setItem("britestar-timeoff", JSON.stringify(timeOff));
    localStorage.setItem("britestar-coverage-requests", JSON.stringify(coverage));
    localStorage.setItem("britestar-swap-requests", JSON.stringify(swaps));
    localStorage.setItem("britestar-notifications", JSON.stringify([]));
    localStorage.setItem(SEED_KEY, SEED_VERSION);
  } catch {
    // localStorage unavailable — app just falls back to its normal defaults
  }
}
