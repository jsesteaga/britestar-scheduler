import type { CoverageRequest, Shift, SwapRequest, TimeOffRequest, Worker } from "../types";
import { describeShift } from "../utils/time";
import { formatFriendlyDate, swapFocus } from "../utils/week";
import { CardButton, OfferChip, RequestCard, type OpenTarget } from "./RequestCard";
import { SwapCard } from "./SwapCard";
import { CardStack, type StackItem } from "./ui/CardStack";

type MyRequestsProps = {
  me: Worker;
  workers: Worker[];
  shifts: Shift[];
  timeOff: TimeOffRequest[];
  coverageRequests: CoverageRequest[];
  swapRequests: SwapRequest[];
  todayISO: string;
  onCancelTimeOff: (id: string) => void;
  onCancelGiveAway: (id: string) => void;
  onCancelSwap: (id: string) => void;
  onAcceptSwap: (id: string) => void;
  onDeclineSwap: (id: string) => void;
  // Clicking a card jumps to its week and highlights its day(s).
  onOpen: (target: OpenTarget) => void;
  selectedKey?: string | null;
};

const statusPill = (text: string, tone: "amber" | "green" | "tan") => (
  <span
    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
      tone === "green"
        ? "bg-brite-green/15 text-brite-green"
        : tone === "amber"
          ? "bg-brite-amber/15 text-brite-amber"
          : "bg-brite-tan/10 text-brite-tan/70"
    }`}
  >
    {text}
  </span>
);

/**
 * A bartender's own requests, stacked like the manager's Pending requests:
 * time off, shifts they're giving away, and swaps they sent or were asked
 * to join — each showing where it stands.
 */
export function MyRequests(props: MyRequestsProps) {
  const { me, workers, shifts, todayISO } = props;
  const byId = (id: string) => workers.find((w) => w.id === id);
  const cards: (StackItem & { date: string })[] = [];

  for (const r of props.timeOff) {
    if (r.workerId !== me.id || r.endDate < todayISO) continue;
    cards.push({
      key: `pto-${r.id}`,
      date: r.startDate,
      node: (
        <RequestCard
          kind="timeoff"
          date={r.startDate}
          onOpen={() => props.onOpen({ key: `pto-${r.id}`, date: r.startDate, endDate: r.endDate })}
          selected={props.selectedKey === `pto-${r.id}`}
          title={<b className="font-semibold">Time off</b>}
          subtitle={[
            r.startDate === r.endDate
              ? formatFriendlyDate(r.startDate)
              : `${formatFriendlyDate(r.startDate)} – ${formatFriendlyDate(r.endDate)}`,
            r.reason,
          ]
            .filter(Boolean)
            .join(" · ")}
          actions={
            r.status === "approved" ? (
              statusPill("✓ Approved", "green")
            ) : (
              <>
                {statusPill("Pending", "amber")}
                <CardButton onClick={() => props.onCancelTimeOff(r.id)}>Cancel</CardButton>
              </>
            )
          }
        />
      ),
    });
  }

  for (const r of props.coverageRequests) {
    const shift = shifts.find((s) => s.id === r.shiftId);
    if (r.requestingWorkerId !== me.id || !shift || shift.date < todayISO) continue;
    const offers = (r.responses ?? [])
      .filter((x) => x.canCover)
      .map((x) => byId(x.workerId))
      .filter((w): w is Worker => !!w);
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
            <span>
              <b className="font-semibold">Your shift</b> is up for grabs
            </span>
          }
          subtitle={[describeShift(shift), r.note && `“${r.note}”`].filter(Boolean).join(" · ")}
          actions={<CardButton onClick={() => props.onCancelGiveAway(r.id)}>Cancel</CardButton>}
          footer={
            <div className="flex flex-wrap items-center gap-2">
              {offers.length === 0 ? (
                <span className="text-xs italic text-brite-tan/40">No offers yet</span>
              ) : (
                <>
                  {offers.map((w) => (
                    <OfferChip key={w.id} worker={w} label={`${w.name} offered to cover!`} />
                  ))}
                  <span className="text-xs text-brite-tan/45">Your manager will confirm.</span>
                </>
              )}
            </div>
          }
        />
      ),
    });
  }

  for (const r of props.swapRequests) {
    if (r.requestingWorkerId !== me.id && r.targetWorkerId !== me.id) continue;
    const requester = byId(r.requestingWorkerId);
    const target = byId(r.targetWorkerId);
    const mine = shifts.find((s) => s.id === r.requestingShiftId);
    const theirs = shifts.find((s) => s.id === r.targetShiftId);
    if (!requester || !target || !mine || !theirs || mine.date < todayISO || theirs.date < todayISO) continue;
    const focus = swapFocus(mine, theirs);
    const asked = r.requestingWorkerId === me.id;
    const waitingOnPartner = r.status === "awaiting-partner";

    cards.push({
      key: `swap-${r.id}`,
      date: focus.date,
      node: (
        <SwapCard
          requester={requester}
          target={target}
          requesterShift={mine}
          targetShift={theirs}
          onOpen={() => props.onOpen({ key: `swap-${r.id}`, date: focus.date, shiftIds: focus.shiftIds })}
          selected={props.selectedKey === `swap-${r.id}`}
          note={
            asked
              ? waitingOnPartner
                ? `Waiting on ${target.name} to accept`
                : `${target.name} accepted · waiting on your manager`
              : waitingOnPartner
                ? `${requester.name} wants to swap with you`
                : "You accepted · waiting on your manager"
          }
          actions={
            !asked && waitingOnPartner ? (
              <>
                <CardButton variant="primary" onClick={() => props.onAcceptSwap(r.id)}>
                  Accept
                </CardButton>
                <CardButton onClick={() => props.onDeclineSwap(r.id)}>Decline</CardButton>
              </>
            ) : asked ? (
              <CardButton onClick={() => props.onCancelSwap(r.id)}>Cancel swap</CardButton>
            ) : (
              statusPill("Waiting on manager", "tan")
            )
          }
        />
      ),
    });
  }

  cards.sort((a, b) => a.date.localeCompare(b.date));
  return <CardStack title="Your requests" items={cards} />;
}
