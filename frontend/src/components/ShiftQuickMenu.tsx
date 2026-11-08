import { useRef } from "react";
import type { Shift, Worker } from "../types";
import { formatCompactTime } from "../utils/time";
import { ShiftContextMenu, type CopyTarget, type ShiftMenuActions } from "./ShiftContextMenu";
import { ShiftTimeForm } from "./ShiftTimeForm";
import { Popover } from "./ui/Popover";
import { WorkerPickerList } from "./WorkerPickerList";

/** What a shift's menus need to know — the same things a full ShiftCard gets. */
export type ShiftMenuBase = {
  shift: Shift;
  dayLabel: string;
  assignedWorkers: Worker[];
  addableWorkers: Worker[];
  offWorkers: Worker[];
  onOffWorkerClick: (workerId: string) => void;
  copyTargets: CopyTarget[];
  actions: ShiftMenuActions;
  onExchange?: () => void;
};

// menu: the shift's options (leading with one person's, when a name was
// tapped) · time: the start/end editor · add: pick a bartender to add.
export type QuickMenuKind = "menu" | "time" | "add";

type ShiftQuickMenuProps = ShiftMenuBase & {
  kind: QuickMenuKind;
  x: number;
  y: number;
  focusWorkerId?: string;
  onClose: () => void;
};

/**
 * The phone week grid has no room for ✕ buttons or "+ Add bartender", so its
 * names, times and "+" are tap targets that open the same menus a full
 * ShiftCard uses.
 */
export function ShiftQuickMenu({ kind, x, y, focusWorkerId, onClose, ...base }: ShiftQuickMenuProps) {
  const { shift, dayLabel, addableWorkers, offWorkers, onOffWorkerClick, actions } = base;
  // The time editor's unsaved edit — tapping away saves it, like on the card.
  const timeDraft = useRef<{ start: string; end: string } | null>(null);

  if (kind === "menu") {
    return <ShiftContextMenu x={x} y={y} onClose={onClose} focusWorkerId={focusWorkerId} {...base} />;
  }

  if (kind === "time") {
    const close = (save: boolean) => {
      const draft = timeDraft.current;
      if (save && draft && (draft.start !== shift.start || draft.end !== shift.end)) {
        actions.onSetTime(shift.id, draft.start, draft.end);
      }
      onClose();
    };
    return (
      <Popover x={x} y={y} onClose={() => close(true)} onEscape={() => close(false)} className="w-64">
        <div className="px-3 pb-1.5 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-brite-tan/45">
          {dayLabel} · shift time
        </div>
        <ShiftTimeForm
          shift={shift}
          onSave={(start, end) => {
            actions.onSetTime(shift.id, start, end);
            onClose();
          }}
          onDraftChange={(start, end) => {
            timeDraft.current = { start, end };
          }}
        />
      </Popover>
    );
  }

  return (
    <Popover x={x} y={y} onClose={onClose} className="w-56">
      <div className="px-3 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-brite-tan/45">
        Add to {dayLabel} {formatCompactTime(shift.start)}–{formatCompactTime(shift.end)}
      </div>
      <WorkerPickerList
        workers={addableWorkers}
        offWorkers={offWorkers}
        onOffWorkerClick={(id) => {
          onClose();
          onOffWorkerClick(id);
        }}
        onPick={(workerId) => {
          actions.onAddWorker(shift.id, workerId);
          onClose();
        }}
      />
    </Popover>
  );
}
