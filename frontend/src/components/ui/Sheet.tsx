import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

type SheetProps = {
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
};

// How far (px) the grab handle has to be pulled down to close the sheet.
const PULL_TO_CLOSE = 70;

/**
 * A panel that slides up from the bottom of the screen — the phone-friendly
 * cousin of Modal (thumbs reach the bottom of a phone, not the middle).
 * Closes on Escape, tapping the dimmed backdrop, or pulling the handle down.
 * On wider screens it's a centered column instead of full-width.
 */
export function Sheet({ onClose, children, labelledBy }: SheetProps) {
  const pullStartY = useRef<number | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    // Stop the page behind from scrolling along with the sheet.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // Same as Modal: keep right-clicks in here from reaching menus behind it.
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="sheet-panel flex max-h-[88dvh] w-full flex-col rounded-t-2xl border border-b-0 border-brite-tan/15 bg-brite-black-soft shadow-2xl shadow-black/70 sm:max-w-lg"
      >
        <div
          className="flex shrink-0 cursor-grab justify-center pb-1 pt-2.5 touch-none"
          onPointerDown={(e) => {
            pullStartY.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            const start = pullStartY.current;
            pullStartY.current = null;
            if (start !== null && e.clientY - start > PULL_TO_CLOSE) onClose();
          }}
          aria-hidden
        >
          <span className="h-1.5 w-10 rounded-full bg-brite-tan/25" />
        </div>
        {/* The bottom padding clears the iPhone home bar. */}
        <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
