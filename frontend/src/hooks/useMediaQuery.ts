import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query currently matches, e.g. "(min-width: 1280px)",
 * updating live as the window resizes. For when a layout difference is more
 * than CSS can do — like rendering a different component altogether.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
