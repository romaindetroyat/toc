// Compile-time debug switch, defined in vite.config.ts. True in the dev server and in builds made
// with VITE_TOC_DEBUG=1 (the e2e build); false in production, where every `if (DEBUG)` branch
// is removed by the minifier. Debug-only modules must be loaded with a dynamic import() inside
// a branch that tests `__TOC_DEBUG__` itself (not the re-exported `DEBUG`): the bundler only drops
// the module from dist when the condition is a literal at tree-shaking time.
declare global {
  /** Same compile-time switch as `DEBUG`, readable without importing this module. */
  const __TOC_DEBUG__: boolean;

  interface Window {
    __tocDebug?: {
      audio: {
        scheduled: number[];
        history: number[][];
        /** Every sound other than the clops that the game asked for: id, audio-clock time, request time. */
        cues?: { id: string; at: number; requestedAt: number }[];
        /** Rendered synthesized sounds, keyed `recipe#variant`: duration in seconds and peak amplitude. */
        sounds?: Record<string, { duration: number; peak: number }>;
        /** The bus gains the last mix asked for: 0 or 1 for master and effects, 0..1 for the ambience. */
        gains?: { master: number; sfx: number; ambience: number };
        /** What the game last asked of the ambience: started, paused with the tab, or stopped. */
        ambience?: "on" | "paused" | "off";
      };
    };
  }
}

export const DEBUG: boolean = __TOC_DEBUG__;
