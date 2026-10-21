import type { CoverageRequest, Shift, Worker } from "../types";
import { formatCompactTime } from "../utils/time";
import { formatFriendlyDate } from "../utils/week";
import { CardButton, RequestCard } from "./RequestCard";
import { Avatar } from "./ui/Avatar";
import { CardStack } from "./ui/CardStack";

type CoverageBoardProps = {
  requests: CoverageRequest[];
  shifts: Shift[];
  workers: Worker[];
  me: Worker;
  todayISO: string;
  onRespond: (requestId: string, canCover: boolean | null) => void;
  onCancelMine: (requestId: string) => void;
};

/**
 * What bartenders see of give-away requests: everyone's open shifts (soonest
 * on top) with "I can cover" / "Can't", plus their own requests and who's
 * offered to take them.
 */
export function CoverageBoard({ requests, shifts, workers, me, todayISO, onRespond, onCancelMine }: CoverageBoardProps) {
  const nameOf = (id: string) => workers.find((w) => w.id === id);

  const items = requests
    .map((r) => ({ r, shift: shifts.find((s) => s.id === r.shiftId) }))
    .filter(
      (x): x is { r: CoverageRequest; shift: Shift } =>
        !!x.shift &&
        x.shift.date >= todayISO &&
        // Your own requests always show. Others' drop off once you're on
        // that shift or you've answered (your answer lives in the bell, and
        // you can change it by right-clicking the shift on the schedule).
        (x.r.requestingWorkerId === me.id ||
          (!x.shift.workerIds.includes(me.id) && !(x.r.responses ?? []).some((a) => a.workerId === me.id))),
    )
    .sort((a, b) => a.shift.date.localeCompare(b.shift.date))
    .map(({ r, shift }) => {
      const requester = nameOf(r.requestingWorkerId);
      const responses = r.responses ?? [];
      // Other people's offers — your own answer already shows by the buttons.
      const offers = responses
        .filter((x) => x.canCover && x.workerId !== me.id)
        .map((x) => nameOf(x.workerId))
        .filter((w): w is Worker => !!w);
      const mine = r.requestingWorkerId === me.id;
      const myAnswer = responses.find((x) => x.workerId === me.id);
      const when = `${formatFriendlyDate(shift.date)}, ${formatCompactTime(shift.start)}–${formatCompactTime(shift.end)}`;

      return {
        key: r.id,
        node: (
          <RequestCard
            kind="coverage"
            date={shift.date}
            title={
              mine ? (
                <span>
                  <b className="font-semibold">Your shift</b> is up for grabs
                </span>
              ) : (
                <>
                  {requester && <Avatar name={requester.name} color={requester.avatarColor} size="sm" />}
                  <span>
                    <b className="font-semibold">{requester?.name ?? "Someone"}</b> needs coverage
                  </span>
                </>
              )
            }
            subtitle={[when, r.note && `“${r.note}”`].filter(Boolean).join(" · ")}
            actions={
              mine ? (
                <CardButton onClick={() => onCancelMine(r.id)}>Cancel request</CardButton>
              ) : myAnswer ? (
                <>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      myAnswer.canCover ? "bg-brite-green/15 text-brite-green" : "bg-brite-tan/10 text-brite-tan/60"
                    }`}
                  >
                    {myAnswer.canCover ? "✓ You offered to cover" : "You passed"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRespond(r.id, null)}
                    className="text-xs font-semibold text-brite-tan/45 hover:text-brite-tan"
                  >
                    Change
                  </button>
                </>
              ) : (
                <>
                  <CardButton variant="primary" onClick={() => onRespond(r.id, true)}>
                    I can cover
                  </CardButton>
                  <CardButton onClick={() => onRespond(r.id, false)}>Can't</CardButton>
                </>
              )
            }
            footer={
              offers.length > 0 || mine ? (
                <div className="flex flex-wrap items-center gap-2">
                  {offers.length === 0 ? (
                    <span className="text-xs italic text-brite-tan/40">
                      No offers yet
                    </span>
                  ) : (
                    offers.map((w) => (
                      <span
                        key={w.id}
                        className="flex items-center gap-1.5 rounded-full border border-brite-green/30 bg-brite-green/10 py-0.5 pl-0.5 pr-2.5"
                      >
                        <Avatar name={w.name} color={w.avatarColor} size="sm" />
                        <span className="text-xs text-brite-white">
                          {w.name} offered to cover!
                        </span>
                      </span>
                    ))
                  )}
                  {mine && offers.length > 0 && (
                    <span className="text-xs text-brite-tan/45">Your manager will confirm.</span>
                  )}
                </div>
              ) : undefined
            }
          />
        ),
      };
    });

  return <CardStack title="Shifts up for grabs" items={items} />;
}
