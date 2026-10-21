import type { ReactNode } from "react";

export type RequestRow = {
  id: string;
  content: ReactNode;
  onApprove: () => void;
  approveLabel: string;
  onDeny: () => void;
  denyLabel: string;
};

export function RequestsPanel({ rows }: { rows: RequestRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-brite-amber/30 bg-brite-amber/10 p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brite-amber">
        Pending requests
      </h2>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brite-black-soft/60 p-3"
          >
            {row.content}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={row.onApprove}
                className="rounded-md bg-brite-green px-3 py-1.5 text-xs font-semibold text-brite-white hover:opacity-90"
              >
                {row.approveLabel}
              </button>
              <button
                type="button"
                onClick={row.onDeny}
                className="rounded-md border border-brite-tan/30 px-3 py-1.5 text-xs font-semibold text-brite-tan/80 hover:border-brite-tan"
              >
                {row.denyLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
