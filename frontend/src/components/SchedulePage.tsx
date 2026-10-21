import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { eventFor, getDayEvents, saveDayEvents, type DayEvents } from "../data/events";
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
import { addWorker, getWorkers, removeWorker, saveWorkers } from "../data/workers";
import { describeShift, diffShiftNotifications, type PendingNotification } from "../data/notifications";
import type {
  AppNotification,
  Availability,
  CoverageRequest,
  Day,
  DayAvailability,
  PostedWeek,
  Shift,
  SwapRequest,
  TimeOffRequest,
  Worker,
} from "../types";
import { getShiftDrag, isShiftDrag, type DragPayload } from "../utils/dnd";
import {
  displayTimeToInputValue,
  formatPostedAt,
  inputValueToDisplayTime,
} from "../utils/time";
import {
  DAY_FULL_NAMES,
  DAYS,
  dateToDayName,
  formatMonthTitle,
  fromISODate,
  formatShortDate,
  formatWeekRange,
  getDatesForWeek,
  getMondayOfWeek,
  getMonthGrid,
  mondayKeyFor,
  toISODate,
  weekOffsetForDate,
} from "../utils/week";
import { AvailabilityPanel } from "./AvailabilityPanel";
import { BritestarLogo } from "./BritestarLogo";
import { CoverageRequestForm } from "./CoverageRequestForm";
import { DayEventNote } from "./DayEventNote";
import { ManageWorkersPanel } from "./ManageWorkersPanel";
import { CoverageBoard } from "./CoverageBoard";
import { ManagerRequests } from "./ManagerRequests";
import { MonthView } from "./MonthView";
import { NotificationCenter } from "./NotificationCenter";
import { ManagerPostBar, ScheduleInTheWorks, type PostState } from "./PostStatus";
import { SetAvailabilityPanel } from "./SetAvailabilityPanel";
import { ShiftCard, type BartenderMenu, type CoverageHighlight } from "./ShiftCard";
import type { ShiftMenuActions } from "./ShiftContextMenu";
import { StarField } from "./StarField";
import { SwapRequestForm } from "./SwapRequestForm";
import { TimeOffCard } from "./TimeOffCard";
import { Avatar } from "./ui/Avatar";
import { WorkerPickerList } from "./WorkerPickerList";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { MenuDivider, MenuItem, MenuLabel, Popover } from "./ui/Popover";

type ViewMode = "week" | "month";
type RequestTab = "coverage" | "swap" | "availability" | null;

type Snapshot = {
  shifts: Shift[];
  workers: Worker[];
  timeOff: TimeOffRequest[];
  coverageRequests: CoverageRequest[];
  swapRequests: SwapRequest[];
  availability: Availability[];
  dayEvents: DayEvents;
  postedWeeks: Record<string, PostedWeek>;
  notifications: AppNotification[];
};

// When the bar closes, and the rules for auto-timing a newly added shift
// (see suggestNextShiftTime).
const CLOSING_TIME = "2:00 AM";
const NIGHT_SHIFT_FROM = 19 * 60; // starting 7 PM or later: runs to close
const MID_SHIFT_END = 21 * 60; // otherwise ends by 9 PM, when the night crew starts…
const NEW_SHIFT_LENGTH = 4 * 60; // …and is at most 4 hours

/** Minutes since midnight (may exceed 24h for after-midnight times) → "9:00 PM". */
function minutesToDisplayTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return inputValueToDisplayTime(`${hh}:${mm}`);
}

/**
 * How many shifts differ between the posted snapshot and the live week:
 * added, removed, or edited (time, bartenders, day, or position).
 */
function countShiftChanges(posted: Shift[], live: Shift[]): number {
  const postedIndex = new Map(posted.map((s, i) => [s.id, { s, i }]));
  let changes = 0;
  live.forEach((s, i) => {
    const before = postedIndex.get(s.id);
    if (!before) changes++;
    else if (JSON.stringify(before.s) !== JSON.stringify(s) || before.i !== i) changes++;
    postedIndex.delete(s.id);
  });
  return changes + postedIndex.size;
}

export function SchedulePage() {
  const [searchParams] = useSearchParams();
  const isAdmin = searchParams.get("role") === "admin";

  const [workers, setWorkersRaw] = useState<Worker[]>(() => getWorkers());
  const [shifts, setShiftsRaw] = useState<Shift[]>(() => getShifts());
  const [timeOff, setTimeOffRaw] = useState<TimeOffRequest[]>(() => getTimeOff());
  const [coverageRequests, setCoverageRequestsRaw] = useState<CoverageRequest[]>(() =>
    getCoverageRequests(),
  );
  const [swapRequests, setSwapRequestsRaw] = useState<SwapRequest[]>(() => getSwapRequests());
  const [availability, setAvailabilityRaw] = useState<Availability[]>(() => getAvailability());
  // getShifts() above may seed this on a fresh browser/migration — read it
  // after, so that seeded value is picked up rather than a stale empty [].
  const [generatedWeeks, setGeneratedWeeks] = useState<string[]>(() => getGeneratedWeeks());
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [resolveConfirm, setResolveConfirm] = useState<CoverageRequest | null>(null);
  const [dismissConfirm, setDismissConfirm] = useState<CoverageRequest | null>(null);
  const [dayEvents, setDayEventsRaw] = useState<DayEvents>(() => getDayEvents());

  const [postedWeeks, setPostedWeeksRaw] = useState<Record<string, PostedWeek>>(() => getPostedWeeks());
  const [notifications, setNotificationsRaw] = useState<AppNotification[]>(() => getNotifications());

  function setNotifications(next: AppNotification[] | ((current: AppNotification[]) => AppNotification[])) {
    setNotificationsRaw((current) => {
      const resolved =
        typeof next === "function" ? (next as (c: AppNotification[]) => AppNotification[])(current) : next;
      saveNotifications(resolved);
      return resolved;
    });
  }

  function notify(pending: PendingNotification[]) {
    if (pending.length === 0) return;
    const createdAt = new Date().toISOString();
    const fresh = pending.map((p, i) => ({
      ...p,
      id: `n${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt,
      read: false,
    }));
    setNotifications((current) => [...fresh, ...current].slice(0, 200));
  }

  function setPostedWeeks(next: Record<string, PostedWeek>) {
    savePostedWeeks(next);
    setPostedWeeksRaw(next);
  }

  function setDayEvents(next: DayEvents) {
    saveDayEvents(next);
    setDayEventsRaw(next);
  }

  // Every update to these four pieces of state also persists to localStorage
  // (see data/scheduleStore.ts) — otherwise logging out and back in would
  // reset the whole schedule, since that unmounts this component.
  function setWorkers(next: Worker[] | ((current: Worker[]) => Worker[])) {
    setWorkersRaw((current) => {
      const resolved = typeof next === "function" ? (next as (c: Worker[]) => Worker[])(current) : next;
      saveWorkers(resolved);
      return resolved;
    });
  }
  // Every manager edit to shifts goes through here. Besides saving, it diffs
  // the old schedule against the new one to notify affected bartenders (on
  // finalized weeks only) and to close give-away requests that just got
  // covered. It resolves against this render's `shifts` rather than a state
  // updater on purpose: React may run updaters twice in dev, which would
  // send every notification twice.
  function setShifts(next: Shift[] | ((current: Shift[]) => Shift[])) {
    const resolved = typeof next === "function" ? (next as (c: Shift[]) => Shift[])(shifts) : next;
    saveShifts(resolved);
    setShiftsRaw(resolved);

    const { notifications: pending, resolvedRequestIds } = diffShiftNotifications({
      before: shifts,
      after: resolved,
      isFinalized: (date) => mondayKeyFor(date) in postedWeeks,
      coverageRequests,
      nameOf: (id) => workers.find((w) => w.id === id)?.name ?? "someone",
    });
    notify(pending);
    if (resolvedRequestIds.length > 0) {
      setCoverageRequests((current) => current.filter((r) => !resolvedRequestIds.includes(r.id)));
    }
  }
  function setTimeOff(next: TimeOffRequest[] | ((current: TimeOffRequest[]) => TimeOffRequest[])) {
    setTimeOffRaw((current) => {
      const resolved =
        typeof next === "function" ? (next as (c: TimeOffRequest[]) => TimeOffRequest[])(current) : next;
      saveTimeOff(resolved);
      return resolved;
    });
  }
  function setCoverageRequests(
    next: CoverageRequest[] | ((current: CoverageRequest[]) => CoverageRequest[]),
  ) {
    setCoverageRequestsRaw((current) => {
      const resolved =
        typeof next === "function"
          ? (next as (c: CoverageRequest[]) => CoverageRequest[])(current)
          : next;
      saveCoverageRequests(resolved);
      return resolved;
    });
  }
  function setSwapRequests(next: SwapRequest[] | ((current: SwapRequest[]) => SwapRequest[])) {
    setSwapRequestsRaw((current) => {
      const resolved =
        typeof next === "function" ? (next as (c: SwapRequest[]) => SwapRequest[])(current) : next;
      saveSwapRequests(resolved);
      return resolved;
    });
  }
  function setAvailability(next: Availability[] | ((current: Availability[]) => Availability[])) {
    setAvailabilityRaw((current) => {
      const resolved =
        typeof next === "function" ? (next as (c: Availability[]) => Availability[])(current) : next;
      saveAvailability(resolved);
      return resolved;
    });
  }

  const loggedInUsername = searchParams.get("worker");
  const currentWorker =
    workers.find((w) => w.username === loggedInUsername) ?? workers[0];

  const [requestTab, setRequestTab] = useState<RequestTab>(null);
  const [showManageWorkers, setShowManageWorkers] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [dayMenu, setDayMenu] = useState<{ x: number; y: number; date: string; label: string } | null>(
    null,
  );
  // The day column a whole shift card is currently being dragged over, for
  // highlighting where it'll land.
  const [shiftDragOverDate, setShiftDragOverDate] = useState<string | null>(null);

  // A drag cancelled with Escape or dropped outside any column never fires
  // that column's dragleave/drop, so clear the highlight when any drag ends.
  useEffect(() => {
    const clear = () => setShiftDragOverDate(null);
    document.addEventListener("dragend", clear);
    return () => document.removeEventListener("dragend", clear);
  }, []);

  const monday = getMondayOfWeek(weekOffset);
  const weekDates = getDatesForWeek(monday);

  // Populate whichever week(s) are currently visible the first time they're
  // seen, from the template — a week that's already been generated is never
  // touched again, so edits/deletions in it are permanent and don't leak
  // into other weeks.
  useEffect(() => {
    const mondaysNeeded =
      viewMode === "week"
        ? [getMondayOfWeek(weekOffset)]
        : getMonthGrid(monthOffset).map((week) => week[0]);
    const result = ensureWeeksGenerated(mondaysNeeded, shifts, generatedWeeks);
    if (result) {
      setShiftsRaw(result.shifts);
      setGeneratedWeeks(result.generatedWeeks);
    }
    // shifts/generatedWeeks are intentionally excluded: this effect only
    // needs to re-run when the visible week/month changes, not on every
    // shift edit (ensureWeeksGenerated already reads the latest via args).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, weekOffset, monthOffset]);

  function pushHistory() {
    setHistory((h) => [
      ...h.slice(-19),
      {
        shifts,
        workers,
        timeOff,
        coverageRequests,
        swapRequests,
        availability,
        dayEvents,
        postedWeeks,
        notifications,
      },
    ]);
  }

  function handleUndo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      // Restored directly (not via setShifts), so undoing doesn't send a
      // fresh round of notifications — and the ones the undone change sent
      // are rolled back along with everything else.
      saveShifts(last.shifts);
      setShiftsRaw(last.shifts);
      setNotifications(last.notifications);
      setWorkers(last.workers);
      setTimeOff(last.timeOff);
      setCoverageRequests(last.coverageRequests);
      setSwapRequests(last.swapRequests);
      setAvailability(last.availability);
      setDayEvents(last.dayEvents);
      setPostedWeeks(last.postedWeeks);
      return h.slice(0, -1);
    });
  }

  function handleAddWorker(username: string) {
    pushHistory();
    setWorkers((current) => addWorker(username, current));
  }

  // Removing someone from the roster ends their account and opens up any
  // shifts they had from today on. Past shifts are left alone as history.
  function handleRemoveWorker(workerId: string) {
    pushHistory();
    const today = toISODate(new Date());
    setShifts((current) =>
      current.map((s) =>
        s.date >= today && s.workerIds.includes(workerId)
          ? { ...s, workerIds: s.workerIds.filter((id) => id !== workerId) }
          : s,
      ),
    );
    setWorkers((current) => removeWorker(workerId, current));
  }

  function handleReorderWorker(workerId: string, targetId: string, side: "before" | "after") {
    if (workerId === targetId) return;
    pushHistory();
    setWorkers((current) => {
      const moving = current.find((w) => w.id === workerId);
      if (!moving) return current;
      const rest = current.filter((w) => w.id !== workerId);
      const i = rest.findIndex((w) => w.id === targetId);
      const at = i < 0 ? rest.length : side === "before" ? i : i + 1;
      return [...rest.slice(0, at), moving, ...rest.slice(at)];
    });
  }

  // Renames everywhere — manager view and the bartender's own. Their login
  // (username) stays the same.
  function handleRenameWorker(workerId: string, name: string) {
    pushHistory();
    setWorkers((current) => current.map((w) => (w.id === workerId ? { ...w, name, nameClaimed: true } : w)));
  }

  function handleAddWorkerToShift(shiftId: string, workerId: string) {
    pushHistory();
    setShifts((current) =>
      current.map((shift) =>
        shift.id === shiftId
          ? { ...shift, workerIds: [...shift.workerIds, workerId] }
          : shift,
      ),
    );
  }

  function handleRemoveWorkerFromShift(shiftId: string, workerId: string) {
    pushHistory();
    setShifts((current) =>
      current.map((shift) =>
        shift.id === shiftId
          ? { ...shift, workerIds: shift.workerIds.filter((id) => id !== workerId) }
          : shift,
      ),
    );
  }

  function handleSetShiftTime(shiftId: string, start: string, end: string) {
    pushHistory();
    setShifts((current) =>
      current.map((shift) => (shift.id === shiftId ? { ...shift, start, end } : shift)),
    );
  }

  function handleClearShiftWorkers(shiftId: string) {
    pushHistory();
    setShifts((current) =>
      current.map((shift) => (shift.id === shiftId ? { ...shift, workerIds: [] } : shift)),
    );
  }

  function handleDeleteShift(shiftId: string) {
    pushHistory();
    setShifts((current) => current.filter((shift) => shift.id !== shiftId));
  }

  // Same time slot, nobody on it — duplicating the bartenders too would put
  // the same person behind the bar twice at once.
  function handleDuplicateShift(shiftId: string) {
    pushHistory();
    setShifts((current) => {
      const source = current.find((s) => s.id === shiftId);
      if (!source) return current;
      return [...current, { ...source, id: `s${Date.now()}`, workerIds: [] }];
    });
  }

  function workersOffOn(date: string): string[] {
    return timeOff
      .filter((r) => r.status === "approved" && date >= r.startDate && date <= r.endDate)
      .map((r) => r.workerId);
  }

  function handleCopyShiftToDates(shiftId: string, dates: string[]) {
    pushHistory();
    setShifts((current) => {
      const source = current.find((s) => s.id === shiftId);
      if (!source) return current;
      const copies = dates.map((date, i) => {
        const off = workersOffOn(date);
        return {
          id: `s${Date.now()}-${i}`,
          date,
          start: source.start,
          end: source.end,
          workerIds: source.workerIds.filter((id) => !off.includes(id)),
        };
      });
      return [...current, ...copies];
    });
  }

  // A day's shifts display in the order they sit in the `shifts` array, so
  // moving one is just pulling it out and splicing it back in at the new
  // spot (taking the target's date, in case it came from another day).
  function moveShift(shiftId: string, toDate: string, findIndex: (rest: Shift[]) => number) {
    pushHistory();
    setShifts((current) => {
      const moving = current.find((s) => s.id === shiftId);
      if (!moving) return current;
      const rest = current.filter((s) => s.id !== shiftId);
      const index = findIndex(rest);
      const at = index < 0 ? rest.length : index;
      const moved = { ...moving, date: toDate };
      const next = [...rest.slice(0, at), moved, ...rest.slice(at)];

      // Dropped between two shifts with a gap between them (e.g. between
      // 1–5:30 and 8:30–2)? Stretch it to fill exactly that gap (5:30–8:30).
      const day = next.filter((s) => s.date === toDate);
      const pos = day.indexOf(moved);
      const before = day[pos - 1];
      const after = day[pos + 1];
      if (before && after && sortMinutes(after.start) > sortMinutes(before.end)) {
        moved.start = before.end;
        moved.end = after.start;
      }
      return next;
    });
  }

  function handleMoveShiftNextTo(shiftId: string, targetShiftId: string, position: "before" | "after") {
    const target = shifts.find((s) => s.id === targetShiftId);
    if (!target || shiftId === targetShiftId) return;
    moveShift(shiftId, target.date, (rest) => {
      const i = rest.findIndex((s) => s.id === targetShiftId);
      return position === "before" ? i : i + 1;
    });
  }

  function handleMoveShiftToDay(shiftId: string, date: string) {
    moveShift(shiftId, date, (rest) => {
      const lastOfDay = rest.findLastIndex((s) => s.date === date);
      return lastOfDay < 0 ? -1 : lastOfDay + 1;
    });
  }

  // Early-morning starts (before 5 AM) sort after late-night ones, so a
  // 2 AM shift lands after the 8:30 PM one instead of first thing.
  function sortMinutes(display: string): number {
    const [h, m] = displayTimeToInputValue(display).split(":").map(Number);
    const minutes = h * 60 + m;
    return minutes < 5 * 60 ? minutes + 24 * 60 : minutes;
  }

  function handleSortDay(date: string) {
    pushHistory();
    setShifts((current) => {
      const sorted = current
        .filter((s) => s.date === date)
        .sort((a, b) => sortMinutes(a.start) - sortMinutes(b.start) || sortMinutes(a.end) - sortMinutes(b.end));
      // Drop the sorted shifts back into the same array slots that day
      // already occupied, leaving every other day untouched.
      let next = 0;
      return current.map((s) => (s.date === date ? sorted[next++] : s));
    });
  }

  function handleSaveWeeklyEvent(day: Day, text: string) {
    pushHistory();
    setDayEvents({ ...dayEvents, weekly: { ...dayEvents.weekly, [day]: text } });
  }

  function handleSaveOneOffEvent(date: string, text: string) {
    pushHistory();
    setDayEvents({ ...dayEvents, dates: { ...dayEvents.dates, [date]: text } });
  }

  function handleResetEventToWeekly(date: string) {
    pushHistory();
    const { [date]: _removed, ...rest } = dayEvents.dates;
    setDayEvents({ ...dayEvents, dates: rest });
  }

  function handleClearDayWorkers(date: string) {
    pushHistory();
    setShifts((current) =>
      current.map((shift) => (shift.date === date ? { ...shift, workerIds: [] } : shift)),
    );
  }

  function handleDeleteDayShifts(date: string) {
    pushHistory();
    setShifts((current) => current.filter((shift) => shift.date !== date));
  }

  // A new shift picks up where the day's latest shift ends. From 7 PM on it
  // runs to close (1–8:30 → 8:30–2); earlier it's a mid shift ending at 9 PM,
  // at most 4 hours long (1–5 → 5–9, 1–6 → 6–9, 12–3 → 3–7).
  // If the latest shift already runs to close, the new one copies its times
  // (an extra closer). An empty day gets the plain default.
  function suggestNextShiftTime(date: string, current: Shift[]): { start: string; end: string } {
    const dayShifts = current.filter((s) => s.date === date);
    if (dayShifts.length === 0) return { start: "12:00 PM", end: "5:00 PM" };

    const latest = dayShifts.reduce((a, b) => (sortMinutes(b.end) > sortMinutes(a.end) ? b : a));
    const start = sortMinutes(latest.end);
    const close = sortMinutes(CLOSING_TIME);
    if (start >= close) return { start: latest.start, end: latest.end };

    const end =
      start >= NIGHT_SHIFT_FROM ? close : Math.min(start + NEW_SHIFT_LENGTH, MID_SHIFT_END);
    return { start: latest.end, end: minutesToDisplayTime(end) };
  }

  function handleAddShift(date: string) {
    pushHistory();
    setShifts((current) => [
      ...current,
      { id: `s${Date.now()}`, date, ...suggestNextShiftTime(date, current), workerIds: [] },
    ]);
  }

  function handleDropOnShift(payload: DragPayload, targetShiftId: string) {
    pushHistory();
    setShifts((current) => {
      let updated = current;
      if (payload.source === "shift" && payload.shiftId !== targetShiftId) {
        updated = updated.map((s) =>
          s.id === payload.shiftId
            ? { ...s, workerIds: s.workerIds.filter((id) => id !== payload.workerId) }
            : s,
        );
      }
      updated = updated.map((s) =>
        s.id === targetShiftId && !s.workerIds.includes(payload.workerId)
          ? { ...s, workerIds: [...s.workerIds, payload.workerId] }
          : s,
      );
      return updated;
    });
  }

  function handleDropOnWorker(payload: DragPayload, targetShiftId: string, targetWorkerId: string) {
    if (payload.workerId === targetWorkerId) return;
    if (payload.source !== "shift") {
      handleDropOnShift(payload, targetShiftId);
      return;
    }
    pushHistory();
    const sourceShiftId = payload.shiftId;
    setShifts((current) =>
      current.map((s) => {
        if (s.id === sourceShiftId && s.id === targetShiftId) return s;
        if (s.id === sourceShiftId) {
          return {
            ...s,
            workerIds: s.workerIds.filter((id) => id !== payload.workerId).concat(targetWorkerId),
          };
        }
        if (s.id === targetShiftId) {
          return {
            ...s,
            workerIds: s.workerIds.filter((id) => id !== targetWorkerId).concat(payload.workerId),
          };
        }
        return s;
      }),
    );
  }

  function handleRequestTimeOff(startDate: string, endDate: string, reason: string) {
    pushHistory();
    setTimeOff((current) => [
      ...current,
      {
        id: `t${Date.now()}`,
        workerId: currentWorker.id,
        startDate,
        endDate,
        reason: reason || undefined,
        status: "pending",
      },
    ]);
  }

  function handleCancelTimeOff(requestId: string) {
    pushHistory();
    setTimeOff((current) => current.filter((r) => r.id !== requestId));
  }

  function handleSubmitAvailability(days: Record<Day, DayAvailability>) {
    pushHistory();
    setAvailability((current) => {
      const withoutMine = current.filter((a) => a.workerId !== currentWorker.id);
      return [
        ...withoutMine,
        {
          id: `av${Date.now()}`,
          workerId: currentWorker.id,
          days,
          submittedAt: new Date().toISOString(),
        },
      ];
    });
    setRequestTab(null);
  }

  function handleApproveTimeOff(requestId: string) {
    pushHistory();
    // Note: we don't auto-remove the worker from that day's shift here.
    // Shifts are a recurring weekly template with no date of their own, so
    // there's no way to pull someone off just the one dated occurrence
    // without also affecting every other week's copy of that shift. The
    // approved Time Off card will show alongside their shift that day —
    // remove them from it by hand (✕) if they shouldn't be on it that week.
    setTimeOff((current) =>
      current.map((r) => (r.id === requestId ? { ...r, status: "approved" } : r)),
    );
  }

  function handleDenyTimeOff(requestId: string) {
    pushHistory();
    setTimeOff((current) => current.filter((r) => r.id !== requestId));
  }

  function handleRequestCoverage(shiftId: string, note: string) {
    pushHistory();
    setCoverageRequests((current) => [
      ...current,
      { id: `c${Date.now()}`, shiftId, requestingWorkerId: currentWorker.id, note: note || undefined },
    ]);
    // Everyone who could take it hears about it — not the requester, and not
    // anyone already on that shift.
    const shift = shifts.find((s) => s.id === shiftId);
    if (shift) {
      notify(
        workers
          .filter((w) => w.id !== currentWorker.id && !shift.workerIds.includes(w.id))
          .map((w) => ({
            workerId: w.id,
            kind: "needs-coverage" as const,
            text: `${currentWorker.name} needs coverage: ${describeShift(shift)}. Can you take it?`,
          })),
      );
    }
    setRequestTab(null);
  }

  // A bartender answers someone's give-away request. null takes back their
  // answer. Saying "I can cover" lets the requester know right away.
  function handleRespondCoverage(requestId: string, canCover: boolean | null) {
    const request = coverageRequests.find((r) => r.id === requestId);
    if (!request) return;
    pushHistory();
    const others = (request.responses ?? []).filter((x) => x.workerId !== currentWorker.id);
    const responses =
      canCover === null
        ? others
        : [...others, { workerId: currentWorker.id, canCover, at: new Date().toISOString() }];
    setCoverageRequests((current) => current.map((r) => (r.id === requestId ? { ...r, responses } : r)));

    const shift = shifts.find((s) => s.id === request.shiftId);
    const requesterName = workers.find((w) => w.id === request.requestingWorkerId)?.name ?? "someone";
    setNotifications((current) => {
      const rest = current.filter(
        (n) => !(n.workerId === currentWorker.id && n.kind === "response" && n.requestId === requestId),
      );
      if (canCover === null || !shift) return rest;
      const mine: AppNotification = {
        id: `n${Date.now()}-resp`,
        workerId: currentWorker.id,
        kind: "response",
        requestId,
        read: true,
        createdAt: new Date().toISOString(),
        text: canCover
          ? `You offered to cover ${requesterName}'s shift: ${describeShift(shift)}.`
          : `You passed on ${requesterName}'s shift: ${describeShift(shift)}.`,
      };
      return [mine, ...rest];
    });
    if (canCover && shift) {
      notify([
        {
          workerId: request.requestingWorkerId,
          kind: "offer",
          text: `${currentWorker.name} offered to cover your shift: ${describeShift(shift)}!`,
        },
      ]);
    }
  }

  // Who can swap in for a give-away (minus the requester, anyone already on
  // the shift, and anyone with approved time off that day), each flagged:
  // offered to cover, said they can't, or usually unavailable that weekday
  // per their general availability. Ordered best bets first.
  function exchangeCandidates(request: CoverageRequest): { candidates: Worker[]; flags: Record<string, ExchangeFlag> } {
    const shift = shifts.find((s) => s.id === request.shiftId);
    if (!shift) return { candidates: [], flags: {} };
    const weekday = dateToDayName(fromISODate(shift.date));
    const off = workersOffOn(shift.date);
    const flags: Record<string, ExchangeFlag> = {};
    for (const a of request.responses ?? []) flags[a.workerId] = a.canCover ? "offered" : "cant";
    for (const a of availability) {
      if (!flags[a.workerId] && a.days[weekday]?.available === false) flags[a.workerId] = "unavailable";
    }
    const rank = (w: Worker) => ({ offered: 0, unavailable: 2, cant: 3 })[flags[w.id] as ExchangeFlag] ?? 1;
    const candidates = workers
      .filter((w) => !shift.workerIds.includes(w.id) && !off.includes(w.id))
      .sort((x, y) => rank(x) - rank(y));
    return { candidates, flags };
  }

  // How a shift card looks/acts when someone's giving it away. Managers see
  // amber + the offer count. Bartenders see amber (green if they offered),
  // and — for shifts today or later — a right-click / press-and-hold menu
  // to answer or change their answer.
  function coverageFor(shift: Shift): { coverage?: CoverageHighlight; bartenderMenu?: BartenderMenu } {
    const req = coverageRequests.find((r) => r.shiftId === shift.id);
    if (!req) return {};
    const answers = req.responses ?? [];
    if (isAdmin) {
      const offers = answers.filter((a) => a.canCover).length;
      return {
        coverage: {
          tone: "amber",
          label: offers ? `Needs coverage · ${offers} offer${offers === 1 ? "" : "s"}` : "Needs coverage",
        },
      };
    }

    const mine = req.requestingWorkerId === currentWorker.id;
    const answer = answers.find((a) => a.workerId === currentWorker.id);
    const coverage: CoverageHighlight = mine
      ? { tone: "amber", label: "Giving away" }
      : answer?.canCover
        ? { tone: "green", label: "You offered" }
        : { tone: "amber", label: answer ? "Needs coverage · passed" : "Needs coverage" };

    if (shift.date < todayISO) return { coverage };
    if (mine) {
      return {
        coverage,
        bartenderMenu: {
          title: "Your give-away request",
          subtitle: describeShift(shift),
          items: [{ label: "Cancel my request", icon: "✕", danger: true, onClick: () => handleRemoveCoverageRequest(req.id) }],
        },
      };
    }
    if (shift.workerIds.includes(currentWorker.id)) return { coverage };
    const requester = workers.find((w) => w.id === req.requestingWorkerId)?.name ?? "Someone";
    return {
      coverage,
      bartenderMenu: {
        title: `${requester} needs coverage`,
        subtitle: describeShift(shift),
        items: [
          { label: "I can cover", icon: "♥", checked: answer?.canCover === true, onClick: () => handleRespondCoverage(req.id, true) },
          { label: "Can't cover", icon: "–", checked: answer?.canCover === false, onClick: () => handleRespondCoverage(req.id, false) },
          ...(answer ? [{ label: "Clear my answer", icon: "↺", onClick: () => handleRespondCoverage(req.id, null) }] : []),
        ],
      },
    };
  }

  // Manager accepts an offer: the volunteer takes the requester's place in
  // one step. The shift diff in setShifts then sends "you've been covered" /
  // "you've been added to cover" and closes the request.
  function handleAssignCover(request: CoverageRequest, workerId: string) {
    pushHistory();
    setShifts((current) =>
      current.map((s) =>
        s.id === request.shiftId
          ? {
              ...s,
              workerIds: [
                ...s.workerIds.filter((id) => id !== request.requestingWorkerId && id !== workerId),
                workerId,
              ],
            }
          : s,
      ),
    );
  }

  // "Mark resolved" on a give-away request: if the person who asked is still
  // on that shift, it isn't really covered yet — check with the manager first.
  function handleResolveCoverage(request: CoverageRequest) {
    const shift = shifts.find((s) => s.id === request.shiftId);
    if (shift?.workerIds.includes(request.requestingWorkerId)) setResolveConfirm(request);
    else handleRemoveCoverageRequest(request.id);
  }

  // Closing a request while they're still on the shift — let them know
  // they're still working it.
  function handleCloseCoverageRequest(request: CoverageRequest, how: "resolved" | "dismissed") {
    const shift = shifts.find((s) => s.id === request.shiftId);
    handleRemoveCoverageRequest(request.id);
    if (shift?.workerIds.includes(request.requestingWorkerId)) {
      notify([
        {
          workerId: request.requestingWorkerId,
          kind: "request",
          text:
            how === "dismissed"
              ? `Your request to give away ${describeShift(shift)} was dismissed. You're still on it.`
              : `Your give-away request for ${describeShift(shift)} was closed. You're still on it.`,
        },
      ]);
    }
  }

  function handleRemoveCoverageRequest(requestId: string) {
    pushHistory();
    setCoverageRequests((current) => current.filter((r) => r.id !== requestId));
  }

  function handleRequestSwap(myShiftId: string, targetWorkerId: string, targetShiftId: string) {
    pushHistory();
    setSwapRequests((current) => [
      ...current,
      {
        id: `sw${Date.now()}`,
        requestingWorkerId: currentWorker.id,
        requestingShiftId: myShiftId,
        targetWorkerId,
        targetShiftId,
      },
    ]);
    setRequestTab(null);
  }

  function handleApproveSwap(request: SwapRequest) {
    pushHistory();
    setShifts((current) =>
      current.map((s) => {
        if (s.id === request.requestingShiftId) {
          return {
            ...s,
            workerIds: s.workerIds
              .filter((id) => id !== request.requestingWorkerId)
              .concat(request.targetWorkerId),
          };
        }
        if (s.id === request.targetShiftId) {
          return {
            ...s,
            workerIds: s.workerIds
              .filter((id) => id !== request.targetWorkerId)
              .concat(request.requestingWorkerId),
          };
        }
        return s;
      }),
    );
    setSwapRequests((current) => current.filter((r) => r.id !== request.id));
  }

  function handleDenySwap(requestId: string) {
    pushHistory();
    setSwapRequests((current) => current.filter((r) => r.id !== requestId));
  }

  function handleSelectDateFromMonth(date: Date) {
    setWeekOffset(weekOffsetForDate(date));
    setViewMode("week");
  }

  // ---- Posting -------------------------------------------------------
  const weekKey = toISODate(monday);
  const weekLabel = formatWeekRange(monday);
  const weekDateSet = new Set(DAYS.map((d) => toISODate(weekDates[d])));
  const liveWeekShifts = shifts.filter((s) => weekDateSet.has(s.date));
  const postedWeek: PostedWeek | undefined = postedWeeks[weekKey];
  const changeCount = postedWeek ? countShiftChanges(postedWeek.shifts, liveWeekShifts) : 0;
  const postState: PostState = !postedWeek ? "draft" : changeCount === 0 ? "posted" : "changed";

  function handlePostWeek() {
    pushHistory();
    // The first time a week is finalized, every bartender hears about it —
    // with their own shifts listed, or a heads-up that they're not on it.
    // (A later "Finalize changes" stays quiet: each edit already notified.)
    if (!postedWeek) {
      notify(
        workers.map((w) => {
          const theirs = liveWeekShifts.filter((s) => s.workerIds.includes(w.id));
          return {
            workerId: w.id,
            kind: "finalized" as const,
            text:
              theirs.length > 0
                ? `The schedule for ${weekLabel} has been finalized. You're on ${theirs.length} shift${
                    theirs.length === 1 ? "" : "s"
                  }: ${theirs.map(describeShift).join("; ")}.`
                : `The schedule for ${weekLabel} has been finalized. You're not on any shifts that week.`,
          };
        }),
      );
    }
    setPostedWeeks({
      ...postedWeeks,
      [weekKey]: { postedAt: new Date().toISOString(), shifts: liveWeekShifts },
    });
  }

  function handleUnpostWeek() {
    pushHistory();
    const { [weekKey]: _removed, ...rest } = postedWeeks;
    setPostedWeeks(rest);
  }

  // Bartenders see the live schedule too — a week that isn't finalized yet
  // is just shown blurred, with an "in the works" note over it.
  const weekInTheWorks = !isAdmin && !postedWeek;

  const myShifts = shifts.filter((s) => s.workerIds.includes(currentWorker.id));

  // Only shifts worth giving away: today or later (no past clutter), on a
  // week the manager has finalized, and not already up for grabs.
  const todayISO = toISODate(new Date());
  const alreadyOffered = new Set(
    coverageRequests.filter((r) => r.requestingWorkerId === currentWorker.id).map((r) => r.shiftId),
  );
  const giveAwayShifts = myShifts
    .filter(
      (s) => s.date >= todayISO && mondayKeyFor(s.date) in postedWeeks && !alreadyOffered.has(s.id),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || sortMinutes(a.start) - sortMinutes(b.start));

  const shiftMenuActions: ShiftMenuActions = {
    onAddWorker: handleAddWorkerToShift,
    onRemoveWorker: handleRemoveWorkerFromShift,
    onClearWorkers: handleClearShiftWorkers,
    onSetTime: handleSetShiftTime,
    onDuplicate: handleDuplicateShift,
    onCopyToDates: handleCopyShiftToDates,
    onDeleteShift: handleDeleteShift,
  };
  const dayMenuShifts = dayMenu ? shifts.filter((s) => s.date === dayMenu.date) : [];


  return (
    <div className="min-h-screen bg-brite-black">
      <StarField seed={viewMode === "week" ? toISODate(monday) : `month:${monthOffset}`} />
      {/* relative: positioned so it paints above the fixed star layer. */}
      <header className="relative flex items-center justify-between border-b border-brite-tan/10 px-6 py-3.5">
        <BritestarLogo />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold text-brite-white">
              {isAdmin ? "Manager View" : currentWorker.name}
            </div>
            <div className="text-xs text-brite-tan/50">
              {isAdmin ? "Full schedule control" : "Bartender"}
            </div>
          </div>
          {!isAdmin && (
            <NotificationCenter
              notifications={notifications.filter((n) => n.workerId === currentWorker.id)}
              onMarkAllRead={() =>
                setNotifications((current) =>
                  current.map((n) => (n.workerId === currentWorker.id ? { ...n, read: true } : n)),
                )
              }
              onClearAll={() =>
                setNotifications((current) => current.filter((n) => n.workerId !== currentWorker.id))
              }
              actionsFor={(n) => {
                if (n.kind !== "response" || !n.requestId) return null;
                const req = coverageRequests.find((r) => r.id === n.requestId);
                const shift = req && shifts.find((s) => s.id === req.shiftId);
                if (!req || !shift) {
                  return <span className="text-[11px] italic text-brite-tan/35">This request is closed.</span>;
                }
                if (shift.date < todayISO) return null;
                const offered = (req.responses ?? []).some((a) => a.workerId === currentWorker.id && a.canCover);
                return (
                  <button
                    type="button"
                    onClick={() => handleRespondCoverage(req.id, !offered)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                      offered
                        ? "border-brite-tan/25 text-brite-tan/70 hover:border-brite-tan/60"
                        : "border-brite-green/40 text-brite-green hover:bg-brite-green/10"
                    }`}
                  >
                    {offered ? "Can't make it after all" : "Actually, I can cover"}
                  </button>
                );
              }}
            />
          )}
          <Avatar
            name={isAdmin ? "Manager" : currentWorker.name}
            color={isAdmin ? "#ab3131" : currentWorker.avatarColor}
          />
          <Link
            to="/"
            className="ml-2 text-xs font-semibold text-brite-tan/50 hover:text-brite-tan"
          >
            Log out
          </Link>
        </div>
      </header>

      <main className="relative p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {viewMode === "week" ? (
              <>
                <button
                  type="button"
                  onClick={() => setWeekOffset((w) => w - 1)}
                  className="rounded-md border border-brite-tan/15 px-2.5 py-1 text-sm text-brite-tan/70 hover:border-brite-tan/40 hover:text-brite-tan"
                  aria-label="Previous week"
                >
                  ←
                </button>
                <div>
                  <h1 className="text-base font-bold text-brite-white">
                    {weekOffset === 0 ? "This Week" : formatWeekRange(monday)}
                  </h1>
                  {weekOffset !== 0 && (
                    <button
                      type="button"
                      onClick={() => setWeekOffset(0)}
                      className="text-xs text-brite-tan/50 hover:text-brite-tan"
                    >
                      Back to this week
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setWeekOffset((w) => w + 1)}
                  className="rounded-md border border-brite-tan/15 px-2.5 py-1 text-sm text-brite-tan/70 hover:border-brite-tan/40 hover:text-brite-tan"
                  aria-label="Next week"
                >
                  →
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMonthOffset((m) => m - 1)}
                  className="rounded-md border border-brite-tan/15 px-2.5 py-1 text-sm text-brite-tan/70 hover:border-brite-tan/40 hover:text-brite-tan"
                  aria-label="Previous month"
                >
                  ←
                </button>
                <h1 className="text-base font-bold text-brite-white">{formatMonthTitle(monthOffset)}</h1>
                <button
                  type="button"
                  onClick={() => setMonthOffset((m) => m + 1)}
                  className="rounded-md border border-brite-tan/15 px-2.5 py-1 text-sm text-brite-tan/70 hover:border-brite-tan/40 hover:text-brite-tan"
                  aria-label="Next month"
                >
                  →
                </button>
              </>
            )}

            <div className="ml-1 flex rounded-lg bg-brite-black-soft/60 p-1">
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  viewMode === "week"
                    ? "bg-brite-red text-brite-white"
                    : "text-brite-tan/60 hover:text-brite-tan"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  viewMode === "month"
                    ? "bg-brite-red text-brite-white"
                    : "text-brite-tan/60 hover:text-brite-tan"
                }`}
              >
                Month
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={handleUndo}
                disabled={history.length === 0}
                className="rounded-lg border border-brite-tan/15 px-3 py-2 text-xs font-semibold text-brite-tan/70 hover:border-brite-tan/40 hover:text-brite-tan disabled:opacity-30"
              >
                ↺ Undo
              </button>
            )}
            {isAdmin && (
              <Button
                variant="ghost"
                className="w-auto px-4"
                onClick={() => setShowManageWorkers((v) => !v)}
              >
                {showManageWorkers ? "Hide bartenders" : "Manage bartenders"}
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="ghost"
                className="w-auto px-4"
                onClick={() => setShowAvailability((v) => !v)}
              >
                {showAvailability ? "Hide availability" : "View availability"}
              </Button>
            )}
            {isAdmin && viewMode === "week" && (
              <ManagerPostBar
                state={postState}
                postedAt={postedWeek?.postedAt}
                changeCount={changeCount}
                weekLabel={weekLabel}
                onPost={handlePostWeek}
                onUnpost={handleUnpostWeek}
              />
            )}
            {!isAdmin &&
              (
                [
                  ["availability", "Set availability"],
                  ["coverage", "Give away shift"],
                  ["swap", "Swap shift"],
                ] as const
              ).map(([tab, label]) => (
                <Button
                  key={tab}
                  variant="ghost"
                  className={`w-auto px-4 ${
                    requestTab === tab ? "border-brite-amber text-brite-amber hover:border-brite-amber" : ""
                  }`}
                  onClick={() => setRequestTab(requestTab === tab ? null : tab)}
                >
                  {label}
                </Button>
              ))}
          </div>
        </div>

        {viewMode === "week" && !isAdmin && (
          <div className="mb-3">
            {postedWeek ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brite-green/30 bg-brite-green/10 px-3 py-1 text-xs font-semibold text-brite-green">
                ✓ Finalized · {formatPostedAt(postedWeek.postedAt)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brite-amber/30 bg-brite-amber/10 px-3 py-1 text-xs font-semibold text-brite-amber">
                ● Work in progress
              </span>
            )}
          </div>
        )}

        {isAdmin && showManageWorkers && (
          <ManageWorkersPanel
            workers={workers}
            onAdd={handleAddWorker}
            onRemove={handleRemoveWorker}
            upcomingShiftCount={(id) =>
              shifts.filter((s) => s.date >= todayISO && s.workerIds.includes(id)).length
            }
            onReorder={handleReorderWorker}
            onRename={handleRenameWorker}
          />
        )}

        {isAdmin && showAvailability && (
          <AvailabilityPanel availability={availability} workers={workers} />
        )}

        {!isAdmin && requestTab === "availability" && (
          <SetAvailabilityPanel
            initialDays={availability.find((a) => a.workerId === currentWorker.id)?.days}
            myTimeOff={timeOff.filter((r) => r.workerId === currentWorker.id)}
            onSubmitAvailability={handleSubmitAvailability}
            onRequestTimeOff={handleRequestTimeOff}
            onCancelTimeOff={handleCancelTimeOff}
            onClose={() => setRequestTab(null)}
          />
        )}
        {!isAdmin && requestTab === "coverage" && (
          <CoverageRequestForm
            myShifts={giveAwayShifts}
            onSubmit={handleRequestCoverage}
            onCancel={() => setRequestTab(null)}
          />
        )}
        {!isAdmin && requestTab === "swap" && (
          <SwapRequestForm
            myShifts={myShifts}
            otherWorkers={workers.filter((w) => w.id !== currentWorker.id)}
            shifts={shifts}
            onSubmit={handleRequestSwap}
            onCancel={() => setRequestTab(null)}
          />
        )}

        {isAdmin && (
          <ManagerRequests
            timeOff={timeOff}
            coverageRequests={coverageRequests}
            swapRequests={swapRequests}
            shifts={shifts}
            workers={workers}
            onApproveTimeOff={handleApproveTimeOff}
            onDenyTimeOff={handleDenyTimeOff}
            onResolveCoverage={handleResolveCoverage}
            onDismissCoverage={setDismissConfirm}
            onAssignCover={handleAssignCover}
            onApproveSwap={handleApproveSwap}
            onDenySwap={handleDenySwap}
          />
        )}
        {!isAdmin && (
          <CoverageBoard
            requests={coverageRequests}
            shifts={shifts}
            workers={workers}
            me={currentWorker}
            todayISO={todayISO}
            onRespond={handleRespondCoverage}
            onCancelMine={handleRemoveCoverageRequest}
          />
        )}

        {viewMode === "month" ? (
          <MonthView
            monthOffset={monthOffset}
            shifts={shifts}
            workers={workers}
            timeOff={timeOff}
            onSelectDate={handleSelectDateFromMonth}
          />
        ) : (
          <div className="relative">
          {weekInTheWorks && <ScheduleInTheWorks weekLabel={weekLabel} />}
          <div
            aria-hidden={weekInTheWorks || undefined}
            className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7 ${
              weekInTheWorks ? "pointer-events-none select-none opacity-70 blur-[3px]" : ""
            }`}
          >
            {DAYS.map((day) => {
              const dayDateStr = toISODate(weekDates[day]);
              const dayShifts = shifts.filter((shift) => shift.date === dayDateStr);
              const dayTimeOff = timeOff.filter(
                (r) =>
                  r.status === "approved" &&
                  dayDateStr >= r.startDate &&
                  dayDateStr <= r.endDate,
              );
              const unavailableWorkerIds = dayTimeOff.map((r) => r.workerId);

              return (
                <div
                  key={day}
                  // Right-clicking a day's header or empty space opens the
                  // day menu — shift cards stop the event, so it doesn't
                  // fire when right-clicking a shift.
                  onContextMenu={
                    isAdmin
                      ? (e) => {
                          e.preventDefault();
                          setDayMenu({
                            x: e.clientX,
                            y: e.clientY,
                            date: dayDateStr,
                            label: `${day} ${formatShortDate(weekDates[day])}`,
                          });
                        }
                      : undefined
                  }
                  onDragOver={
                    isAdmin
                      ? (e) => {
                          if (!isShiftDrag(e)) return;
                          e.preventDefault();
                          setShiftDragOverDate(dayDateStr);
                        }
                      : undefined
                  }
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setShiftDragOverDate((d) => (d === dayDateStr ? null : d));
                  }}
                  onDrop={
                    isAdmin
                      ? (e) => {
                          if (!isShiftDrag(e)) return;
                          // Only reached for drops on empty column space —
                          // a drop on a card is handled (and stopped) there.
                          e.preventDefault();
                          setShiftDragOverDate(null);
                          const shiftId = getShiftDrag(e);
                          if (shiftId) handleMoveShiftToDay(shiftId, dayDateStr);
                        }
                      : undefined
                  }
                  className={`group/day -m-1.5 flex flex-col gap-2 rounded-xl p-1.5 transition-colors ${
                    shiftDragOverDate === dayDateStr ? "bg-brite-amber/5 ring-1 ring-brite-amber/25" : ""
                  }`}
                >
                  <div className="text-center">
                    <div className="text-xs font-bold uppercase tracking-wide text-brite-tan/70">
                      {day}
                    </div>
                    <div className="text-[11px] text-brite-tan/40">
                      {formatShortDate(weekDates[day])}
                    </div>
                    {/* Fixed min-height (not conditional) so every day column reserves the
                        same header space, whether or not it has an event — otherwise the
                        shift cards below started at different heights per column. */}
                    <div className="mt-0.5 min-h-[2.25rem]">
                      <DayEventNote
                        text={eventFor(dayEvents, day, dayDateStr)}
                        isAdmin={isAdmin}
                        day={day}
                        dateLabel={formatShortDate(weekDates[day])}
                        isOneOff={dayDateStr in dayEvents.dates}
                        onSaveWeekly={(text) => handleSaveWeeklyEvent(day, text)}
                        onSaveOneOff={(text) => handleSaveOneOffEvent(dayDateStr, text)}
                        onResetToWeekly={() => handleResetEventToWeekly(dayDateStr)}
                      />
                    </div>
                  </div>
                  {dayTimeOff.map((request) => (
                    <TimeOffCard
                      key={request.id}
                      request={request}
                      worker={workers.find((w) => w.id === request.workerId) ?? null}
                    />
                  ))}
                  {dayShifts.map((shift) => {
                    const assignedWorkers = shift.workerIds
                      .map((id) => workers.find((w) => w.id === id))
                      .filter((w): w is Worker => Boolean(w));
                    const addableWorkers = workers.filter(
                      (w) =>
                        !shift.workerIds.includes(w.id) &&
                        !unavailableWorkerIds.includes(w.id),
                    );
                    return (
                      <ShiftCard
                        key={shift.id}
                        shift={shift}
                        dayLabel={`${day} ${formatShortDate(weekDates[day])}`}
                        assignedWorkers={assignedWorkers}
                        addableWorkers={addableWorkers}
                        copyTargets={DAYS.filter((d) => d !== day).map((d) => ({
                          day: d,
                          date: toISODate(weekDates[d]),
                          dateLabel: formatShortDate(weekDates[d]),
                        }))}
                        isAdmin={isAdmin}
                        actions={shiftMenuActions}
                        onDropOnShift={handleDropOnShift}
                        onDropOnWorker={handleDropOnWorker}
                        onMoveShift={handleMoveShiftNextTo}
                        {...coverageFor(shift)}
                      />
                    );
                  })}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleAddShift(dayDateStr)}
                      className="rounded-lg border border-dashed border-brite-tan/20 py-1.5 text-xs font-semibold text-brite-tan/50 hover:border-brite-tan/40 hover:text-brite-tan"
                    >
                      + Add shift
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        )}

        {resolveConfirm && (
          <ResolveCoverageDialog
            shift={shifts.find((s) => s.id === resolveConfirm.shiftId)}
            name={workers.find((w) => w.id === resolveConfirm.requestingWorkerId)?.name ?? "This person"}
            {...exchangeCandidates(resolveConfirm)}
            onTakeOff={(shiftId) =>
              handleRemoveWorkerFromShift(shiftId, resolveConfirm.requestingWorkerId)
            }
            onExchange={(workerId) => handleAssignCover(resolveConfirm, workerId)}
            onClose={() => setResolveConfirm(null)}
          />
        )}

        {dismissConfirm && (
          <DismissCoverageDialog
            shift={shifts.find((s) => s.id === dismissConfirm.shiftId)}
            worker={workers.find((w) => w.id === dismissConfirm.requestingWorkerId)}
            note={dismissConfirm.note}
            onDismiss={() => handleCloseCoverageRequest(dismissConfirm, "dismissed")}
            onClose={() => setDismissConfirm(null)}
          />
        )}

        {dayMenu && (
          <Popover x={dayMenu.x} y={dayMenu.y} onClose={() => setDayMenu(null)} className="w-60">
            <MenuLabel>{dayMenu.label}</MenuLabel>
            <MenuItem
              icon="+"
              label="Add shift"
              onClick={() => {
                handleAddShift(dayMenu.date);
                setDayMenu(null);
              }}
            />
            <MenuItem
              icon="↕"
              label="Sort shifts by start time"
              disabled={dayMenuShifts.length < 2}
              onClick={() => {
                handleSortDay(dayMenu.date);
                setDayMenu(null);
              }}
            />
            <MenuDivider />
            <MenuItem
              icon="⊘"
              label="Clear bartenders from all shifts"
              danger
              disabled={!dayMenuShifts.some((s) => s.workerIds.length > 0)}
              onClick={() => {
                handleClearDayWorkers(dayMenu.date);
                setDayMenu(null);
              }}
            />
            <MenuItem
              icon="🗑"
              label="Delete all shifts this day"
              hint={dayMenuShifts.length > 0 ? dayMenuShifts.length : undefined}
              danger
              disabled={dayMenuShifts.length === 0}
              onClick={() => {
                handleDeleteDayShifts(dayMenu.date);
                setDayMenu(null);
              }}
            />
          </Popover>
        )}
      </main>
    </div>
  );
}

type ExchangeFlag = "offered" | "cant" | "unavailable";

const FLAG_TAG: Record<ExchangeFlag, { label: string; className: string }> = {
  offered: { label: "Offered", className: "bg-brite-green/15 text-brite-green" },
  cant: { label: "Can't", className: "bg-brite-red/20 text-brite-red-bright" },
  unavailable: { label: "Unavailable", className: "bg-brite-amber/15 text-brite-amber" },
};

type ResolveCoverageDialogProps = {
  shift: Shift | undefined;
  name: string;
  candidates: Worker[];
  flags: Record<string, ExchangeFlag>;
  onTakeOff: (shiftId: string) => void;
  onExchange: (workerId: string) => void;
  onClose: () => void;
};

/**
 * Asked before resolving a give-away whose requester is still on the shift:
 * remove them, exchange them for someone else, or wait.
 */
function ResolveCoverageDialog({
  shift,
  name,
  candidates,
  flags,
  onTakeOff,
  onExchange,
  onClose,
}: ResolveCoverageDialogProps) {
  const [picking, setPicking] = useState(false);
  // A flagged pick (said they can't / usually unavailable) gets a quick "sure?".
  const [checking, setChecking] = useState<Worker | null>(null);
  const first = name; // full name — "Test 2" shortened to "Test" was ambiguous

  function pick(worker: Worker) {
    const flag = flags[worker.id];
    if (flag === "cant" || flag === "unavailable") setChecking(worker);
    else {
      onExchange(worker.id);
      onClose();
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="resolve-title">
      <h2 id="resolve-title" className="text-base font-bold text-brite-white">
        {name} is still on this shift
      </h2>
      {shift && <ShiftDateChip shift={shift} className="mt-2" />}

      <div className="mt-4 flex flex-col gap-2">
        {shift && (
          <button
            type="button"
            autoFocus
            onClick={() => {
              onTakeOff(shift.id);
              onClose();
            }}
            className="rounded-lg bg-brite-red py-2.5 text-sm font-semibold text-brite-white hover:bg-brite-red-bright"
          >
            Remove {first}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setPicking((v) => !v);
            setChecking(null);
          }}
          aria-expanded={picking}
          className={`flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-sm font-semibold transition-colors ${
            picking
              ? "border-brite-amber/60 bg-brite-amber/10 text-brite-amber"
              : "border-brite-tan/30 text-brite-cream hover:border-brite-tan"
          }`}
        >
          Exchange
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 transition-transform duration-200 ${picking ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {picking && !checking && (
          <div className="rounded-lg border border-brite-tan/10 bg-brite-black/40 py-1.5">
            <WorkerPickerList
              workers={candidates}
              onPick={(id) => {
                const worker = candidates.find((w) => w.id === id);
                if (worker) pick(worker);
              }}
              tagFor={(w) => {
                const flag = flags[w.id];
                return flag ? (
                  <span
                    className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${FLAG_TAG[flag].className}`}
                  >
                    {FLAG_TAG[flag].label}
                  </span>
                ) : null;
              }}
            />
          </div>
        )}

        {checking && (
          <div className="rounded-lg border border-brite-amber/30 bg-brite-amber/[0.07] p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-brite-white">
              <Avatar name={checking.name} color={checking.avatarColor} size="sm" />
              {flags[checking.id] === "cant"
                ? `${checking.name} said they can't cover`
                : `${checking.name} is usually unavailable${shift ? ` ${DAY_FULL_NAMES[dateToDayName(fromISODate(shift.date))]}s` : ""}`}
            </div>
            <div className="mt-2.5 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onExchange(checking.id);
                  onClose();
                }}
                className="rounded-md bg-brite-amber px-3 py-1 text-xs font-semibold text-brite-black hover:brightness-110"
              >
                Assign anyway
              </button>
              <button
                type="button"
                onClick={() => setChecking(null)}
                className="rounded-md border border-brite-tan/25 px-3 py-1 text-xs font-semibold text-brite-tan/80 hover:border-brite-tan/60"
              >
                Back
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg py-2 text-sm font-semibold text-brite-tan/55 hover:text-brite-tan"
        >
          Wait to resolve
        </button>
      </div>
    </Modal>
  );
}

/** 📅 Fri, Oct 30, 1–5:30 — the date line in the coverage dialogs. */
function ShiftDateChip({ shift, className = "" }: { shift: Shift; className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border border-brite-tan/15 bg-brite-black/40 px-3 py-1.5 text-sm text-brite-cream ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-brite-red-bright" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      {describeShift(shift)}
    </div>
  );
}

type DismissCoverageDialogProps = {
  shift: Shift | undefined;
  worker: Worker | undefined;
  note?: string;
  onDismiss: () => void;
  onClose: () => void;
};

/** "Dismiss Test 2's request?" — confirms before throwing out a give-away request. */
function DismissCoverageDialog({ shift, worker, note, onDismiss, onClose }: DismissCoverageDialogProps) {
  const name = worker?.name ?? "this";
  return (
    <Modal onClose={onClose} labelledBy="dismiss-title">
      <div className="flex flex-col items-center text-center">
        {worker && (
          <div className="relative mb-3">
            <span className="absolute -inset-1.5 rounded-full bg-brite-amber/20 blur-md" />
            <span className="relative block rounded-full ring-2 ring-brite-amber/50 ring-offset-2 ring-offset-brite-black-soft">
              <Avatar name={worker.name} color={worker.avatarColor} />
            </span>
          </div>
        )}
        <h2 id="dismiss-title" className="text-base font-bold text-brite-white">
          Dismiss {name}'s request?
        </h2>
        <p className="mt-0.5 text-xs text-brite-tan/50">Needs coverage for</p>
        {shift && <ShiftDateChip shift={shift} className="mt-2" />}
        {note && <p className="mt-2 text-xs italic text-brite-tan/55">“{note}”</p>}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="rounded-lg border border-brite-tan/30 py-2.5 text-sm font-semibold text-brite-cream hover:border-brite-tan"
        >
          Keep
        </button>
        <button
          type="button"
          onClick={() => {
            onDismiss();
            onClose();
          }}
          className="rounded-lg bg-brite-red py-2.5 text-sm font-semibold text-brite-white hover:bg-brite-red-bright"
        >
          Dismiss
        </button>
      </div>
    </Modal>
  );
}
