import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { eventFor, getDayEvents, saveDayEvents, type DayEvents } from "../data/events";
import {
  ensureWeeksGenerated,
  getAvailability,
  getCoverageRequests,
  getGeneratedWeeks,
  getShifts,
  getSwapRequests,
  getTimeOff,
  saveAvailability,
  saveCoverageRequests,
  saveShifts,
  saveSwapRequests,
  saveTimeOff,
} from "../data/scheduleStore";
import { addWorker, getWorkers, managerView, removeWorker, saveWorkers } from "../data/workers";
import type {
  Availability,
  CoverageRequest,
  Day,
  DayAvailability,
  Shift,
  SwapRequest,
  TimeOffRequest,
  Worker,
} from "../types";
import { getShiftDrag, isShiftDrag, type DragPayload } from "../utils/dnd";
import { displayTimeToInputValue, formatCompactTime } from "../utils/time";
import {
  DAYS,
  formatFriendlyDate,
  formatMonthTitle,
  formatShortDate,
  formatWeekRange,
  getDatesForWeek,
  getMondayOfWeek,
  getMonthGrid,
  toISODate,
  weekOffsetForDate,
} from "../utils/week";
import { AvailabilityPanel } from "./AvailabilityPanel";
import { BritestarLogo } from "./BritestarLogo";
import { CoverageRequestForm } from "./CoverageRequestForm";
import { DayEventNote } from "./DayEventNote";
import { ManageWorkersPanel } from "./ManageWorkersPanel";
import { MonthView } from "./MonthView";
import type { RequestRow } from "./RequestsPanel";
import { RequestsPanel } from "./RequestsPanel";
import { SetAvailabilityPanel } from "./SetAvailabilityPanel";
import { ShiftCard } from "./ShiftCard";
import type { ShiftMenuActions } from "./ShiftContextMenu";
import { StarField } from "./StarField";
import { SwapRequestForm } from "./SwapRequestForm";
import { TimeOffCard } from "./TimeOffCard";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
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
};

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
  const [dayEvents, setDayEventsRaw] = useState<DayEvents>(() => getDayEvents());

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
  function setShifts(next: Shift[] | ((current: Shift[]) => Shift[])) {
    setShiftsRaw((current) => {
      const resolved = typeof next === "function" ? (next as (c: Shift[]) => Shift[])(current) : next;
      saveShifts(resolved);
      return resolved;
    });
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

  // What names look like on screen: managers see their private view names
  // (managerName) in place of real ones; bartenders always see real names.
  const shownWorkers = isAdmin ? managerView(workers) : workers;

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
      { shifts, workers, timeOff, coverageRequests, swapRequests, availability, dayEvents },
    ]);
  }

  function handleUndo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setShifts(last.shifts);
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

  function handleRemoveWorker(workerId: string) {
    pushHistory();
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

  // Empty string clears it, so they show under their own name again.
  function handleSetManagerName(workerId: string, name: string) {
    pushHistory();
    setWorkers((current) =>
      current.map((w) => (w.id === workerId ? { ...w, managerName: name || undefined } : w)),
    );
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

  function handleAddShift(date: string) {
    pushHistory();
    setShifts((current) => [
      ...current,
      { id: `s${Date.now()}`, date, start: "12:00 PM", end: "5:00 PM", workerIds: [] },
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
    setRequestTab(null);
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

  const myShifts = shifts.filter((s) => s.workerIds.includes(currentWorker.id));

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

  const requestRows: RequestRow[] = [
    ...timeOff
      .filter((r) => r.status === "pending")
      .map((r): RequestRow | null => {
        const worker = shownWorkers.find((w) => w.id === r.workerId);
        if (!worker) return null;
        return {
          id: `pto-${r.id}`,
          content: (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-brite-black/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brite-amber">
                Time off
              </span>
              <Avatar name={worker.name} color={worker.avatarColor} size="sm" />
              <span className="text-sm text-brite-white">
                {worker.name} —{" "}
                {r.startDate === r.endDate
                  ? formatFriendlyDate(r.startDate)
                  : `${formatFriendlyDate(r.startDate)} – ${formatFriendlyDate(r.endDate)}`}
              </span>
              {r.reason && <span className="text-xs text-brite-tan/60">({r.reason})</span>}
            </div>
          ),
          onApprove: () => handleApproveTimeOff(r.id),
          approveLabel: "Approve",
          onDeny: () => handleDenyTimeOff(r.id),
          denyLabel: "Deny",
        };
      })
      .filter((r): r is RequestRow => r !== null),
    ...coverageRequests
      .map((r): RequestRow | null => {
        const worker = shownWorkers.find((w) => w.id === r.requestingWorkerId);
        const shift = shifts.find((s) => s.id === r.shiftId);
        if (!worker || !shift) return null;
        return {
          id: `cov-${r.id}`,
          content: (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-brite-black/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brite-amber">
                Coverage
              </span>
              <Avatar name={worker.name} color={worker.avatarColor} size="sm" />
              <span className="text-sm text-brite-white">
                {worker.name} needs coverage — {formatFriendlyDate(shift.date)}{" "}
                {formatCompactTime(shift.start)}–{formatCompactTime(shift.end)}
              </span>
              {r.note && <span className="text-xs text-brite-tan/60">({r.note})</span>}
            </div>
          ),
          onApprove: () => handleRemoveCoverageRequest(r.id),
          approveLabel: "Mark resolved",
          onDeny: () => handleRemoveCoverageRequest(r.id),
          denyLabel: "Dismiss",
        };
      })
      .filter((r): r is RequestRow => r !== null),
    ...swapRequests
      .map((r): RequestRow | null => {
        const requester = shownWorkers.find((w) => w.id === r.requestingWorkerId);
        const target = shownWorkers.find((w) => w.id === r.targetWorkerId);
        const myShift = shifts.find((s) => s.id === r.requestingShiftId);
        const targetShift = shifts.find((s) => s.id === r.targetShiftId);
        if (!requester || !target || !myShift || !targetShift) return null;
        return {
          id: `swap-${r.id}`,
          content: (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-brite-black/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brite-amber">
                Swap
              </span>
              <span className="text-sm text-brite-white">
                {requester.name} ({formatFriendlyDate(myShift.date)}{" "}
                {formatCompactTime(myShift.start)}–{formatCompactTime(myShift.end)}) ⇄{" "}
                {target.name} ({formatFriendlyDate(targetShift.date)}{" "}
                {formatCompactTime(targetShift.start)}–{formatCompactTime(targetShift.end)})
              </span>
            </div>
          ),
          onApprove: () => handleApproveSwap(r),
          approveLabel: "Approve swap",
          onDeny: () => handleDenySwap(r.id),
          denyLabel: "Deny",
        };
      })
      .filter((r): r is RequestRow => r !== null),
  ];

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

        {viewMode === "week" && weekOffset !== 0 && (
          <p className="mb-4 text-xs text-brite-tan/40">
            Note: without a backend yet, every week shows the same template shifts — real
            per-week history will come once schedules are actually saved.
          </p>
        )}

        {isAdmin && showManageWorkers && (
          <ManageWorkersPanel
            workers={workers}
            onAdd={handleAddWorker}
            onRemove={handleRemoveWorker}
            onReorder={handleReorderWorker}
            onSetManagerName={handleSetManagerName}
          />
        )}

        {isAdmin && showAvailability && (
          <AvailabilityPanel availability={availability} workers={shownWorkers} />
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
            myShifts={myShifts}
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

        {isAdmin && <RequestsPanel rows={requestRows} />}

        {viewMode === "month" ? (
          <MonthView
            monthOffset={monthOffset}
            shifts={shifts}
            workers={shownWorkers}
            timeOff={timeOff}
            onSelectDate={handleSelectDateFromMonth}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
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
                      worker={shownWorkers.find((w) => w.id === request.workerId) ?? null}
                    />
                  ))}
                  {dayShifts.map((shift) => {
                    const assignedWorkers = shift.workerIds
                      .map((id) => shownWorkers.find((w) => w.id === id))
                      .filter((w): w is Worker => Boolean(w));
                    const addableWorkers = shownWorkers.filter(
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
