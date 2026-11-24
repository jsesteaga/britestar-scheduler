import { eventFor, type DayEvents } from "../data/events";
import type { Shift, TimeOffRequest, Worker } from "../types";
import { formatCompactTime, nightMinutes } from "./time";
import { DAYS, formatShortDate, formatWeekRange, getDatesForWeek, toISODate } from "./week";

/**
 * Draws one week of the schedule as a PNG, sized for a phone screen, so the
 * manager can drop it into the group chat. It's drawn by hand on a <canvas>
 * (not a screenshot of the page) so it never picks up buttons, menus, or
 * whatever happens to be open, and looks the same in every browser.
 */

export type ScheduleImageInput = {
  monday: Date;
  shifts: Shift[];
  workers: Worker[];
  timeOff: TimeOffRequest[];
  dayEvents: DayEvents;
};

// Logical size; drawn at SCALE× so text stays crisp on Retina phones.
const WIDTH = 600;
const SCALE = 2;
const PAD = 28;
const CARD_PAD = 14;
const DAY_COL = 70;
const TIME_COL = 70;
const CARD_GAP = 10;

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, sans-serif';

// Same palette as index.css (canvas can't read CSS variables reliably).
const COLOR = {
  bg: "#241d19",
  card: "#362c25",
  red: "#d8503f",
  amber: "#e2a857",
  cream: "#f6ecdc",
  tan: "#e9d8bb",
  white: "#fffdf9",
  muted: "rgba(233, 216, 187, 0.55)",
};

/** Splits `tokens` (e.g. names) into lines no wider than `maxWidth`, never breaking a token. */
function wrapTokens(ctx: CanvasRenderingContext2D, tokens: string[], sep: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const token of tokens) {
    const candidate = line ? line + sep + token : token;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line + sep.trimEnd());
      line = token;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) =>
  wrapTokens(ctx, text.split(/\s+/).filter(Boolean), " ", maxWidth);

/**
 * Lays out (and, when `draw` is true, paints) the whole image. Returns the
 * total height, so it can run once to measure and once to draw.
 */
function paint(ctx: CanvasRenderingContext2D, input: ScheduleImageInput, draw: boolean): number {
  const { monday, shifts, workers, timeOff, dayEvents } = input;
  const nameOf = (id: string) => workers.find((w) => w.id === id)?.name ?? "?";
  const text = (s: string, x: number, y: number, font: string, color: string) => {
    if (!draw) return;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  };

  ctx.textBaseline = "top";
  let y = PAD;

  // Header
  text("BRITESTAR · SCHEDULE", PAD, y, `700 12px ${FONT}`, COLOR.amber);
  y += 20;
  text(formatWeekRange(monday), PAD, y, `700 30px ${FONT}`, COLOR.white);
  y += 50;

  const dates = getDatesForWeek(monday);
  const innerX = PAD + CARD_PAD;
  const contentX = innerX + DAY_COL;
  const contentW = WIDTH - PAD - CARD_PAD - contentX;

  for (const day of DAYS) {
    const iso = toISODate(dates[day]);
    const dayShifts = shifts
      .filter((s) => s.date === iso)
      .sort((a, b) => nightMinutes(a.start) - nightMinutes(b.start));
    const off = timeOff
      .filter((r) => r.status === "approved" && iso >= r.startDate && iso <= r.endDate)
      .map((r) => nameOf(r.workerId));
    const note = eventFor(dayEvents, day, iso).trim();

    // Measure this day's content first, so the card behind it is the right height.
    const rows: { kind: "note" | "time" | "names" | "open" | "empty" | "off"; s: string; x: number; dy: number }[] = [];
    let cy = 0;

    if (note) {
      ctx.font = `italic 600 13px ${FONT}`;
      for (const line of wrapText(ctx, note, contentW)) {
        rows.push({ kind: "note", s: line, x: contentX, dy: cy });
        cy += 18;
      }
      cy += 6;
    }

    if (dayShifts.length === 0) {
      rows.push({ kind: "empty", s: "No shifts", x: contentX, dy: cy });
      cy += 22;
    }
    for (const shift of dayShifts) {
      rows.push({
        kind: "time",
        s: `${formatCompactTime(shift.start)}–${formatCompactTime(shift.end)}`,
        x: contentX,
        dy: cy,
      });
      if (shift.workerIds.length === 0) {
        rows.push({ kind: "open", s: "Open — needs a bartender", x: contentX + TIME_COL, dy: cy });
        cy += 22;
      } else {
        ctx.font = `500 16px ${FONT}`;
        for (const line of wrapTokens(ctx, shift.workerIds.map(nameOf), ", ", contentW - TIME_COL)) {
          rows.push({ kind: "names", s: line, x: contentX + TIME_COL, dy: cy });
          cy += 22;
        }
      }
      cy += 4;
    }

    if (off.length > 0) {
      cy += 2;
      ctx.font = `500 12px ${FONT}`;
      for (const line of wrapTokens(ctx, off, ", ", contentW - 30)) {
        rows.push({ kind: "off", s: line, x: contentX, dy: cy });
        cy += 17;
      }
    }

    const cardH = Math.max(cy, 40) + CARD_PAD * 2 - 4;

    if (draw) {
      ctx.fillStyle = COLOR.card;
      ctx.beginPath();
      ctx.roundRect(PAD, y, WIDTH - PAD * 2, cardH, 12);
      ctx.fill();
    }

    const top = y + CARD_PAD;
    text(day.toUpperCase(), innerX, top, `800 16px ${FONT}`, COLOR.white);
    text(formatShortDate(dates[day]), innerX, top + 21, `500 13px ${FONT}`, COLOR.muted);

    let firstOff = true;
    for (const row of rows) {
      const ry = top + row.dy;
      if (row.kind === "note") text(row.s, row.x, ry, `italic 600 13px ${FONT}`, COLOR.amber);
      else if (row.kind === "time") text(row.s, row.x, ry, `700 16px ${FONT}`, COLOR.cream);
      else if (row.kind === "names") text(row.s, row.x, ry, `500 16px ${FONT}`, COLOR.tan);
      else if (row.kind === "open") text(row.s, row.x, ry, `700 15px ${FONT}`, COLOR.red);
      else if (row.kind === "empty") text(row.s, row.x, ry, `500 15px ${FONT}`, COLOR.muted);
      else if (row.kind === "off") {
        // "Off" label on the first line only; names line up after it.
        if (firstOff) text("Off", row.x, ry, `700 12px ${FONT}`, COLOR.muted);
        text(row.s, row.x + 30, ry, `500 12px ${FONT}`, COLOR.muted);
        firstOff = false;
      }
    }

    y += cardH + CARD_GAP;
  }

  y += 6;
  const updated = new Date().toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  text(`Updated ${updated}`, PAD, y, `500 12px ${FONT}`, COLOR.muted);
  y += 16;

  return y + PAD;
}

/** Renders the week to a PNG blob. */
export async function renderScheduleImage(input: ScheduleImageInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available in this browser");

  const height = paint(ctx, input, false);
  canvas.width = WIDTH * SCALE;
  canvas.height = Math.ceil(height * SCALE);
  // Resizing a canvas resets its context, so set everything up after.
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, WIDTH, height);
  paint(ctx, input, true);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't create the image"))), "image/png"),
  );
}
