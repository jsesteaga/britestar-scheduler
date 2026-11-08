import type { ReactNode } from "react";
import type { Worker } from "../types";
import { Avatar } from "./ui/Avatar";
import { fromISODate, relativeDayLabel } from "../utils/week";

export type RequestKind = "timeoff" | "coverage" | "swap";

// What a clicked request card points at on the schedule. `key` identifies
// the card, so clicking it again can clear the selection.
export type OpenTarget = { key: string; date: string; shiftIds?: string[]; endDate?: string };

const KIND: Record<RequestKind, { label: string; className: string }> = {
  timeoff: { label: "Time off", className: "bg-brite-green/15 text-brite-green" },
  coverage: { label: "Needs coverage", className: "bg-brite-amber/15 text-brite-amber" },
  swap: { label: "Swap", className: "bg-brite-tan/10 text-brite-tan" },
};

type RequestCardProps = {
  kind: RequestKind;
  date: string; // ISO — drives the date tile and the "in 3 days" label
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  // Clicking the card itself (not its buttons) — e.g. jump to that week.
  onOpen?: () => void;
  // The card that's currently selected (its days are highlighted).
  selected?: boolean;
};

/** "THU / 22 / OCT" as a little calendar page. */
export function DateTile({ date }: { date: string }) {
  const d = fromISODate(date);
  return (
    <div className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-brite-tan/10 bg-brite-black/50 py-1.5 leading-none">
      <span className="text-[9px] font-bold uppercase tracking-wider text-brite-red-bright">
        {d.toLocaleDateString(undefined, { weekday: "short" })}
      </span>
      <span className="mt-1 text-lg font-black text-brite-white">{d.getDate()}</span>
      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-brite-tan/50">
        {d.toLocaleDateString(undefined, { month: "short" })}
      </span>
    </div>
  );
}

/** A calendar-tile date, a type tag, the details, and its actions — used in every request stack. */
export function RequestCard({ kind, date, title, subtitle, actions, footer, onOpen, selected }: RequestCardProps) {
  const soon = relativeDayLabel(date);

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
      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
        <DateTile date={date} />

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${KIND[kind].className}`}>
              {KIND[kind].label}
            </span>
            <span className="text-[11px] text-brite-tan/45">{soon}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-brite-white">{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-brite-tan/55">{subtitle}</div>}
        </div>

        {actions && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto"
          >
            {actions}
          </div>
        )}
      </div>
      {footer && (
        <div onClick={(e) => e.stopPropagation()} className="mt-3 border-t border-brite-tan/10 pt-3">
          {footer}
        </div>
      )}
    </article>
  );
}

const BUTTON_STYLES = {
  primary: "bg-brite-green text-brite-white hover:brightness-110",
  danger: "bg-brite-red text-brite-white hover:bg-brite-red-bright",
  ghost: "border border-brite-tan/25 text-brite-tan/80 hover:border-brite-tan/60 hover:text-brite-cream",
};

export function CardButton({
  variant = "ghost",
  onClick,
  children,
}: {
  variant?: keyof typeof BUTTON_STYLES;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-[filter,background-color,border-color,color] ${BUTTON_STYLES[variant]}`}
    >
      {children}
    </button>
  );
}

/** Green "<name> can cover" pill, with an optional action (e.g. Assign). */
export function OfferChip({ worker, label, action }: { worker: Worker; label: string; action?: ReactNode }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border border-brite-green/30 bg-brite-green/10 py-0.5 pl-0.5 ${
        action ? "pr-1" : "pr-2.5"
      }`}
    >
      <Avatar name={worker.name} color={worker.avatarColor} size="sm" />
      <span className="text-xs text-brite-white">{label}</span>
      {action}
    </span>
  );
}
