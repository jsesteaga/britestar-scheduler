import type { CoverageRequest, Shift, SwapRequest, TimeOffRequest, Worker } from "../types";
import { describeShift } from "../utils/time";
import { formatFriendlyDate, swapFocus, toISODate } from "../utils/week";
import { CardButton, OfferChip, RequestCard, type OpenTarget } from "./RequestCard";
import { SwapCard } from "./SwapCard";
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
  // Clicking a card jumps to its week and highlights its day(s).
  onOpen: (target: OpenTarget) => void;
  selectedKey?: string | null;
};

/** Every pending request as one date-sorted stack: soonest on top. */
export function ManagerRequests(props: ManagerRequestsProps) {
  const { shifts, workers } = props;
  const byId = (id: string) => workers.find((w) => w.id === id);
  const cards: (StackItem & { date: string })[] = [];

  // Only time off that hasn't fully passed yet — an old request for last
  // month is just clutter.
  const today = toISODate(new Date());
  for (const r of props.timeOff) {
    const worker = byId(r.workerId);
    if (r.status !== "pending" || !worker || r.endDate < today) continue;
    cards.push({
      key: `pto-${r.id}`,
      date: r.startDate,
      node: (
        <RequestCard
          kind="timeoff"
          date={r.startDate}
          onOpen={() => props.onOpen({ key: `pto-${r.id}`, date: r.startDate, endDate: r.endDate })}
          selected={props.selectedKey === `pto-${r.id}`}
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
          onOpen={() => props.onOpen({ key: `cov-${r.id}`, date: shift.date, shiftIds: [shift.id] })}
          selected={props.selectedKey === `cov-${r.id}`}
          title={
            <>
              <Avatar name={worker.name} color={worker.avatarColor} size="sm" />
              <span>
                <b className="font-semibold">{worker.name}</b> needs coverage
              </span>
            </>
          }
          subtitle={[describeShift(shift), r.note && `“${r.note}”`]
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
                <OfferChip
                  key={w.id}
                  worker={w}
                  label={`${w.name} can cover`}
                  action={
                    <button
                      type="button"
                      onClick={() => props.onAssignCover(r, w.id)}
                      title={`Give this shift to ${w.name} (takes ${worker.name} off it)`}
                      className="rounded-full bg-brite-green px-2.5 py-0.5 text-[11px] font-semibold text-brite-white hover:brightness-110"
                    >
                      Assign
                    </button>
                  }
                />
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
    // Once either shift has passed, the swap can't happen — hide it.
    if (date < today) continue;
    cards.push({
      key: `swap-${r.id}`,
      date,
      node: (
        <SwapCard
          requester={requester}
          target={target}
          requesterShift={mine}
          targetShift={theirs}
          onOpen={() => {
            const focus = swapFocus(mine, theirs);
            props.onOpen({ key: `swap-${r.id}`, date: focus.date, shiftIds: focus.shiftIds });
          }}
          selected={props.selectedKey === `swap-${r.id}`}
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
