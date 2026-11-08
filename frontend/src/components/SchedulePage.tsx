import { useEffect, useRef, useState } from "react";
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
  saveGeneratedWeeks,
  saveNotifications,
  savePostedWeeks,
  saveShifts,
  saveSwapRequests,
  saveTimeOff,
} from "../data/scheduleStore";
import { addWorker, getWorkers, removeWorker, saveWorkers } from "../data/workers";
import { diffShiftNotifications, type PendingNotification } from "../data/notifications";
import { useHoldDrag, type HoldDragItem, type HoldDropTarget } from "../hooks/useHoldDrag";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { usePersistedState } from "../hooks/usePersistedState";
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
import { describeShift, formatCompactTime, formatPostedAt, minutesToDisplayTime, nightMinutes } from "../utils/time";
import {
  DAY_FULL_NAMES,
  DAYS,
  dateToDayName,
  formatFriendlyDate,
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
import { CopyPreviousWeekDialog, type CopyScope } from "./CopyPreviousWeekDialog";
import { CoverageRequestForm } from "./CoverageRequestForm";
import { DayEventNote } from "./DayEventNote";
import { ManageWorkersPanel } from "./ManageWorkersPanel";
import { CoverageBoard } from "./CoverageBoard";
import { DayTimeOff } from "./DayTimeOff";
import { ManagerRequests } from "./ManagerRequests";
import { MonthView } from "./MonthView";
import type { OpenTarget } from "./RequestCard";
import { MyRequests } from "./MyRequests";
import { NotificationCenter } from "./NotificationCenter";
import { FinalizeButton, ScheduleInTheWorks, type PostState } from "./PostStatus";
import { SetAvailabilityPanel } from "./SetAvailabilityPanel";
import { ShiftQuickMenu, type QuickMenuKind, type ShiftMenuBase } from "./ShiftQuickMenu";
import {
  ShiftCard,
  type BartenderMenu,
  type ChipBadge,
  type CoverageHighlight,
  type PillAction,
  type PillMenu,
} from "./ShiftCard";
import type { ShiftMenuActions } from "./ShiftContextMenu";
import { StarField } from "./StarField";
import { SwapApproveDialog } from "./SwapApproveDialog";
import { SwapRequestForm } from "./SwapRequestForm";
import { TimeOffDialog } from "./TimeOffDialog";
import { Avatar } from "./ui/Avatar";
import { InstallAppLink } from "./InstallAppPrompt";
import { HoldDragGhost } from "./HoldDragGhost";
import { WeekOverview } from "./WeekOverview";
import { Sheet } from "./ui/Sheet";
import { WorkerPickerList } from "./WorkerPickerList";
import { Button, ShortLabel } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { MenuDivider, MenuItem, MenuLabel, Popover } from "./ui/Popover";

type ViewMode = "week" | "month";
type RequestTab = "coverage" | "swap" | "availability" | "timeoff" | null;

type Snapshot = {
  shifts: Shift[];
  workers: Worker[];
  timeOff: TimeOffRequest[];
  coverageRequests: CoverageRequest[];
  swapRequests: SwapRequest[];
  availability: Availability[];
  dayEvents: DayEvents;
  notifications: AppNotification[];
  // postedWeeks is deliberately NOT here: a finalized week only goes back to
  // work-in-progress through "Back to work in progress", never via Undo.
};

// When the bar closes, and the rules for auto-timing a newly added shift
// (see suggestNextShiftTime).
const CLOSING_TIME = "2:00 AM";
const NIGHT_SHIFT_FROM = 19 * 60; // starting 7 PM or later: runs to close
const MID_SHIFT_END = 21 * 60; // otherwise ends by 9 PM, when the night crew starts…
const NEW_SHIFT_LENGTH = 4 * 60; // …and is at most 4 hours
// "Copy to other days" joins an existing shift whose start and end are each
// within this much of the copied one, instead of adding a near-duplicate.
const SIMILAR_SHIFT_MINUTES = 60;

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

  // Each of these saves itself on every change (see usePersistedState).
  const [workers, setWorkers] = usePersistedState(getWorkers, saveWorkers);
  // shifts saves through setShifts below, which also sends notifications.
  const [shifts, , setShiftsRaw] = usePersistedState(getShifts, saveShifts);
  const [timeOff, setTimeOff] = usePersistedState(getTimeOff, saveTimeOff);
  const [coverageRequests, setCoverageRequests] = usePersistedState(getCoverageRequests, saveCoverageRequests);
  const [swapRequests, setSwapRequests] = usePersistedState(getSwapRequests, saveSwapRequests);
  const [availability, setAvailability] = usePersistedState(getAvailability, saveAvailability);
  const [dayEvents, setDayEvents] = usePersistedState(getDayEvents, saveDayEvents);
  const [postedWeeks, setPostedWeeks] = usePersistedState(getPostedWeeks, savePostedWeeks);
  const [notifications, setNotifications] = usePersistedState(getNotifications, saveNotifications);
  // getShifts() above may seed this on a fresh browser/migration — read it
  // after, so that seeded value is picked up rather than a stale empty [].
  // (ensureWeeksGenerated saves it itself, hence the non-saving setter.)
  const [generatedWeeks, , setGeneratedWeeks] = usePersistedState(getGeneratedWeeks, saveGeneratedWeeks);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [resolveConfirm, setResolveConfirm] = useState<CoverageRequest | null>(null);
  // Opened from a shift's "Exchange bartender" menu item: start with the list open.
  const [resolveStartPicking, setResolveStartPicking] = useState(false);
  const [dismissConfirm, setDismissConfirm] = useState<CoverageRequest | null>(null);

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
      // Covered: the "can you take it?" notes are moot, but the history of
      // what happened (covered / covering / your answers) stays.
      dropRequestNotes(resolvedRequestIds, ["needs-coverage"]);
    }
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
  // Tablet width and up: seven full day columns (their cards tighten up as
  // the columns narrow). Phones: no room for that, so the week shows as a
  // compact overview (WeekOverview) and a day's full editor opens in a sheet.
  // sheetDay is the day that sheet is showing (null = closed).
  const isWide = useMediaQuery("(min-width: 768px)");
  const [sheetDay, setSheetDay] = useState<Day | null>(null);
  // Press-and-hold dragging of names, for touch screens at every size.
  const holdDrag = useHoldDrag((item, target) => handleHoldDrop(item, target));
  // A menu opened from a name/time/"+" tap in the phone week grid.
  const [quickMenu, setQuickMenu] = useState<{
    shiftId: string;
    kind: QuickMenuKind;
    x: number;
    y: number;
    workerId?: string;
  } | null>(null);
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
    if (blockIfOff(workerId, shiftId)) return;
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

  function workersOffOn(date: string): string[] {
    return timeOff
      .filter((r) => r.status === "approved" && date >= r.startDate && date <= r.endDate)
      .map((r) => r.workerId);
  }

  // "Copy to other days": each day gets the shift's bartenders (minus anyone
  // off that day). If the day already has a similar shift — start and end
  // each within an hour, e.g. 9–2 for 8:30–2 — they join that one instead of
  // a near-duplicate block being added; days stay at their 2–3 shifts.
  function handleCopyShiftToDates(shiftId: string, dates: string[]) {
    const source = shifts.find((s) => s.id === shiftId);
    if (!source) return;
    const gap = (a: string, b: string) => Math.abs(nightMinutes(a) - nightMinutes(b));
    const similarOn = (date: string) =>
      shifts
        .filter(
          (s) =>
            s.date === date &&
            s.id !== source.id &&
            gap(s.start, source.start) <= SIMILAR_SHIFT_MINUTES &&
            gap(s.end, source.end) <= SIMILAR_SHIFT_MINUTES,
        )
        .sort((a, b) => gap(a.start, source.start) + gap(a.end, source.end) - (gap(b.start, source.start) + gap(b.end, source.end)))[0];

    const joined = new Map<string, string[]>(); // existing shift id -> people to add
    const copies: Shift[] = [];
    dates.forEach((date, i) => {
      const off = workersOffOn(date);
      const people = source.workerIds.filter((id) => !off.includes(id));
      const match = similarOn(date);
      if (match) joined.set(match.id, people.filter((id) => !match.workerIds.includes(id)));
      else copies.push({ id: `s${Date.now()}-${i}`, date, start: source.start, end: source.end, workerIds: people });
    });

    pushHistory();
    setShifts([
      ...shifts.map((s) => (joined.has(s.id) ? { ...s, workerIds: [...s.workerIds, ...joined.get(s.id)!] } : s)),
      ...copies,
    ]);
    const dayNames = (ds: string[]) => ds.map((d) => dateToDayName(fromISODate(d))).join(", ");
    const joinedDays = shifts.filter((s) => joined.has(s.id)).map((s) => s.date);
    showToast(
      [
        joinedDays.length ? `Added to the similar shift on ${dayNames(joinedDays)}` : "",
        copies.length ? `New ${formatCompactTime(source.start)}–${formatCompactTime(source.end)} on ${dayNames(copies.map((c) => c.date))}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      { undo: true },
    );
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
      if (before && after && nightMinutes(after.start) > nightMinutes(before.end)) {
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

  function handleSortDay(date: string) {
    pushHistory();
    setShifts((current) => {
      const sorted = current
        .filter((s) => s.date === date)
        .sort((a, b) => nightMinutes(a.start) - nightMinutes(b.start) || nightMinutes(a.end) - nightMinutes(b.end));
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

  // ---- Copy from previous week (day menu) ------------------------------
  const [copyPrevFor, setCopyPrevFor] = useState<string | null>(null);

  /** The same weekday one week earlier. */
  function weekBefore(isoDate: string): string {
    const d = fromISODate(isoDate);
    d.setDate(d.getDate() - 7);
    return toISODate(d);
  }

  // The week before the one showing may never have been opened, so it may
  // have no shifts yet — fill it in from the template first (as opening it
  // would), so there's something to copy.
  function openCopyFromPreviousWeek(date: string) {
    const result = ensureWeeksGenerated([getMondayOfWeek(weekOffset - 1)], shifts, generatedWeeks);
    if (result) {
      setShiftsRaw(result.shifts);
      setGeneratedWeeks(result.generatedWeeks);
    }
    setCopyPrevFor(date);
  }

  // What each choice in the dialog would do: the dates it replaces, and the
  // give-away/swap requests on those shifts (which go with them).
  function copyPlan(scope: CopyScope, date: string) {
    const targets = scope === "week" ? DAYS.map((d) => toISODate(weekDates[d])) : [date];
    const replaced = new Set(shifts.filter((s) => targets.includes(s.date)).map((s) => s.id));
    const pendingRequests =
      coverageRequests.filter((r) => replaced.has(r.shiftId)).length +
      swapRequests.filter((r) => replaced.has(r.requestingShiftId) || replaced.has(r.targetShiftId)).length;
    const sources = targets.map(weekBefore);
    return {
      targets,
      replaced,
      shiftCount: shifts.filter((s) => sources.includes(s.date)).length,
      pendingRequests,
    };
  }

  // The day (or whole week) a week earlier replaces what's there now: same
  // times, same bartenders — minus anyone with approved time off on the new
  // date, or who's no longer on the roster. Undoable.
  function handleCopyFromPreviousWeek(scope: CopyScope, date: string) {
    const { targets, replaced } = copyPlan(scope, date);
    const onRoster = new Set(workers.map((w) => w.id));
    const leftOff = new Set<string>();
    const stamp = Date.now();
    const copies = targets.flatMap((target, t) => {
      const off = workersOffOn(target);
      return shifts
        .filter((s) => s.date === weekBefore(target))
        .map((s, i) => {
          s.workerIds.filter((id) => off.includes(id)).forEach((id) => leftOff.add(id));
          return {
            id: `s${stamp}-${t}-${i}`,
            date: target,
            start: s.start,
            end: s.end,
            workerIds: s.workerIds.filter((id) => onRoster.has(id) && !off.includes(id)),
          };
        });
    });
    pushHistory();
    setShifts([...shifts.filter((s) => !replaced.has(s.id)), ...copies]);
    setCoverageRequests((current) => current.filter((r) => !replaced.has(r.shiftId)));
    setSwapRequests((current) =>
      current.filter((r) => !replaced.has(r.requestingShiftId) && !replaced.has(r.targetShiftId)),
    );
    const names = [...leftOff].map((id) => workers.find((w) => w.id === id)?.name ?? "someone");
    showToast(
      `Copied ${scope === "week" ? "last week" : `last ${DAY_FULL_NAMES[dateToDayName(fromISODate(date))]}`} · ${
        copies.length
      } shift${copies.length === 1 ? "" : "s"}${names.length ? ` · left off (time off): ${names.join(", ")}` : ""}`,
      { undo: true },
    );
  }

  // A new shift picks up where the day's latest shift ends. From 7 PM on it
  // runs to close (1–8:30 → 8:30–2); earlier it's a mid shift ending at 9 PM,
  // at most 4 hours long (1–5 → 5–9, 1–6 → 6–9, 12–3 → 3–7).
  // If the latest shift already runs to close, the new one copies its times
  // (an extra closer). An empty day gets the plain default.
  function suggestNextShiftTime(date: string, current: Shift[]): { start: string; end: string } {
    const dayShifts = current.filter((s) => s.date === date);
    if (dayShifts.length === 0) return { start: "12:00 PM", end: "5:00 PM" };

    const latest = dayShifts.reduce((a, b) => (nightMinutes(b.end) > nightMinutes(a.end) ? b : a));
    const start = nightMinutes(latest.end);
    const close = nightMinutes(CLOSING_TIME);
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

  // Both drop handlers return whether anything changed (false = blocked).
  function handleDropOnShift(payload: DragPayload, targetShiftId: string): boolean {
    if (blockIfOff(payload.workerId, targetShiftId)) return false;
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
    return true;
  }

  function handleDropOnWorker(payload: DragPayload, targetShiftId: string, targetWorkerId: string): boolean {
    if (payload.workerId === targetWorkerId) return false;
    if (payload.source !== "shift") return handleDropOnShift(payload, targetShiftId);
    // A swap moves both people — neither can land on a day they're off.
    if (blockIfOff(payload.workerId, targetShiftId) || blockIfOff(targetWorkerId, payload.shiftId)) return false;
    pushHistory();
    const sourceShiftId = payload.shiftId;
    // Only add someone who isn't already there — if the person dropped onto
    // was also on the source shift, they'd otherwise end up listed twice.
    const swapIn = (ids: string[], out: string, inn: string) => {
      const kept = ids.filter((id) => id !== out);
      return kept.includes(inn) ? kept : kept.concat(inn);
    };
    setShifts((current) =>
      current.map((s) => {
        if (s.id === sourceShiftId && s.id === targetShiftId) return s;
        if (s.id === sourceShiftId) return { ...s, workerIds: swapIn(s.workerIds, payload.workerId, targetWorkerId) };
        if (s.id === targetShiftId) return { ...s, workerIds: swapIn(s.workerIds, targetWorkerId, payload.workerId) };
        return s;
      }),
    );
    return true;
  }

  // Every press-and-hold drop (touch screens at any size, and the phone grid
  // with a mouse too) — the same things a mouse drag does on a computer.
  function handleHoldDrop(item: HoldDragItem, target: HoldDropTarget) {
    if (item.kind === "shift") {
      if (target.shiftId) {
        if (target.shiftId !== item.shiftId) handleMoveShiftNextTo(item.shiftId, target.shiftId, target.side);
      } else if (target.date) {
        handleMoveShiftToDay(item.shiftId, target.date);
      }
      return;
    }
    if (target.rosterId) {
      // Reordering the Manage bartenders roster (only names from the roster).
      if (!item.fromShiftId && target.rosterId !== item.workerId) {
        handleReorderWorker(item.workerId, target.rosterId, target.side);
      }
      return;
    }
    if (!target.shiftId || target.shiftId === item.fromShiftId || target.workerId === item.workerId) return;
    handleMovePerson(item.workerId, item.fromShiftId, target.shiftId, target.workerId);
  }

  // A name dropped onto a shift: from the roster it's added; from another
  // shift it moves there (or swaps, if dropped onto someone). Says what
  // happened, with Undo right there.
  function handleMovePerson(workerId: string, fromShiftId: string | undefined, toShiftId: string, toWorkerId?: string) {
    const target = shifts.find((s) => s.id === toShiftId);
    if (!target) return;
    const nameOf = (id: string) => workers.find((w) => w.id === id)?.name ?? "Someone";
    // From the roster, dropping onto someone just adds (same as a mouse drag).
    const swapWith = fromShiftId ? toWorkerId : undefined;
    if (!swapWith && target.workerIds.includes(workerId)) {
      showToast(`${nameOf(workerId)} is already on that shift`);
      return;
    }
    const payload: DragPayload = fromShiftId
      ? { source: "shift", workerId, shiftId: fromShiftId }
      : { source: "roster", workerId };
    const done = swapWith ? handleDropOnWorker(payload, toShiftId, swapWith) : handleDropOnShift(payload, toShiftId);
    if (!done) return; // blocked — blockIfOff already said why
    showToast(
      swapWith
        ? `Swapped ${nameOf(workerId)} and ${nameOf(swapWith)}`
        : `${fromShiftId ? "Moved" : "Added"} ${nameOf(workerId)} to ${describeShift(target)}`,
      { undo: true },
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

  // Approved time off means they're off the schedule those days: pull them
  // off any shifts in the range (today or later) right away.
  function removeFromShiftsInRange(workerId: string, startDate: string, endDate: string) {
    const from = startDate < todayISO ? todayISO : startDate;
    if (!shifts.some((s) => s.date >= from && s.date <= endDate && s.workerIds.includes(workerId))) return;
    setShifts((current) =>
      current.map((s) =>
        s.date >= from && s.date <= endDate && s.workerIds.includes(workerId)
          ? { ...s, workerIds: s.workerIds.filter((id) => id !== workerId) }
          : s,
      ),
    );
  }

  function describeRange(startDate: string, endDate: string) {
    return startDate === endDate
      ? formatFriendlyDate(startDate)
      : `${formatFriendlyDate(startDate)} – ${formatFriendlyDate(endDate)}`;
  }

  function handleApproveTimeOff(requestId: string) {
    const request = timeOff.find((r) => r.id === requestId);
    if (!request) return;
    pushHistory();
    setTimeOff((current) =>
      current.map((r) => (r.id === requestId ? { ...r, status: "approved" } : r)),
    );
    removeFromShiftsInRange(request.workerId, request.startDate, request.endDate);
    notify([
      {
        workerId: request.workerId,
        kind: "request",
        text: `Your time off for ${describeRange(request.startDate, request.endDate)} was approved.`,
      },
    ]);
  }

  // Manager edits the dates on someone's time off (from the Time Off card or
  // an OFF name in a picker). Still approved → off any shifts in the new range.
  function handleUpdateTimeOff(requestId: string, startDate: string, endDate: string) {
    const request = timeOff.find((r) => r.id === requestId);
    if (!request) return;
    pushHistory();
    setTimeOff((current) => current.map((r) => (r.id === requestId ? { ...r, startDate, endDate } : r)));
    if (request.status === "approved") removeFromShiftsInRange(request.workerId, startDate, endDate);
    notify([
      {
        workerId: request.workerId,
        kind: "request",
        text: `Your manager changed your time off to ${describeRange(startDate, endDate)}.`,
      },
    ]);
  }

  // Manager cancels someone's time off — they're schedulable those days again.
  function handleManagerCancelTimeOff(requestId: string) {
    const request = timeOff.find((r) => r.id === requestId);
    if (!request) return;
    pushHistory();
    setTimeOff((current) => current.filter((r) => r.id !== requestId));
    notify([
      {
        workerId: request.workerId,
        kind: "request",
        text: `Your time off for ${describeRange(request.startDate, request.endDate)} was cancelled by your manager.`,
      },
    ]);
  }

  // Blocked actions (e.g. scheduling someone on their day off) say why here.
  // `undo` adds an Undo button (and stays up longer, to give time to tap it).
  const [toast, setToast] = useState<{ message: string; undo?: boolean } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  function showToast(message: string, { undo = false } = {}) {
    setToast({ message, undo });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), undo ? 5000 : 3200);
  }

  // Someone with approved time off can't be put on a shift that day.
  function blockIfOff(workerId: string, shiftId: string): boolean {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift || !workersOffOn(shift.date).includes(workerId)) return false;
    const name = workers.find((w) => w.id === workerId)?.name ?? "They";
    showToast(`${name} is off ${formatFriendlyDate(shift.date)}. Change their time off to schedule them.`);
    return true;
  }

  const [editingTimeOffId, setEditingTimeOffId] = useState<string | null>(null);
  // "Approve swap" opens a picture of the swap first (SwapApproveDialog).
  const [approvingSwap, setApprovingSwap] = useState<SwapRequest | null>(null);
  // From an OFF name in a picker: open that person's time off covering the date.
  function openTimeOffFor(workerId: string, date: string) {
    const request = timeOff.find(
      (r) => r.workerId === workerId && r.status === "approved" && date >= r.startDate && date <= r.endDate,
    );
    if (request) setEditingTimeOffId(request.id);
  }

  function handleDenyTimeOff(requestId: string) {
    pushHistory();
    setTimeOff((current) => current.filter((r) => r.id !== requestId));
  }

  function handleRequestCoverage(shiftId: string, note: string) {
    pushHistory();
    const requestId = `c${Date.now()}`;
    setCoverageRequests((current) => [
      ...current,
      { id: requestId, shiftId, requestingWorkerId: currentWorker.id, note: note || undefined },
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
            requestId,
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
          requestId,
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
  // Manager view: everything on a shift (today or later) still waiting on a
  // decision — give-aways, swaps, time-off requests — plus real conflicts
  // (someone scheduled on a day they have approved off).
  type Issue = {
    label: string;
    workerIds: string[];
    conflict?: boolean;
    badge?: ChipBadge;
    // What the manager can do about it, from the tag's menu on the shift.
    menuTitle: string;
    actions: PillAction[];
  };
  function issuesFor(shift: Shift): Issue[] {
    if (shift.date < todayISO) return [];
    const issues: Issue[] = [];
    const nameOf = (id: string) => workers.find((w) => w.id === id)?.name ?? "Someone";
    const req = coverageRequests.find((r) => r.shiftId === shift.id);
    if (req) {
      const offers = (req.responses ?? []).filter((a) => a.canCover).length;
      issues.push({
        label: offers ? `Needs coverage · ${offers} offer${offers === 1 ? "" : "s"}` : "Needs coverage",
        workerIds: [req.requestingWorkerId],
        menuTitle: `${nameOf(req.requestingWorkerId)} needs coverage`,
        actions: [
          {
            label: "Exchange bartender",
            icon: "⇄",
            onClick: () => {
              setResolveStartPicking(true);
              setResolveConfirm(req);
            },
          },
          { label: "Mark resolved", icon: "✓", onClick: () => handleResolveCoverage(req) },
          { label: "Dismiss", icon: "✕", onClick: () => setDismissConfirm(req) },
        ],
      });
    }
    for (const sw of managerSwaps) {
      const here =
        sw.requestingShiftId === shift.id ? sw.requestingWorkerId : sw.targetShiftId === shift.id ? sw.targetWorkerId : null;
      if (!here) continue;
      issues.push({
        label: "Swap pending",
        workerIds: [here],
        menuTitle: `Swap: ${nameOf(sw.requestingWorkerId)} ⇄ ${nameOf(sw.targetWorkerId)}`,
        actions: [
          { label: "Review & approve swap", icon: "⇄", onClick: () => setApprovingSwap(sw) },
          { label: "Deny swap", icon: "✕", onClick: () => handleDenySwap(sw.id) },
        ],
      });
    }
    for (const r of timeOff) {
      if (!shift.workerIds.includes(r.workerId) || shift.date < r.startDate || shift.date > r.endDate) continue;
      // Name the person right in the label, and tag their chip, so it's
      // obvious who it's about without hovering.
      issues.push(
        r.status === "approved"
          ? {
              label: `${nameOf(r.workerId)} is off`,
              workerIds: [r.workerId],
              conflict: true,
              badge: { text: "Off", tone: "red", title: `Approved time off${r.reason ? `: ${r.reason}` : ""}` },
              menuTitle: `${nameOf(r.workerId)} has the day off${r.reason ? ` · ${r.reason}` : ""}`,
              actions: [
                {
                  label: `Take ${nameOf(r.workerId)} off this shift`,
                  icon: "−",
                  onClick: () => handleRemoveWorkerFromShift(shift.id, r.workerId),
                },
                { label: "Edit time off", icon: "✎", onClick: () => setEditingTimeOffId(r.id) },
              ],
            }
          : {
              label: `${nameOf(r.workerId)} asked off`,
              workerIds: [r.workerId],
              badge: { text: "Off?", tone: "amber", title: `Time off requested${r.reason ? `: ${r.reason}` : ""}` },
              menuTitle: `${nameOf(r.workerId)} asked for time off${r.reason ? ` · ${r.reason}` : ""}`,
              actions: [
                { label: "Grant time off", icon: "✓", onClick: () => handleApproveTimeOff(r.id) },
                { label: "Deny", icon: "✕", onClick: () => handleDenyTimeOff(r.id) },
              ],
            },
      );
    }
    // Conflicts first — they're the ones that are actually wrong.
    return issues.sort((a, b) => Number(!!b.conflict) - Number(!!a.conflict));
  }

  // For month view: how many issues fall on each date. (A function, called
  // from the JSX, because issuesFor needs todayISO, defined further down.)
  function attentionByDate(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const s of shifts) {
      const n = issuesFor(s).length;
      if (n) counts[s.date] = (counts[s.date] ?? 0) + n;
    }
    return counts;
  }

  function coverageFor(shift: Shift): {
    coverage?: CoverageHighlight;
    bartenderMenu?: BartenderMenu;
    onExchange?: () => void;
    flagWorkerIds?: string[];
    chipBadges?: Record<string, ChipBadge>;
    pillMenu?: PillMenu;
  } {
    const req = coverageRequests.find((r) => r.shiftId === shift.id);
    if (isAdmin) {
      const issues = issuesFor(shift);
      if (issues.length === 0) return {};
      return {
        coverage: {
          tone: issues.some((i) => i.conflict) ? "red" : "amber",
          label: issues.length > 1 ? `${issues[0].label} +${issues.length - 1}` : issues[0].label,
          title: issues.map((i) => i.label).join("\n"),
        },
        flagWorkerIds: [...new Set(issues.flatMap((i) => i.workerIds))],
        pillMenu: { sections: issues.map((i) => ({ title: i.menuTitle, actions: i.actions })) },
        chipBadges: Object.fromEntries(
          issues.filter((i) => i.badge).map((i) => [i.workerIds[0], i.badge!] as const),
        ),
        // Same as Mark resolved → Exchange, opened straight to the list.
        onExchange: req
          ? () => {
              setResolveStartPicking(true);
              setResolveConfirm(req);
            }
          : undefined,
      };
    }
    if (!req) {
      // Nothing being given away: bartenders still see their own shifts lit
      // up (finalized or work-in-progress weeks alike).
      return !isAdmin && shift.workerIds.includes(currentWorker.id)
        ? { coverage: { tone: "mine", label: "Your shift" } }
        : {};
    }
    const answers = req.responses ?? [];

    const mine = req.requestingWorkerId === currentWorker.id;
    const answer = answers.find((a) => a.workerId === currentWorker.id);
    const coverage: CoverageHighlight = mine
      ? { tone: "amber", label: "Giving away" }
      : answer?.canCover
        ? { tone: "green", label: "Offered" }
        : { tone: "amber", label: answer ? "Passed" : "Needs coverage" };

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
        // Not answered yet: Cover / Can't right on the card. Answered: the
        // card just shows the answer, with a ☰ menu to switch or clear it.
        items: answer
          ? [
              answer.canCover
                ? { label: "Switch to Can't cover", icon: "⇄", onClick: () => handleRespondCoverage(req.id, false) }
                : { label: "Switch to I can cover", icon: "⇄", onClick: () => handleRespondCoverage(req.id, true) },
              { label: "Clear answer", icon: "↺", onClick: () => handleRespondCoverage(req.id, null) },
            ]
          : [
              { label: "I can cover", icon: "♥", inlineLabel: "Cover", primary: true, onClick: () => handleRespondCoverage(req.id, true) },
              { label: "Can't cover", icon: "–", inlineLabel: "Can't", onClick: () => handleRespondCoverage(req.id, false) },
            ],
      },
    };
  }

  // Manager accepts an offer: the volunteer takes the requester's place in
  // one step. The shift diff in setShifts then sends "you've been covered" /
  // "you've been added to cover" and closes the request.
  function handleAssignCover(request: CoverageRequest, workerId: string) {
    if (blockIfOff(workerId, request.shiftId)) return;
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
    if (shift?.workerIds.includes(request.requestingWorkerId)) {
      setResolveStartPicking(false);
      setResolveConfirm(request);
    }
    else handleRemoveCoverageRequest(request.id);
  }

  // Dismissing a request while they're still on the shift — let them know
  // they're still working it.
  function handleDismissCoverage(request: CoverageRequest) {
    const shift = shifts.find((s) => s.id === request.shiftId);
    handleRemoveCoverageRequest(request.id);
    if (shift?.workerIds.includes(request.requestingWorkerId)) {
      notify([
        {
          workerId: request.requestingWorkerId,
          kind: "request",
          text: `Your request to give away ${describeShift(shift)} was dismissed. You're still on it.`,
        },
      ]);
    }
  }

  // Cancelled, dismissed, or closed: the request goes, and so does every
  // note about it ("needs coverage", offers, answers) — it's moot now.
  function handleRemoveCoverageRequest(requestId: string) {
    pushHistory();
    setCoverageRequests((current) => current.filter((r) => r.id !== requestId));
    dropRequestNotes([requestId], ["needs-coverage", "offer", "response"]);
  }

  function dropRequestNotes(requestIds: string[], kinds: AppNotification["kind"][]) {
    setNotifications((current) =>
      current.filter((n) => !(n.requestId && requestIds.includes(n.requestId) && kinds.includes(n.kind))),
    );
  }

  // ---- Swaps: asker → other bartender accepts → manager approves --------
  function swapParts(r: SwapRequest) {
    return {
      mine: shifts.find((s) => s.id === r.requestingShiftId),
      theirs: shifts.find((s) => s.id === r.targetShiftId),
      requesterName: workers.find((w) => w.id === r.requestingWorkerId)?.name ?? "Someone",
      targetName: workers.find((w) => w.id === r.targetWorkerId)?.name ?? "Someone",
    };
  }

  function handleRequestSwap(myShiftId: string, targetWorkerId: string, targetShiftId: string) {
    pushHistory();
    const id = `sw${Date.now()}`;
    setSwapRequests((current) => [
      ...current,
      {
        id,
        requestingWorkerId: currentWorker.id,
        requestingShiftId: myShiftId,
        targetWorkerId,
        targetShiftId,
        status: "awaiting-partner",
      },
    ]);
    const mine = shifts.find((s) => s.id === myShiftId);
    const theirs = shifts.find((s) => s.id === targetShiftId);
    if (mine && theirs) {
      notify([
        {
          workerId: targetWorkerId,
          kind: "swap",
          requestId: id,
          text: `${currentWorker.name} wants to swap: you'd take ${describeShift(mine)}, they'd take your ${describeShift(theirs)}.`,
        },
      ]);
    }
    showToast(`Sent to ${workers.find((w) => w.id === targetWorkerId)?.name ?? "them"} to accept`);
    setRequestTab(null);
  }

  // The other bartender agrees — now it goes to the manager.
  function handleAcceptSwap(requestId: string) {
    const r = swapRequests.find((x) => x.id === requestId);
    if (!r) return;
    pushHistory();
    setSwapRequests((current) => current.map((x) => (x.id === requestId ? { ...x, status: "awaiting-manager" } : x)));
    notify([
      {
        workerId: r.requestingWorkerId,
        kind: "swap",
        requestId,
        text: `${swapParts(r).targetName} accepted your swap. Waiting on your manager.`,
      },
    ]);
  }

  function handleDeclineSwap(requestId: string) {
    const r = swapRequests.find((x) => x.id === requestId);
    if (!r) return;
    pushHistory();
    setSwapRequests((current) => current.filter((x) => x.id !== requestId));
    dropRequestNotes([requestId], ["swap"]);
    notify([{ workerId: r.requestingWorkerId, kind: "swap", text: `${swapParts(r).targetName} declined your swap.` }]);
  }

  // The asker takes it back (at any stage).
  function handleCancelMySwap(requestId: string) {
    const r = swapRequests.find((x) => x.id === requestId);
    if (!r) return;
    pushHistory();
    setSwapRequests((current) => current.filter((x) => x.id !== requestId));
    dropRequestNotes([requestId], ["swap"]);
    notify([{ workerId: r.targetWorkerId, kind: "swap", text: `${swapParts(r).requesterName} cancelled their swap request.` }]);
  }

  function handleApproveSwap(request: SwapRequest) {
    if (blockIfOff(request.requestingWorkerId, request.targetShiftId) || blockIfOff(request.targetWorkerId, request.requestingShiftId)) {
      return;
    }
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
    const { requesterName, targetName } = swapParts(request);
    notify([
      { workerId: request.requestingWorkerId, kind: "swap", text: `Your swap with ${targetName} was approved.` },
      { workerId: request.targetWorkerId, kind: "swap", text: `Your swap with ${requesterName} was approved.` },
    ]);
  }

  function handleDenySwap(requestId: string) {
    const r = swapRequests.find((x) => x.id === requestId);
    pushHistory();
    setSwapRequests((current) => current.filter((x) => x.id !== requestId));
    if (r) {
      const { requesterName, targetName } = swapParts(r);
      dropRequestNotes([requestId], ["swap"]);
      notify([
        { workerId: r.requestingWorkerId, kind: "swap", text: `Your swap with ${targetName} was denied.` },
        { workerId: r.targetWorkerId, kind: "swap", text: `Your swap with ${requesterName} was denied.` },
      ]);
    }
  }

  function handleSelectDateFromMonth(date: Date) {
    setWeekOffset(weekOffsetForDate(date));
    // Small screens: open that day's editor too, so it's not one more tap.
    if (!isWide) setSheetDay(dateToDayName(date));
    setViewMode("week");
  }

  // From a request card: show that week, scroll to the shift, and pulse it
  // for a moment so it's obvious which one it is.
  const [flashShiftIds, setFlashShiftIds] = useState<string[]>([]);
  // The request card that's selected, and the day(s) it covers. The days
  // stay highlighted until the same card is clicked again.
  // For swaps, the two shift blocks stay outlined too (shiftIds).
  const [selected, setSelected] = useState<{ key: string; dates: string[]; shiftIds: string[] } | null>(null);
  function handleOpenFromRequest({ key, date, shiftIds = [], endDate }: OpenTarget) {
    if (selected?.key === key) {
      setSelected(null);
      return;
    }
    handleSelectDateFromMonth(fromISODate(date));
    const dates = new Set([date, ...shiftIds.map((id) => shifts.find((s) => s.id === id)?.date ?? date)]);
    if (endDate) {
      for (const d = fromISODate(date); toISODate(d) <= endDate; d.setDate(d.getDate() + 1)) dates.add(toISODate(d));
    }
    setSelected({ key, dates: [...dates], shiftIds: key.startsWith("swap-") ? shiftIds : [] });
    setFlashShiftIds([]);
    window.setTimeout(() => {
      const target =
        (shiftIds[0] && document.getElementById(`shift-${shiftIds[0]}`)) || document.getElementById("week-grid");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashShiftIds(shiftIds);
    }, 60);
    window.setTimeout(() => setFlashShiftIds([]), 2200);
  }

  // ---- Posting -------------------------------------------------------
  const weekKey = toISODate(monday);
  const weekLabel = formatWeekRange(monday);
  const weekDateSet = new Set(DAYS.map((d) => toISODate(weekDates[d])));
  const liveWeekShifts = shifts.filter((s) => weekDateSet.has(s.date));
  const postedWeek: PostedWeek | undefined = postedWeeks[weekKey];
  const changeCount = postedWeek ? countShiftChanges(postedWeek.shifts, liveWeekShifts) : 0;
  const postState: PostState = !postedWeek ? "draft" : changeCount === 0 ? "posted" : "changed";

  // Not undoable on purpose (see Snapshot) — finalizing sticks.
  function handlePostWeek() {
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
    const { [weekKey]: _removed, ...rest } = postedWeeks;
    setPostedWeeks(rest);
  }

  // Bartenders see the live schedule too — a week that isn't finalized yet
  // is just shown blurred, with an "in the works" note over it.
  const weekInTheWorks = !isAdmin && !postedWeek;

  const myShifts = shifts.filter((s) => s.workerIds.includes(currentWorker.id));

  // Swaps reach the manager only after the other bartender accepts.
  const managerSwaps = swapRequests.filter((r) => (r.status ?? "awaiting-manager") === "awaiting-manager");

  // This bartender's bell. "Needs coverage" notes only show while their
  // request is still open, and only the newest of any repeats (older data
  // could hold several identical ones from a cancelled-then-re-posted request).
  const openRequestIds = new Set(coverageRequests.map((r) => r.id));
  const seenCoverageNotes = new Set<string>();
  const myNotifications = notifications.filter((n) => {
    if (n.workerId !== currentWorker.id) return false;
    if (n.kind !== "needs-coverage") return true;
    if (n.requestId && !openRequestIds.has(n.requestId)) return false;
    if (seenCoverageNotes.has(n.text)) return false;
    seenCoverageNotes.add(n.text);
    return true;
  });

  // Only shifts worth giving away: today or later (no past clutter), on a
  // week the manager has finalized, and not already up for grabs.
  const todayISO = toISODate(new Date());
  const alreadyOffered = new Set(
    coverageRequests.filter((r) => r.requestingWorkerId === currentWorker.id).map((r) => r.shiftId),
  );
  // Swaps only ever involve shifts that haven't happened yet — both yours and
  // theirs — soonest first.
  const upcomingShifts = shifts
    .filter((s) => s.date >= todayISO)
    .sort((a, b) => a.date.localeCompare(b.date) || nightMinutes(a.start) - nightMinutes(b.start));

  const giveAwayShifts = myShifts
    .filter(
      (s) => s.date >= todayISO && mondayKeyFor(s.date) in postedWeeks && !alreadyOffered.has(s.id),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || nightMinutes(a.start) - nightMinutes(b.start));

  const shiftMenuActions: ShiftMenuActions = {
    onAddWorker: handleAddWorkerToShift,
    onRemoveWorker: handleRemoveWorkerFromShift,
    onClearWorkers: handleClearShiftWorkers,
    onSetTime: handleSetShiftTime,
    onCopyToDates: handleCopyShiftToDates,
    onDeleteShift: handleDeleteShift,
  };
  const dayMenuShifts = dayMenu ? shifts.filter((s) => s.date === dayMenu.date) : [];


  // ---- One day's contents ----------------------------------------------
  // Shared by the wide 7-column grid and the day sheet on smaller screens.
  function dayInfo(day: Day) {
    const date = toISODate(weekDates[day]);
    const dayTimeOff = timeOff.filter(
      (r) => r.status === "approved" && date >= r.startDate && date <= r.endDate,
    );
    return { date, dayTimeOff, unavailableWorkerIds: dayTimeOff.map((r) => r.workerId) };
  }

  function renderDayNote(day: Day) {
    const { date } = dayInfo(day);
    return (
      <DayEventNote
        text={eventFor(dayEvents, day, date)}
        isAdmin={isAdmin}
        day={day}
        dateLabel={formatShortDate(weekDates[day])}
        isOneOff={date in dayEvents.dates}
        onSaveWeekly={(text) => handleSaveWeeklyEvent(day, text)}
        onSaveOneOff={(text) => handleSaveOneOffEvent(date, text)}
        onResetToWeekly={() => handleResetEventToWeekly(date)}
      />
    );
  }

  /** Everything a shift's menus need — for its full card, or the phone grid's tap menus. */
  function shiftMenuBase(shift: Shift, day: Day): ShiftMenuBase {
    const { unavailableWorkerIds } = dayInfo(day);
    return {
      shift,
      dayLabel: `${day} ${formatShortDate(weekDates[day])}`,
      assignedWorkers: shift.workerIds
        .map((id) => workers.find((w) => w.id === id))
        .filter((w): w is Worker => Boolean(w)),
      addableWorkers: workers.filter(
        (w) => !shift.workerIds.includes(w.id) && !unavailableWorkerIds.includes(w.id),
      ),
      offWorkers: workers.filter((w) => !shift.workerIds.includes(w.id) && unavailableWorkerIds.includes(w.id)),
      onOffWorkerClick: (id) => openTimeOffFor(id, shift.date),
      copyTargets: DAYS.filter((d) => d !== day).map((d) => ({
        day: d,
        date: toISODate(weekDates[d]),
        dateLabel: formatShortDate(weekDates[d]),
      })),
      actions: shiftMenuActions,
      onExchange: coverageFor(shift).onExchange,
    };
  }

  /** Who's off, the day's shift cards, and (manager) "+ Add shift". */
  function renderDayShifts(day: Day) {
    const { date, dayTimeOff } = dayInfo(day);
    return (
      <>
        <DayTimeOff requests={dayTimeOff} workers={workers} onOpen={isAdmin ? setEditingTimeOffId : undefined} />
        {shifts
          .filter((shift) => shift.date === date)
          .map((shift) => (
            <ShiftCard
              key={shift.id}
              {...shiftMenuBase(shift, day)}
              isAdmin={isAdmin}
              onDropOnShift={handleDropOnShift}
              onDropOnWorker={handleDropOnWorker}
              onMoveShift={handleMoveShiftNextTo}
              {...coverageFor(shift)}
              highlightWorkerId={isAdmin ? undefined : currentWorker.id}
              flash={flashShiftIds.includes(shift.id)}
              selected={!!selected?.shiftIds.includes(shift.id)}
              holdDrag={isAdmin ? holdDrag : undefined}
            />
          ))}
        {isAdmin && (
          <button
            type="button"
            onClick={() => handleAddShift(date)}
            className="rounded-lg border border-dashed border-brite-tan/20 py-1.5 text-xs font-semibold text-brite-tan/50 hover:border-brite-tan/40 hover:text-brite-tan pointer-coarse:py-2.5"
          >
            + Add shift
          </button>
        )}
      </>
    );
  }

  // Day sheet's ‹ › buttons, rolling over into the previous/next week.
  function stepSheetDay(delta: number) {
    if (!sheetDay) return;
    const i = DAYS.indexOf(sheetDay) + delta;
    if (i < 0) {
      setWeekOffset((w) => w - 1);
      setSheetDay("Sun");
    } else if (i >= DAYS.length) {
      setWeekOffset((w) => w + 1);
      setSheetDay("Mon");
    } else {
      setSheetDay(DAYS[i]);
    }
  }

  const requestsSection = (
    <>
      {isAdmin && (
        <ManagerRequests
          timeOff={timeOff}
          coverageRequests={coverageRequests}
          swapRequests={managerSwaps}
          shifts={shifts}
          workers={workers}
          onApproveTimeOff={handleApproveTimeOff}
          onDenyTimeOff={handleDenyTimeOff}
          onResolveCoverage={handleResolveCoverage}
          onDismissCoverage={setDismissConfirm}
          onAssignCover={handleAssignCover}
          onApproveSwap={setApprovingSwap}
          onDenySwap={handleDenySwap}
          onOpen={handleOpenFromRequest}
          selectedKey={selected?.key}
        />
      )}
      {!isAdmin && (
        <MyRequests
          me={currentWorker}
          workers={workers}
          shifts={shifts}
          timeOff={timeOff}
          coverageRequests={coverageRequests}
          swapRequests={swapRequests}
          todayISO={todayISO}
          onCancelTimeOff={handleCancelTimeOff}
          onCancelGiveAway={handleRemoveCoverageRequest}
          onCancelSwap={handleCancelMySwap}
          onAcceptSwap={handleAcceptSwap}
          onDeclineSwap={handleDeclineSwap}
          onOpen={handleOpenFromRequest}
          selectedKey={selected?.key}
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
          onOpen={handleOpenFromRequest}
          selectedKey={selected?.key}
        />
      )}
    </>
  );

  const calendarSection =
    viewMode === "month" ? (
      <MonthView
        monthOffset={monthOffset}
        shifts={shifts}
        workers={workers}
        timeOff={timeOff}
        onSelectDate={handleSelectDateFromMonth}
        highlightWorkerId={isAdmin ? undefined : currentWorker.id}
        attentionByDate={isAdmin ? attentionByDate() : undefined}
      />
    ) : (
      <div className="relative">
        {weekInTheWorks && <ScheduleInTheWorks weekLabel={weekLabel} />}
        <div
          aria-hidden={weekInTheWorks || undefined}
          className={weekInTheWorks ? "pointer-events-none select-none opacity-70 blur-[3px]" : undefined}
        >
          {isWide ? (
            <div id="week-grid" className="grid grid-cols-7 gap-2 xl:gap-3">
              {DAYS.map((day) => {
                const { date } = dayInfo(day);
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
                              date,
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
                            setShiftDragOverDate(date);
                          }
                        : undefined
                    }
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      setShiftDragOverDate((d) => (d === date ? null : d));
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
                            if (shiftId) handleMoveShiftToDay(shiftId, date);
                          }
                        : undefined
                    }
                    // Where a press-and-hold shift drag can land (see useHoldDrag).
                    data-drop-day={date}
                    // @container: its shift cards size themselves to this column's width.
                    className={`group/day @container -m-1 flex min-w-0 flex-col gap-2 rounded-xl p-1 transition-colors xl:-m-1.5 xl:p-1.5 ${
                      shiftDragOverDate === date ||
                      (holdDrag.dragged?.kind === "shift" && holdDrag.target?.date === date && !holdDrag.target.shiftId)
                        ? "bg-brite-amber/5 ring-1 ring-brite-amber/25"
                        : ""
                    }`}
                  >
                    <div className="text-center">
                      <div className="relative">
                        <div
                          className={`mx-auto w-fit rounded-full px-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                            selected?.dates.includes(date)
                              ? "bg-brite-amber/20 text-brite-amber ring-1 ring-brite-amber/40"
                              : "text-brite-tan/70"
                          }`}
                        >
                          {day}
                        </div>
                        {isAdmin && (
                          // The day menu is a right-click on computers; touch
                          // screens have no right-click, so they get this ⋯.
                          <button
                            type="button"
                            aria-label={`${day} options`}
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setDayMenu({
                                x: rect.left,
                                y: rect.bottom + 4,
                                date,
                                label: `${day} ${formatShortDate(weekDates[day])}`,
                              });
                            }}
                            className="absolute -top-1 right-0 hidden rounded px-1.5 py-1 leading-none text-brite-tan/60 pointer-coarse:block"
                          >
                            ⋯
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-brite-tan/40">{formatShortDate(weekDates[day])}</div>
                      {/* Fixed min-height (not conditional) so every day column reserves the
                          same header space, whether or not it has an event — otherwise the
                          shift cards below started at different heights per column. */}
                      <div className="mt-0.5 min-h-[2.25rem]">{renderDayNote(day)}</div>
                    </div>
                    {renderDayShifts(day)}
                  </div>
                );
              })}
            </div>
          ) : (
            // No room for seven full columns: the week as a compact overview;
            // tapping a day opens its full editor in a sheet (below).
            <div id="week-grid">
              <WeekOverview
                weekOffset={weekOffset}
                weekDates={weekDates}
                shifts={shifts}
                workers={workers}
                timeOff={timeOff}
                hasNote={(day, date) => !!eventFor(dayEvents, day, date)}
                toneFor={(shift) => coverageFor(shift).coverage?.tone}
                highlightWorkerId={isAdmin ? undefined : currentWorker.id}
                todayISO={todayISO}
                selectedDay={sheetDay}
                onOpenDay={setSheetDay}
                onSwipeWeek={(delta) => setWeekOffset((w) => w + delta)}
                holdDrag={isAdmin ? holdDrag : undefined}
                onShiftTap={
                  isAdmin
                    ? (shiftId, kind, at, workerId) => setQuickMenu({ shiftId, kind, ...at, workerId })
                    : undefined
                }
                onAddShift={isAdmin ? handleAddShift : undefined}
                onDayMenu={
                  isAdmin
                    ? (day, at) =>
                        setDayMenu({
                          ...at,
                          date: toISODate(weekDates[day]),
                          label: `${day} ${formatShortDate(weekDates[day])}`,
                        })
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-brite-black">
      <StarField seed={viewMode === "week" ? toISODate(monday) : `month:${monthOffset}`} />
      {/* relative: positioned so it paints above the fixed star layer. */}
      <header className="relative flex items-center justify-between gap-3 border-b border-brite-tan/10 px-4 py-3 sm:px-6 sm:py-3.5">
        <BritestarLogo compact />
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Phones: the avatar's initials say who's logged in; no room for the name too. */}
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-brite-white">
              {isAdmin ? "Manager View" : currentWorker.name}
            </div>
            <div className="text-xs text-brite-tan/50">
              {isAdmin ? "Full schedule control" : "Bartender"}
            </div>
          </div>
          {!isAdmin && (
            <NotificationCenter
              notifications={myNotifications}
              onMarkRead={(id) =>
                setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)))
              }
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
            className="ml-1 whitespace-nowrap text-xs font-semibold text-brite-tan/50 hover:text-brite-tan sm:ml-2"
          >
            Log out
          </Link>
        </div>
      </header>

      <main className="relative p-4 sm:p-6">
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

          {/* Compact buttons, with shorter labels on phones so they fit in one row. */}
          <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={handleUndo}
                disabled={history.length === 0}
                aria-label="Undo"
                className="rounded-lg border border-brite-tan/15 px-2.5 py-1.5 text-xs font-semibold text-brite-tan/70 hover:border-brite-tan/40 hover:text-brite-tan disabled:opacity-30 sm:text-sm"
              >
                ↺<span className="hidden sm:inline"> Undo</span>
              </button>
            )}
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => setShowManageWorkers((v) => !v)}>
                {showManageWorkers ? (
                  <ShortLabel short="Hide" long="Hide bartenders" />
                ) : (
                  <ShortLabel short="Bartenders" long="Manage bartenders" />
                )}
              </Button>
            )}
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => setShowAvailability((v) => !v)}>
                {showAvailability ? (
                  <ShortLabel short="Hide" long="Hide availability" />
                ) : (
                  <ShortLabel short="Availability" long="View availability" />
                )}
              </Button>
            )}
            {isAdmin && viewMode === "week" && (
              <FinalizeButton
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
                  ["availability", "Availability", "Set availability"],
                  ["timeoff", "Time off", "Request time off"],
                  ["coverage", "Give away", "Give away shift"],
                  ["swap", "Swap", "Swap shift"],
                ] as const
              ).map(([tab, short, long]) => (
                <Button
                  key={tab}
                  variant="ghost"
                  size="sm"
                  className={requestTab === tab ? "border-brite-amber text-brite-amber hover:border-brite-amber" : ""}
                  onClick={() => setRequestTab(requestTab === tab ? null : tab)}
                >
                  <ShortLabel short={short} long={long} />
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
            holdDrag={holdDrag}
            holdDragMouse={!isWide}
          />
        )}

        {isAdmin && showAvailability && (
          <AvailabilityPanel availability={availability} workers={workers} />
        )}

        {!isAdmin && (requestTab === "availability" || requestTab === "timeoff") && (
          <SetAvailabilityPanel
            // A new key per button, so switching between them reopens on the right tab.
            key={requestTab}
            startTab={requestTab === "timeoff" ? "days-off" : "general"}
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
            myShifts={upcomingShifts.filter((s) => s.workerIds.includes(currentWorker.id))}
            otherWorkers={workers.filter((w) => w.id !== currentWorker.id)}
            shifts={upcomingShifts}
            onSubmit={handleRequestSwap}
            onCancel={() => setRequestTab(null)}
          />
        )}

        {/* Wide screens: requests, then the week. Smaller screens lead with
            the week — it's what people open the app to see. */}
        {isWide ? (
          <>
            {requestsSection}
            {calendarSection}
          </>
        ) : (
          <>
            {calendarSection}
            <div className="mt-6">{requestsSection}</div>
          </>
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
            startPicking={resolveStartPicking}
            onClose={() => setResolveConfirm(null)}
          />
        )}

        {editingTimeOffId &&
          (() => {
            const request = timeOff.find((r) => r.id === editingTimeOffId);
            const worker = request && workers.find((w) => w.id === request.workerId);
            if (!request || !worker) return null;
            return (
              <TimeOffDialog
                key={request.id}
                request={request}
                worker={worker}
                todayISO={todayISO}
                onSave={(start, end) => handleUpdateTimeOff(request.id, start, end)}
                onCancelTimeOff={() => handleManagerCancelTimeOff(request.id)}
                onClose={() => setEditingTimeOffId(null)}
              />
            );
          })()}

        {approvingSwap &&
          (() => {
            const r = approvingSwap;
            const requester = workers.find((w) => w.id === r.requestingWorkerId);
            const target = workers.find((w) => w.id === r.targetWorkerId);
            const mine = shifts.find((s) => s.id === r.requestingShiftId);
            const theirs = shifts.find((s) => s.id === r.targetShiftId);
            if (!requester || !target || !mine || !theirs) return null;
            return (
              <SwapApproveDialog
                requester={requester}
                target={target}
                requesterShift={mine}
                targetShift={theirs}
                onApprove={() => handleApproveSwap(r)}
                onDeny={() => handleDenySwap(r.id)}
                onClose={() => setApprovingSwap(null)}
              />
            );
          })()}

        {toast && (
          <div
            role="status"
            // bottom: clear of the iPhone home bar when installed.
            className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-[70] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-brite-tan/25 bg-brite-black-soft py-2 pl-4 pr-4 text-sm text-brite-cream shadow-2xl shadow-black/60"
          >
            <span className="text-center">{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  handleUndo();
                  setToast(null);
                }}
                className="-my-1 -mr-2 shrink-0 rounded-full px-3 py-1 font-bold text-brite-amber hover:bg-brite-amber/10"
              >
                Undo
              </button>
            )}
          </div>
        )}

        {quickMenu &&
          (() => {
            const shift = shifts.find((s) => s.id === quickMenu.shiftId);
            if (!shift) return null;
            return (
              <ShiftQuickMenu
                key={`${quickMenu.shiftId}-${quickMenu.kind}-${quickMenu.workerId ?? ""}`}
                kind={quickMenu.kind}
                x={quickMenu.x}
                y={quickMenu.y}
                focusWorkerId={quickMenu.workerId}
                onClose={() => setQuickMenu(null)}
                {...shiftMenuBase(shift, dateToDayName(fromISODate(shift.date)))}
              />
            );
          })()}

        {/* Small screens: one day's full editor, opened from the week overview. */}
        {!isWide && viewMode === "week" && sheetDay && (
          <Sheet onClose={() => setSheetDay(null)} labelledBy="day-sheet-title">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stepSheetDay(-1)}
                aria-label="Previous day"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-brite-tan/70 hover:bg-brite-tan/10 active:bg-brite-tan/10"
              >
                ‹
              </button>
              <div className="min-w-0 flex-1 text-center">
                <h2 id="day-sheet-title" className="text-base font-bold text-brite-white">
                  {DAY_FULL_NAMES[sheetDay]}
                  {toISODate(weekDates[sheetDay]) === todayISO && (
                    <span className="ml-2 rounded-full bg-brite-red px-2 py-0.5 align-middle text-[10px] font-bold uppercase text-brite-white">
                      Today
                    </span>
                  )}
                </h2>
                <div className="text-xs text-brite-tan/50">{formatShortDate(weekDates[sheetDay])}</div>
              </div>
              <button
                type="button"
                onClick={() => stepSheetDay(1)}
                aria-label="Next day"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-brite-tan/70 hover:bg-brite-tan/10 active:bg-brite-tan/10"
              >
                ›
              </button>
            </div>
            <div className="mt-1 text-center">{renderDayNote(sheetDay)}</div>
            <div className="@container mt-3 flex flex-col gap-2">{renderDayShifts(sheetDay)}</div>
            {isAdmin && (
              // On a computer these live on a right-click of the day; touch
              // screens have no right-click, so they get a button.
              <button
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDayMenu({
                    x: rect.left,
                    y: rect.top - 8,
                    date: toISODate(weekDates[sheetDay]),
                    label: `${sheetDay} ${formatShortDate(weekDates[sheetDay])}`,
                  });
                }}
                className="mt-3 w-full rounded-lg py-2 text-xs font-semibold text-brite-tan/50 hover:text-brite-tan"
              >
                ⋯ Day options (sort, clear, delete)
              </button>
            )}
          </Sheet>
        )}

        {copyPrevFor &&
          (() => {
            const date = copyPrevFor;
            const day = dateToDayName(fromISODate(date));
            const lastMonday = getMondayOfWeek(weekOffset - 1);
            const week = copyPlan("week", date);
            const one = copyPlan("day", date);
            return (
              <CopyPreviousWeekDialog
                dayName={DAY_FULL_NAMES[day]}
                week={{
                  from: formatWeekRange(lastMonday),
                  to: formatWeekRange(monday),
                  shiftCount: week.shiftCount,
                  pendingRequests: week.pendingRequests,
                }}
                day={{
                  from: `${day} ${formatShortDate(fromISODate(weekBefore(date)))}`,
                  to: `${day} ${formatShortDate(fromISODate(date))}`,
                  shiftCount: one.shiftCount,
                  pendingRequests: one.pendingRequests,
                }}
                onCopy={(scope) => {
                  handleCopyFromPreviousWeek(scope, date);
                  setCopyPrevFor(null);
                }}
                onClose={() => setCopyPrevFor(null)}
              />
            );
          })()}

        {dismissConfirm && (
          <DismissCoverageDialog
            shift={shifts.find((s) => s.id === dismissConfirm.shiftId)}
            worker={workers.find((w) => w.id === dismissConfirm.requestingWorkerId)}
            note={dismissConfirm.note}
            onDismiss={() => handleDismissCoverage(dismissConfirm)}
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
            <MenuItem
              icon="⟲"
              label="Copy from previous week…"
              onClick={() => {
                openCopyFromPreviousWeek(dayMenu.date);
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

        <HoldDragGhost drag={holdDrag} />
        <InstallAppLink />
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
  startPicking?: boolean;
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
  startPicking = false,
  onClose,
}: ResolveCoverageDialogProps) {
  const [picking, setPicking] = useState(startPicking);
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
