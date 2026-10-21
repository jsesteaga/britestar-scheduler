/** Drag payloads carried between draggable bartender chips and shift drop targets. */
export type DragPayload =
  | { source: "roster"; workerId: string }
  | { source: "shift"; workerId: string; shiftId: string };

const MIME = "application/json";

export function setDragPayload(e: React.DragEvent, payload: DragPayload) {
  e.dataTransfer.setData(MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "move";
}

export function getDragPayload(e: React.DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData(MIME);
    return raw ? (JSON.parse(raw) as DragPayload) : null;
  } catch {
    return null;
  }
}

// Whole shift cards are dragged under their own MIME type, separate from
// bartender chips. During dragover the browser hides the dragged *data* but
// does expose the *types*, so this is how a drop target tells the two apart
// before the drop happens (e.g. to show the "insert here" line).
const SHIFT_MIME = "application/x-britestar-shift";

export function setShiftDrag(e: React.DragEvent, shiftId: string) {
  e.dataTransfer.setData(SHIFT_MIME, shiftId);
  e.dataTransfer.effectAllowed = "move";
}

export function isShiftDrag(e: React.DragEvent): boolean {
  return e.dataTransfer.types.includes(SHIFT_MIME);
}

export function getShiftDrag(e: React.DragEvent): string | null {
  return e.dataTransfer.getData(SHIFT_MIME) || null;
}

// Reordering names inside the Manage bartenders panel — separate from the
// "roster" DragPayload (which is for dropping a name onto a shift), so the
// panel's chips only react to drags that started in the panel.
const ROSTER_MIME = "application/x-britestar-roster";

export function setRosterDrag(e: React.DragEvent, workerId: string) {
  e.dataTransfer.setData(ROSTER_MIME, workerId);
}

export function isRosterDrag(e: React.DragEvent): boolean {
  return e.dataTransfer.types.includes(ROSTER_MIME);
}

export function getRosterDrag(e: React.DragEvent): string | null {
  return e.dataTransfer.getData(ROSTER_MIME) || null;
}
