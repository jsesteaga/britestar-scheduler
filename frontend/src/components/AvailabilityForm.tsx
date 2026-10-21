import { useState } from "react";
import type { Day, DayAvailability } from "../types";
import { DAYS } from "../utils/week";
import { Button } from "./ui/Button";

type AvailabilityFormProps = {
  initialDays?: Record<Day, DayAvailability>;
  onSubmit: (days: Record<Day, DayAvailability>) => void;
  onCancel: () => void;
};

function defaultDays(): Record<Day, DayAvailability> {
  const days = {} as Record<Day, DayAvailability>;
  DAYS.forEach((day) => {
    days[day] = { available: true, note: "" };
  });
  return days;
}

export function AvailabilityForm({ initialDays, onSubmit, onCancel }: AvailabilityFormProps) {
  const [days, setDays] = useState<Record<Day, DayAvailability>>(initialDays ?? defaultDays());

  function toggleDay(day: Day) {
    setDays((current) => ({
      ...current,
      [day]: { ...current[day], available: !current[day].available },
    }));
  }

  function setNote(day: Day, note: string) {
    setDays((current) => ({ ...current, [day]: { ...current[day], note } }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(days);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-brite-tan/15 bg-brite-black-soft/60 p-4"
    >
      <p className="mb-3 text-xs text-brite-tan/50">
        Build out a general weekly availability pattern and send it to your manager. Uncheck a
        day you're generally not available, and add a note for anything time-specific.
      </p>

      <div className="flex flex-col gap-2">
        {DAYS.map((day) => (
          <div key={day} className="flex items-center gap-3 rounded-lg bg-brite-black/40 p-2.5">
            <label className="flex w-28 items-center gap-2 text-sm font-semibold text-brite-white">
              <input
                type="checkbox"
                checked={days[day].available}
                onChange={() => toggleDay(day)}
              />
              {day}
            </label>
            <input
              value={days[day].note ?? ""}
              onChange={(e) => setNote(day, e.target.value)}
              disabled={!days[day].available}
              placeholder={days[day].available ? "e.g. after 5pm (optional)" : "Not available"}
              className="flex-1 rounded-md border border-brite-tan/20 bg-brite-black px-2 py-1.5 text-xs text-brite-white placeholder:text-brite-tan/40 disabled:opacity-40"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" className="w-auto px-5">
          Send to manager
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-brite-tan/60 hover:text-brite-tan"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
