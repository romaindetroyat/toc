import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [svelte()],
  // `vite dev` next to `wrangler dev` (port 8787): the table's API and sockets go to the Worker. The
  // Worker refuses a socket from another origin (T-02-03), so the proxy presents the Worker's own.
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        headers: { origin: "http://localhost:8787" },
      },
      "/ws": {
        target: "http://localhost:8787",
        ws: true,
        changeOrigin: true,
        headers: { origin: "http://localhost:8787" },
      },
    },
  },
  define: {
    // Compile-time debug switch: dev server, or VITE_TOC_DEBUG=1 at build time (the e2e build).
    // Production builds drop every `if (DEBUG)` branch.
    __TOC_DEBUG__: JSON.stringify(mode === "development" || process.env.VITE_TOC_DEBUG === "1"),
  },
}));
