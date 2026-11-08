import type { ReactNode } from "react";
import type { Shift, Worker } from "../types";
import { formatCompactTime } from "../utils/time";
import { relativeDayLabel } from "../utils/week";
import { DateTile } from "./RequestCard";
import { Avatar } from "./ui/Avatar";

type SwapCardProps = {
  requester: Worker;
  target: Worker;
  requesterShift: Shift;
  targetShift: Shift;
  actions?: ReactNode;
  // Optional line under the swap, e.g. "Waiting on your manager".
  note?: ReactNode;
  onOpen?: () => void;
  selected?: boolean;
};

/** One side of the swap: the day as a calendar tile, then who and when. */
function SwapSide({ worker, shift }: { worker: Worker; shift: Shift }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <DateTile date={shift.date} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Avatar name={worker.name} color={worker.avatarColor} size="sm" />
          <span className="truncate text-sm font-semibold text-brite-white">{worker.name}</span>
        </div>
        <span className="mt-1 inline-block whitespace-nowrap rounded-full border border-brite-tan/15 bg-brite-black/40 px-2 py-0.5 text-[11px] font-bold text-brite-cream">
          {formatCompactTime(shift.start)}–{formatCompactTime(shift.end)}
        </span>
      </div>
    </div>
  );
}

/** A shift swap: the two days side by side as calendar tiles, ⇄ between. */
export function SwapCard({ requester, target, requesterShift, targetShift, actions, note, onOpen, selected }: SwapCardProps) {
  const soonest = requesterShift.date <= targetShift.date ? requesterShift.date : targetShift.date;

  return (
    <article
      onClick={onOpen}
      onKeyDown={onOpen ? (e) => e.key === "Enter" && e.target === e.currentTarget && onOpen() : undefined}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      title={onOpen ? "Show on the schedule" : undefined}
      // A short name for screen readers — otherwise the whole card's text
      // (including its own buttons' labels) becomes this button's name.
      aria-label={onOpen ? "Show on the schedule" : undefined}
      aria-pressed={onOpen ? !!selected : undefined}
      className={`rounded-xl border bg-brite-black-soft p-3.5 shadow-lg shadow-black/30 ${
        selected ? "border-brite-amber/60 ring-1 ring-brite-amber/25" : "border-brite-tan/12"
      } ${onOpen ? "cursor-pointer transition-colors hover:border-brite-tan/35" : ""}`}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span className="rounded-full bg-brite-tan/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brite-tan">
          Swap
        </span>
        <span className="text-[11px] text-brite-tan/45">{relativeDayLabel(soonest)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <SwapSide worker={requester} shift={requesterShift} />
        <span
          aria-label="swaps with"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brite-amber/30 bg-brite-amber/10 text-sm font-bold text-brite-amber"
        >
          ⇄
        </span>
        <SwapSide worker={target} shift={targetShift} />

        {actions && (
          <div onClick={(e) => e.stopPropagation()} className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            {actions}
          </div>
        )}
      </div>

      {note && <p className="mt-2.5 text-[11px] text-brite-tan/45">{note}</p>}
    </article>
  );
}
