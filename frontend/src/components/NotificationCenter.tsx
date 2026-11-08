import { useState, type ReactNode } from "react";
import type { AppNotification, NotificationKind } from "../types";
import { Popover } from "./ui/Popover";

type NotificationCenterProps = {
  // Just this bartender's notifications, newest first.
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  // Hovering an unread note marks just that one read (its red dot goes away).
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
  // Optional buttons under a notification (e.g. "Actually, I can cover").
  actionsFor?: (n: AppNotification) => ReactNode;
};

const KIND_STYLE: Record<NotificationKind, { icon: string; className: string }> = {
  covered: { icon: "✓", className: "bg-brite-green/15 text-brite-green" },
  added: { icon: "+", className: "bg-brite-green/15 text-brite-green" },
  finalized: { icon: "★", className: "bg-brite-green/15 text-brite-green" },
  covering: { icon: "⇄", className: "bg-brite-amber/15 text-brite-amber" },
  changed: { icon: "✎", className: "bg-brite-amber/15 text-brite-amber" },
  request: { icon: "•", className: "bg-brite-tan/10 text-brite-tan" },
  "needs-coverage": { icon: "!", className: "bg-brite-amber/15 text-brite-amber" },
  offer: { icon: "♥", className: "bg-brite-green/15 text-brite-green" },
  response: { icon: "↩", className: "bg-brite-tan/10 text-brite-tan" },
  swap: { icon: "⇄", className: "bg-brite-amber/15 text-brite-amber" },
  removed: { icon: "−", className: "bg-brite-red/20 text-brite-red-bright" },
};

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function NotificationRow({
  n,
  actions,
  onSeen,
}: {
  n: AppNotification;
  actions?: ReactNode;
  onSeen?: () => void;
}) {
  const style = KIND_STYLE[n.kind];
  return (
    <div className="flex gap-2.5 px-3 py-2" onMouseEnter={onSeen}>
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${style.className}`}
      >
        {style.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] leading-snug ${n.read ? "text-brite-tan/70" : "text-brite-white"}`}>{n.text}</p>
        <p className="mt-0.5 text-[11px] text-brite-tan/40">{timeAgo(n.createdAt)}</p>
        {actions && <div className="mt-1.5">{actions}</div>}
      </div>
      {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brite-red-bright" />}
    </div>
  );
}

/**
 * A bartender's schedule updates, in a bell in the header. New ones show as
 * a red count on the bell (no pop-up on login); opening it marks them read.
 */
export function NotificationCenter({
  notifications,
  onMarkAllRead,
  onMarkRead,
  onClearAll,
  actionsFor,
}: NotificationCenterProps) {
  const unread = notifications.filter((n) => !n.read);
  const [list, setList] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setList({ x: rect.right - 320, y: rect.bottom + 6 });
        }}
        aria-label={`Notifications${unread.length ? ` (${unread.length} new)` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-brite-tan/15 text-brite-tan/70 hover:border-brite-tan/40 hover:text-brite-tan"
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brite-red-bright px-1 text-[10px] font-bold text-brite-white">
            {unread.length}
          </span>
        )}
      </button>

      {list && (
        <Popover
          x={list.x}
          y={list.y}
          onClose={() => {
            setList(null);
            onMarkAllRead();
          }}
          className="w-80"
        >
          <div className="flex items-center justify-between px-3 pb-1.5 pt-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brite-tan/55">Updates</span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setList(null);
                }}
                className="text-[11px] font-semibold text-brite-tan/45 hover:text-brite-tan"
              >
                Clear all
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs italic text-brite-tan/40">No updates yet.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.slice(0, 30).map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  actions={actionsFor?.(n)}
                  onSeen={n.read ? undefined : () => onMarkRead(n.id)}
                />
              ))}
            </div>
          )}
        </Popover>
      )}

    </>
  );
}
