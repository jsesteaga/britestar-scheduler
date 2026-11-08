import { useSyncExternalStore } from "react";

/**
 * "Add to Home Screen" support, which works very differently per platform:
 *
 * - Chrome / Edge / Android: the browser fires `beforeinstallprompt` once the
 *   site qualifies as installable. Saving that event lets our own button
 *   show the browser's real install dialog later.
 * - iPhone / iPad: there's no install API at all. People have to do it
 *   themselves from the Share menu, so we can only show them how.
 * - Other phones/tablets (e.g. Firefox or Samsung Internet on Android): also
 *   no button we can trigger, but the browser menu has the option.
 * - Already opened from the home screen ("standalone"): nothing to offer.
 *
 * The listeners are registered when this module first loads (at app start,
 * since the login page imports it), because the browser may fire the event
 * very early, before anything has been drawn.
 */

// Chrome's event type isn't in TypeScript's built-in DOM types.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState =
  | { kind: "installed" } // running from the home screen
  | { kind: "prompt" } // our button can open the browser's install dialog
  | { kind: "ios" } // show the Share → Add to Home Screen steps
  | { kind: "manual" } // other touch devices: point them at the browser menu
  | { kind: "unsupported" }; // e.g. desktop Firefox — nothing to offer

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // we show our own button instead of the browser's mini-bar
  deferredPrompt = e as BeforeInstallPromptEvent;
  notify();
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  justInstalled = true;
  notify();
});

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's older, non-standard flag for home-screen launches.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPads report themselves as a Mac; touch support gives them away.
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

// useSyncExternalStore needs the same object back while nothing changed.
let cached: InstallState | null = null;
function compute(): InstallState {
  const next: InstallState =
    justInstalled || isStandalone()
      ? { kind: "installed" }
      : deferredPrompt
        ? { kind: "prompt" }
        : isIOS()
          ? { kind: "ios" }
          : window.matchMedia("(pointer: coarse)").matches
            ? { kind: "manual" }
            : { kind: "unsupported" };
  if (!cached || cached.kind !== next.kind) cached = next;
  return cached;
}

/** Whether there's any way to offer "Add to Home Screen" here (and it isn't done already). */
export function canOfferInstall(state: InstallState): boolean {
  return state.kind === "prompt" || state.kind === "ios" || state.kind === "manual";
}

/** Which kind of "Add to Home Screen" help this device can get, kept up to date. */
export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    compute,
  );
}

/** Opens the browser's own install dialog (only when the state is "prompt"). */
export async function promptInstall(): Promise<void> {
  const event = deferredPrompt;
  if (!event) return;
  // The saved event only works once; the browser re-fires it if needed.
  deferredPrompt = null;
  await event.prompt();
  notify();
}
