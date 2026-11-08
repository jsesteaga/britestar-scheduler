import { useState } from "react";
import type { TimeOffRequest, Worker } from "../types";
import { formatFriendlyDate } from "../utils/week";
import { Avatar } from "./ui/Avatar";
import { Modal } from "./ui/Modal";

type TimeOffDialogProps = {
  request: TimeOffRequest;
  worker: Worker;
  todayISO: string;
  onSave: (startDate: string, endDate: string) => void;
  onCancelTimeOff: () => void;
  onClose: () => void;
};

const dateInput =
  "w-full rounded-lg border border-brite-tan/25 bg-brite-black px-3 py-2 text-sm text-brite-white focus:border-brite-amber/60 focus:outline-none";

/**
 * Manager's view of one person's time off: change the dates, or cancel it
 * (which makes them schedulable on those days again).
 */
export function TimeOffDialog({ request, worker, todayISO, onSave, onCancelTimeOff, onClose }: TimeOffDialogProps) {
  const [start, setStart] = useState(request.startDate);
  const [end, setEnd] = useState(request.endDate < start ? start : request.endDate);
  const changed = start !== request.startDate || end !== request.endDate;
  const valid = !!start && !!end && end >= start;

  return (
    <Modal onClose={onClose} labelledBy="timeoff-title">
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={worker.name} color={worker.avatarColor} />
        <div className="min-w-0">
          <h2 id="timeoff-title" className="text-base font-bold text-brite-white">
            {worker.name}'s time off
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                request.status === "approved" ? "bg-brite-green/15 text-brite-green" : "bg-brite-amber/15 text-brite-amber"
              }`}
            >
              {request.status === "approved" ? "Approved" : "Pending"}
            </span>
            {request.reason && <span className="truncate text-brite-tan/55">{request.reason}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-brite-tan/55">
          From
          <input
            type="date"
            value={start}
            min={todayISO}
            onChange={(e) => {
              setStart(e.target.value);
              if (end < e.target.value) setEnd(e.target.value);
            }}
            className={dateInput}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-brite-tan/55">
          To
          <input type="date" value={end} min={start || todayISO} onChange={(e) => setEnd(e.target.value)} className={dateInput} />
        </label>
      </div>
      {request.status === "approved" && valid && (
        <p className="mt-2 text-[11px] text-brite-tan/45">
          Off {start === end ? formatFriendlyDate(start) : `${formatFriendlyDate(start)} – ${formatFriendlyDate(end)}`} ·
          they can't be scheduled those days
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          disabled={!changed || !valid}
          onClick={() => {
            onSave(start, end);
            onClose();
          }}
          className="rounded-lg bg-brite-red py-2.5 text-sm font-semibold text-brite-white hover:bg-brite-red-bright disabled:bg-brite-tan/10 disabled:text-brite-tan/35"
        >
          Save dates
        </button>
        <button
          type="button"
          onClick={() => {
            onCancelTimeOff();
            onClose();
          }}
          className="rounded-lg border border-brite-tan/30 py-2.5 text-sm font-semibold text-brite-cream hover:border-brite-tan/60"
        >
          Cancel time off
        </button>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="py-1 text-xs font-semibold text-brite-tan/50 hover:text-brite-tan"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
