import { getWorkers, TEST_USERNAMES } from "../data/workers";

/**
 * DEMO-ONLY credential handling.
 *
 * There is no backend yet, so "checking a password" here just means
 * comparing plain strings and storing them in the browser's localStorage.
 * That is NOT secure — anyone can read this source file, and localStorage
 * is plain text on the visitor's own machine. This exists purely so the
 * login flow can be previewed end-to-end. It must be replaced by real
 * server-side password hashing + checks (Go backend) before real staff
 * credentials ever touch this.
 */

// The real values live in frontend/.env.local, which git ignores, so they
// never end up on GitHub. Copy .env.example to .env.local to set your own;
// without it, these generic placeholders are used.
const MANAGER_PASSWORD: string = import.meta.env.VITE_MANAGER_PASSWORD || "manager-demo";
const DEFAULT_WORKER_PASSWORD: string = import.meta.env.VITE_TEMP_WORKER_PASSWORD || "newhire-demo";
const STORAGE_PREFIX = "britestar-demo-password:";
export const TEST_ACCOUNT_PASSWORD: string = import.meta.env.VITE_TEST_ACCOUNT_PASSWORD || "test-demo";

export function checkManagerPassword(password: string): boolean {
  return password === MANAGER_PASSWORD;
}

function getStoredWorkerPassword(username: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + username);
  } catch {
    return null;
  }
}

export function setStoredWorkerPassword(username: string, password: string): void {
  localStorage.setItem(STORAGE_PREFIX + username, password);
}

export type WorkerLoginResult =
  | "unknown-username"
  | "needs-password-reset"
  | "wrong-password"
  | "ok";

export function checkWorkerLogin(username: string, password: string): WorkerLoginResult {
  const worker = getWorkers().find((w) => w.username === username);
  if (!worker) return "unknown-username";

  const storedPassword = getStoredWorkerPassword(username);

  // No custom password saved yet -> they must still be on the shared
  // default password, and must go set a real one.
  if (!storedPassword) {
    if (TEST_USERNAMES.includes(username) && password === TEST_ACCOUNT_PASSWORD) return "ok";
    return password === DEFAULT_WORKER_PASSWORD ? "needs-password-reset" : "wrong-password";
  }

  return password === storedPassword ? "ok" : "wrong-password";
}

export function isValidNewPassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password === DEFAULT_WORKER_PASSWORD) return "Choose a password different from the temporary one.";
  return null;
}
