/**
 * DEMO-ONLY persistence: every data/ module reads and writes the browser's
 * localStorage through these two helpers. This is the one seam a real
 * backend replaces — swap these calls for API requests and the rest of the
 * app doesn't need to know.
 */

/** The saved value for `key`, or null if there isn't one (or it can't be read). */
export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (private browsing, etc.) — changes just won't persist
  }
}
