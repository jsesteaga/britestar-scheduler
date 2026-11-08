import { useRef, useState } from "react";
import type { HoldDrag } from "../hooks/useHoldDrag";
import { useMediaQuery } from "../hooks/useMediaQuery";
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
import { MenuDivider, MenuItem, Popover } from "./ui/Popover";
import { WorkerPickerList } from "./WorkerPickerList";

type ShiftCardProps = {
  shift: Shift;
  dayLabel: string;
  assignedWorkers: Worker[];
  addableWorkers: Worker[];
  // Manager view: people off that day — listed in "Add bartender", not pickable.
  offWorkers?: Worker[];
  onOffWorkerClick?: (workerId: string) => void;
  copyTargets: CopyTarget[];
  isAdmin: boolean;
  actions: ShiftMenuActions;
  onDropOnShift: (payload: DragPayload, shiftId: string) => void;
  onDropOnWorker: (payload: DragPayload, shiftId: string, targetWorkerId: string) => void;
  onMoveShift: (shiftId: string, targetShiftId: string, position: DropEdge) => void;
  coverage?: CoverageHighlight;
  bartenderMenu?: BartenderMenu;
  // Manager only, when the shift needs coverage.
  onExchange?: () => void;
  // Bartender view: their own chip is highlighted on every shift.
  highlightWorkerId?: string;
  // Manager view: people involved in something that needs resolving.
  flagWorkerIds?: string[];
  chipBadges?: Record<string, ChipBadge>;
  pillMenu?: PillMenu;
  // Briefly pulses the card — set right after jumping to it from a request.
  flash?: boolean;
  // Stays outlined while its request (a swap) is selected.
  selected?: boolean;
  // Manager: touch-screen press-and-hold dragging of names (see useHoldDrag).
  holdDrag?: HoldDrag;
};

type MenuState = { x: number; y: number; focusWorkerId?: string };

// How a shift is highlighted: amber while it needs coverage; green for the
// bartender's own shifts ("mine") and for shifts they offered to take.
export type CoverageHighlight = {
  tone: "amber" | "green" | "mine" | "red";
  label: string;
  // Hover text — e.g. every issue on the shift when the label only fits one.
  title?: string;
};

const HIGHLIGHT = {
  mine: { card: "border-l-brite-green bg-brite-green/[0.08] ring-1 ring-brite-green/45", tag: "bg-brite-green/15 text-brite-green", icon: "★" },
  green: { card: "border-l-brite-green bg-brite-green/[0.08] ring-1 ring-brite-green/40", tag: "bg-brite-green/15 text-brite-green", icon: "✓" },
  amber: { card: "border-l-brite-amber bg-brite-amber/[0.07] ring-1 ring-brite-amber/35", tag: "bg-brite-amber/15 text-brite-amber", icon: "●" },
  // Conflicts (e.g. scheduled on a day off): same calm amber, "!" icon.
  red: { card: "border-l-brite-amber bg-brite-amber/[0.07] ring-1 ring-brite-amber/45", tag: "bg-brite-amber/15 text-brite-amber", icon: "!" },
} as const;

// The bartender's own right-click / press-and-hold menu on a shift (managers
// get the full ShiftContextMenu instead).
export type BartenderMenu = {
  title: string;
  subtitle?: string;
  items: {
    label: string;
    icon?: string;
    checked?: boolean;
    danger?: boolean;
    // Also shown as a small button right on the card (e.g. "Cover" / "Can't").
    inlineLabel?: string;
    primary?: boolean;
    onClick: () => void;
  }[];
};

// A small tag inside one person's name chip, e.g. "Off" when they have the
// day off but are still scheduled.
export type ChipBadge = { text: string; tone: "red" | "amber"; title?: string };

// Manager view: clicking a highlighted shift's tag lists what can be done
// about each thing on it (approve the swap, grant the time off, …).
export type PillAction = { label: string; icon?: string; onClick: () => void };
export type PillMenu = { sections: { title: string; actions: PillAction[] }[] };

const LONG_PRESS_MS = 500;
type DropEdge = "before" | "after";

export function ShiftCard({
  shift,
  dayLabel,
  assignedWorkers,
  addableWorkers,
  offWorkers = [],
  onOffWorkerClick,
  copyTargets,
  isAdmin,
  actions,
  onDropOnShift,
  onDropOnWorker,
  onMoveShift,
  coverage,
  bartenderMenu,
  onExchange,
  highlightWorkerId,
  flagWorkerIds,
  chipBadges,
  pillMenu,
  flash,
  selected,
  holdDrag,
}: ShiftCardProps) {
  // Computers drag with the browser's own drag and drop. Touch screens can't,
  // so there names use press-and-hold instead (holdDrag) and nothing is
  // natively draggable — otherwise the two would fight over the same finger.
  const finePointer = useMediaQuery("(pointer: fine)");
  const nativeDrag = isAdmin && finePointer;
  // Press-and-hold drag over this card: a name from elsewhere (holdOver), or
  // another whole shift (holdEdge: which side of this card it'd land on).
  const held = holdDrag?.dragged;
  const overThis = holdDrag?.target?.shiftId === shift.id ? holdDrag.target : null;
  const holdOver = held?.kind === "person" && held.fromShiftId !== shift.id ? overThis : null;
  const holdEdge = held?.kind === "shift" && held.shiftId !== shift.id ? overThis?.side : undefined;
  const [workerMenu, setWorkerMenu] = useState<{ x: number; y: number } | null>(null);
  const [pillMenuAt, setPillMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [pressTimer, setPressTimer] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  // While another shift card is dragged over this one: which half the cursor
  // is in, i.e. whether the dragged shift would land above or below this one.
  const [dropEdge, setDropEdge] = useState<DropEdge | null>(null);
  const [isBeingDragged, setIsBeingDragged] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [picker, setPicker] = useState<{ x: number; y: number } | null>(null);
  const [timeEdit, setTimeEdit] = useState<{ x: number; y: number } | null>(null);
  // The time bubble's unsaved edit, so clicking away can save it in place.
  const timeDraft = useRef<{ start: string; end: string } | null>(null);

  // Clicking off the bubble saves (if anything changed); Escape cancels.
  function closeTimeEdit(save: boolean) {
    const draft = timeDraft.current;
    if (save && draft && (draft.start !== shift.start || draft.end !== shift.end)) {
      actions.onSetTime(shift.id, draft.start, draft.end);
    }
    timeDraft.current = null;
    setTimeEdit(null);
  }

  // Right-click (or long-press on Android) anywhere on the card opens the
  // shift menu instead of the browser's own. Chips call this too, passing
  // their worker so the menu leads with actions for that bartender.
  function openMenu(e: React.MouseEvent, focusWorkerId?: string) {
    // Android fires this on a long press — mid press-and-hold drag, ignore it.
    if (holdDrag?.isBusy()) {
      e.preventDefault();
      return;
    }
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
      id={`shift-${shift.id}`}
      // Where a press-and-hold drag can drop (see useHoldDrag).
      data-drop-shift={shift.id}
      // The whole card is the drag handle for moving the shift. Bartender
      // chips inside are their own draggables (for moving just that person);
      // their dragstart bubbles up here too, hence the target check.
      draggable={nativeDrag}
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
      // Touch: press and hold the card itself (not a name on it — those start
      // their own drag first) to move the whole shift, like a mouse drag.
      onPointerDown={
        isAdmin && holdDrag
          ? (e) =>
              holdDrag.start(
                e,
                { kind: "shift", shiftId: shift.id, label: `${dayLabel} ${formatCompactTime(shift.start)}–${formatCompactTime(shift.end)}` },
                { touchOnly: true },
              )
          : undefined
      }
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
      className={`group relative overflow-hidden rounded-lg @[7rem]:p-1.5 @[9.5rem]:p-2.5 border-l-[3px] border-y border-r border-y-brite-tan/10 border-r-brite-tan/10 p-1 transition-[background-color,border-color,opacity] ${
        isBeingDragged || (held?.kind === "shift" && held.shiftId === shift.id) ? "opacity-40" : ""
      } ${nativeDrag ? "cursor-grab active:cursor-grabbing" : ""} ${
        isDragOver || (holdOver && !holdOver.workerId)
          ? "border-l-brite-amber bg-brite-amber/10 ring-2 ring-brite-amber/70"
          : menu || workerMenu
            ? "border-l-brite-amber bg-brite-black-soft/80"
            : coverage
              ? HIGHLIGHT[coverage.tone].card
              : "border-l-brite-red-bright/60 bg-brite-black-soft/50"
      } ${!isAdmin && bartenderMenu ? "select-none" : ""} ${flash ? "shift-flash" : ""} ${
        selected ? "outline-2 outline-offset-2 outline-brite-amber" : ""
      }`}
    >
      {/* Sizes below with @[9.5rem]: are "when this day column is at least
          9.5rem (152px) wide" — see @container on the columns in SchedulePage.
          Narrower columns (a tablet-width week) get a tighter layout, and
          the narrowest (@[7rem] and under) drop the color dot and Off? tag
          to leave room for the name — the chip's amber border still flags it. */}
      {(dropEdge ?? holdEdge) && (
        <div
          className={`pointer-events-none absolute inset-x-0 h-[3px] bg-brite-amber ${
            (dropEdge ?? holdEdge) === "before" ? "top-0" : "bottom-0"
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
            className={`shrink-0 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[11px] font-bold transition-colors @[9.5rem]:px-2 @[9.5rem]:text-xs ${
              timeEdit
                ? "border-brite-amber/70 bg-brite-amber/10 text-brite-amber"
                : "border-brite-tan/15 bg-brite-black/40 text-brite-cream hover:border-brite-amber/50 hover:text-brite-white"
            }`}
          >
            {formatCompactTime(shift.start)}–{formatCompactTime(shift.end)}
          </button>
        ) : (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-brite-tan/15 bg-brite-black/40 px-1.5 py-0.5 text-[11px] font-bold text-brite-cream @[9.5rem]:px-2 @[9.5rem]:text-xs">
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
              // Bigger hit area on touch screens — a fingertip is wider than a ⋯.
              className="px-0.5 leading-none text-brite-tan/30 hover:text-brite-tan pointer-coarse:-my-1 pointer-coarse:px-2 pointer-coarse:py-1 pointer-coarse:text-brite-tan/60"
            >
              ⋯
            </button>
          </div>
        )}
      </div>

      {coverage &&
        (() => {
          // max-w-full + truncate: in narrow day columns a long label
          // ("Needs coverage · 1 offer") trims with … instead of spilling out.
          const pill = `mb-1.5 inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${HIGHLIGHT[coverage.tone].tag}`;
          const content = (
            <>
              {HIGHLIGHT[coverage.tone].icon} <span className="truncate">{coverage.label}</span>
            </>
          );
          // Once there's nothing to answer inline, the whole pill opens the
          // options menu (⋯ is just the hint that it's clickable).
          const opensMenu =
            (isAdmin && !!pillMenu) || (bartenderMenu && !bartenderMenu.items.some((i) => i.inlineLabel));
          return opensMenu ? (
            <button
              type="button"
              aria-label={`${coverage.label}: ${isAdmin ? "options" : "change your answer"}`}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const at = { x: rect.left, y: rect.bottom + 4 };
                if (isAdmin) setPillMenuAt(at);
                else setWorkerMenu(at);
              }}
              title={coverage.title ?? coverage.label}
              className={`${pill} transition-[filter] hover:brightness-125`}
            >
              {content}
              <span aria-hidden className="ml-0.5 text-xs leading-none opacity-70">
                ⋯
              </span>
            </button>
          ) : (
            <div className={pill} title={coverage.title}>
              {content}
            </div>
          );
        })()}

      {bartenderMenu && bartenderMenu.items.some((i) => i.inlineLabel) && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {bartenderMenu.items
            .filter((i) => i.inlineLabel)
            .map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-[filter,border-color,color] ${
                  item.primary
                    ? "bg-brite-green text-brite-white hover:brightness-110"
                    : "border border-brite-tan/25 text-brite-tan/75 hover:border-brite-tan/60 hover:text-brite-cream"
                }`}
              >
                {item.inlineLabel}
              </button>
            ))}
        </div>
      )}

      {assignedWorkers.length === 0 && (
        <span className="text-xs italic text-brite-tan/40">No one scheduled yet</span>
      )}

      {/* Narrow: one name per line (so each keeps its ✕). Roomy: wrapped chips. */}
      <div className="flex flex-col gap-1 @[9.5rem]:flex-row @[9.5rem]:flex-wrap @[9.5rem]:gap-1.5">
        {assignedWorkers.map((worker) => (
          <div
            key={worker.id}
            data-drop-worker={worker.id}
            draggable={nativeDrag}
            // Touch: press and hold the name, then drag it (useHoldDrag).
            onPointerDown={
              isAdmin && holdDrag
                ? (e) =>
                    holdDrag.start(
                      e,
                      { kind: "person", workerId: worker.id, fromShiftId: shift.id, name: worker.name, color: worker.avatarColor },
                      { touchOnly: true },
                    )
                : undefined
            }
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
            className={`flex min-w-0 items-center gap-1 rounded-full border py-0.5 pl-1 pr-1 @[7rem]:pl-1.5 @[7rem]:pr-1.5 @[9.5rem]:gap-1.5 @[9.5rem]:pl-0.5 @[9.5rem]:pr-2 ${
              menu?.focusWorkerId === worker.id
                ? "border-brite-amber/60 bg-brite-amber/10"
                : flagWorkerIds?.includes(worker.id)
                  ? "border-brite-amber/60 bg-brite-amber/10"
                  : worker.id === highlightWorkerId
                  ? "border-brite-green/60 bg-brite-green/15"
                  : "border-brite-tan/15 bg-brite-black/40"
            } ${nativeDrag ? "cursor-grab active:cursor-grabbing" : ""} ${
              isAdmin ? "pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none]" : ""
            } ${
              held?.kind === "person" && held.workerId === worker.id && held.fromShiftId === shift.id ? "opacity-30" : ""
            } ${holdOver?.workerId === worker.id ? "ring-2 ring-brite-amber" : ""}`}
          >
            <span className="hidden @[9.5rem]:contents">
              <Avatar name={worker.name} color={worker.avatarColor} size="sm" />
            </span>
            <span className="hidden h-2 w-2 shrink-0 rounded-full @[7rem]:block @[9.5rem]:hidden" style={{ backgroundColor: worker.avatarColor }} />
            <span title={worker.name} className="min-w-0 flex-1 truncate text-[11px] text-brite-white @[9.5rem]:flex-none @[9.5rem]:text-xs">
              {worker.name}
            </span>
            {chipBadges?.[worker.id] && (
              <span
                title={chipBadges[worker.id].title}
                className={`hidden shrink-0 rounded-full px-1 py-px text-[9px] @[7rem]:inline-block font-bold uppercase tracking-wide @[9.5rem]:px-1.5 ${
                  chipBadges[worker.id].tone === "red"
                    ? "bg-brite-tan/20 text-brite-cream"
                    : "bg-brite-amber/25 text-brite-amber"
                }`}
              >
                {chipBadges[worker.id].text}
              </span>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => actions.onRemoveWorker(shift.id, worker.id)}
                aria-label={`Remove ${worker.name} from this shift`}
                className="shrink-0 text-brite-tan/40 hover:text-brite-red-bright pointer-coarse:-my-1 pointer-coarse:px-1 pointer-coarse:py-1"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && addableWorkers.length + offWorkers.length > 0 && (
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
          <span className="@[9.5rem]:hidden">+ Add</span>
          <span className="hidden @[9.5rem]:inline">+ Add bartender</span>
        </button>
      )}

      {picker && (
        <Popover x={picker.x} y={picker.y} onClose={() => setPicker(null)} className="w-56">
          <div className="px-3 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-brite-tan/45">
            Add to {formatCompactTime(shift.start)}–{formatCompactTime(shift.end)}
          </div>
          <WorkerPickerList
            workers={addableWorkers}
            offWorkers={offWorkers}
            onOffWorkerClick={(id) => {
              setPicker(null);
              onOffWorkerClick?.(id);
            }}
            onPick={(workerId) => {
              actions.onAddWorker(shift.id, workerId);
              setPicker(null);
            }}
          />
        </Popover>
      )}

      {pillMenuAt && pillMenu && (
        <Popover x={pillMenuAt.x} y={pillMenuAt.y} onClose={() => setPillMenuAt(null)} className="w-64">
          {pillMenu.sections.map((section, i) => (
            <div key={section.title + i}>
              {i > 0 && <MenuDivider />}
              <div className="px-3 pb-1 pt-1 text-[11px] font-bold text-brite-tan/70">{section.title}</div>
              {section.actions.map((action) => (
                <MenuItem
                  key={action.label}
                  icon={action.icon ?? ""}
                  label={action.label}
                  onClick={() => {
                    setPillMenuAt(null);
                    action.onClick();
                  }}
                />
              ))}
            </div>
          ))}
        </Popover>
      )}

      {workerMenu && bartenderMenu && (
        <Popover x={workerMenu.x} y={workerMenu.y} onClose={() => setWorkerMenu(null)} className="w-60">
          <div className="px-3 pb-1 pt-0.5">
            <div className="text-sm font-bold text-brite-white">{bartenderMenu.title}</div>
            {bartenderMenu.subtitle && <div className="text-[11px] text-brite-tan/50">{bartenderMenu.subtitle}</div>}
          </div>
          <MenuDivider />
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
        <Popover
          x={timeEdit.x}
          y={timeEdit.y}
          onClose={() => closeTimeEdit(true)}
          onEscape={() => closeTimeEdit(false)}
          className="w-64"
        >
          <div className="px-3 pb-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-brite-tan/45">
            {dayLabel} · shift time
          </div>
          <ShiftTimeForm
            shift={shift}
            autoFocus
            onSave={(start, end) => {
              actions.onSetTime(shift.id, start, end);
              timeDraft.current = null;
              setTimeEdit(null);
            }}
            onDraftChange={(start, end) => {
              timeDraft.current = { start, end };
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
          offWorkers={offWorkers}
          onOffWorkerClick={onOffWorkerClick}
          focusWorkerId={menu.focusWorkerId}
          copyTargets={copyTargets}
          actions={actions}
          onExchange={onExchange}
        />
      )}
    </div>
  );
}
