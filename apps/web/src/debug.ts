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
        /** Rendered synthesized sounds, keyed `recipe#variant`: duration in seconds and peak amplitude. */
        sounds?: Record<string, { duration: number; peak: number }>;
      };
    };
  }
}

export const DEBUG: boolean = __TOC_DEBUG__;
