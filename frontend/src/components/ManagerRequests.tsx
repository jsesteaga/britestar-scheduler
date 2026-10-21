import type { CoverageRequest, Shift, SwapRequest, TimeOffRequest, Worker } from "../types";
import { formatCompactTime } from "../utils/time";
import { formatFriendlyDate } from "../utils/week";
import { CardButton, RequestCard } from "./RequestCard";
import { Avatar } from "./ui/Avatar";
import { CardStack, type StackItem } from "./ui/CardStack";

type ManagerRequestsProps = {
  timeOff: TimeOffRequest[];
  coverageRequests: CoverageRequest[];
  swapRequests: SwapRequest[];
  shifts: Shift[];
  workers: Worker[];
  onApproveTimeOff: (id: string) => void;
  onDenyTimeOff: (id: string) => void;
  onResolveCoverage: (request: CoverageRequest) => void;
  onDismissCoverage: (request: CoverageRequest) => void;
  onAssignCover: (request: CoverageRequest, workerId: string) => void;
  onApproveSwap: (request: SwapRequest) => void;
  onDenySwap: (id: string) => void;
};

const shiftTime = (s: Shift) => `${formatCompactTime(s.start)}–${formatCompactTime(s.end)}`;

/** Every pending request as one date-sorted stack: soonest on top. */
export function ManagerRequests(props: ManagerRequestsProps) {
  const { shifts, workers } = props;
  const byId = (id: string) => workers.find((w) => w.id === id);
  const cards: (StackItem & { date: string })[] = [];

  for (const r of props.timeOff) {
    const worker = byId(r.workerId);
    if (r.status !== "pending" || !worker) continue;
    cards.push({
      key: `pto-${r.id}`,
      date: r.startDate,
      node: (
        <RequestCard
          kind="timeoff"
          date={r.startDate}
          title={
            <>
              <Avatar name={worker.name} color={worker.avatarColor} size="sm" />
              <span>
                <b className="font-semibold">{worker.name}</b> wants time off
              </span>
            </>
          }
          subtitle={[
            r.startDate === r.endDate
              ? formatFriendlyDate(r.startDate)
              : `${formatFriendlyDate(r.startDate)} – ${formatFriendlyDate(r.endDate)}`,
            r.reason,
          ]
            .filter(Boolean)
            .join(" · ")}
          actions={
            <>
              <CardButton variant="primary" onClick={() => props.onApproveTimeOff(r.id)}>
                Approve
              </CardButton>
              <CardButton onClick={() => props.onDenyTimeOff(r.id)}>Deny</CardButton>
            </>
          }
        />
      ),
    });
  }

  for (const r of props.coverageRequests) {
    const worker = byId(r.requestingWorkerId);
    const shift = shifts.find((s) => s.id === r.shiftId);
    if (!worker || !shift) continue;
    const responses = r.responses ?? [];
    const offers = responses.filter((x) => x.canCover).map((x) => byId(x.workerId)).filter((w): w is Worker => !!w);
    const cant = responses.filter((x) => !x.canCover).map((x) => byId(x.workerId)?.name).filter(Boolean);
    cards.push({
      key: `cov-${r.id}`,
      date: shift.date,
      node: (
        <RequestCard
          kind="coverage"
          date={shift.date}
          title={
            <>
              <Avatar name={worker.name} color={worker.avatarColor} size="sm" />
              <span>
                <b className="font-semibold">{worker.name}</b> needs coverage
              </span>
            </>
          }
          subtitle={[`${formatFriendlyDate(shift.date)}, ${shiftTime(shift)}`, r.note && `“${r.note}”`]
            .filter(Boolean)
            .join(" · ")}
          actions={
            <>
              <CardButton variant="primary" onClick={() => props.onResolveCoverage(r)}>
                Mark resolved
              </CardButton>
              <CardButton onClick={() => props.onDismissCoverage(r)}>Dismiss</CardButton>
            </>
          }
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brite-tan/45">Offers</span>
              {offers.length === 0 && (
                <span className="text-xs italic text-brite-tan/40">
                  No offers yet
                </span>
              )}
              {offers.map((w) => (
                <span
                  key={w.id}
                  className="flex items-center gap-1.5 rounded-full border border-brite-green/30 bg-brite-green/10 py-0.5 pl-0.5 pr-1"
                >
                  <Avatar name={w.name} color={w.avatarColor} size="sm" />
                  <span className="text-xs text-brite-white">{w.name} can cover</span>
                  <button
                    type="button"
                    onClick={() => props.onAssignCover(r, w.id)}
                    title={`Give this shift to ${w.name} (takes ${worker.name} off it)`}
                    className="rounded-full bg-brite-green px-2.5 py-0.5 text-[11px] font-semibold text-brite-white hover:brightness-110"
                  >
                    Assign
                  </button>
                </span>
              ))}
              {cant.length > 0 && (
                <span className="text-xs text-brite-tan/40">Can't: {cant.join(", ")}</span>
              )}
            </div>
          }
        />
      ),
    });
  }

  for (const r of props.swapRequests) {
    const requester = byId(r.requestingWorkerId);
    const target = byId(r.targetWorkerId);
    const mine = shifts.find((s) => s.id === r.requestingShiftId);
    const theirs = shifts.find((s) => s.id === r.targetShiftId);
    if (!requester || !target || !mine || !theirs) continue;
    const date = mine.date < theirs.date ? mine.date : theirs.date;
    cards.push({
      key: `swap-${r.id}`,
      date,
      node: (
        <RequestCard
          kind="swap"
          date={date}
          title={
            <span>
              <b className="font-semibold">{requester.name}</b> ⇄ <b className="font-semibold">{target.name}</b>
            </span>
          }
          subtitle={`${formatFriendlyDate(mine.date)}, ${shiftTime(mine)}  ⇄  ${formatFriendlyDate(theirs.date)}, ${shiftTime(theirs)}`}
          actions={
            <>
              <CardButton variant="primary" onClick={() => props.onApproveSwap(r)}>
                Approve swap
              </CardButton>
              <CardButton onClick={() => props.onDenySwap(r.id)}>Deny</CardButton>
            </>
          }
        />
      ),
    });
  }

  cards.sort((a, b) => a.date.localeCompare(b.date));
  return <CardStack title="Pending requests" items={cards} />;
}
