import type { CoverageRequest, NotificationKind, Shift } from "../types";
import { formatCompactTime } from "../utils/time";
import { formatFriendlyDate } from "../utils/week";

export type PendingNotification = { workerId: string; kind: NotificationKind; text: string };

/** "Thu, Oct 30, 1–5:30" */
export function describeShift(shift: Shift): string {
  return `${formatFriendlyDate(shift.date)}, ${formatCompactTime(shift.start)}–${formatCompactTime(shift.end)}`;
}

type DiffInput = {
  before: Shift[];
  after: Shift[];
  // Only finalized weeks notify — reshuffling a work-in-progress week
  // shouldn't ping anyone.
  isFinalized: (date: string) => boolean;
  coverageRequests: CoverageRequest[];
  nameOf: (workerId: string) => string;
};

/**
 * Compares the schedule before and after one manager action and works out
 * who needs to hear about it. Doing it as a before/after diff (rather than
 * inside each add/remove/drag/copy/delete handler) means every way of
 * changing the schedule is covered automatically.
 *
 * Also returns the give-away requests this change fulfilled: if someone who
 * asked to give a shift away is no longer on it, they've been covered (this
 * part applies to every week, finalized or not).
 */
export function diffShiftNotifications({
  before,
  after,
  isFinalized,
  coverageRequests,
  nameOf,
}: DiffInput): { notifications: PendingNotification[]; resolvedRequestIds: string[] } {
  const beforeById = new Map(before.map((s) => [s.id, s]));
  const afterById = new Map(after.map((s) => [s.id, s]));
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  const notifications: PendingNotification[] = [];
  const resolvedRequestIds: string[] = [];

  for (const id of ids) {
    const was = beforeById.get(id);
    const now = afterById.get(id);
    // Give-away requests close whenever their requester comes off the shift,
    // on any week; notifications only go out for finalized weeks.
    const finalized = (was && isFinalized(was.date)) || (now && isFinalized(now.date));
    const notes: PendingNotification[] = [];

    const wasIds = was?.workerIds ?? [];
    const nowIds = now?.workerIds ?? [];
    const removed = wasIds.filter((w) => !nowIds.includes(w));
    const added = nowIds.filter((w) => !wasIds.includes(w));
    const stayed = nowIds.filter((w) => wasIds.includes(w));
    const giveAways = coverageRequests.filter((r) => r.shiftId === id);

    for (const workerId of removed) {
      const theirRequest = giveAways.find((r) => r.requestingWorkerId === workerId);
      if (theirRequest) {
        resolvedRequestIds.push(theirRequest.id);
        notes.push({
          workerId,
          kind: "covered",
          text: `You've been covered for ${describeShift(was!)}. Enjoy the night off!`,
        });
      } else {
        notes.push({
          workerId,
          kind: "removed",
          text: `You've been taken off ${describeShift(was!)}.`,
        });
      }
    }

    for (const workerId of added) {
      const covering = giveAways.find((r) => r.requestingWorkerId !== workerId);
      notes.push(
        covering
          ? {
              workerId,
              kind: "covering",
              text: `You've been added to cover ${nameOf(covering.requestingWorkerId)}'s shift: ${describeShift(now!)}.`,
            }
          : { workerId, kind: "added", text: `You've been added to ${describeShift(now!)}.` },
      );
    }

    if (was && now && (was.start !== now.start || was.end !== now.end || was.date !== now.date)) {
      for (const workerId of stayed) {
        notes.push({
          workerId,
          kind: "changed",
          text: `Your shift on ${describeShift(was)} changed to ${describeShift(now)}.`,
        });
      }
    }

    if (finalized) notifications.push(...notes);
  }

  return { notifications, resolvedRequestIds };
}
