import { useState } from "react";
import type { Worker } from "../types";
import { Avatar } from "./ui/Avatar";

type WorkerPickerListProps = {
  workers: Worker[];
  onPick: (workerId: string) => void;
};

// Past this many names, a filter box is quicker than scrolling.
const SEARCH_THRESHOLD = 6;

/** A dark-themed list of bartenders to pick from — replaces the native <select>, whose option list the browser always drew white. */
export function WorkerPickerList({ workers, onPick }: WorkerPickerListProps) {
  const [query, setQuery] = useState("");
  const visible = workers.filter((w) => w.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div>
      {workers.length > SEARCH_THRESHOLD && (
        <div className="px-2 pb-1.5">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && visible.length > 0) onPick(visible[0].id);
            }}
            placeholder="Search bartenders…"
            className="w-full rounded-md border border-brite-tan/15 bg-brite-black px-2 py-1 text-xs text-brite-cream placeholder:text-brite-tan/35 focus:border-brite-amber/60 focus:outline-none"
          />
        </div>
      )}
      <div className="max-h-56 overflow-y-auto">
        {visible.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => onPick(w.id)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-brite-cream hover:bg-brite-tan/10"
          >
            <Avatar name={w.name} color={w.avatarColor} imageUrl={w.avatarUrl} size="sm" />
            <span className="truncate">{w.name}</span>
          </button>
        ))}
        {visible.length === 0 && (
          <div className="px-3 py-2 text-xs italic text-brite-tan/40">
            {workers.length === 0 ? "Everyone's already on this shift" : "No matches"}
          </div>
        )}
      </div>
    </div>
  );
}
