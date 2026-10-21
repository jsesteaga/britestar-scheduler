import { useState, type ReactNode } from "react";
import type { AppNotification, NotificationKind } from "../types";
import { Modal } from "./ui/Modal";
import { Popover } from "./ui/Popover";

type NotificationCenterProps = {
  // Just this bartender's notifications, newest first.
  notifications: AppNotification[];
  onMarkAllRead: () => void;
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

function NotificationRow({ n, actions }: { n: AppNotification; actions?: ReactNode }) {
  const style = KIND_STYLE[n.kind];
  return (
    <div className="flex gap-2.5 px-3 py-2">
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
 * A bartender's schedule updates: a pop-up of anything new when they open
 * the app, plus a bell in the header to look back through them later.
 */
export function NotificationCenter({ notifications, onMarkAllRead, onClearAll, actionsFor }: NotificationCenterProps) {
  const unread = notifications.filter((n) => !n.read);
  // Decided once, on arrival: if there's news waiting, lead with it.
  const [showPopup, setShowPopup] = useState(() => unread.length > 0);
  const [list, setList] = useState<{ x: number; y: number } | null>(null);

  function closePopup() {
    setShowPopup(false);
    onMarkAllRead();
  }

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
                <NotificationRow key={n.id} n={n} actions={actionsFor?.(n)} />
              ))}
            </div>
          )}
        </Popover>
      )}

      {showPopup && unread.length > 0 && (
        <Modal onClose={closePopup} labelledBy="updates-title">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brite-amber/15 text-lg text-brite-amber">
              ★
            </span>
            <div>
              <h2 id="updates-title" className="text-base font-bold text-brite-white">
                Schedule update{unread.length === 1 ? "" : "s"}
              </h2>
              <p className="text-xs text-brite-tan/50">
                {unread.length} new since you last checked
              </p>
            </div>
          </div>
          <div className="-mx-3 mb-4 max-h-72 overflow-y-auto">
            {unread.map((n) => (
              <NotificationRow key={n.id} n={n} />
            ))}
          </div>
          <button
            type="button"
            autoFocus
            onClick={closePopup}
            className="w-full rounded-lg bg-brite-red py-2.5 text-sm font-semibold text-brite-white hover:bg-brite-red-bright"
          >
            Got it
          </button>
        </Modal>
      )}
    </>
  );
}
