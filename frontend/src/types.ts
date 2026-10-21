export type Worker = {
  id: string;
  username: string;
  name: string;
  avatarColor: string;
  avatarUrl?: string;
  // false only for a freshly manager-created slot that hasn't been claimed
  // yet — undefined/true means `name` is a real name someone chose.
  nameClaimed?: boolean;
  // A private label only the manager sees (e.g. "Dylan R. (bar back)").
  // Never shown to the bartender themselves, and never touches their
  // `username` login — see managerView() in data/workers.ts.
  managerName?: string;
};

export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

// A shift is a specific calendar day's time slot, not a recurring weekday —
// "date" is an ISO string ("YYYY-MM-DD") so editing next Monday's shift
// doesn't silently change every other Monday too. New weeks are populated
// from a template (see data/mockSchedule.ts) the first time they're viewed,
// but from then on each week's shifts are independent. A slot can hold more
// than one bartender at once (busy nights need two or three behind the bar).
export type Shift = {
  id: string;
  date: string;
  start: string;
  end: string;
  workerIds: string[];
};

// The recurring weekly pattern used only to populate a newly-visited week —
// not itself a Shift, since it has no date until instantiated.
export type ShiftTemplateEntry = {
  day: Day;
  start: string;
  end: string;
  workerIds: string[];
};

export type TimeOffStatus = "pending" | "approved";

// Time off is a specific calendar date range, not a recurring weekday —
// startDate/endDate are ISO strings ("YYYY-MM-DD"), inclusive. A single-day
// request just has startDate === endDate.
export type TimeOffRequest = {
  id: string;
  workerId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: TimeOffStatus;
};

// A worker flags one of their own shifts as needing someone else to cover
// it. The manager finds a replacement (via the normal add-bartender flow)
// and dismisses the request. Existing in this list means "still pending" —
// resolving or denying just removes it.
export type CoverageRequest = {
  id: string;
  shiftId: string;
  requestingWorkerId: string;
  note?: string;
};

// A worker asks to trade one of their shifts for another worker's shift.
// Approving performs the swap immediately and removes the request.
export type SwapRequest = {
  id: string;
  requestingWorkerId: string;
  requestingShiftId: string;
  targetWorkerId: string;
  targetShiftId: string;
};

export type DayAvailability = {
  available: boolean;
  note?: string;
};

// A generic recurring weekly availability pattern a worker builds and sends
// to the manager — not tied to a specific date, unlike time off. Submitting
// again replaces their previous one (one record per worker).
export type Availability = {
  id: string;
  workerId: string;
  days: Record<Day, DayAvailability>;
  submittedAt: string;
};
