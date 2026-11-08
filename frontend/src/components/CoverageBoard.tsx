import type { CoverageRequest, Shift, Worker } from "../types";
import { describeShift } from "../utils/time";
import { CardButton, OfferChip, RequestCard, type OpenTarget } from "./RequestCard";
import { Avatar } from "./ui/Avatar";
import { CardStack } from "./ui/CardStack";

type CoverageBoardProps = {
  requests: CoverageRequest[];
  shifts: Shift[];
  workers: Worker[];
  me: Worker;
  todayISO: string;
  onRespond: (requestId: string, canCover: boolean) => void;
  onOpen: (target: OpenTarget) => void;
  selectedKey?: string | null;
};

/**
 * Other bartenders' shifts up for grabs (soonest on top) that you could take
 * and haven't answered yet. Your own give-aways live in "Your requests";
 * once you answer one here it moves to your bell, and you can change it by
 * right-clicking the shift on the schedule.
 */
export function CoverageBoard({
  requests,
  shifts,
  workers,
  me,
  todayISO,
  onRespond,
  onOpen,
  selectedKey,
}: CoverageBoardProps) {
  const byId = (id: string) => workers.find((w) => w.id === id);

  const items = requests
    .map((r) => ({ r, shift: shifts.find((s) => s.id === r.shiftId) }))
    .filter(
      (x): x is { r: CoverageRequest; shift: Shift } =>
        !!x.shift &&
        x.shift.date >= todayISO &&
        x.r.requestingWorkerId !== me.id &&
        !x.shift.workerIds.includes(me.id) &&
        !(x.r.responses ?? []).some((a) => a.workerId === me.id),
    )
    .sort((a, b) => a.shift.date.localeCompare(b.shift.date))
    .map(({ r, shift }) => {
      const requester = byId(r.requestingWorkerId);
      const offers = (r.responses ?? [])
        .filter((x) => x.canCover)
        .map((x) => byId(x.workerId))
        .filter((w): w is Worker => !!w);

      return {
        key: r.id,
        node: (
          <RequestCard
            kind="coverage"
            date={shift.date}
            onOpen={() => onOpen({ key: `grab-${r.id}`, date: shift.date, shiftIds: [shift.id] })}
            selected={selectedKey === `grab-${r.id}`}
            title={
              <>
                {requester && <Avatar name={requester.name} color={requester.avatarColor} size="sm" />}
                <span>
                  <b className="font-semibold">{requester?.name ?? "Someone"}</b> needs coverage
                </span>
              </>
            }
            subtitle={[describeShift(shift), r.note && `“${r.note}”`].filter(Boolean).join(" · ")}
            actions={
              <>
                <CardButton variant="primary" onClick={() => onRespond(r.id, true)}>
                  I can cover
                </CardButton>
                <CardButton onClick={() => onRespond(r.id, false)}>Can't</CardButton>
              </>
            }
            footer={
              offers.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {offers.map((w) => (
                    <OfferChip key={w.id} worker={w} label={`${w.name} offered to cover!`} />
                  ))}
                </div>
              ) : undefined
            }
          />
        ),
      };
    });

  return <CardStack title="Shifts up for grabs" items={items} />;
}
