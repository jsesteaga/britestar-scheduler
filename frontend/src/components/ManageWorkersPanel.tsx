import { useState } from "react";
import type { Worker } from "../types";
import { getRosterDrag, isRosterDrag, setDragPayload, setRosterDrag } from "../utils/dnd";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { MenuDivider, MenuItem, MenuLabel, Popover } from "./ui/Popover";

type Side = "before" | "after";

type ManageWorkersPanelProps = {
  workers: Worker[];
  onAdd: (username: string) => void;
  onRemove: (workerId: string) => void;
  // How many shifts from today on they're scheduled for (shown in the
  // remove confirmation, since those spots open up).
  upcomingShiftCount: (workerId: string) => number;
  onReorder: (workerId: string, targetId: string, side: Side) => void;
  onRename: (workerId: string, name: string) => void;
};

type MenuState = { x: number; y: number; workerId: string };

export function ManageWorkersPanel({
  workers,
  onAdd,
  onRemove,
  upcomingShiftCount,
  onReorder,
  onRename,
}: ManageWorkersPanelProps) {
  const [username, setUsername] = useState("");
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [removing, setRemoving] = useState<Worker | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Which chip the dragged name is hovering, and which side of it it'd land on.
  const [dropTarget, setDropTarget] = useState<{ id: string; side: Side } | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim()) return;
    onAdd(username.trim());
    setUsername("");
  }

  // Chips flow left-to-right and wrap, so "before/after" is the left or
  // right half of the chip under the cursor.
  function sideOf(e: React.DragEvent<HTMLElement>): Side {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX < rect.left + rect.width / 2 ? "before" : "after";
  }

  const menuWorker = menu ? workers.find((w) => w.id === menu.workerId) : undefined;

  return (
    <div className="mb-6 rounded-xl border border-brite-tan/15 bg-brite-black-soft/60 p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brite-tan/80">Bartenders</h2>
        <span className="text-xs text-brite-tan/40">{workers.length} on the roster</span>
      </div>
      <p className="mb-3 text-xs text-brite-tan/50">
        Drag onto a shift to schedule · drag between names to reorder · right-click for more
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {workers.map((worker) => {
          const shownName = worker.name;
          const edge = dropTarget?.id === worker.id ? dropTarget.side : null;
          return (
            <div
              key={worker.id}
              draggable
              onDragStart={(e) => {
                // Carries both: a "roster" payload so it can still be
                // dropped onto a shift, and a reorder marker for this panel.
                setDragPayload(e, { source: "roster", workerId: worker.id });
                setRosterDrag(e, worker.id);
                setMenu(null);
                setDraggingId(worker.id);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDropTarget(null);
              }}
              onDragOver={(e) => {
                if (!isRosterDrag(e) || draggingId === worker.id) return;
                e.preventDefault();
                setDropTarget({ id: worker.id, side: sideOf(e) });
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDropTarget((t) => (t?.id === worker.id ? null : t));
              }}
              onDrop={(e) => {
                if (!isRosterDrag(e)) return;
                e.preventDefault();
                const draggedId = getRosterDrag(e);
                if (draggedId && draggedId !== worker.id) onReorder(draggedId, worker.id, sideOf(e));
                setDropTarget(null);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, workerId: worker.id });
              }}
              title={`Login: ${worker.username}`}
              className={`relative flex cursor-grab items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 active:cursor-grabbing ${
                draggingId === worker.id ? "opacity-40" : ""
              } ${
                menu?.workerId === worker.id
                  ? "border-brite-amber/60 bg-brite-amber/10"
                  : "border-brite-tan/20 hover:border-brite-tan/40"
              }`}
            >
              {edge && (
                <span
                  className={`pointer-events-none absolute inset-y-0 w-[3px] rounded-full bg-brite-amber ${
                    edge === "before" ? "-left-[6px]" : "-right-[6px]"
                  }`}
                />
              )}
              <Avatar name={shownName} color={worker.avatarColor} imageUrl={worker.avatarUrl} size="sm" />
              <span className="text-sm text-brite-white">{shownName}</span>
              {worker.nameClaimed === false && (
                <span className="text-[10px] text-brite-amber">pending</span>
              )}
              <button
                type="button"
                onClick={() => setRemoving(worker)}
                aria-label={`Remove ${shownName}`}
                className="text-brite-tan/50 hover:text-brite-red-bright"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Assign a username, e.g. jsmith..."
          className="flex-1 rounded-lg border border-brite-tan/30 bg-brite-black px-3 py-2 text-sm text-brite-white placeholder:text-brite-tan/40"
        />
        <Button type="submit" className="w-auto px-4">
          Add
        </Button>
      </form>
      <p className="mt-2 text-xs text-brite-tan/50">
        They sign in with this username + the temp password, then set their own.
      </p>

      {removing && (
        <RemoveBartenderDialog
          worker={removing}
          upcomingShifts={upcomingShiftCount(removing.id)}
          onConfirm={() => {
            onRemove(removing.id);
            setRemoving(null);
          }}
          onClose={() => setRemoving(null)}
        />
      )}

      {menu && menuWorker && (
        <WorkerMenu
          key={menuWorker.id}
          x={menu.x}
          y={menu.y}
          worker={menuWorker}
          isFirst={workers[0]?.id === menuWorker.id}
          isLast={workers[workers.length - 1]?.id === menuWorker.id}
          onClose={() => setMenu(null)}
          onRename={(name) => onRename(menuWorker.id, name)}
          onMoveToStart={() => onReorder(menuWorker.id, workers[0].id, "before")}
          onMoveToEnd={() => onReorder(menuWorker.id, workers[workers.length - 1].id, "after")}
          onRemove={() => setRemoving(menuWorker)}
        />
      )}
    </div>
  );
}

type WorkerMenuProps = {
  x: number;
  y: number;
  worker: Worker;
  isFirst: boolean;
  isLast: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  onMoveToStart: () => void;
  onMoveToEnd: () => void;
  onRemove: () => void;
};

function WorkerMenu({
  x,
  y,
  worker,
  isFirst,
  isLast,
  onClose,
  onRename,
  onMoveToStart,
  onMoveToEnd,
  onRemove,
}: WorkerMenuProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(worker.name);
  const shownName = worker.name;

  function run(action: () => void) {
    action();
    onClose();
  }

  function saveName() {
    const value = draft.trim();
    // Typing their real name back in is the same as clearing the override.
    if (!value || value === worker.name) {
      setRenaming(false);
      return;
    }
    run(() => onRename(value));
  }

  return (
    <Popover x={x} y={y} onClose={onClose} className="w-64">
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-1">
        <Avatar name={shownName} color={worker.avatarColor} imageUrl={worker.avatarUrl} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-brite-white">{shownName}</div>
          <div className="truncate text-[11px] text-brite-tan/45">
            login: {worker.username}
          </div>
        </div>
      </div>
      <MenuDivider />

      {renaming ? (
        <form
          className="px-3 pb-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            saveName();
          }}
        >
          <MenuLabel>Name</MenuLabel>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setRenaming(false);
              }
            }}
            placeholder={worker.name}
            className="w-full rounded-md border border-brite-tan/20 bg-brite-black px-2 py-1 text-[13px] text-brite-cream focus:border-brite-amber/60 focus:outline-none"
          />
          <p className="mt-1 text-[10px] text-brite-tan/40">Updates everywhere · login stays the same</p>
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="submit"
              className="flex-1 rounded-md bg-brite-red py-1 text-[11px] font-semibold text-brite-white hover:bg-brite-red-bright"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setRenaming(false)}
              className="rounded-md border border-brite-tan/20 px-2.5 py-1 text-[11px] font-semibold text-brite-tan/70 hover:border-brite-tan/45"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <MenuItem icon="✎" label="Change name" onClick={() => setRenaming(true)} />
      )}

      <MenuDivider />
      <MenuItem icon="⇤" label="Move to start" disabled={isFirst} onClick={() => run(onMoveToStart)} />
      <MenuItem icon="⇥" label="Move to end" disabled={isLast} onClick={() => run(onMoveToEnd)} />
      <MenuDivider />
      <MenuItem icon="✕" label="Remove from roster" danger onClick={() => run(onRemove)} />
    </Popover>
  );
}

type RemoveBartenderDialogProps = {
  worker: Worker;
  upcomingShifts: number;
  onConfirm: () => void;
  onClose: () => void;
};

/** "Say goodbye to …?" — confirms removing someone from the roster (and their login). */
function RemoveBartenderDialog({ worker, upcomingShifts, onConfirm, onClose }: RemoveBartenderDialogProps) {
  const name = worker.name;
  const first = name; // full name — "Test 2" shortened to "Test" was ambiguous

  return (
    <Modal onClose={onClose} labelledBy="remove-bartender-title">
      <div className="flex flex-col items-center text-center">
        <span className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-brite-tan/40">
          ★ BriteStar Tavern ★
        </span>
        {/* Avatar with a soft red glow ring. */}
        <div className="relative mb-4">
          <span className="absolute -inset-2 rounded-full bg-brite-red/25 blur-md" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full ring-2 ring-brite-red-bright/60 ring-offset-4 ring-offset-brite-black-soft">
            <Avatar name={name} color={worker.avatarColor} imageUrl={worker.avatarUrl} />
          </span>
        </div>
        <h2 id="remove-bartender-title" className="text-lg font-bold text-brite-white">
          Say goodbye to {first}?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-brite-tan/65">
          Removes them from the roster and ends their login.
        </p>
        {upcomingShifts > 0 && (
          <p className="mt-3 rounded-lg border border-brite-amber/25 bg-brite-amber/10 px-3 py-2 text-xs text-brite-amber">
            {upcomingShifts} upcoming shift{upcomingShifts === 1 ? "" : "s"} will open up
          </p>
        )}
        <p className="mt-3 text-[11px] text-brite-tan/35">
          {worker.username} · Undo available
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-brite-red py-2.5 text-sm font-semibold text-brite-white shadow-lg shadow-brite-red/20 hover:bg-brite-red-bright"
        >
          Remove {first} &amp; end their account
        </button>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="rounded-lg border border-brite-tan/25 py-2.5 text-sm font-semibold text-brite-cream hover:border-brite-tan/60"
        >
          Keep {first}
        </button>
      </div>
    </Modal>
  );
}
