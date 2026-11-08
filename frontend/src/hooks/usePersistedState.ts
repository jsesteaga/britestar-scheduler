import { useEffect, useState } from "react";

type Next<T> = T | ((current: T) => T);

/**
 * useState that also saves every change (via `save`, e.g. to localStorage).
 * Needed because logging out unmounts the schedule page — plain state would
 * reset to the defaults the next time it mounts.
 *
 * Also keeps every open tab in sync with what the others save.
 *
 * Returns [value, set, setWithoutSaving]; the last is for the rare case of
 * updating state that's already been saved some other way.
 */
export function usePersistedState<T>(load: () => T, save: (value: T) => void) {
  const [value, setRaw] = useState<T>(load);

  // Another tab (say, the manager view and a bartender view side by side)
  // saved something: pick it up, so this tab never saves stale data back
  // over it. The "storage" event only fires for changes from OTHER tabs.
  useEffect(() => {
    const reload = () => setRaw(load());
    window.addEventListener("storage", reload);
    return () => window.removeEventListener("storage", reload);
  }, [load]);

  function set(next: Next<T>) {
    setRaw((current) => {
      const resolved = typeof next === "function" ? (next as (c: T) => T)(current) : next;
      save(resolved);
      return resolved;
    });
  }

  return [value, set, setRaw] as const;
}
