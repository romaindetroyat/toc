import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [svelte()],
  define: {
    // Compile-time debug switch: dev server, or VITE_TOC_DEBUG=1 at build time (the e2e build).
    // Production builds drop every `if (DEBUG)` branch.
    __TOC_DEBUG__: JSON.stringify(mode === "development" || process.env.VITE_TOC_DEBUG === "1"),
  },
}));
