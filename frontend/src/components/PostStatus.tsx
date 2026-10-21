import { useState } from "react";
import { formatPostedAt } from "../utils/time";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

// "draft": work in progress — bartenders see it blurred.
// "posted": finalized — bartenders see it normally.
// "changed": finalized, then edited since (bartenders already see the edits).
export type PostState = "draft" | "posted" | "changed";

type ManagerPostBarProps = {
  state: PostState;
  postedAt?: string;
  changeCount: number;
  weekLabel: string; // "Sep 28 – Oct 4"
  onPost: () => void;
  onUnpost: () => void;
};

/**
 * The manager's finalize control, sized to sit in the top-right button row:
 * a red "Finalize schedule" button while the week is a work in progress, a
 * small green "Finalized" pill once it's done (click it to move the week
 * back), and "Finalize changes" if it's been edited since.
 */
export function ManagerPostBar({
  state,
  postedAt,
  changeCount,
  weekLabel,
  onPost,
  onUnpost,
}: ManagerPostBarProps) {
  const [confirm, setConfirm] = useState<"post" | "unpost" | null>(null);

  return (
    <>
      {state === "posted" ? (
        <button
          type="button"
          onClick={() => setConfirm("unpost")}
          title={postedAt ? `Finalized ${formatPostedAt(postedAt)} — click to move back to work in progress` : undefined}
          className="rounded-lg border border-brite-green/40 bg-brite-green/10 px-4 py-2.5 font-semibold tracking-wide text-brite-green transition-colors hover:border-brite-green"
        >
          ✓ Finalized
        </button>
      ) : (
        <Button
          className="w-auto px-4"
          onClick={() => setConfirm("post")}
          title={
            state === "draft"
              ? "Bartenders see this week blurred until you finalize it"
              : postedAt
                ? `${changeCount} shift${changeCount === 1 ? "" : "s"} changed since you finalized it on ${formatPostedAt(postedAt)}`
                : undefined
          }
        >
          {state === "draft" ? "Finalize schedule" : "Finalize changes"}
          {state === "changed" && (
            <span className="ml-2 rounded-full bg-brite-white/20 px-1.5 text-xs">{changeCount}</span>
          )}
        </Button>
      )}

      {confirm && (
        <Modal onClose={() => setConfirm(null)} labelledBy="post-confirm-title">
          <div className="mb-4 flex items-center gap-2.5">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${
                confirm === "post" ? "bg-brite-green/15 text-brite-green" : "bg-brite-amber/15 text-brite-amber"
              }`}
            >
              {confirm === "post" ? "✓" : "↩"}
            </span>
            <div>
              <h2 id="post-confirm-title" className="text-base font-bold text-brite-white">
                {confirm === "post"
                  ? state === "changed"
                    ? "Finalize your changes?"
                    : "Finalize this week's schedule?"
                  : "Move back to work in progress?"}
              </h2>
              <p className="text-xs text-brite-tan/50">{weekLabel}</p>
            </div>
          </div>
          <p className="mb-4 text-sm text-brite-tan/70">
            {confirm === "post"
              ? state === "changed" && postedAt
                ? `${changeCount} shift${changeCount === 1 ? "" : "s"} changed since ${formatPostedAt(postedAt)}`
                : "Bartenders will see it as final."
              : "Bartenders will see it blurred again."}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => {
                (confirm === "post" ? onPost : onUnpost)();
                setConfirm(null);
              }}
              className="rounded-lg bg-brite-red py-2.5 text-sm font-semibold text-brite-white hover:bg-brite-red-bright"
            >
              {confirm === "post" ? "Finalize" : "Move back"}
            </button>
            {confirm === "post" && state === "changed" && (
              <button
                type="button"
                onClick={() => setConfirm("unpost")}
                className="rounded-lg border border-brite-tan/25 py-2 text-xs font-semibold text-brite-tan/70 hover:border-brite-tan/50"
              >
                Move back to work in progress instead
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="py-1 text-xs font-semibold text-brite-tan/50 hover:text-brite-tan"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/**
 * Floats over the blurred schedule for bartenders while a week is still a
 * work in progress — they can make out the shape of it, but it's clearly
 * not final.
 */
export function ScheduleInTheWorks({ weekLabel }: { weekLabel: string }) {
  return (
    <div className="absolute inset-x-0 top-8 z-10 flex justify-center px-4">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-brite-amber/25 bg-brite-black-soft/90 px-6 py-7 text-center shadow-2xl shadow-black/60 backdrop-blur-sm">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brite-amber/15 text-2xl text-brite-amber">
          ★
        </span>
        <h2 className="text-lg font-bold text-brite-white">This week's schedule is still in the works</h2>
        <p className="mt-1 text-sm text-brite-tan/55">
          {weekLabel} · shifts may still change
        </p>
      </div>
    </div>
  );
}
