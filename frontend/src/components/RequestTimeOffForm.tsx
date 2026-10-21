import { useState } from "react";
import { toISODate } from "../utils/week";
import { Button } from "./ui/Button";

type RequestTimeOffFormProps = {
  onSubmit: (startDate: string, endDate: string, reason: string) => void;
  onCancel: () => void;
};

export function RequestTimeOffForm({ onSubmit, onCancel }: RequestTimeOffFormProps) {
  const today = toISODate(new Date());
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!startDate || !endDate) return;
    if (endDate < startDate) {
      setError("End date can't be before the start date.");
      return;
    }
    onSubmit(startDate, endDate, reason);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-brite-tan/15 bg-brite-black-soft/60 p-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="timeoff-start" className="text-xs font-medium uppercase tracking-wider text-brite-tan/80">
          From
        </label>
        <input
          id="timeoff-start"
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setError(null);
          }}
          className="rounded-lg border border-brite-tan/30 bg-brite-black px-3 py-2 text-sm text-brite-white"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="timeoff-end" className="text-xs font-medium uppercase tracking-wider text-brite-tan/80">
          To
        </label>
        <input
          id="timeoff-end"
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setError(null);
          }}
          className="rounded-lg border border-brite-tan/30 bg-brite-black px-3 py-2 text-sm text-brite-white"
        />
      </div>

      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <label htmlFor="reason" className="text-xs font-medium uppercase tracking-wider text-brite-tan/80">
          Reason (optional)
        </label>
        <input
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Doctor's appointment"
          className="rounded-lg border border-brite-tan/30 bg-brite-black px-3 py-2 text-sm text-brite-white placeholder:text-brite-tan/40"
        />
      </div>

      {error && <p className="w-full text-sm text-brite-red-bright">{error}</p>}

      <Button type="submit" className="w-auto px-5">
        Submit request
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
