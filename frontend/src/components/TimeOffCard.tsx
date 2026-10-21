import type { TimeOffRequest, Worker } from "../types";
import { Avatar } from "./ui/Avatar";

type TimeOffCardProps = {
  request: TimeOffRequest;
  worker: Worker | null;
};

export function TimeOffCard({ request, worker }: TimeOffCardProps) {
  if (!worker) return null;

  return (
    <div className="rounded-lg border border-brite-green/30 bg-brite-green/10 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-brite-green">
        Time Off
      </div>
      <div className="flex items-center gap-2">
        <Avatar name={worker.name} color={worker.avatarColor} size="sm" />
        <span className="text-sm text-brite-white">{worker.name}</span>
      </div>
      {request.reason && (
        <p className="mt-1.5 text-xs text-brite-tan/60">{request.reason}</p>
      )}
    </div>
  );
}
