import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Day, Shift, Worker } from "../types";
import { formatCompactTime } from "../utils/time";
import { DAY_FULL_NAMES } from "../utils/week";
import { ShiftTimeForm } from "./ShiftTimeForm";
import { Avatar } from "./ui/Avatar";
import { MenuDivider, MenuItem, MenuLabel, Popover } from "./ui/Popover";
import { WorkerPickerList } from "./WorkerPickerList";

export type CopyTarget = { day: Day; date: string; dateLabel: string };

type CopyFlyoutProps = {
  anchorRef: React.RefObject<HTMLElement | null>;
  targets: CopyTarget[];
  selected: string[];
  onToggle: (date: string) => void;
  onSetAll: (all: boolean) => void;
  onCopy: () => void;
};

/**
 * The side panel for "Copy to other days…". It's position: fixed (placed
 * from the menu row's on-screen rect) so the menu's own scroll container
 * can't clip it, but it's still a DOM child of the menu — so clicks in it
 * don't count as "clicking outside" and close everything.
 */
function CopyFlyout({ anchorRef, targets, selected, onToggle, onSetAll, onCopy }: CopyFlyoutProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !ref.current) return;
    const row = anchor.getBoundingClientRect();
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    // Open to the right of the menu, or flip to the left near the screen edge.
    const left = row.right + w + 12 > window.innerWidth ? row.left - w - 4 : row.right + 4;
    const top = Math.max(8, Math.min(row.top - 6, window.innerHeight - h - 8));
    setPos({ left, top });
  }, [anchorRef]);

  const allSelected = selected.length === targets.length;

  return (
    <div
      ref={ref}
      style={pos ?? { visibility: "hidden" }}
      className="fixed z-50 w-52 rounded-xl border border-brite-tan/15 bg-brite-black-soft py-1.5 shadow-2xl shadow-black/60"
    >
      <div className="flex items-center justify-between px-3 pb-1 pt-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brite-tan/45">Copy to</span>
        <button
          type="button"
          onClick={() => onSetAll(!allSelected)}
          className="rounded px-1 text-[10px] font-semibold text-brite-tan/55 hover:text-brite-cream"
        >
          {allSelected ? "Clear" : "Select all"}
        </button>
      </div>
      {targets.map((t) => {
        const checked = selected.includes(t.date);
        return (
          <button
            key={t.date}
            type="button"
            role="menuitemcheckbox"
            aria-checked={checked}
            onClick={() => onToggle(t.date)}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] hover:bg-brite-tan/10 ${
              checked ? "text-brite-white" : "text-brite-cream"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none ${
                checked ? "border-brite-red bg-brite-red text-brite-white" : "border-brite-tan/30"
              }`}
            >
              {checked ? "✓" : ""}
            </span>
            <span className="flex-1">{DAY_FULL_NAMES[t.day]}</span>
            <span className="text-[11px] text-brite-tan/40">{t.dateLabel}</span>
          </button>
        );
      })}
      <div className="px-3 pt-1.5">
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={onCopy}
          className="w-full rounded-md bg-brite-red py-1 text-[11px] font-semibold text-brite-white hover:bg-brite-red-bright disabled:bg-brite-tan/10 disabled:text-brite-tan/35"
        >
          {selected.length === 0
            ? "Pick days"
            : `Copy to ${selected.length} day${selected.length === 1 ? "" : "s"}`}
        </button>
        <p className="mt-1.5 text-[10px] leading-snug text-brite-tan/40">
          Time + bartenders · skips anyone off that day
        </p>
      </div>
    </div>
  );
}

export type ShiftMenuActions = {
  onAddWorker: (shiftId: string, workerId: string) => void;
  onRemoveWorker: (shiftId: string, workerId: string) => void;
  onClearWorkers: (shiftId: string) => void;
  onSetTime: (shiftId: string, start: string, end: string) => void;
  onDuplicate: (shiftId: string) => void;
  onCopyToDates: (shiftId: string, dates: string[]) => void;
  onDeleteShift: (shiftId: string) => void;
};

type ShiftContextMenuProps = {
  x: number;
  y: number;
  onClose: () => void;
  shift: Shift;
  dayLabel: string;
  assignedWorkers: Worker[];
  addableWorkers: Worker[];
  // Set when the menu was opened by right-clicking a specific bartender's chip.
  focusWorkerId?: string;
  copyTargets: CopyTarget[];
  actions: ShiftMenuActions;
  // Set when someone's giving this shift away — opens the exchange picker.
  onExchange?: () => void;
};

type Expanded = "add" | null;

// The whole row is the click target (no precise aiming needed): hovering
// anywhere on it tints the row like "Remove all bartenders" does, and also
// lights up the boxed "Remove" label on the right. No hover transitions —
// feedback should be instant.
function WorkerRow({
  worker,
  highlighted,
  onRemove,
}: {
  worker: Worker;
  // The bartender whose chip was right-clicked to open this menu.
  highlighted?: boolean;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onRemove}
      aria-label={`Remove ${worker.name} from shift`}
      className={`group/row flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-brite-red/15 ${
        highlighted ? "bg-brite-amber/10" : ""
      }`}
    >
      <Avatar name={worker.name} color={worker.avatarColor} imageUrl={worker.avatarUrl} size="sm" />
      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${
          highlighted ? "font-semibold text-brite-white" : "text-brite-cream"
        }`}
      >
        {worker.name}
      </span>
      <span className="shrink-0 rounded-md border border-transparent px-2 py-0.5 text-[11px] font-semibold text-brite-red-bright/80 group-hover/row:border-brite-red-bright/60 group-hover/row:bg-brite-red/15 group-hover/row:text-brite-red-bright">
        Remove
      </span>
    </button>
  );
}

export function ShiftContextMenu({
  x,
  y,
  onClose,
  shift,
  dayLabel,
  assignedWorkers,
  addableWorkers,
  focusWorkerId,
  copyTargets,
  actions,
  onExchange,
}: ShiftContextMenuProps) {
  const [expanded, setExpanded] = useState<Expanded>(null);
  const [copyDates, setCopyDates] = useState<string[]>([]);
  const [copyOpen, setCopyOpen] = useState(false);
  const copyAnchorRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  // The flyout opens on hover and closes a moment after the mouse leaves —
  // the delay lets the cursor cross the small gap between the menu and the
  // flyout (or wobble off it) without it snapping shut.
  function openCopy() {
    window.clearTimeout(closeTimer.current);
    setCopyOpen(true);
  }
  function scheduleCloseCopy() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setCopyOpen(false), 250);
  }
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);


  // Every action closes the menu after running, like a normal context menu.
  function run(action: () => void) {
    action();
    onClose();
  }

  function toggleCopyDate(date: string) {
    setCopyDates((current) =>
      current.includes(date) ? current.filter((d) => d !== date) : [...current, date],
    );
  }

  return (
    <Popover x={x} y={y} onClose={onClose} className="w-64">
      <div className="px-3 pb-1 pt-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-brite-tan/50">
          {dayLabel}
        </div>
        <div className="text-sm font-bold text-brite-white">
          {formatCompactTime(shift.start)}–{formatCompactTime(shift.end)}
        </div>
      </div>

      {onExchange && (
        <>
          <MenuDivider />
          <MenuLabel>Needs coverage</MenuLabel>
          <MenuItem icon="⇄" label="Exchange bartender" onClick={() => run(onExchange)} />
        </>
      )}

      <MenuDivider />
      <MenuLabel>Shift time</MenuLabel>
      <ShiftTimeForm
        shift={shift}
        onSave={(start, end) => run(() => actions.onSetTime(shift.id, start, end))}
      />

      <MenuDivider />
      <MenuLabel>Bartenders</MenuLabel>
      {assignedWorkers.map((w) => (
        <WorkerRow
          key={w.id}
          worker={w}
          highlighted={w.id === focusWorkerId}
          onRemove={() => run(() => actions.onRemoveWorker(shift.id, w.id))}
        />
      ))}
      {assignedWorkers.length === 0 && (
        <div className="px-3 py-1 text-xs italic text-brite-tan/40">No one scheduled yet</div>
      )}
      <MenuItem
        icon="+"
        label="Add bartender"
        hint={expanded === "add" ? "▾" : "▸"}
        disabled={addableWorkers.length === 0}
        onClick={() => setExpanded(expanded === "add" ? null : "add")}
      />
      {expanded === "add" && (
        <div className="mx-2 mb-1 rounded-lg bg-brite-black/40 py-1">
          <WorkerPickerList
            workers={addableWorkers}
            onPick={(workerId) => run(() => actions.onAddWorker(shift.id, workerId))}
          />
        </div>
      )}
      <MenuItem
        icon="⊘"
        label="Remove all bartenders"
        danger
        disabled={assignedWorkers.length === 0}
        onClick={() => run(() => actions.onClearWorkers(shift.id))}
      />

      <MenuDivider />
      <MenuItem
        icon="⧉"
        label="New shift at same time"
        onClick={() => run(() => actions.onDuplicate(shift.id))}
      />
      <div
        ref={copyAnchorRef}
        onMouseEnter={copyTargets.length > 0 ? openCopy : undefined}
        onMouseLeave={scheduleCloseCopy}
        className={copyOpen ? "bg-brite-tan/10" : undefined}
      >
        <MenuItem
          icon="⇢"
          label="Copy to other days…"
          hint="▸"
          disabled={copyTargets.length === 0}
          // Click also toggles it, for touch screens (no hover there).
          onClick={() => setCopyOpen((v) => !v)}
        />
        {copyOpen && (
          <CopyFlyout
            anchorRef={copyAnchorRef}
            targets={copyTargets}
            selected={copyDates}
            onToggle={toggleCopyDate}
            onSetAll={(all) => setCopyDates(all ? copyTargets.map((t) => t.date) : [])}
            onCopy={() => run(() => actions.onCopyToDates(shift.id, copyDates))}
          />
        )}
      </div>
      <MenuItem
        icon="🗑"
        label="Delete shift"
        danger
        onClick={() => run(() => actions.onDeleteShift(shift.id))}
      />
    </Popover>
  );
}
