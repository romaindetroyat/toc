// The step change of the sign-up and the recovery (plan 04-09; 04-UI-SPEC « Motion »): the new step
// fades in over 200 ms, coming 12 px from the right; under reduced motion (the setting, or the
// system's preference before it was ever set) a 150 ms fade. Only opacity and transform.

import type { TransitionConfig } from "svelte/transition";
import { settings } from "../settings/store.svelte.ts";

function reduced(): boolean {
  if (settings.reduceMotion) return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function stepIn(_node: Element): TransitionConfig {
  if (reduced()) return { duration: 150, css: (t) => `opacity: ${t}` };
  return {
    duration: 200,
    css: (t) => `opacity: ${t}; transform: translateX(${(1 - t) * 12}px)`,
  };
}

/**
 * A list row that comes or goes (plan 04-10; 04-UI-SPEC « Motion »: list row removed / added): a
 * 150 ms fade; instant under reduced motion.
 */
export function rowFade(_node: Element): TransitionConfig {
  if (reduced()) return { duration: 0 };
  return { duration: 150, css: (t) => `opacity: ${t}` };
}
