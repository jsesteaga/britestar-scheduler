import type { Shift, TimeOffRequest, Worker } from "../types";
import { getMonthGrid, isInMonth, isSameDate, toISODate } from "../utils/week";
import { Avatar } from "./ui/Avatar";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type MonthViewProps = {
  monthOffset: number;
  shifts: Shift[];
  workers: Worker[];
  timeOff: TimeOffRequest[];
  onSelectDate: (date: Date) => void;
};

export function MonthView({ monthOffset, shifts, workers, timeOff, onSelectDate }: MonthViewProps) {
  const weeks = getMonthGrid(monthOffset);
  const today = new Date();

  return (
    <div>
      <p className="mb-3 text-xs text-brite-tan/50">
        Click any day to jump to that week's full schedule.
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
              const inMonth = isInMonth(date, monthOffset, today);
              const isToday = isSameDate(date, today);

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => onSelectDate(date)}
                  className={`flex min-h-24 flex-col gap-1.5 border-b border-r border-brite-tan/10 p-2 text-left transition-colors hover:bg-brite-black-soft/60 ${
                    inMonth ? "" : "opacity-35"
                  } ${isToday ? "bg-brite-red/10" : ""}`}
                >
                  <span className="text-xs font-semibold text-brite-tan/70">{date.getDate()}</span>
                  <div className="flex flex-wrap gap-1">
                    {dayWorkers.slice(0, 4).map((w) => (
                      <Avatar key={w.id} name={w.name} color={w.avatarColor} size="sm" />
                    ))}
                    {dayWorkers.length > 4 && (
                      <span className="text-[10px] text-brite-tan/50">
                        +{dayWorkers.length - 4}
                      </span>
                    )}
                  </div>
                  {hasTimeOff && <span className="text-[10px] text-brite-green">Time off</span>}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
