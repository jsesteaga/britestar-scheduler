import { useState } from "react";
import type { Shift, Worker } from "../types";
import { formatCompactTime } from "../utils/time";
import { formatFriendlyDate } from "../utils/week";
import { Button } from "./ui/Button";

type SwapRequestFormProps = {
  myShifts: Shift[];
  otherWorkers: Worker[];
  shifts: Shift[];
  onSubmit: (myShiftId: string, targetWorkerId: string, targetShiftId: string) => void;
  onCancel: () => void;
};

export function SwapRequestForm({ myShifts, otherWorkers, shifts, onSubmit, onCancel }: SwapRequestFormProps) {
  const [myShiftId, setMyShiftId] = useState(myShifts[0]?.id ?? "");
  const [targetWorkerId, setTargetWorkerId] = useState(otherWorkers[0]?.id ?? "");

  const targetShifts = shifts.filter((s) => s.workerIds.includes(targetWorkerId));
  const [targetShiftId, setTargetShiftId] = useState(targetShifts[0]?.id ?? "");

  function handleTargetWorkerChange(workerId: string) {
    setTargetWorkerId(workerId);
    const firstShift = shifts.find((s) => s.workerIds.includes(workerId));
    setTargetShiftId(firstShift?.id ?? "");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!myShiftId || !targetWorkerId || !targetShiftId) return;
    onSubmit(myShiftId, targetWorkerId, targetShiftId);
  }

  if (myShifts.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-brite-tan/15 bg-brite-black-soft/60 p-4 text-sm text-brite-tan/60">
        You don't have any shifts this week to swap.{" "}
        <button type="button" onClick={onCancel} className="font-semibold text-brite-tan hover:underline">
          Close
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-brite-tan/15 bg-brite-black-soft/60 p-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="swap-my-shift" className="text-xs font-medium uppercase tracking-wider text-brite-tan/80">
          Your shift
        </label>
        <select
          id="swap-my-shift"
          value={myShiftId}
          onChange={(e) => setMyShiftId(e.target.value)}
          className="rounded-lg border border-brite-tan/30 bg-brite-black px-3 py-2 text-sm text-brite-white"
        >
          {myShifts.map((s) => (
            <option key={s.id} value={s.id}>
              {formatFriendlyDate(s.date)} {formatCompactTime(s.start)}–{formatCompactTime(s.end)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="swap-target-worker" className="text-xs font-medium uppercase tracking-wider text-brite-tan/80">
          Swap with
        </label>
        <select
          id="swap-target-worker"
          value={targetWorkerId}
          onChange={(e) => handleTargetWorkerChange(e.target.value)}
          className="rounded-lg border border-brite-tan/30 bg-brite-black px-3 py-2 text-sm text-brite-white"
        >
          {otherWorkers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="swap-target-shift" className="text-xs font-medium uppercase tracking-wider text-brite-tan/80">
          Their shift
        </label>
        {targetShifts.length === 0 ? (
          <span className="py-2 text-sm text-brite-tan/50">No shifts scheduled</span>
        ) : (
          <select
            id="swap-target-shift"
            value={targetShiftId}
            onChange={(e) => setTargetShiftId(e.target.value)}
            className="rounded-lg border border-brite-tan/30 bg-brite-black px-3 py-2 text-sm text-brite-white"
          >
            {targetShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {formatFriendlyDate(s.date)} {formatCompactTime(s.start)}–{formatCompactTime(s.end)}
              </option>
            ))}
          </select>
        )}
      </div>

      <Button type="submit" className="w-auto px-5" disabled={targetShifts.length === 0}>
        Request swap
      </Button>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs font-semibold text-brite-tan/60 hover:text-brite-tan"
      >
        Cancel
      </button>
    </form>
  );
}
