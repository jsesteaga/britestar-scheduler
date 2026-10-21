import { useRef, useState } from "react";
import type { Day } from "../types";
import { DAY_FULL_NAMES } from "../utils/week";
import { Modal } from "./ui/Modal";

type DayEventNoteProps = {
  text: string;
  isAdmin: boolean;
  day: Day;
  dateLabel: string; // "10/5"
  // True when this date has its own one-off note instead of the weekly one.
  isOneOff: boolean;
  onSaveWeekly: (text: string) => void;
  onSaveOneOff: (text: string) => void;
  onResetToWeekly: () => void;
};

/**
 * The promo note under a day's date. Managers click it to edit in place;
 * saving a change pops up a dialog asking whether it's for every week's
 * <day> or just this date. The editor floats over the header (absolute)
 * rather than pushing it taller, so shift cards stay lined up.
 */
export function DayEventNote({
  text,
  isAdmin,
  day,
  dateLabel,
  isOneOff,
  onSaveWeekly,
  onSaveOneOff,
  onResetToWeekly,
}: DayEventNoteProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editing = draft !== null;
  const dayName = DAY_FULL_NAMES[day];

  function finish() {
    setDraft(null);
    setConfirming(false);
  }

  // Nothing changed → just close. Otherwise ask where the change applies.
  function requestSave() {
    if (draft === null) return;
    if (draft.trim() === text) {
      finish();
      return;
    }
    setConfirming(true);
  }

  // Back from the dialog to the editor, with the cursor in the text again.
  function keepEditing() {
    setConfirming(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function save(scope: "weekly" | "one-off") {
    const value = (draft ?? "").trim();
    (scope === "weekly" ? onSaveWeekly : onSaveOneOff)(value);
    finish();
  }

  if (!isAdmin) {
    return <div className="px-1 text-[10px] font-semibold leading-tight text-brite-amber">{text}</div>;
  }

  const newText = (draft ?? "").trim();
  const removing = newText === "";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setDraft(text)}
        title={isOneOff ? `Just for ${dateLabel} — click to edit` : `Every ${dayName} — click to edit`}
        className={`w-full rounded-md px-1 py-0.5 text-[10px] font-semibold leading-tight transition-colors hover:bg-brite-amber/10 ${
          text ? "text-brite-amber" : "text-transparent group-hover/day:text-brite-tan/35"
        } ${editing ? "invisible" : ""}`}
      >
        {text || "+ Add note"}
      </button>

      {editing && (
        <div
          className="absolute inset-x-0 top-0 z-20 rounded-lg border border-brite-amber/40 bg-brite-black-soft p-1.5 shadow-xl shadow-black/50"
          onBlur={(e) => {
            // Clicking away with no changes just closes; with changes it
            // asks (the dialog's own focus doesn't count as clicking away).
            if (confirming || e.currentTarget.contains(e.relatedTarget as Node)) return;
            requestSave();
          }}
        >
          <textarea
            ref={textareaRef}
            autoFocus
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                requestSave();
              } else if (e.key === "Escape") {
                finish();
              }
            }}
            placeholder="e.g. Trivia Night"
            className="w-full resize-none rounded border border-brite-tan/15 bg-brite-black px-1.5 py-1 text-center text-[11px] font-semibold leading-tight text-brite-amber placeholder:text-brite-tan/30 focus:border-brite-amber/60 focus:outline-none"
          />
          <button
            type="button"
            // Keep focus in the textarea — Safari doesn't focus buttons on
            // click, so the blur would otherwise fire first as "click away".
            onMouseDown={(e) => e.preventDefault()}
            onClick={requestSave}
            className="mt-1 w-full rounded bg-brite-red py-0.5 text-[10px] font-semibold text-brite-white hover:bg-brite-red-bright"
          >
            Save
          </button>
          {isOneOff && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onResetToWeekly();
                finish();
              }}
              className="mt-1 w-full text-[10px] text-brite-tan/45 hover:text-brite-tan"
            >
              Reset to weekly note
            </button>
          )}
        </div>
      )}

      {confirming && (
        <Modal onClose={keepEditing} labelledBy="note-scope-title">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brite-amber/15 text-lg text-brite-amber">
              ★
            </span>
            <div>
              <h2 id="note-scope-title" className="text-base font-bold text-brite-white">
                {removing ? `Remove the note from every ${dayName}?` : `Make this every ${dayName}?`}
              </h2>
              <p className="text-xs text-brite-tan/50">
                {removing ? "Or just clear it for this one day." : "Or keep it to just this one day."}
              </p>
            </div>
          </div>

          {/* Preview of the note, styled like it appears under the date. */}
          <div className="mb-4 rounded-lg border border-brite-tan/10 bg-brite-black/50 px-3 py-2.5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-wide text-brite-tan/60">
              {day} {dateLabel}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-brite-amber">
              {removing ? <span className="italic text-brite-tan/35">No note</span> : newText}
            </div>
            {text && text !== newText && (
              <div className="mt-1 text-[11px] text-brite-tan/35 line-through">{text}</div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => save("weekly")}
              className="rounded-lg bg-brite-red py-2.5 text-sm font-semibold text-brite-white hover:bg-brite-red-bright"
            >
              {removing ? `Remove from every ${dayName}` : `Yes, every ${dayName}`}
            </button>
            <button
              type="button"
              onClick={() => save("one-off")}
              className="rounded-lg border border-brite-tan/30 py-2.5 text-sm font-semibold text-brite-cream hover:border-brite-tan"
            >
              Just this {dayName} ({dateLabel})
            </button>
            <button
              type="button"
              onClick={keepEditing}
              className="py-1 text-xs font-semibold text-brite-tan/50 hover:text-brite-tan"
            >
              Keep editing
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
