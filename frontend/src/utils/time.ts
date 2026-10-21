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
