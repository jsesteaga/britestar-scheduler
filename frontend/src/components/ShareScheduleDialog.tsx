import { useEffect, useState } from "react";
import { renderScheduleImage, type ScheduleImageInput } from "../utils/scheduleImage";
import { toISODate } from "../utils/week";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

type ShareScheduleDialogProps = {
  input: ScheduleImageInput;
  weekLabel: string;
  onClose: () => void;
};

/**
 * Turns the week into an image the manager can send to the group chat.
 * Shows a preview first, then offers whatever this browser supports:
 * the share sheet (Safari: pick Messages → the group), copy to clipboard
 * (paste into Messages), or a plain download.
 */
export function ShareScheduleDialog({ input, weekLabel, onClose }: ShareScheduleDialogProps) {
  // Snapshot the schedule as it was when the dialog opened, so the parent
  // re-rendering doesn't keep redrawing the image.
  const [snapshot] = useState(input);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    renderScheduleImage(snapshot)
      .then((blob) => {
        if (cancelled) return;
        const name = `britestar-schedule-${toISODate(snapshot.monday)}.png`;
        url = URL.createObjectURL(blob);
        setFile(new File([blob], name, { type: "image/png" }));
        setPreviewUrl(url);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't create the image");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [snapshot]);

  const canShare =
    !!file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  const canCopy = typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;

  async function handleShare() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: `Schedule ${weekLabel}` });
    } catch (e) {
      // Closing the share sheet throws AbortError — that's not a failure.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setStatus("Sharing didn't work here. Try Copy or Download instead.");
      }
    }
  }

  async function handleCopy() {
    if (!file) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": file })]);
      setStatus("Copied! Paste it into the group chat (⌘V).");
    } catch {
      setStatus("Couldn't copy in this browser. Use Download instead.");
    }
  }

  function handleDownload() {
    if (!file || !previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = file.name;
    a.click();
    setStatus("Saved to your Downloads folder.");
  }

  return (
    <Modal onClose={onClose} labelledBy="share-title" wide>
      <h2 id="share-title" className="text-base font-bold text-brite-white">
        Share schedule · {weekLabel}
      </h2>
      <p className="mt-1 text-xs text-brite-tan/60">
        This is the week exactly as it looks right now. Send it to the group chat.
      </p>

      <div className="mt-4 flex justify-center rounded-xl bg-black/25 p-3">
        {error ? (
          <p className="py-10 text-sm text-brite-red-bright">{error}</p>
        ) : previewUrl ? (
          <img src={previewUrl} alt={`Schedule for ${weekLabel}`} className="w-full max-w-sm rounded-lg shadow-lg" />
        ) : (
          <p className="py-10 text-sm text-brite-tan/60">Making the image…</p>
        )}
      </div>

      {status && <p className="mt-3 text-center text-xs font-semibold text-brite-amber">{status}</p>}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDownload} disabled={!file}>
          Download
        </Button>
        {canCopy && (
          <Button variant={canShare ? "ghost" : "primary"} size="sm" onClick={handleCopy} disabled={!file}>
            Copy image
          </Button>
        )}
        {canShare && (
          <Button size="sm" onClick={handleShare}>
            Share…
          </Button>
        )}
      </div>
    </Modal>
  );
}
