import { useState } from "react";
import type { Shift } from "../types";
import { displayTimeToInputValue, inputValueToDisplayTime, inputValueToMinutes } from "../utils/time";

type ShiftTimeFormProps = {
  shift: Shift;
  // Called with display strings ("5:30 PM"), only when the time actually changed.
  onSave: (start: string, end: string) => void;
  // Reports every edit as it happens (display strings), so a parent can
  // save the latest times when the editor is closed by clicking away.
  onDraftChange?: (start: string, end: string) => void;
  autoFocus?: boolean;
};

/** "4.5 hrs", treating an end at/before the start as running past midnight. */
function describeDuration(start: string, end: string): string {
  let minutes = inputValueToMinutes(end) - inputValueToMinutes(start);
  const overnight = minutes <= 0;
  if (overnight) minutes += 24 * 60;
  const hours = Math.round((minutes / 60) * 100) / 100;
  return `${hours} hr${hours === 1 ? "" : "s"}${overnight ? " · overnight" : ""}`;
}

const timeInputClass =
  "w-full min-w-0 rounded-md border border-brite-tan/20 bg-brite-black px-2 py-1 text-xs text-brite-cream focus:border-brite-amber/60 focus:outline-none";

/** Start/end time pickers + Save — shared by the right-click menu and the click-to-edit time bubble. */
export function ShiftTimeForm({ shift, onSave, onDraftChange, autoFocus }: ShiftTimeFormProps) {
  const [start, setStart] = useState(() => displayTimeToInputValue(shift.start));
  const [end, setEnd] = useState(() => displayTimeToInputValue(shift.end));
  const timeChanged =
    start !== displayTimeToInputValue(shift.start) || end !== displayTimeToInputValue(shift.end);

  return (
    <form
      className="px-3 pb-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (start && end && timeChanged) onSave(inputValueToDisplayTime(start), inputValueToDisplayTime(end));
      }}
    >
      {/* Touch screens: stacked, since the time boxes there use bigger text
          (see index.css) and two side by side get cut off in a menu. */}
      <div className="flex items-center gap-1.5 pointer-coarse:flex-col pointer-coarse:items-stretch pointer-coarse:gap-1">
        <input
          type="time"
          aria-label="Start time"
          autoFocus={autoFocus}
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            if (e.target.value && end) onDraftChange?.(inputValueToDisplayTime(e.target.value), inputValueToDisplayTime(end));
          }}
          className={timeInputClass}
        />
        <span className="text-xs text-brite-tan/40 pointer-coarse:text-center">to</span>
        <input
          type="time"
          aria-label="End time"
          value={end}
          onChange={(e) => {
            setEnd(e.target.value);
            if (start && e.target.value) onDraftChange?.(inputValueToDisplayTime(start), inputValueToDisplayTime(e.target.value));
          }}
          className={timeInputClass}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[11px] text-brite-tan/45">
          {start && end ? describeDuration(start, end) : ""}
        </span>
        <button
          type="submit"
          disabled={!timeChanged}
          className="rounded-md bg-brite-red px-2.5 py-1 text-[11px] font-semibold text-brite-white transition-colors hover:bg-brite-red-bright disabled:bg-brite-tan/10 disabled:text-brite-tan/35"
        >
          Save time
        </button>
      </div>
    </form>
  );
}
