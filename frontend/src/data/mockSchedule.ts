import type { Shift, ShiftTemplateEntry, TimeOffRequest } from "../types";
import { getDatesForWeek, toISODate } from "../utils/week";

// Worker ids here (w1-w8) line up with the default roster seeded in
// data/workers.ts: w1 Dylan R., w2 Dylan S., w3 John S., w4 Bianca,
// w5 Melanie, w6 Taylor, w7 Kristin, w8 Adrienne.

// This is only the default weekly PATTERN — used to populate a week the
// first time it's viewed (see data/scheduleStore.ts). Once generated, a
// week's actual shifts are independent dated instances; editing one week
// never touches this template or any other week.
export const shiftTemplate: ShiftTemplateEntry[] = [
  { day: "Mon", start: "1:00 PM", end: "8:30 PM", workerIds: ["w1"] },
  { day: "Mon", start: "8:30 PM", end: "2:00 AM", workerIds: ["w2"] },

  { day: "Tue", start: "1:00 PM", end: "8:30 PM", workerIds: ["w2"] },
  { day: "Tue", start: "8:30 PM", end: "2:00 AM", workerIds: ["w1"] },

  { day: "Wed", start: "1:00 PM", end: "8:30 PM", workerIds: [] },
  { day: "Wed", start: "8:30 PM", end: "2:00 AM", workerIds: ["w5"] },

  { day: "Thu", start: "1:00 PM", end: "5:30 PM", workerIds: ["w1"] },
  { day: "Thu", start: "8:30 PM", end: "2:00 AM", workerIds: ["w2", "w4"] },

  { day: "Fri", start: "1:00 PM", end: "5:30 PM", workerIds: ["w1", "w5"] },
  { day: "Fri", start: "8:30 PM", end: "2:00 AM", workerIds: ["w2", "w3"] },

  { day: "Sat", start: "1:00 PM", end: "5:30 PM", workerIds: ["w1", "w4"] },
  { day: "Sat", start: "8:30 PM", end: "2:00 AM", workerIds: ["w2", "w3", "w6"] },

  { day: "Sun", start: "1:00 PM", end: "8:30 PM", workerIds: ["w5", "w6"] },
];

/** Builds real dated Shift instances for the week starting `monday`, from the template. */
export function generateShiftsForWeek(monday: Date): Shift[] {
  const mondayISO = toISODate(monday);
  const dates = getDatesForWeek(monday);
  return shiftTemplate.map((entry, index) => ({
    id: `s-${mondayISO}-${index}`,
    date: toISODate(dates[entry.day]),
    start: entry.start,
    end: entry.end,
    workerIds: [...entry.workerIds],
  }));
}

// Specific calendar date ranges, not recurring weekdays — these two just
// happen to fall in "this week" as sample data. A single-day request has
// startDate === endDate.
export const mockTimeOff: TimeOffRequest[] = [
  {
    id: "t1",
    workerId: "w3",
    startDate: "2026-09-09",
    endDate: "2026-09-09",
    reason: "Doctor's appointment",
    status: "approved",
  },
  {
    id: "t2",
    workerId: "w4",
    startDate: "2026-09-12",
    endDate: "2026-09-12",
    reason: "Family event",
    status: "pending",
  },
];
