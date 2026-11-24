import { useRef, useState } from "react";
import { createBackupFile, restoreBackupFile } from "../data/backup";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

/**
 * Save everything in this browser to a file, or load it back. The schedule
 * only lives in this browser until there's a real backend, so this is
 * the safety net if site data ever gets cleared (or to move to a new laptop).
 */
export function BackupDialog({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleDownload() {
    const file = createBackupFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(true);
  }

  async function handleRestore() {
    if (!pending) return;
    try {
      await restoreBackupFile(pending);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't restore that file.");
      setPending(null);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="backup-title">
      <h2 id="backup-title" className="text-base font-bold text-brite-white">
        Back up schedule
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-brite-tan/60">
        Everything (bartenders, shifts, time off, notes) is saved only in this browser. Download a backup
        now and then, so nothing is lost if browsing data gets cleared.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <Button size="sm" onClick={handleDownload}>
          Download backup
        </Button>
        {saved && <p className="text-center text-xs font-semibold text-brite-green">Saved to Downloads.</p>}

        <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
          Restore from a backup…
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            setError(null);
            setPending(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </div>

      {pending && (
        <div className="mt-4 rounded-lg border border-brite-red/40 bg-brite-red/10 p-3">
          <p className="text-xs text-brite-cream">
            Replace everything in this browser with <span className="font-semibold">{pending.name}</span>? This
            can't be undone.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleRestore}>
              Replace
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-xs font-semibold text-brite-red-bright">{error}</p>}

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
