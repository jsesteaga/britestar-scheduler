import { useRef, useState } from "react";
import type { HoldDrag } from "../hooks/useHoldDrag";
import type { Day, Shift, TimeOffRequest, Worker } from "../types";
import { initialsFor } from "../utils/initials";
import { formatCompactTime } from "../utils/time";
import { DAYS, formatShortDate, toISODate } from "../utils/week";
import type { CoverageHighlight } from "./ShiftCard";
import type { QuickMenuKind } from "./ShiftQuickMenu";

type WeekOverviewProps = {
  weekOffset: number;
  weekDates: Record<Day, Date>;
  shifts: Shift[];
  workers: Worker[];
  timeOff: TimeOffRequest[];
  // Days with an event note (Paint Night, …) get a little amber dot.
  hasNote: (day: Day, date: string) => boolean;
  // Same color coding as the full shift cards: yours, needs coverage, etc.
  toneFor: (shift: Shift) => CoverageHighlight["tone"] | undefined;
  highlightWorkerId?: string;
  todayISO: string;
  // The day whose editor is (or was last) open — outlined.
  selectedDay: Day | null;
  onOpenDay: (day: Day) => void;
  // -1 / +1 when the overview is swiped right / left.
  onSwipeWeek: (delta: number) => void;
  // Manager only: press-and-hold a name, then drag it onto another shift
  // (see useHoldDrag — SchedulePage owns it, so drops land in one place).
  holdDrag?: HoldDrag;
  // Manager only: a name, time or "+" was tapped — open that menu at `at`
  // (see ShiftQuickMenu).
  onShiftTap?: (shiftId: string, kind: QuickMenuKind, at: { x: number; y: number }, workerId?: string) => void;
  onAddShift?: (date: string) => void;
  // Manager only: press and hold (or right-click) a day's date for the day
  // menu — sort, copy from previous week, clear, delete.
  onDayMenu?: (day: Day, at: { x: number; y: number }) => void;
};

const BLOCK_TONE: Record<CoverageHighlight["tone"] | "none", string> = {
  mine: "border-l-brite-green bg-brite-green/15",
  green: "border-l-brite-green bg-brite-green/15",
  amber: "border-l-brite-amber bg-brite-amber/10",
  red: "border-l-brite-amber bg-brite-amber/10",
  none: "border-l-brite-red/70 bg-brite-black-soft/80",
};

// How far (px) a finger has to travel sideways to count as a week swipe.
const SWIPE_DISTANCE = 60;
// Press and hold a date this long for the day menu.
const DAY_MENU_HOLD_MS = 500;
/**
 * The whole week side by side on smaller screens, Google Calendar style: each
 * day is a column of shift blocks listing who's on. Tapping a day opens its
 * full editor (a bottom sheet, in SchedulePage). Swiping changes the week.
 */
export function WeekOverview({
  weekOffset,
  weekDates,
  shifts,
  workers,
  timeOff,
  hasNote,
  toneFor,
  highlightWorkerId,
  todayISO,
  selectedDay,
  onOpenDay,
  onSwipeWeek,
  holdDrag,
  onShiftTap,
  onAddShift,
  onDayMenu,
}: WeekOverviewProps) {
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  // A press on a date that may turn into "hold for the day menu". fired:
  // the menu opened, so the tap that follows the release mustn't also open
  // the day.
  const datePress = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);

  function openDayMenu(day: Day, at: { x: number; y: number }) {
    navigator.vibrate?.(12);
    onDayMenu?.(day, at);
  }

  // Which way the week just changed, so the new week slides in from that
  // side. (Tracked during render, React's pattern for "compare with the
  // previous value" without an extra effect.)
  const [prevOffset, setPrevOffset] = useState(weekOffset);
  const [direction, setDirection] = useState<"next" | "prev" | null>(null);
  if (weekOffset !== prevOffset) {
    setPrevOffset(weekOffset);
    setDirection(weekOffset > prevOffset ? "next" : "prev");
  }

  const dragged = holdDrag?.dragged;
  const target = holdDrag?.target;
  const canEdit = !!onShiftTap;

  // A tap on a name/time/"+": its menu opens just below it. Doesn't also
  // open the day (stopPropagation), and isn't the end of a drag.
  function tap(e: React.MouseEvent<HTMLElement>, shiftId: string, kind: QuickMenuKind, workerId?: string) {
    e.stopPropagation();
    if (holdDrag?.isBusy()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onShiftTap?.(shiftId, kind, { x: rect.left, y: rect.bottom + 4 }, workerId);
  }

  return (
    <div
      className="overflow-hidden"
      onTouchStart={(e) => {
        const t = e.touches[0];
        swipeStart.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start || holdDrag?.isBusy()) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        // Mostly sideways only — a vertical scroll that drifts a bit isn't a swipe.
        if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
          onSwipeWeek(dx < 0 ? 1 : -1);
        }
      }}
    >
      <div
        // A new key per week restarts the slide-in animation.
        key={weekOffset}
        className={`grid grid-cols-7 gap-1 sm:gap-1.5 ${
          direction === "next" ? "week-slide-next" : direction === "prev" ? "week-slide-prev" : ""
        }`}
      >
        {DAYS.map((day) => {
          const date = toISODate(weekDates[day]);
          const dayShifts = shifts.filter((s) => s.date === date);
          const offCount = timeOff.filter(
            (r) => r.status === "approved" && date >= r.startDate && date <= r.endDate,
          ).length;
          const selected = day === selectedDay;
          const isToday = date === todayISO;
          // A whole shift held over this day's empty space: it'd move here.
          const shiftOverDay = dragged?.kind === "shift" && target?.date === date && !target.shiftId;

          return (
            <div
              key={day}
              data-drop-day={date}
              // Tapping the date or any empty space opens the whole day.
              // Names, times and "+" (manager) handle their own taps.
              onClick={() => {
                if (datePress.current?.fired) {
                  datePress.current = null;
                  return;
                }
                if (!holdDrag?.isBusy()) onOpenDay(day);
              }}
              className={`flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-lg p-0.5 pb-2 transition-colors sm:p-1 ${
                selected ? "bg-brite-tan/[0.07] ring-1 ring-brite-red/60" : ""
              } ${date < todayISO && !selected && !dragged ? "opacity-50" : ""} ${
                shiftOverDay ? "bg-brite-amber/10 ring-1 ring-brite-amber/50" : ""
              }`}
            >
              <button
                type="button"
                aria-label={`${day} ${formatShortDate(weekDates[day])}: open day`}
                // Hold (touch) or right-click (mouse): the day menu.
                onPointerDown={
                  onDayMenu
                    ? (e) => {
                        if (e.pointerType === "mouse") return;
                        const at = { x: e.clientX, y: e.clientY };
                        datePress.current = {
                          ...at,
                          fired: false,
                          timer: window.setTimeout(() => {
                            if (datePress.current) datePress.current.fired = true;
                            openDayMenu(day, at);
                          }, DAY_MENU_HOLD_MS),
                        };
                      }
                    : undefined
                }
                onPointerMove={(e) => {
                  const p = datePress.current;
                  if (p && !p.fired && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) {
                    window.clearTimeout(p.timer);
                    datePress.current = null;
                  }
                }}
                onPointerUp={() => {
                  const p = datePress.current;
                  if (p && !p.fired) {
                    window.clearTimeout(p.timer);
                    datePress.current = null;
                  }
                }}
                onPointerCancel={() => {
                  if (datePress.current) window.clearTimeout(datePress.current.timer);
                  datePress.current = null;
                }}
                onContextMenu={
                  onDayMenu
                    ? (e) => {
                        e.preventDefault();
                        // Android also fires this on a long press — the timer
                        // above has (or will have) handled that.
                        if (datePress.current) return;
                        openDayMenu(day, { x: e.clientX, y: e.clientY });
                      }
                    : undefined
                }
                className="flex select-none flex-col items-center rounded-md pt-0.5 leading-tight [-webkit-touch-callout:none] active:bg-brite-tan/[0.08]"
              >
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide ${
                    isToday ? "text-brite-red-bright" : "text-brite-tan/60"
                  }`}
                >
                  {day}
                </span>
                <span
                  className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    isToday ? "bg-brite-red text-brite-white" : "text-brite-cream"
                  }`}
                >
                  {weekDates[day].getDate()}
                </span>
                <span
                  className={`mt-0.5 h-1 w-1 rounded-full ${hasNote(day, date) ? "bg-brite-amber" : "bg-transparent"}`}
                />
              </button>

              {dayShifts.length === 0 && (
                <span className="text-center text-[10px] text-brite-tan/25">—</span>
              )}
              {dayShifts.map((shift) => {
                const tone = toneFor(shift);
                const people = shift.workerIds
                  .map((id) => workers.find((w) => w.id === id))
                  .filter((w): w is Worker => Boolean(w));
                // Held over this block: a name from elsewhere, or another whole shift.
                const isTarget =
                  target?.shiftId === shift.id &&
                  (dragged?.kind === "person" ? dragged.fromShiftId !== shift.id : dragged?.shiftId !== shift.id);
                const liftedShift = dragged?.kind === "shift" && dragged.shiftId === shift.id;
                const label = `${day} ${formatCompactTime(shift.start)}–${formatCompactTime(shift.end)}`;
                const time = (
                  <>
                    {tone === "red" && <span className="text-brite-amber">! </span>}
                    {/* <wbr> lets "12:30–5:30" break after the dash in a narrow column. */}
                    {formatCompactTime(shift.start)}–<wbr />
                    {formatCompactTime(shift.end)}
                  </>
                );
                const timeClass =
                  "rounded text-left text-[10.5px] font-bold leading-tight tracking-tight text-brite-cream sm:px-0.5 sm:text-[11px]";
                return (
                  <div
                    key={shift.id}
                    data-drop-shift={shift.id}
                    className={`flex flex-col gap-1 rounded-md border-l-2 px-0.5 py-1.5 transition-shadow sm:px-1 ${BLOCK_TONE[tone ?? "none"]} ${
                      isTarget && (!target?.workerId || dragged?.kind === "shift") ? "ring-2 ring-brite-amber" : ""
                    } ${liftedShift ? "opacity-30" : ""}`}
                  >
                    {canEdit ? (
                      <button
                        type="button"
                        aria-label={`Change time, ${label}`}
                        // Tap: change the time. Press and hold: move the whole shift.
                        onClick={(e) => tap(e, shift.id, "time")}
                        onPointerDown={
                          holdDrag ? (e) => holdDrag.start(e, { kind: "shift", shiftId: shift.id, label }) : undefined
                        }
                        onContextMenu={(e) => e.preventDefault()}
                        className={`${timeClass} cursor-grab select-none [-webkit-touch-callout:none] active:bg-brite-tan/15`}
                      >
                        {time}
                      </button>
                    ) : (
                      <span className={timeClass}>{time}</span>
                    )}
                    {people.length === 0 && (
                      <span className="px-0.5 text-[10px] italic text-brite-tan/40">open</span>
                    )}
                    {people.map((w) => {
                      const isMe = w.id === highlightWorkerId;
                      const lifted = dragged?.kind === "person" && dragged.workerId === w.id && dragged.fromShiftId === shift.id;
                      const swapTarget = isTarget && dragged?.kind === "person" && target?.workerId === w.id;
                      const chipClass = `block h-6 w-full truncate rounded px-0.5 text-center text-[11px] font-bold leading-6 text-brite-white transition-opacity sm:px-1.5 sm:text-left sm:font-semibold ${
                        isMe ? "ring-2 ring-brite-green ring-offset-1 ring-offset-brite-black" : ""
                      } ${lifted ? "opacity-30" : ""} ${
                        swapTarget ? "ring-2 ring-brite-amber ring-offset-1 ring-offset-brite-black" : ""
                      }`;
                      const name = (
                        <>
                          {/* Phones: initials. Wider: the name. */}
                          <span className="sm:hidden">{initialsFor(w.name)}</span>
                          <span className="hidden sm:inline">{w.name}</span>
                        </>
                      );
                      return canEdit ? (
                        <button
                          key={w.id}
                          type="button"
                          data-drop-worker={w.id}
                          title={w.name}
                          aria-label={`${w.name}: options`}
                          style={{ backgroundColor: w.avatarColor }}
                          // Tap: this person's options. Press and hold: drag them.
                          onClick={(e) => tap(e, shift.id, "menu", w.id)}
                          onPointerDown={
                            holdDrag
                              ? (e) => holdDrag.start(e, { kind: "person", workerId: w.id, fromShiftId: shift.id, name: w.name, color: w.avatarColor })
                              : undefined
                          }
                          // Android's long-press menu would otherwise pop up mid-drag.
                          onContextMenu={(e) => e.preventDefault()}
                          className={`${chipClass} cursor-grab select-none [-webkit-touch-callout:none] active:brightness-125`}
                        >
                          {name}
                        </button>
                      ) : (
                        <span
                          key={w.id}
                          data-drop-worker={w.id}
                          title={w.name}
                          style={{ backgroundColor: w.avatarColor }}
                          className={chipClass}
                        >
                          {name}
                        </span>
                      );
                    })}
                    {canEdit && (
                      <button
                        type="button"
                        aria-label={`Add a bartender, ${label}`}
                        onClick={(e) => tap(e, shift.id, "add")}
                        className="h-6 rounded border border-dashed border-brite-tan/25 text-xs font-bold leading-none text-brite-tan/50 active:bg-brite-tan/10"
                      >
                        +
                      </button>
                    )}
                  </div>
                );
              })}

              {offCount > 0 && (
                <span className="text-center text-[10px] font-semibold text-brite-tan/45">{offCount} off</span>
              )}
              {onAddShift && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddShift(date);
                  }}
                  className="rounded border border-dashed border-brite-tan/15 py-1 text-[10px] font-semibold leading-tight text-brite-tan/40 active:bg-brite-tan/10"
                >
                  + shift
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-center text-[11px] text-brite-tan/35">
        {canEdit
          ? "Tap a name, time or + to edit · hold a name or time to drag it · hold a date for day options"
          : "Tap a day for details"}
        <span className="hidden pointer-coarse:inline"> · swipe for other weeks</span>
      </p>
    </div>
  );
}
