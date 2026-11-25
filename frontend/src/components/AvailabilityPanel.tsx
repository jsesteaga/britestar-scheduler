import type { Availability, Day, TimeOffRequest, Worker } from "../types";
import { DAYS, formatShortDate, toISODate } from "../utils/week";
import { Avatar } from "./ui/Avatar";

type AvailabilityPanelProps = {
  availability: Availability[];
  workers: Worker[];
  // The week being looked at — its time off is shown right in the grid, so
  // "usually available Tue" and "but off this Tue" read in one place.
  timeOff: TimeOffRequest[];
  weekDates: Record<Day, Date>;
  weekLabel: string;
};

export function AvailabilityPanel({ availability, workers, timeOff, weekDates, weekLabel }: AvailabilityPanelProps) {
  const isoFor = (day: Day) => toISODate(weekDates[day]);
  const weekStart = isoFor("Mon");
  const weekEnd = isoFor("Sun");

  // Time off touching this week (approved or still pending).
  const weekTimeOff = timeOff.filter((r) => r.startDate <= weekEnd && r.endDate >= weekStart);
  const offOn = (workerId: string, day: Day) => {
    const date = isoFor(day);
    const hits = weekTimeOff.filter((r) => r.workerId === workerId && date >= r.startDate && date <= r.endDate);
    return hits.find((r) => r.status === "approved") ?? hits[0];
  };

  // Everyone who sent availability, plus anyone off this week who didn't.
  const rows = [
    ...availability.map((a) => ({ workerId: a.workerId, entry: a as Availability | undefined })),
    ...[...new Set(weekTimeOff.map((r) => r.workerId))]
      .filter((id) => !availability.some((a) => a.workerId === id))
      .map((workerId) => ({ workerId, entry: undefined })),
  ];

  if (rows.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-brite-tan/15 bg-brite-black-soft/60 p-4 text-sm text-brite-tan/50">
        No one has sent in their availability yet, and no one has time off {weekLabel}.
      </div>
    );
  }

  return (
    <div className="mb-6 overflow-x-auto rounded-xl border border-brite-tan/15 bg-brite-black-soft/60 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brite-tan/80">
          Availability · <span className="normal-case">{weekLabel}</span>
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-brite-tan/50">
          <span>
            <span className="text-brite-green">✓</span> usually available
          </span>
          <span>
            <OffTag approved /> time off
          </span>
          <span>
            <OffTag approved={false} /> requested
          </span>
        </div>
      </div>
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="p-1.5 text-left text-xs font-semibold uppercase text-brite-tan/60">Bartender</th>
            {DAYS.map((day) => (
              <th key={day} className="p-1.5 text-center text-xs font-semibold uppercase text-brite-tan/60">
                {day}
                <div className="text-[10px] font-normal normal-case text-brite-tan/40">
                  {formatShortDate(weekDates[day])}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ workerId, entry }) => {
            const worker = workers.find((w) => w.id === workerId);
            if (!worker) return null;
            return (
              <tr key={workerId} className="border-t border-brite-tan/10">
                <td className="p-1.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={worker.name} color={worker.avatarColor} size="sm" />
                    <div className="min-w-0">
                      <div className="text-brite-white">{worker.name}</div>
                      {!entry && <div className="text-[10px] text-brite-tan/40">No availability sent</div>}
                    </div>
                  </div>
                </td>
                {DAYS.map((day) => {
                  const off = offOn(workerId, day);
                  const info = entry?.days[day];
                  return (
                    <td key={day} className="p-1.5 text-center align-top">
                      {off ? (
                        <span title={off.reason ? `Time off: ${off.reason}` : "Time off"}>
                          <OffTag approved={off.status === "approved"} />
                          {off.reason && (
                            <div className="mt-0.5 text-[10px] leading-tight text-brite-tan/50">{off.reason}</div>
                          )}
                        </span>
                      ) : info ? (
                        <>
                          <span className={info.available ? "text-brite-green" : "text-brite-tan/30"}>
                            {info.available ? "✓" : "✕"}
                          </span>
                          {info.available && info.note && (
                            <div className="text-[10px] leading-tight text-brite-tan/50">{info.note}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-brite-tan/20">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OffTag({ approved }: { approved: boolean }) {
  return approved ? (
    <span className="rounded-full bg-brite-red/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brite-red-bright">
      Off
    </span>
  ) : (
    <span className="rounded-full bg-brite-amber/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brite-amber">
      Off?
    </span>
  );
}
