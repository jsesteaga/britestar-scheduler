import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
};

/** A centered pop-up over a dimmed, blurred page. Escape or clicking the backdrop closes it. */
export function Modal({ onClose, children, labelledBy }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // React events bubble through portals to whatever rendered this —
      // keep a right-click in here from opening a menu behind it.
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="modal-panel w-full max-w-sm rounded-2xl border border-brite-tan/15 bg-brite-black-soft p-5 shadow-2xl shadow-black/70"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
