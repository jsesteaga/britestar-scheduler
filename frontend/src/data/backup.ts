/**
 * Backup / restore for the DEMO-ONLY localStorage "database". Until the Go
 * backend exists, everything lives in one browser, and clearing site data
 * would wipe it. This copies every Britestar key to a file and back.
 *
 * Values are kept as the raw strings localStorage holds, so a restore puts
 * back exactly what was there. That includes the demo passwords from
 * auth/credentials.ts, so treat the backup file as private.
 */

const PREFIX = "britestar";
const APP_ID = "britestar-scheduler";

type BackupFile = {
  app: typeof APP_ID;
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
};

function britestarKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

/** Everything saved in this browser, as a downloadable JSON file. */
export function createBackupFile(): File {
  const data: Record<string, string> = {};
  for (const key of britestarKeys()) {
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  const backup: BackupFile = { app: APP_ID, version: 1, exportedAt: new Date().toISOString(), data };
  const day = backup.exportedAt.slice(0, 10);
  return new File([JSON.stringify(backup, null, 2)], `britestar-backup-${day}.json`, {
    type: "application/json",
  });
}

/**
 * Replaces everything saved in this browser with the backup's contents.
 * Throws (and changes nothing) if the file isn't a Britestar backup.
 * Returns how many items were restored. Reload the page afterwards.
 */
export async function restoreBackupFile(file: File): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't a Britestar backup.");
  }
  const backup = parsed as Partial<BackupFile>;
  if (backup?.app !== APP_ID || typeof backup.data !== "object" || backup.data === null) {
    throw new Error("That file isn't a Britestar backup.");
  }
  const entries = Object.entries(backup.data).filter(
    ([key, value]) => key.startsWith(PREFIX) && typeof value === "string",
  );

  for (const key of britestarKeys()) localStorage.removeItem(key);
  for (const [key, value] of entries) localStorage.setItem(key, value);
  return entries.length;
}
