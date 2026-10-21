import { useState } from "react";
import type { Day, DayAvailability, TimeOffRequest } from "../types";
import { formatFriendlyDate } from "../utils/week";
import { AvailabilityForm } from "./AvailabilityForm";
import { RequestTimeOffForm } from "./RequestTimeOffForm";

type Tab = "general" | "days-off";

type SetAvailabilityPanelProps = {
  initialDays?: Record<Day, DayAvailability>;
  myTimeOff: TimeOffRequest[];
  onSubmitAvailability: (days: Record<Day, DayAvailability>) => void;
  onRequestTimeOff: (startDate: string, endDate: string, reason: string) => void;
  onCancelTimeOff: (requestId: string) => void;
  onClose: () => void;
};

/**
 * The employee's one place for "when can I work": a general weekly pattern,
 * plus specific dates they can't make — those go to the manager as time-off
 * requests to approve.
 */
export function SetAvailabilityPanel({
  initialDays,
  myTimeOff,
  onSubmitAvailability,
  onRequestTimeOff,
  onCancelTimeOff,
  onClose,
}: SetAvailabilityPanelProps) {
  const [tab, setTab] = useState<Tab>("general");
  const sortedTimeOff = [...myTimeOff].sort((a, b) => a.startDate.localeCompare(b.startDate));

  const tabClass = (t: Tab) =>
    `rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
      tab === t ? "bg-brite-red text-brite-white" : "text-brite-tan/60 hover:text-brite-tan"
    }`;

  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg bg-brite-black-soft/60 p-1">
          <button type="button" onClick={() => setTab("general")} className={tabClass("general")}>
            General availability
          </button>
          <button type="button" onClick={() => setTab("days-off")} className={tabClass("days-off")}>
            Days I can't work
            {myTimeOff.some((r) => r.status === "pending") && (
              <span className="ml-1.5 rounded bg-brite-amber/20 px-1 text-[10px] text-brite-amber">
                {myTimeOff.filter((r) => r.status === "pending").length}
              </span>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-brite-tan/50 hover:text-brite-tan"
        >
          Close
        </button>
      </div>

      {tab === "general" ? (
        <AvailabilityForm initialDays={initialDays} onSubmit={onSubmitAvailability} onCancel={onClose} />
      ) : (
        <>
          <p className="mb-2 text-xs text-brite-tan/50">
            Pick a day (or a range) you can't work. It goes to your manager as a time-off request.
          </p>
          <RequestTimeOffForm onSubmit={onRequestTimeOff} onCancel={onClose} />

          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-brite-tan/60">
            Your requests
          </h3>
          {sortedTimeOff.length === 0 ? (
            <p className="text-xs italic text-brite-tan/40">No time-off requests yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {sortedTimeOff.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-brite-tan/10 bg-brite-black-soft/50 px-3 py-2"
                >
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      r.status === "approved"
                        ? "bg-brite-green/15 text-brite-green"
                        : "bg-brite-amber/15 text-brite-amber"
                    }`}
                  >
                    {r.status === "approved" ? "Approved" : "Pending"}
                  </span>
                  <span className="text-sm text-brite-white">
                    {r.startDate === r.endDate
                      ? formatFriendlyDate(r.startDate)
                      : `${formatFriendlyDate(r.startDate)} – ${formatFriendlyDate(r.endDate)}`}
                  </span>
                  {r.reason && <span className="text-xs text-brite-tan/50">({r.reason})</span>}
                  {r.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => onCancelTimeOff(r.id)}
                      className="ml-auto rounded-md border border-transparent px-2 py-0.5 text-[11px] font-semibold text-brite-tan/50 transition-colors hover:border-brite-tan/30 hover:text-brite-tan"
                    >
                      Cancel request
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
