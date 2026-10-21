import type { Worker } from "../types";

/**
 * The bartender roster. Same DEMO-ONLY approach as `auth/credentials.ts`:
 * with no backend yet, "the database" is just localStorage in the manager's
 * own browser. This must move server-side once the Go backend exists, so
 * every manager sees the same roster instead of whoever added it locally.
 */

const STORAGE_KEY = "britestar-workers";

const AVATAR_PALETTE = [
  "#ab3131",
  "#7a4a9c",
  "#2b7a5f",
  "#b8791c",
  "#2b5d9c",
  "#9c5b2b",
  "#c2185b",
  "#4f8a8b",
  "#6b8e23",
  "#cc6b49",
  "#5a5aa8",
  "#57636b",
  "#8a3d6b",
];

// Throwaway accounts for walking through the employee side. They sign in
// with TEST_ACCOUNT_PASSWORD (see auth/credentials.ts) and skip the
// set-your-own-password step.
export const TEST_USERNAMES = ["test1", "test2", "test3", "test4", "test5"];

const DEFAULT_WORKERS: Worker[] = [
  { id: "w1", username: "dylanr", name: "Dylan R.", avatarColor: AVATAR_PALETTE[0] },
  { id: "w2", username: "dylans", name: "Dylan S.", avatarColor: AVATAR_PALETTE[1] },
  { id: "w3", username: "johns", name: "John S.", avatarColor: AVATAR_PALETTE[2] },
  { id: "w4", username: "bianca", name: "Bianca", avatarColor: AVATAR_PALETTE[3] },
  { id: "w5", username: "melanie", name: "Melanie", avatarColor: AVATAR_PALETTE[4] },
  { id: "w6", username: "taylor", name: "Taylor", avatarColor: AVATAR_PALETTE[5] },
  { id: "w7", username: "kristin", name: "Kristin", avatarColor: AVATAR_PALETTE[6] },
  { id: "w8", username: "adrienne", name: "Adrienne", avatarColor: AVATAR_PALETTE[7] },
  { id: "w9", username: "charity", name: "Charity", avatarColor: AVATAR_PALETTE[8] },
  { id: "w10", username: "kelsey", name: "Kelsey", avatarColor: AVATAR_PALETTE[9] },
  { id: "w11", username: "lexi", name: "Lexi", avatarColor: AVATAR_PALETTE[10] },
  { id: "w12", username: "djsecurity", name: "DJ (Security)", avatarColor: AVATAR_PALETTE[11] },
  { id: "w13", username: "test123", name: "Test User", avatarColor: AVATAR_PALETTE[12] },
  ...TEST_USERNAMES.map((username, i) => ({
    id: `w${14 + i}`,
    username,
    name: `Test ${i + 1}`,
    avatarColor: AVATAR_PALETTE[(i * 3 + 2) % AVATAR_PALETTE.length],
  })),
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function uniqueUsername(base: string, existing: Worker[]): string {
  if (!existing.some((w) => w.username === base)) return base;
  let n = 2;
  while (existing.some((w) => w.username === `${base}${n}`)) n++;
  return `${base}${n}`;
}

export function saveWorkers(workers: Worker[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workers));
  } catch {
    // localStorage unavailable (private browsing, etc.) — changes just won't persist
  }
}

export function getWorkers(): Worker[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Worker[];
      // Merge in any newly-added default names a returning browser doesn't
      // have yet, without touching existing entries (claimed names, etc.).
      const missing = DEFAULT_WORKERS.filter(
        (d) => !stored.some((w) => w.username === d.username),
      );
      if (missing.length > 0) {
        const merged = [...stored, ...missing];
        saveWorkers(merged);
        return merged;
      }
      return stored;
    }
  } catch {
    // fall through to defaults
  }
  saveWorkers(DEFAULT_WORKERS);
  return DEFAULT_WORKERS;
}

// The manager only assigns a username here — the new hire picks their own
// display name when they set their password on first login (claimWorkerName).
export function addWorker(username: string, current: Worker[]): Worker[] {
  const finalUsername = uniqueUsername(slugify(username) || "worker", current);
  const avatarColor = AVATAR_PALETTE[current.length % AVATAR_PALETTE.length];
  const placeholderName = finalUsername.charAt(0).toUpperCase() + finalUsername.slice(1);
  const updated: Worker[] = [
    ...current,
    {
      id: `w${Date.now()}`,
      username: finalUsername,
      name: placeholderName,
      avatarColor,
      nameClaimed: false,
    },
  ];
  saveWorkers(updated);
  return updated;
}

export function removeWorker(id: string, current: Worker[]): Worker[] {
  const updated = current.filter((w) => w.id !== id);
  saveWorkers(updated);
  return updated;
}

/** The roster as the manager sees it: each worker's private managerName (if set) replaces their name. */
export function managerView(workers: Worker[]): Worker[] {
  return workers.map((w) => (w.managerName ? { ...w, name: w.managerName } : w));
}

export function claimWorkerName(id: string, name: string, current: Worker[]): Worker[] {
  const updated = current.map((w) =>
    w.id === id ? { ...w, name: name.trim(), nameClaimed: true } : w,
  );
  saveWorkers(updated);
  return updated;
}
