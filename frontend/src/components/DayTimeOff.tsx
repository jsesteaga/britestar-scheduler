import { useState } from "react";
import type { TimeOffRequest, Worker } from "../types";
import { Avatar } from "./ui/Avatar";

type DayTimeOffProps = {
  requests: TimeOffRequest[]; // approved time off covering this day
  workers: Worker[];
  // Manager view: click a person to change or cancel their time off.
  onOpen?: (requestId: string) => void;
};

// Faces shown before the rest collapse into a "+N" bubble.
const SHOWN = 3;

/**
 * Who's off on a day, as one compact row: overlapping avatar circles (first
 * three, then +N), tap to unfold the full list. Replaces a stack of cards
 * per person, which got cluttered fast on busy days.
 */
export function DayTimeOff({ requests, workers, onOpen }: DayTimeOffProps) {
  const [open, setOpen] = useState(false);
  const people = requests
    .map((r) => ({ r, w: workers.find((w) => w.id === r.workerId) }))
    .filter((x): x is { r: TimeOffRequest; w: Worker } => !!x.w);
  if (people.length === 0) return null;
  const extra = people.length - SHOWN;

  return (
    <div className="rounded-lg border border-brite-green/25 bg-brite-green/[0.07]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={people.map((p) => p.w.name).join(", ")}
        className="flex w-full items-center gap-2 px-2.5 py-1.5"
      >
        <span className="text-[10px] font-bold uppercase tracking-wide text-brite-green">Off</span>
        <span className="flex -space-x-2">
          {people.slice(0, SHOWN).map(({ w }) => (
            <span key={w.id} className="rounded-full ring-2 ring-brite-black-soft">
              <Avatar name={w.name} color={w.avatarColor} imageUrl={w.avatarUrl} size="sm" />
            </span>
          ))}
          {extra > 0 && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brite-black-soft text-[10px] font-bold text-brite-tan ring-2 ring-brite-black-soft">
              +{extra}
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-brite-green/70 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* grid-rows 0fr → 1fr animates the unfold without measuring heights */}
      <div className={`grid transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden" inert={!open}>
          <ul className="flex flex-col gap-0.5 border-t border-brite-green/15 px-1.5 py-1.5">
            {people.map(({ r, w }) => {
              const row = (
                <>
                  <Avatar name={w.name} color={w.avatarColor} imageUrl={w.avatarUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-brite-white">{w.name}</span>
                    {r.reason && <span className="block truncate text-[10px] text-brite-tan/50">{r.reason}</span>}
                  </span>
                </>
              );
              return (
                <li key={r.id}>
                  {onOpen ? (
                    <button
                      type="button"
                      onClick={() => onOpen(r.id)}
                      title="Change or cancel this time off"
                      className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-brite-green/10"
                    >
                      {row}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-1 py-1">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
