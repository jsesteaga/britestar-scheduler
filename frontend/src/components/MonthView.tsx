import type { Shift, TimeOffRequest, Worker } from "../types";
import { formatCompactTime } from "../utils/time";
import { getMonthGrid, isInMonth, isSameDate, toISODate } from "../utils/week";
import { Avatar } from "./ui/Avatar";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type MonthViewProps = {
  monthOffset: number;
  shifts: Shift[];
  workers: Worker[];
  timeOff: TimeOffRequest[];
  onSelectDate: (date: Date) => void;
  // Bartender view: days they're working get highlighted.
  highlightWorkerId?: string;
  // Manager view: how many things need resolving on each date.
  attentionByDate?: Record<string, number>;
};

export function MonthView({
  monthOffset,
  shifts,
  workers,
  timeOff,
  onSelectDate,
  highlightWorkerId,
  attentionByDate,
}: MonthViewProps) {
  const weeks = getMonthGrid(monthOffset);
  const today = new Date();

  return (
    <div>
      <p className="mb-3 text-xs text-brite-tan/50">
        Pick any day to jump to that week's full schedule.
      </p>
      <div className="overflow-hidden rounded-xl border border-brite-tan/15">
        <div className="grid grid-cols-7 bg-brite-black-soft/80">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="py-2 text-center text-xs font-bold uppercase tracking-wide text-brite-tan/70"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flatMap((week) =>
            week.map((date) => {
              const dateStr = toISODate(date);
              const dayShifts = shifts.filter((s) => s.date === dateStr);
              const workerIds = [...new Set(dayShifts.flatMap((s) => s.workerIds))];
              const dayWorkers = workerIds
                .map((id) => workers.find((w) => w.id === id))
                .filter((w): w is Worker => Boolean(w));
              const hasTimeOff = timeOff.some(
                (r) => r.status === "approved" && dateStr >= r.startDate && dateStr <= r.endDate,
              );
              const myShifts = highlightWorkerId
                ? dayShifts.filter((s) => s.workerIds.includes(highlightWorkerId))
                : [];
              const inMonth = isInMonth(date, monthOffset, today);
              const isToday = isSameDate(date, today);

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => onSelectDate(date)}
                  className={`flex min-h-16 flex-col gap-1 border-b border-r border-brite-tan/10 p-1 text-left sm:min-h-24 sm:gap-1.5 sm:p-2 transition-colors hover:bg-brite-black-soft/60 ${
                    inMonth ? "" : "opacity-35"
                  } ${isToday ? "bg-brite-red/10" : ""} ${
                    myShifts.length > 0 ? "bg-brite-green/[0.08] ring-1 ring-inset ring-brite-green/45" : ""
                  } ${attentionByDate?.[dateStr] ? "bg-brite-amber/[0.07] ring-1 ring-inset ring-brite-amber/45" : ""}`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-brite-tan/70">{date.getDate()}</span>
                    {!!attentionByDate?.[dateStr] && (
                      <span
                        title="Needs resolving"
                        className="rounded-full bg-brite-amber/20 px-1.5 text-[10px] font-bold text-brite-amber"
                      >
                        ! {attentionByDate[dateStr]}
                      </span>
                    )}
                  </span>
                  {myShifts.map((s) => (
                    <span
                      key={s.id}
                      className="w-fit rounded-full bg-brite-green/15 px-1.5 py-0.5 text-[10px] font-bold text-brite-green"
                    >
                      ★<span className="hidden sm:inline"> {formatCompactTime(s.start)}–{formatCompactTime(s.end)}</span>
                    </span>
                  ))}
                  {/* Phones: cells are too narrow for faces — just how many are on. */}
                  {dayWorkers.length > 0 && (
                    <span className="text-[10px] font-semibold text-brite-tan/55 sm:hidden">{dayWorkers.length} on</span>
                  )}
                  <div className="hidden flex-wrap gap-1 sm:flex">
                    {dayWorkers.slice(0, 4).map((w) => (
                      <Avatar key={w.id} name={w.name} color={w.avatarColor} size="sm" />
                    ))}
                    {dayWorkers.length > 4 && (
                      <span className="text-[10px] text-brite-tan/50">
                        +{dayWorkers.length - 4}
                      </span>
                    )}
                  </div>
                  {hasTimeOff && <span className="hidden text-[10px] text-brite-green sm:inline">Time off</span>}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
