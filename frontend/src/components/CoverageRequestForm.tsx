import { useState } from "react";
import type { Shift } from "../types";
import { formatCompactTime } from "../utils/time";
import { formatFriendlyDate } from "../utils/week";
import { Button } from "./ui/Button";

type CoverageRequestFormProps = {
  myShifts: Shift[];
  onSubmit: (shiftId: string, note: string) => void;
  onCancel: () => void;
};

export function CoverageRequestForm({ myShifts, onSubmit, onCancel }: CoverageRequestFormProps) {
  const [shiftId, setShiftId] = useState(myShifts[0]?.id ?? "");
  const [note, setNote] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!shiftId) return;
    onSubmit(shiftId, note);
  }

  if (myShifts.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-brite-tan/15 bg-brite-black-soft/60 p-4 text-sm text-brite-tan/60">
        You don't have any shifts this week to give away.{" "}
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
        <label htmlFor="coverage-shift" className="text-xs font-medium uppercase tracking-wider text-brite-tan/80">
          Which shift?
        </label>
        <select
          id="coverage-shift"
          value={shiftId}
          onChange={(e) => setShiftId(e.target.value)}
          className="rounded-lg border border-brite-tan/30 bg-brite-black px-3 py-2 text-sm text-brite-white"
        >
          {myShifts.map((s) => (
            <option key={s.id} value={s.id}>
              {formatFriendlyDate(s.date)} {formatCompactTime(s.start)}–{formatCompactTime(s.end)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <label htmlFor="coverage-note" className="text-xs font-medium uppercase tracking-wider text-brite-tan/80">
          Note (optional)
        </label>
        <input
          id="coverage-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Can't make it, need coverage"
          className="rounded-lg border border-brite-tan/30 bg-brite-black px-3 py-2 text-sm text-brite-white placeholder:text-brite-tan/40"
        />
      </div>

      <Button type="submit" className="w-auto px-5">
        Post request
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
