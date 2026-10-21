import type { Availability, Worker } from "../types";
import { DAYS } from "../utils/week";
import { Avatar } from "./ui/Avatar";

type AvailabilityPanelProps = {
  availability: Availability[];
  workers: Worker[];
};

export function AvailabilityPanel({ availability, workers }: AvailabilityPanelProps) {
  if (availability.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-brite-tan/15 bg-brite-black-soft/60 p-4 text-sm text-brite-tan/50">
        No one has sent in their availability yet.
      </div>
    );
  }

  return (
    <div className="mb-6 overflow-x-auto rounded-xl border border-brite-tan/15 bg-brite-black-soft/60 p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brite-tan/80">
        Availability
      </h2>
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="p-1.5 text-left text-xs font-semibold uppercase text-brite-tan/60">
              Bartender
            </th>
            {DAYS.map((day) => (
              <th key={day} className="p-1.5 text-center text-xs font-semibold uppercase text-brite-tan/60">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {availability.map((entry) => {
            const worker = workers.find((w) => w.id === entry.workerId);
            if (!worker) return null;
            return (
              <tr key={entry.id} className="border-t border-brite-tan/10">
                <td className="p-1.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={worker.name} color={worker.avatarColor} size="sm" />
                    <span className="text-brite-white">{worker.name}</span>
                  </div>
                </td>
                {DAYS.map((day) => {
                  const info = entry.days[day];
                  return (
                    <td key={day} className="p-1.5 text-center align-top">
                      <span className={info.available ? "text-brite-green" : "text-brite-tan/30"}>
                        {info.available ? "✓" : "✕"}
                      </span>
                      {info.available && info.note && (
                        <div className="text-[10px] leading-tight text-brite-tan/50">
                          {info.note}
                        </div>
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
