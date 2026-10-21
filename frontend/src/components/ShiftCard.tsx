import { useState } from "react";
import type { Shift, Worker } from "../types";
import {
  getDragPayload,
  getShiftDrag,
  isShiftDrag,
  setDragPayload,
  setShiftDrag,
  type DragPayload,
} from "../utils/dnd";
import { formatCompactTime } from "../utils/time";
import { ShiftTimeForm } from "./ShiftTimeForm";
import { ShiftContextMenu, type CopyTarget, type ShiftMenuActions } from "./ShiftContextMenu";
import { Avatar } from "./ui/Avatar";
import { MenuDivider, MenuItem, MenuLabel, Popover } from "./ui/Popover";
import { WorkerPickerList } from "./WorkerPickerList";

type ShiftCardProps = {
  shift: Shift;
  dayLabel: string;
  assignedWorkers: Worker[];
  addableWorkers: Worker[];
  copyTargets: CopyTarget[];
  isAdmin: boolean;
  actions: ShiftMenuActions;
  onDropOnShift: (payload: DragPayload, shiftId: string) => void;
  onDropOnWorker: (payload: DragPayload, shiftId: string, targetWorkerId: string) => void;
  onMoveShift: (shiftId: string, targetShiftId: string, position: DropEdge) => void;
  coverage?: CoverageHighlight;
  bartenderMenu?: BartenderMenu;
};

type MenuState = { x: number; y: number; focusWorkerId?: string };

// How a shift is highlighted when someone's giving it away: amber while it
// needs coverage, green on your own view if you offered to take it.
export type CoverageHighlight = { tone: "amber" | "green"; label: string };

// The bartender's own right-click / press-and-hold menu on a shift (managers
// get the full ShiftContextMenu instead).
export type BartenderMenu = {
  title: string;
  subtitle?: string;
  items: { label: string; icon?: string; checked?: boolean; danger?: boolean; onClick: () => void }[];
};

const LONG_PRESS_MS = 500;
type DropEdge = "before" | "after";

export function ShiftCard({
  shift,
  dayLabel,
  assignedWorkers,
  addableWorkers,
  copyTargets,
  isAdmin,
  actions,
  onDropOnShift,
  onDropOnWorker,
  onMoveShift,
  coverage,
  bartenderMenu,
}: ShiftCardProps) {
  const [workerMenu, setWorkerMenu] = useState<{ x: number; y: number } | null>(null);
  const [pressTimer, setPressTimer] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  // While another shift card is dragged over this one: which half the cursor
  // is in, i.e. whether the dragged shift would land above or below this one.
  const [dropEdge, setDropEdge] = useState<DropEdge | null>(null);
  const [isBeingDragged, setIsBeingDragged] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [picker, setPicker] = useState<{ x: number; y: number } | null>(null);
  const [timeEdit, setTimeEdit] = useState<{ x: number; y: number } | null>(null);

  // Right-click (or long-press on Android) anywhere on the card opens the
  // shift menu instead of the browser's own. Chips call this too, passing
  // their worker so the menu leads with actions for that bartender.
  function openMenu(e: React.MouseEvent, focusWorkerId?: string) {
    if (!isAdmin) {
      if (!bartenderMenu) return;
      e.preventDefault();
      e.stopPropagation();
      setWorkerMenu({ x: e.clientX, y: e.clientY });
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setPicker(null);
    setTimeEdit(null);
    setMenu({ x: e.clientX, y: e.clientY, focusWorkerId });
  }

  // For the ⋯ button — anchors the menu under the button, since there's no
  // cursor position to use (and iOS has no right-click at all).
  function openMenuFromButton(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ x: rect.left, y: rect.bottom + 4 });
  }

  return (
    <div
      // The whole card is the drag handle for moving the shift. Bartender
      // chips inside are their own draggables (for moving just that person);
      // their dragstart bubbles up here too, hence the target check.
      draggable={isAdmin}
      onDragStart={
        isAdmin
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              setShiftDrag(e, shift.id);
              setMenu(null);
              setPicker(null);
              setTimeEdit(null);
              setIsBeingDragged(true);
            }
          : undefined
      }
      onDragEnd={(e) => {
        if (e.target === e.currentTarget) setIsBeingDragged(false);
      }}
      onContextMenu={(e) => openMenu(e)}
      // Press-and-hold on touch screens (iPhones never fire contextmenu).
      onTouchStart={
        !isAdmin && bartenderMenu
          ? (e) => {
              const t = e.touches[0];
              const at = { x: t.clientX, y: t.clientY };
              setPressTimer(window.setTimeout(() => setWorkerMenu(at), LONG_PRESS_MS));
            }
          : undefined
      }
      onTouchEnd={() => pressTimer !== null && (window.clearTimeout(pressTimer), setPressTimer(null))}
      onTouchMove={() => pressTimer !== null && (window.clearTimeout(pressTimer), setPressTimer(null))}
      style={!isAdmin && bartenderMenu ? { WebkitTouchCallout: "none" } : undefined}
      onDragOver={
        isAdmin
          ? (e) => {
              e.preventDefault();
              if (isShiftDrag(e)) {
                if (isBeingDragged) return;
                const rect = e.currentTarget.getBoundingClientRect();
                setDropEdge(e.clientY < rect.top + rect.height / 2 ? "before" : "after");
              } else {
                setIsDragOver(true);
              }
            }
          : undefined
      }
      onDragLeave={
        isAdmin
          ? (e) => {
              // dragleave also fires when moving onto a child element of
              // this card — only clear once the cursor has actually left it.
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setIsDragOver(false);
              setDropEdge(null);
            }
          : undefined
      }
      onDrop={
        isAdmin
          ? (e) => {
              e.preventDefault();
              setIsDragOver(false);
              setDropEdge(null);
              if (isShiftDrag(e)) {
                // Handled here, so the day column behind this card doesn't
                // also treat it as a drop onto its empty space.
                e.stopPropagation();
                const draggedId = getShiftDrag(e);
                const edge =
                  e.clientY < e.currentTarget.getBoundingClientRect().top + e.currentTarget.offsetHeight / 2
                    ? "before"
                    : "after";
                if (draggedId && draggedId !== shift.id) onMoveShift(draggedId, shift.id, edge);
                return;
              }
              const payload = getDragPayload(e);
              if (payload) onDropOnShift(payload, shift.id);
            }
          : undefined
      }
      className={`group relative overflow-hidden rounded-lg border-l-[3px] border-y border-r border-y-brite-tan/10 border-r-brite-tan/10 p-2.5 transition-[background-color,border-color,opacity] ${
        isBeingDragged ? "opacity-40" : ""
      } ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""} ${
        isDragOver
          ? "border-l-brite-amber bg-brite-amber/10"
          : menu || workerMenu
            ? "border-l-brite-amber bg-brite-black-soft/80"
            : coverage?.tone === "green"
              ? "border-l-brite-green bg-brite-green/[0.08] ring-1 ring-brite-green/40"
              : coverage?.tone === "amber"
                ? "border-l-brite-amber bg-brite-amber/[0.07] ring-1 ring-brite-amber/35"
                : "border-l-brite-red-bright/60 bg-brite-black-soft/50"
      } ${!isAdmin && bartenderMenu ? "select-none" : ""}`}
    >
      {dropEdge && (
        <div
          className={`pointer-events-none absolute inset-x-0 h-[3px] bg-brite-amber ${
            dropEdge === "before" ? "top-0" : "bottom-0"
          }`}
        />
      )}

      {/* nowrap + tight gaps: in narrow columns "5:30–8:30" used to break
          onto two lines inside its bubble. */}
      <div className="mb-1.5 flex items-center justify-between gap-1">
        {isAdmin ? (
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenu(null);
              setPicker(null);
              setTimeEdit({ x: rect.left, y: rect.bottom + 4 });
            }}
            title="Click to change the time"
            className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold transition-colors ${
              timeEdit
                ? "border-brite-amber/70 bg-brite-amber/10 text-brite-amber"
                : "border-brite-tan/15 bg-brite-black/40 text-brite-cream hover:border-brite-amber/50 hover:text-brite-white"
            }`}
          >
            {formatCompactTime(shift.start)}–{formatCompactTime(shift.end)}
          </button>
        ) : (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-brite-tan/15 bg-brite-black/40 px-2 py-0.5 text-xs font-bold text-brite-cream">
            {formatCompactTime(shift.start)}–{formatCompactTime(shift.end)}
          </span>
        )}
        {isAdmin && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={openMenuFromButton}
              aria-label="Shift options"
              title="Shift options (or right-click the shift)"
              className="px-0.5 leading-none text-brite-tan/30 hover:text-brite-tan"
            >
              ⋯
            </button>
          </div>
        )}
      </div>

      {coverage && (
        <div
          className={`mb-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            coverage.tone === "green" ? "bg-brite-green/15 text-brite-green" : "bg-brite-amber/15 text-brite-amber"
          }`}
        >
          {coverage.tone === "green" ? "✓" : "●"} {coverage.label}
        </div>
      )}

      {assignedWorkers.length === 0 && (
        <span className="text-xs italic text-brite-tan/40">No one scheduled yet</span>
      )}

      <div className="flex flex-wrap gap-1.5">
        {assignedWorkers.map((worker) => (
          <div
            key={worker.id}
            draggable={isAdmin}
            onContextMenu={(e) => openMenu(e, worker.id)}
            onDragStart={
              isAdmin ? (e) => setDragPayload(e, { source: "shift", workerId: worker.id, shiftId: shift.id }) : undefined
            }
            onDragOver={
              isAdmin
                ? (e) => {
                    // A whole shift being dragged isn't a bartender swap —
                    // let it bubble up to the card's reorder handling.
                    if (isShiftDrag(e)) return;
                    e.preventDefault();
                    e.stopPropagation();
                  }
                : undefined
            }
            onDrop={
              isAdmin
                ? (e) => {
                    if (isShiftDrag(e)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOver(false);
                    const payload = getDragPayload(e);
                    if (payload) onDropOnWorker(payload, shift.id, worker.id);
                  }
                : undefined
            }
            className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 ${
              menu?.focusWorkerId === worker.id
                ? "border-brite-amber/60 bg-brite-amber/10"
                : "border-brite-tan/15 bg-brite-black/40"
            } ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            <Avatar name={worker.name} color={worker.avatarColor} size="sm" />
            <span className="text-xs text-brite-white">{worker.name}</span>
            {isAdmin && (
              <button
                type="button"
                onClick={() => actions.onRemoveWorker(shift.id, worker.id)}
                aria-label={`Remove ${worker.name} from this shift`}
                className="text-brite-tan/40 hover:text-brite-red-bright"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && addableWorkers.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setPicker({ x: rect.left, y: rect.bottom + 4 });
          }}
          className={`mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed py-1 text-[11px] font-semibold transition-colors ${
            picker
              ? "border-brite-amber/60 text-brite-amber"
              : "border-brite-tan/20 text-brite-tan/60 hover:border-brite-tan/45 hover:text-brite-cream"
          }`}
        >
          + Add bartender
        </button>
      )}

      {picker && (
        <Popover x={picker.x} y={picker.y} onClose={() => setPicker(null)} className="w-56">
          <div className="px-3 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-brite-tan/45">
            Add to {formatCompactTime(shift.start)}–{formatCompactTime(shift.end)}
          </div>
          <WorkerPickerList
            workers={addableWorkers}
            onPick={(workerId) => {
              actions.onAddWorker(shift.id, workerId);
              setPicker(null);
            }}
          />
        </Popover>
      )}

      {workerMenu && bartenderMenu && (
        <Popover x={workerMenu.x} y={workerMenu.y} onClose={() => setWorkerMenu(null)} className="w-60">
          <div className="px-3 pb-1 pt-0.5">
            <div className="text-sm font-bold text-brite-white">{bartenderMenu.title}</div>
            {bartenderMenu.subtitle && <div className="text-[11px] text-brite-tan/50">{bartenderMenu.subtitle}</div>}
          </div>
          <MenuDivider />
          <MenuLabel>Your answer</MenuLabel>
          {bartenderMenu.items.map((item) => (
            <MenuItem
              key={item.label}
              icon={item.checked ? "✓" : (item.icon ?? "")}
              label={item.label}
              hint={item.checked ? "current" : undefined}
              danger={item.danger}
              onClick={() => {
                item.onClick();
                setWorkerMenu(null);
              }}
            />
          ))}
        </Popover>
      )}

      {timeEdit && (
        <Popover x={timeEdit.x} y={timeEdit.y} onClose={() => setTimeEdit(null)} className="w-64">
          <div className="px-3 pb-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-brite-tan/45">
            {dayLabel} · shift time
          </div>
          <ShiftTimeForm
            shift={shift}
            autoFocus
            onSave={(start, end) => {
              actions.onSetTime(shift.id, start, end);
              setTimeEdit(null);
            }}
          />
        </Popover>
      )}

      {menu && (
        <ShiftContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          shift={shift}
          dayLabel={dayLabel}
          assignedWorkers={assignedWorkers}
          addableWorkers={addableWorkers}
          focusWorkerId={menu.focusWorkerId}
          copyTargets={copyTargets}
          actions={actions}
        />
      )}
    </div>
  );
}
