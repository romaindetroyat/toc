// Compile-time debug switch, defined in vite.config.ts. True in the dev server and in builds made
// with VITE_TOC_DEBUG=1 (the e2e build); false in production, where every `if (DEBUG)` branch
// is removed by the minifier. Debug-only modules must be loaded with a dynamic import() inside
// such a branch.
declare const __TOC_DEBUG__: boolean;

declare global {
  interface Window {
    __tocDebug?: {
      audio: { scheduled: number[]; history: number[][] };
    };
  }
}

export const DEBUG: boolean = __TOC_DEBUG__;
