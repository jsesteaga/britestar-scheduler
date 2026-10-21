import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type PopoverProps = {
  // Viewport coordinates (e.g. a right-click's clientX/clientY) the popover opens at.
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

const EDGE_MARGIN = 8;

/**
 * A floating panel rendered into <body> via a portal, so it's never clipped
 * by a parent's `overflow-hidden` (shift cards have one). Closes on Escape
 * or on any pointer press outside it.
 */
export function Popover({ x, y, onClose, children, className = "" }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Nudge the panel back on-screen — a right-click near the bottom/right edge
  // would otherwise open it half off the page. Re-runs whenever the panel
  // resizes too, since sections inside it can expand after it opens.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    function clamp() {
      const rect = el!.getBoundingClientRect();
      setPos({
        left: Math.max(EDGE_MARGIN, Math.min(x, window.innerWidth - rect.width - EDGE_MARGIN)),
        top: Math.max(EDGE_MARGIN, Math.min(y, window.innerHeight - rect.height - EDGE_MARGIN)),
      });
    }
    clamp();
    const observer = new ResizeObserver(clamp);
    observer.observe(el);
    return () => observer.disconnect();
  }, [x, y]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.left, top: pos.top }}
      // React events bubble through portals to the component that rendered
      // them — without stopPropagation, a right-click inside this panel
      // would reach the shift card behind it and reopen the menu.
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className={`fixed z-50 max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-brite-tan/15 bg-brite-black-soft py-1.5 text-brite-cream shadow-2xl shadow-black/60 ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-brite-tan/45">
      {children}
    </div>
  );
}

export function MenuDivider() {
  return <div className="my-1.5 h-px bg-brite-tan/10" />;
}

type MenuItemProps = {
  icon?: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export function MenuItem({ icon, label, hint, onClick, danger, disabled }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] disabled:pointer-events-none disabled:opacity-35 ${
        danger
          ? "text-brite-red-bright hover:bg-brite-red/15"
          : "text-brite-cream hover:bg-brite-tan/10"
      }`}
    >
      {icon !== undefined && (
        <span className="flex min-w-4 shrink-0 justify-center text-brite-tan/60">{icon}</span>
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 text-[11px] text-brite-tan/40">{hint}</span>}
    </button>
  );
}
