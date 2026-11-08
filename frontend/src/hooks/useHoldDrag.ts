import { useEffect, useRef, useState } from "react";

/**
 * What's being dragged:
 * - person: a bartender's name — off a shift (fromShiftId), or from the
 *   Manage bartenders roster (no fromShiftId).
 * - shift: a whole shift, to reorder it or move it to another day.
 */
export type HoldDragItem =
  | { kind: "person"; workerId: string; fromShiftId?: string; name: string; color: string }
  | { kind: "shift"; shiftId: string; label: string };

/**
 * What's under the finger. Most specific first: a person on a shift (swap),
 * a shift, a day (its empty space), or a name in the roster (reorder).
 * side: which half of the element — top/bottom for shifts, left/right for
 * roster names — i.e. where a dropped shift/name would land.
 */
export type HoldDropTarget = {
  shiftId?: string;
  workerId?: string;
  date?: string;
  rosterId?: string;
  side: "before" | "after";
};

export type HoldDrag = {
  dragged: HoldDragItem | null;
  pos: { x: number; y: number };
  target: HoldDropTarget | null;
  /**
   * Put on a draggable's onPointerDown. touchOnly: leave mouse drags to the
   * browser's own drag and drop (the full shift cards and roster use that
   * on computers).
   */
  start: (e: React.PointerEvent, item: HoldDragItem, opts?: { touchOnly?: boolean }) => void;
  /** True mid-drag and for a moment after — so the tap the browser fires on release can be ignored. */
  isBusy: () => boolean;
};

// Touch: how long to hold before it lifts up for dragging, and how far the
// finger can wander meanwhile before we decide it's a scroll instead.
const HOLD_MS = 280;
const HOLD_SLOP = 10;
// Mouse: no hold needed, a small movement starts the drag.
const MOUSE_SLOP = 4;
// Dragging near the top/bottom edge scrolls the page; near the left/right
// edge, a sideways-scrolling row under the finger.
const EDGE_SCROLL_ZONE = 70;
const SIDE_SCROLL_ZONE = 40;

/**
 * Press-and-hold drag for names and shifts. The browser's built-in drag and
 * drop doesn't work with fingers, so this is done by hand: pointer events
 * track the finger, and the drop target is whatever sits under it, found by
 * these attributes on the page:
 *   data-drop-shift="<shift id>"    a shift (card or block)
 *   data-drop-worker="<worker id>"  a person's name within a shift
 *   data-drop-day="<date>"          a day column
 *   data-drop-roster="<worker id>"  a name in the Manage bartenders roster
 *
 * Every drop onto something calls onDrop — it decides what that means.
 */
export function useHoldDrag(onDrop: (item: HoldDragItem, target: HoldDropTarget) => void): HoldDrag {
  const [dragged, setDragged] = useState<HoldDragItem | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [target, setTarget] = useState<HoldDropTarget | null>(null);
  // Mirrors of the above for the document-level listeners, which are set up
  // once and so can't read fresh state.
  const live = useRef({
    pending: null as null | { item: HoldDragItem; x: number; y: number; mouse: boolean; timer: number },
    dragged: null as HoldDragItem | null,
    target: null as HoldDropTarget | null,
    x: 0,
    y: 0,
    justDropped: false,
    onDrop,
  });
  useEffect(() => {
    live.current.onDrop = onDrop;
  });

  // Only touches refs and state setters, which never change — so the
  // listeners below, set up once, can safely call it.
  function liftUp(item: HoldDragItem) {
    const s = live.current;
    s.pending = null;
    s.dragged = item;
    setDragged(item);
    setPos({ x: s.x, y: s.y });
    navigator.vibrate?.(12); // a little tick on Android; iPhones ignore this
  }

  useEffect(() => {
    const s = live.current;

    function findTarget(x: number, y: number): HoldDropTarget | null {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const roster = el.closest<HTMLElement>("[data-drop-roster]");
      if (roster) {
        const r = roster.getBoundingClientRect();
        return { rosterId: roster.dataset.dropRoster, side: x < r.left + r.width / 2 ? "before" : "after" };
      }
      const shift = el.closest<HTMLElement>("[data-drop-shift]");
      const day = el.closest<HTMLElement>("[data-drop-day]");
      if (!shift && !day) return null;
      const r = (shift ?? day)!.getBoundingClientRect();
      return {
        shiftId: shift?.dataset.dropShift,
        workerId: el.closest<HTMLElement>("[data-drop-worker]")?.dataset.dropWorker,
        date: day?.dataset.dropDay,
        side: y < r.top + r.height / 2 ? "before" : "after",
      };
    }

    function retarget() {
      s.target = findTarget(s.x, s.y);
      setTarget(s.target);
    }

    function update(x: number, y: number) {
      s.x = x;
      s.y = y;
      const p = s.pending;
      if (p) {
        const moved = Math.hypot(x - p.x, y - p.y);
        if (p.mouse && moved > MOUSE_SLOP) liftUp(p.item);
        else if (!p.mouse && moved > HOLD_SLOP) {
          // Moved before the hold finished: it's a scroll or swipe, not a drag.
          window.clearTimeout(p.timer);
          s.pending = null;
        }
      }
      if (s.dragged) {
        setPos({ x, y });
        retarget();
      }
    }

    function end(drop: boolean) {
      if (s.pending) window.clearTimeout(s.pending.timer);
      s.pending = null;
      const item = s.dragged;
      if (!item) return;
      if (drop && s.target) s.onDrop(item, s.target);
      s.dragged = null;
      s.target = null;
      s.justDropped = true;
      window.setTimeout(() => (s.justDropped = false), 350);
      setDragged(null);
      setTarget(null);
    }

    const onMove = (e: PointerEvent) => update(e.clientX, e.clientY);
    const onUp = () => end(true);
    const onCancel = () => end(false);
    // While something is lifted, the finger must drag it, not scroll the page.
    // (Has to be a non-passive listener for preventDefault to work.)
    const onTouchMove = (e: TouchEvent) => {
      if (s.dragged) e.preventDefault();
    };
    // Near the top/bottom edge, scroll the page so off-screen shifts can be
    // reached. Near the left/right edge over a sideways-scrolling row (marked
    // data-hold-scroll-x, e.g. the phone roster), scroll that row instead.
    const scroller = window.setInterval(() => {
      if (!s.dragged) return;
      const dy = s.y < EDGE_SCROLL_ZONE ? -10 : s.y > window.innerHeight - EDGE_SCROLL_ZONE ? 10 : 0;
      const dx = s.x < SIDE_SCROLL_ZONE ? -8 : s.x > window.innerWidth - SIDE_SCROLL_ZONE ? 8 : 0;
      // Matched by height, not "under the finger": at the very screen edge
      // the finger can be just past the row's own edge.
      const row = dx
        ? [...document.querySelectorAll<HTMLElement>("[data-hold-scroll-x]")].find((el) => {
            const r = el.getBoundingClientRect();
            return s.y >= r.top && s.y <= r.bottom;
          })
        : null;
      if (dy) window.scrollBy(0, dy);
      if (row) row.scrollLeft += dx;
      if (dy || row) retarget();
    }, 16);

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("touchmove", onTouchMove);
      window.clearInterval(scroller);
    };
  }, []);

  function start(e: React.PointerEvent, item: HoldDragItem, { touchOnly = false } = {}) {
    const mouse = e.pointerType === "mouse";
    if (mouse && (touchOnly || e.button !== 0)) return;
    // A name inside a shift card starts its own (person) drag — don't also
    // start the card's (shift) drag as the press bubbles up.
    if (live.current.pending) return;
    const s = live.current;
    s.x = e.clientX;
    s.y = e.clientY;
    s.pending = {
      item,
      x: e.clientX,
      y: e.clientY,
      mouse,
      // Touch: lift it once the finger has stayed put long enough.
      timer: mouse ? 0 : window.setTimeout(() => s.pending && liftUp(s.pending.item), HOLD_MS),
    };
  }

  return {
    dragged,
    pos,
    target,
    start,
    isBusy: () => !!live.current.dragged || live.current.justDropped,
  };
}
