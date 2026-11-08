import { getDayEvents, saveDayEvents } from "../data/events";
import {
  ensureWeeksGenerated,
  getAvailability,
  getCoverageRequests,
  getGeneratedWeeks,
  getNotifications,
  getPostedWeeks,
  getShifts,
  getSwapRequests,
  getTimeOff,
  saveAvailability,
  saveCoverageRequests,
  saveNotifications,
  savePostedWeeks,
  saveShifts,
  saveSwapRequests,
  saveTimeOff,
} from "../data/scheduleStore";
import { getWorkers } from "../data/workers";
import type {
  AppNotification,
  Availability,
  CoverageRequest,
  Day,
  DayAvailability,
  Shift,
  SwapRequest,
  TimeOffRequest,
} from "../types";
import { describeShift } from "../utils/time";
import { DAYS, formatWeekRange, fromISODate, toISODate } from "../utils/week";

/**
 * DEV-ONLY demo data: makes Oct 26 – Nov 1, 2026 a busy, finalized week full
 * of test-user give-aways, offers, swaps, and time-off requests to click
 * through. Triggered by visiting the app with `?seed=crazy-week` (see
 * main.tsx). It only ADDS to what's already saved — nothing else is touched —
 * and re-running it replaces its own previous demo items (ids "seed-…")
 * rather than piling up duplicates.
 */
const WEEK = "2026-10-26";
const NEXT_WEEK = "2026-11-02";

// test1 … test5
const T1 = "w14";
const T2 = "w15";
const T3 = "w16";
const T4 = "w17";
const T5 = "w18";

export function seedCrazyWeek(): void {
  const workers = getWorkers();
  const name = (id: string) => workers.find((w) => w.id === id)?.name ?? id;
  const now = new Date().toISOString();

  // 1. Make sure both weeks exist (generated from the template if they haven't been yet).
  let shifts = getShifts();
  const generated = ensureWeeksGenerated([fromISODate(WEEK), fromISODate(NEXT_WEEK)], shifts, getGeneratedWeeks());
  if (generated) shifts = generated.shifts;

  // The nth shift on a date, in the order the day shows them.
  const slot = (date: string, n: number): Shift => {
    const found = shifts.filter((s) => s.date === date)[n];
    if (!found) throw new Error(`seedCrazyWeek: no shift #${n} on ${date}`);
    return found;
  };
  const put = (shift: Shift, ...ids: string[]) => {
    for (const id of ids) if (!shift.workerIds.includes(id)) shift.workerIds.push(id);
  };

  // 2. Spread the test users across the week.
  const mon1 = slot("2026-10-26", 0), mon2 = slot("2026-10-26", 1);
  const tue1 = slot("2026-10-27", 0), tue2 = slot("2026-10-27", 1);
  const wed1 = slot("2026-10-28", 0), wed2 = slot("2026-10-28", 1);
  const thu1 = slot("2026-10-29", 0), thu2 = slot("2026-10-29", 1);
  const fri1 = slot("2026-10-30", 0), fri2 = slot("2026-10-30", 1);
  const sat1 = slot("2026-10-31", 0), sat2 = slot("2026-10-31", 1);
  const sun1 = slot("2026-11-01", 0);
  const nextMon2 = slot("2026-11-02", 1);
  put(mon1, T1);
  put(mon2, T2);
  put(tue1, T3);
  put(tue2, T4);
  put(wed1, T1, T5);
  put(wed2, T2);
  put(thu1, T3);
  put(thu2, T4);
  put(fri1, T5);
  put(fri2, T1);
  put(sat1, T2);
  put(sat2, T3);
  put(sun1, T4, T5);
  saveShifts(shifts);

  // 3. Finalize the week (so give-aways are allowed and everyone's notified).
  const weekDates = new Set(
    DAYS.map((_, i) => {
      const d = fromISODate(WEEK);
      d.setDate(d.getDate() + i);
      return toISODate(d);
    }),
  );
  savePostedWeeks({
    ...getPostedWeeks(),
    [WEEK]: { postedAt: now, shifts: shifts.filter((s) => weekDates.has(s.date)) },
  });

  // 4. Give-aways, with a mix of offers and passes.
  const answer = (workerId: string, canCover: boolean) => ({ workerId, canCover, at: now });
  const coverage: CoverageRequest[] = [
    { id: "seed-c1", shiftId: mon1.id, requestingWorkerId: T1, note: "Doctor's appointment", responses: [answer(T3, true), answer(T4, false)] },
    { id: "seed-c2", shiftId: wed2.id, requestingWorkerId: T2, note: "Sister's birthday", responses: [answer(T5, true), answer("w4", true), answer("w5", false)] },
    { id: "seed-c3", shiftId: thu1.id, requestingWorkerId: T3 },
    { id: "seed-c4", shiftId: fri1.id, requestingWorkerId: T5, note: "Concert tickets!", responses: [answer(T1, false), answer(T2, false)] },
    { id: "seed-c5", shiftId: sun1.id, requestingWorkerId: T4, note: "Out of town", responses: [answer(T2, true)] },
  ];
  saveCoverageRequests([...getCoverageRequests().filter((r) => !r.id.startsWith("seed-")), ...coverage]);

  // 5. Swaps — same-week ones, plus one that crosses into next week.
  // Two already agreed to by both people (they're waiting on the manager);
  // two still waiting on the other bartender to accept.
  const swaps: SwapRequest[] = [
    { id: "seed-s1", requestingWorkerId: T2, requestingShiftId: mon2.id, targetWorkerId: T4, targetShiftId: tue2.id, status: "awaiting-manager" },
    { id: "seed-s2", requestingWorkerId: T1, requestingShiftId: fri2.id, targetWorkerId: T3, targetShiftId: tue1.id, status: "awaiting-partner" },
    { id: "seed-s3", requestingWorkerId: T5, requestingShiftId: sun1.id, targetWorkerId: T3, targetShiftId: sat2.id, status: "awaiting-partner" },
    { id: "seed-s4", requestingWorkerId: T4, requestingShiftId: thu2.id, targetWorkerId: "w2", targetShiftId: nextMon2.id, status: "awaiting-manager" },
  ];
  saveSwapRequests([...getSwapRequests().filter((r) => !r.id.startsWith("seed-")), ...swaps]);

  // 6. Time off requests to approve or deny — approving Test 1's Friday takes
  // them off their Fri night shift.
  const timeOff: TimeOffRequest[] = [
    { id: "seed-t1", workerId: T3, startDate: "2026-10-31", endDate: "2026-11-01", reason: "Halloween trip", status: "pending" },
    { id: "seed-t2", workerId: T5, startDate: "2026-10-28", endDate: "2026-10-28", reason: "Midterm", status: "pending" },
    { id: "seed-t3", workerId: T2, startDate: "2026-11-01", endDate: "2026-11-01", status: "pending" },
    { id: "seed-t4", workerId: T1, startDate: "2026-10-30", endDate: "2026-10-30", reason: "Wedding", status: "pending" },
  ];
  saveTimeOff([...getTimeOff().filter((r) => !r.id.startsWith("seed-")), ...timeOff]);

  // 7. General availability, so the Exchange list shows "Unavailable" tags.
  const pattern = (off: Day[], notes: Partial<Record<Day, string>> = {}) =>
    Object.fromEntries(DAYS.map((d) => [d, { available: !off.includes(d), note: notes[d] ?? "" }])) as Record<Day, DayAvailability>;
  const availability: Availability[] = [
    { id: "seed-a1", workerId: T1, days: pattern([], { Mon: "after 2pm" }), submittedAt: now },
    { id: "seed-a3", workerId: T3, days: pattern(["Fri"]), submittedAt: now },
    { id: "seed-a5", workerId: T5, days: pattern(["Mon", "Sun"]), submittedAt: now },
  ];
  const seededWorkers = new Set(availability.map((a) => a.workerId));
  saveAvailability([...getAvailability().filter((a) => !seededWorkers.has(a.workerId)), ...availability]);

  // 8. A one-off note for Halloween.
  const events = getDayEvents();
  saveDayEvents({ ...events, dates: { ...events.dates, "2026-10-31": "Halloween Party · Costume Contest" } });

  // 9. The notifications all of the above would have sent.
  const notes: AppNotification[] = [];
  const note = (workerId: string, kind: AppNotification["kind"], text: string, requestId?: string) =>
    notes.push({ id: `seed-n${notes.length}`, workerId, kind, text, requestId, createdAt: now, read: false });
  const weekLabel = formatWeekRange(fromISODate(WEEK));
  for (const w of workers) {
    const theirs = shifts.filter((s) => weekDates.has(s.date) && s.workerIds.includes(w.id));
    note(
      w.id,
      "finalized",
      theirs.length
        ? `The schedule for ${weekLabel} has been finalized. You're on ${theirs.length} shift${theirs.length === 1 ? "" : "s"}: ${theirs.map(describeShift).join("; ")}.`
        : `The schedule for ${weekLabel} has been finalized. You're not on any shifts that week.`,
    );
  }
  for (const r of coverage) {
    const shift = shifts.find((s) => s.id === r.shiftId)!;
    for (const w of workers) {
      if (w.id === r.requestingWorkerId || shift.workerIds.includes(w.id)) continue;
      note(w.id, "needs-coverage", `${name(r.requestingWorkerId)} needs coverage: ${describeShift(shift)}. Can you take it?`, r.id);
    }
    for (const a of r.responses ?? []) {
      note(
        a.workerId,
        "response",
        a.canCover
          ? `You offered to cover ${name(r.requestingWorkerId)}'s shift: ${describeShift(shift)}.`
          : `You passed on ${name(r.requestingWorkerId)}'s shift: ${describeShift(shift)}.`,
        r.id,
      );
      if (a.canCover) note(r.requestingWorkerId, "offer", `${name(a.workerId)} offered to cover your shift: ${describeShift(shift)}!`, r.id);
    }
  }
  for (const sw of swaps.filter((x) => x.status === "awaiting-partner")) {
    const mine = shifts.find((s) => s.id === sw.requestingShiftId)!;
    const theirs = shifts.find((s) => s.id === sw.targetShiftId)!;
    note(
      sw.targetWorkerId,
      "swap",
      `${name(sw.requestingWorkerId)} wants to swap: you'd take ${describeShift(mine)}, they'd take your ${describeShift(theirs)}.`,
      sw.id,
    );
  }
  // Your own answers are already "seen" — they just sit in the bell.
  for (const n of notes) if (n.kind === "response") n.read = true;
  saveNotifications([...notes, ...getNotifications().filter((n) => !n.id.startsWith("seed-"))]);
}

