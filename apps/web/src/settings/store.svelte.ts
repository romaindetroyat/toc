// Reactive settings for the whole app. The storage is read once at start; every change is written
// back. When storage is unavailable the value stays in memory and nothing is shown (UI-SPEC).

import {
  loadSettings,
  parseSettings,
  type Settings,
  type StorageLike,
  saveSettings,
} from "./settings.ts";

/** localStorage, or null when even touching it throws (blocked cookies, some private modes). */
function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const storage = browserStorage();

export const settings: Settings = $state(loadSettings(storage, prefersReducedMotion()));

/** Applies a change to the settings and persists it. */
export function updateSettings(patch: Partial<Settings>): void {
  // Re-validated as a whole, so a caller cannot store an out-of-range volume or an unknown colour.
  const next = parseSettings({ ...$state.snapshot(settings), ...patch }, settings.reduceMotion);
  Object.assign(settings, next);
  saveSettings(storage, next);
}
