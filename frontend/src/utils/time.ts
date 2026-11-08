import type { Shift } from "../types";
import { formatFriendlyDate } from "./week";

/** Converts a display string like "1:00 PM" into the "HH:MM" value an <input type="time"> expects. */
export function displayTimeToInputValue(display: string): string {
  const match = display.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "12:00";
  const [, hourStr, minute, meridiem] = match;
  let hour = parseInt(hourStr, 10) % 12;
  if (meridiem.toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

/** Converts an <input type="time"> value ("HH:MM", 24-hour) back into a "1:00 PM" display string. */
export function inputValueToDisplayTime(value: string): string {
  const [hourStr, minute] = value.split(":");
  let hour = parseInt(hourStr, 10);
  const meridiem = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${meridiem}`;
}

/** Shortens "1:00 PM" to just "1", and "8:30 PM" to "8:30" — drops :00 and AM/PM for a tighter read. */
export function formatCompactTime(display: string): string {
  const match = display.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return display;
  const [, hour, minute] = match;
  return minute === "00" ? hour : `${hour}:${minute}`;
}

/** "Tue, Oct 21, 3:40 PM" — when a week's schedule was posted. */
export function formatPostedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** An <input type="time"> value ("20:30") → minutes since midnight (1230). */
export function inputValueToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/**
 * "8:30 PM" → minutes for ordering a bar night: anything before 5 AM counts
 * as after midnight, so a 2 AM close sorts after an 8:30 PM start.
 */
export function nightMinutes(display: string): number {
  const minutes = inputValueToMinutes(displayTimeToInputValue(display));
  return minutes < 5 * 60 ? minutes + 24 * 60 : minutes;
}

/** Minutes since midnight (may exceed 24h for after-midnight times) → "9:00 PM". */
export function minutesToDisplayTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return inputValueToDisplayTime(`${hh}:${mm}`);
}

/** "Thu, Oct 30, 1–5:30" */
export function describeShift(shift: Shift): string {
  return `${formatFriendlyDate(shift.date)}, ${formatCompactTime(shift.start)}–${formatCompactTime(shift.end)}`;
}
