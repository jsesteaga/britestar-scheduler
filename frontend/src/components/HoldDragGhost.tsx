import type { HoldDrag, HoldDragItem, HoldDropTarget } from "../hooks/useHoldDrag";

/** What letting go here would do, e.g. "→ move" — or nothing if it wouldn't do anything. */
function dropHint(item: HoldDragItem, t: HoldDropTarget | null): string | null {
  if (!t) return null;
  if (item.kind === "shift") {
    if (t.shiftId === item.shiftId) return null;
    return t.shiftId || t.date ? "→ move here" : null;
  }
  if (t.rosterId) return item.fromShiftId || t.rosterId === item.workerId ? null : "↔ reorder";
  if (!t.shiftId || t.shiftId === item.fromShiftId) return null;
  if (t.workerId && t.workerId !== item.workerId) return item.fromShiftId ? "⇄ swap" : "+ add";
  return item.fromShiftId ? "→ move" : "+ add";
}

/** The lifted name or shift during a press-and-hold drag, floating just above the finger so it isn't hidden under it. */
export function HoldDragGhost({ drag }: { drag: HoldDrag }) {
  const { dragged, pos, target } = drag;
  if (!dragged) return null;
  const hint = dropHint(dragged, target);
  // Centered over the finger, but not past the screen edge (it's ~140px wide).
  const left = Math.min(Math.max(pos.x, 75), window.innerWidth - 75);
  return (
    <div
      className={`pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-[150%] whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-bold text-brite-white shadow-2xl shadow-black/70 ring-2 ring-brite-white/70 ${
        dragged.kind === "shift" ? "border-l-4 border-brite-red-bright bg-brite-black-soft" : ""
      }`}
      style={{ left, top: pos.y, backgroundColor: dragged.kind === "person" ? dragged.color : undefined }}
    >
      {dragged.kind === "person" ? dragged.name : dragged.label}
      {hint && <span className="ml-1.5 text-xs font-semibold opacity-80">{hint}</span>}
    </div>
  );
}
