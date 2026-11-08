import { Modal } from "./ui/Modal";

export type CopyScope = "week" | "day";

/** One of the two choices: what gets copied onto what. */
export type CopyChoice = {
  from: string; // e.g. "Oct 19 – Oct 25" or "Mon 10/19"
  to: string;
  shiftCount: number; // shifts that would be copied
  // Give-away/swap requests on the shifts being replaced — they go too.
  pendingRequests: number;
};

type CopyPreviousWeekDialogProps = {
  dayName: string; // "Monday"
  week: CopyChoice;
  day: CopyChoice;
  onCopy: (scope: CopyScope) => void;
  onClose: () => void;
};

/**
 * "Copy from last week" (from the day menu): copy the whole previous week
 * onto this one, or just the same weekday onto this day. Either way the
 * shifts there now are replaced.
 */
export function CopyPreviousWeekDialog({ dayName, week, day, onCopy, onClose }: CopyPreviousWeekDialogProps) {
  return (
    <Modal onClose={onClose} labelledBy="copy-week-title">
      <h2 id="copy-week-title" className="text-base font-bold text-brite-white">
        Copy from last week
      </h2>
      <p className="mt-1 text-xs text-brite-tan/55">Same shift times, same bartenders.</p>

      <div className="mt-4 flex flex-col gap-2">
        <Option title="Whole week" choice={week} autoFocus onClick={() => onCopy("week")} />
        <Option title={`Just ${dayName}`} choice={day} onClick={() => onCopy("day")} />
      </div>

      <p className="mt-3 text-[11px] leading-snug text-brite-tan/45">
        Replaces the shifts that are there now. Anyone with approved time off on the new date is left off. You can
        undo it.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full rounded-lg py-2 text-sm font-semibold text-brite-tan/55 hover:text-brite-tan"
      >
        Cancel
      </button>
    </Modal>
  );
}

function Option({
  title,
  choice,
  autoFocus,
  onClick,
}: {
  title: string;
  choice: CopyChoice;
  autoFocus?: boolean;
  onClick: () => void;
}) {
  const empty = choice.shiftCount === 0;
  return (
    <button
      type="button"
      autoFocus={autoFocus && !empty}
      disabled={empty}
      onClick={onClick}
      className="rounded-xl border border-brite-tan/20 bg-brite-black/40 p-3 text-left transition-colors hover:border-brite-amber/60 hover:bg-brite-amber/[0.06] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-brite-tan/20 disabled:hover:bg-brite-black/40"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-brite-white">{title}</span>
        <span className="shrink-0 text-xs font-semibold text-brite-amber">
          {empty ? "Nothing to copy" : `${choice.shiftCount} shift${choice.shiftCount === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-brite-tan/60">
        {choice.from} <span className="text-brite-tan/35">→</span> {choice.to}
      </div>
      {choice.pendingRequests > 0 && !empty && (
        <div className="mt-1 text-[11px] text-brite-amber/80">
          Clears {choice.pendingRequests} pending request{choice.pendingRequests === 1 ? "" : "s"} on the shifts it
          replaces
        </div>
      )}
    </button>
  );
}
