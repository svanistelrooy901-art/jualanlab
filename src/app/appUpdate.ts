import { useSyncExternalStore } from 'react';

/**
 * A new version of the app has been downloaded and is waiting. The page is never reloaded behind the user's back
 * (that could interrupt a save); the banner asks first. Set from src/main.tsx.
 */
let waiting = false;
let apply: (() => void) | null = null;
const listeners = new Set<() => void>();

export function setUpdateWaiting(applyUpdate: () => void): void {
  waiting = true;
  apply = applyUpdate;
  listeners.forEach((l) => l());
}

export function applyAppUpdate(): void {
  apply?.();
}

export function useUpdateWaiting(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => waiting,
  );
}
