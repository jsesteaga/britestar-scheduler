import { useState } from "react";
import { canOfferInstall, promptInstall, useInstallState, type InstallState } from "../pwa/install";
import { Sheet } from "./ui/Sheet";

/**
 * Runs the right "Add to Home Screen" flow for this device: the browser's
 * own install dialog where there is one, otherwise step-by-step help.
 * Returns the click handler, plus the help sheet to render (null when closed).
 */
function useAddToHome(state: InstallState, onDone?: () => void) {
  const [showSteps, setShowSteps] = useState(false);

  async function start() {
    if (state.kind === "prompt") {
      await promptInstall();
      onDone?.();
    } else {
      setShowSteps(true);
    }
  }

  const steps =
    showSteps && (state.kind === "ios" || state.kind === "manual") ? (
      <InstallSteps
        platform={state.kind}
        onClose={() => {
          setShowSteps(false);
          onDone?.();
        }}
      />
    ) : null;

  return { start, steps };
}

/**
 * The first screen on a phone that hasn't installed the app yet, in place of
 * the login form: add it to the home screen, or carry on in the browser.
 * It goes first (before logging in) on purpose — on iPhone, the home-screen
 * app doesn't share Safari's logins, so installing after logging in would
 * mean logging in twice.
 */
export function InstallWelcome({ onDone }: { onDone: () => void }) {
  const state = useInstallState();
  const { start, steps } = useAddToHome(state, onDone);

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-lg font-bold text-brite-white">Welcome to Britestar Tavern Scheduler</h1>
      <p className="mt-2 text-sm text-brite-tan/65">
        Add it to your home screen and it opens like an app: full screen, one tap away. Free, no app store.
      </p>
      <button
        type="button"
        onClick={start}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brite-red py-3 font-semibold text-brite-white hover:bg-brite-red-bright"
      >
        <PhoneIcon />
        Add to Home Screen
      </button>
      <button
        type="button"
        onClick={onDone}
        className="mt-2 w-full rounded-lg border border-brite-tan/30 py-3 font-semibold text-brite-cream hover:border-brite-tan"
      >
        Continue on web
      </button>
      <p className="mt-4 text-xs text-brite-tan/40">You can add it later from the top right of the login page.</p>
      {steps}
    </div>
  );
}

/** Small top-right button on the login page, for whenever someone wants it. */
export function AddToHomeButton() {
  const state = useInstallState();
  const { start, steps } = useAddToHome(state);
  if (!canOfferInstall(state)) return null;
  return (
    <>
      <button
        type="button"
        onClick={start}
        className="flex items-center gap-1.5 rounded-full border border-brite-tan/25 bg-brite-black-soft/70 px-3 py-1.5 text-xs font-semibold text-brite-cream hover:border-brite-tan/60"
      >
        <PhoneIcon />
        Add to Home Screen
      </button>
      {steps}
    </>
  );
}

/** A quiet link at the bottom of the schedule, for anyone who skipped it at login. */
export function InstallAppLink() {
  const state = useInstallState();
  const { start, steps } = useAddToHome(state);
  if (!canOfferInstall(state)) return null;
  return (
    <>
      <button
        type="button"
        onClick={start}
        className="mx-auto mt-8 flex items-center gap-1.5 text-xs font-semibold text-brite-tan/40 hover:text-brite-tan"
      >
        <PhoneIcon />
        Add Britestar to your home screen
      </button>
      {steps}
    </>
  );
}

/** Help for devices with no install button we can trigger. */
function InstallSteps({ platform, onClose }: { platform: "ios" | "manual"; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="install-steps-title">
      <div className="text-left">
        <h2 id="install-steps-title" className="text-base font-bold text-brite-white">
          Add Britestar to your home screen
        </h2>
        <p className="mt-1 text-xs text-brite-tan/55">Takes about 10 seconds. You only do this once.</p>
        {platform === "ios" ? (
          <ol className="mt-4 flex flex-col gap-3">
            <Step n={1}>
              Tap the <strong className="text-brite-white">Share</strong> button <ShareIcon />
              <span className="mt-0.5 block text-xs text-brite-tan/50">
                Safari: in the toolbar, or inside the <strong>⋯</strong> menu on newer iPhones. Chrome: at the top
                right.
              </span>
            </Step>
            <Step n={2}>
              Scroll down and tap <strong className="text-brite-white">Add to Home Screen</strong>{" "}
              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-brite-tan/40 align-middle text-xs">
                +
              </span>
            </Step>
            <Step n={3}>
              Tap <strong className="text-brite-white">Add</strong>, then open Britestar from your home screen and
              log in there.
            </Step>
          </ol>
        ) : (
          <ol className="mt-4 flex flex-col gap-3">
            <Step n={1}>
              Open your browser's menu: usually <strong className="text-brite-white">⋮</strong> or{" "}
              <strong className="text-brite-white">☰</strong>, at the top or bottom of the screen.
            </Step>
            <Step n={2}>
              Tap <strong className="text-brite-white">Add to Home screen</strong> or{" "}
              <strong className="text-brite-white">Install app</strong>.
            </Step>
            <Step n={3}>Confirm, then open Britestar from your home screen and log in there.</Step>
          </ol>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg border border-brite-tan/30 py-2.5 text-sm font-semibold text-brite-cream hover:border-brite-tan"
        >
          Got it
        </button>
      </div>
    </Sheet>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-brite-cream">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brite-red text-xs font-bold text-brite-white">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

/** Apple's share glyph: a box with an arrow coming up out of it. */
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-5 w-5 align-[-4px] text-sky-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share icon">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  );
}
