import type { Shift, Worker } from "../types";
import { formatCompactTime } from "../utils/time";
import { DAYS, fromISODate, getMondayOfWeek, mondayKeyFor, toISODate } from "../utils/week";
import { Avatar } from "./ui/Avatar";
import { Modal } from "./ui/Modal";

type SwapApproveDialogProps = {
  requester: Worker;
  target: Worker;
  requesterShift: Shift; // requester gives this up → target takes it
  targetShift: Shift; // target gives this up → requester takes it
  onApprove: () => void;
  onDeny: () => void;
  onClose: () => void;
};

/** A lit day: date, time, then who has it now ↓ who'll have it — read top to bottom. */
function SwapDay({ day, date, shift, from, to }: { day: string; date: number; shift: Shift; from: Worker; to: Worker }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-brite-amber/50 bg-brite-amber/10 px-1 py-2 text-center shadow-lg shadow-black/30">
      <span className="text-[9px] font-bold uppercase tracking-wider text-brite-red-bright">{day}</span>
      <span className="-mt-0.5 text-xl font-black leading-none text-brite-white">{date}</span>
      <span className="whitespace-nowrap rounded-full border border-brite-tan/15 bg-brite-black/40 px-1.5 text-[10px] font-bold text-brite-cream">
        {formatCompactTime(shift.start)}–{formatCompactTime(shift.end)}
      </span>

      <span className="mt-1 flex flex-col items-center opacity-55">
        <Avatar name={from.name} color={from.avatarColor} size="sm" />
        <span className="mt-0.5 max-w-full truncate text-[10px] text-brite-tan line-through decoration-brite-tan/60">
          {from.name}
        </span>
      </span>
      <span aria-label="becomes" className="text-xs leading-none text-brite-amber">
        ↓
      </span>
      <span className="flex flex-col items-center">
        <span className="rounded-full ring-2 ring-brite-amber/60">
          <Avatar name={to.name} color={to.avatarColor} size="sm" />
        </span>
        <span className="mt-0.5 max-w-full truncate text-[11px] font-bold text-brite-white">{to.name}</span>
      </span>
    </div>
  );
}

/**
 * Confirms a swap with a picture of it: the week as a calendar where only
 * the two swapped days are lit, each reading top to bottom (who has it now ↓
 * who'll have it). A second week only appears if the swap crosses weeks.
 */
export function SwapApproveDialog({
  requester,
  target,
  requesterShift,
  targetShift,
  onApprove,
  onDeny,
  onClose,
}: SwapApproveDialogProps) {
  const legs = [
    { shift: requesterShift, from: requester, to: target },
    { shift: targetShift, from: target, to: requester },
  ];
  const weeks = [...new Set(legs.map((l) => mondayKeyFor(l.shift.date)))].sort();

  return (
    <Modal onClose={onClose} labelledBy="swap-approve-title" wide>
      <div className="mb-4 text-center">
        <h2 id="swap-approve-title" className="text-lg font-bold text-brite-white">
          Approve swap?
        </h2>
        <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-brite-tan/55">
          {requester.name} <span className="text-brite-amber">⇄</span> {target.name}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {weeks.map((mondayISO) => {
          const monday = getMondayOfWeek(0, fromISODate(mondayISO));
          return (
            <div key={mondayISO} className="grid grid-cols-7 gap-1.5 rounded-2xl border border-brite-tan/10 bg-brite-black/40 p-2">
              {DAYS.map((day, i) => {
                const d = new Date(monday);
                d.setDate(monday.getDate() + i);
                const leg = legs.find((l) => l.shift.date === toISODate(d));
                return leg ? (
                  <SwapDay key={day} day={day} date={d.getDate()} shift={leg.shift} from={leg.from} to={leg.to} />
                ) : (
                  <div key={day} className="flex flex-col items-center py-2 text-center opacity-25">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-brite-tan">{day}</span>
                    <span className="-mt-0.5 text-xl font-black leading-none text-brite-tan">{d.getDate()}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            onDeny();
            onClose();
          }}
          className="rounded-lg border border-brite-tan/30 py-2.5 text-sm font-semibold text-brite-cream hover:border-brite-tan"
        >
          Deny
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => {
            onApprove();
            onClose();
          }}
          className="rounded-lg bg-brite-green py-2.5 text-sm font-semibold text-brite-white hover:brightness-110"
        >
          Approve
        </button>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mx-auto mt-2 block py-1 text-xs font-semibold text-brite-tan/50 hover:text-brite-tan"
      >
        Not now
      </button>
    </Modal>
  );
}
