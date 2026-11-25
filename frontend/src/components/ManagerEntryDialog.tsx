import { useState } from "react";
import type { Availability, Day, DayAvailability, Worker } from "../types";
import { AvailabilityForm } from "./AvailabilityForm";
import { RequestTimeOffForm } from "./RequestTimeOffForm";
import { Avatar } from "./ui/Avatar";
import { Modal } from "./ui/Modal";
import { WorkerPickerList } from "./WorkerPickerList";

export type ManagerEntryMode = "availability" | "timeoff";

type ManagerEntryDialogProps = {
  mode: ManagerEntryMode;
  workers: Worker[];
  availability: Availability[];
  onSetAvailability: (workerId: string, days: Record<Day, DayAvailability>) => void;
  onAddTimeOff: (workerId: string, startDate: string, endDate: string, reason: string) => void;
  onClose: () => void;
};

/**
 * The manager entering availability or time off on a bartender's behalf
 * (e.g. they texted it in). Step 1: pick who. Step 2: the same form the
 * bartender would fill in themselves. Time off entered here is approved.
 */
export function ManagerEntryDialog({
  mode,
  workers,
  availability,
  onSetAvailability,
  onAddTimeOff,
  onClose,
}: ManagerEntryDialogProps) {
  const [workerId, setWorkerId] = useState<string | null>(null);
  const worker = workers.find((w) => w.id === workerId);
  const title = mode === "availability" ? "Set availability" : "Add time off";

  return (
    <Modal onClose={onClose} labelledBy="manager-entry-title" wide={!!worker}>
      <h2 id="manager-entry-title" className="text-base font-bold text-brite-white">
        {title}
      </h2>

      {!worker ? (
        <>
          <p className="mb-3 mt-1 text-xs text-brite-tan/60">Who is it for?</p>
          <div className="-mx-2 rounded-lg bg-brite-black/30 py-1.5">
            <WorkerPickerList workers={workers} onPick={setWorkerId} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-lg py-2 text-sm font-semibold text-brite-tan/55 hover:text-brite-tan"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setWorkerId(null)}
            className="mb-3 mt-2 flex items-center gap-2 text-sm text-brite-cream hover:text-brite-white"
            title="Pick someone else"
          >
            <Avatar name={worker.name} color={worker.avatarColor} imageUrl={worker.avatarUrl} size="sm" />
            <span className="font-semibold">{worker.name}</span>
            <span className="text-xs text-brite-tan/50">· change</span>
          </button>

          {mode === "availability" ? (
            <AvailabilityForm
              initialDays={availability.find((a) => a.workerId === worker.id)?.days}
              submitLabel="Save availability"
              onSubmit={(days) => {
                onSetAvailability(worker.id, days);
                onClose();
              }}
              onCancel={onClose}
            />
          ) : (
            <>
              <p className="mb-2 text-xs text-brite-tan/60">
                Approved right away. They're taken off any shifts in these dates.
              </p>
              <RequestTimeOffForm
                submitLabel="Add time off"
                onSubmit={(start, end, reason) => {
                  onAddTimeOff(worker.id, start, end, reason);
                  onClose();
                }}
                onCancel={onClose}
              />
            </>
          )}
        </>
      )}
    </Modal>
  );
}
