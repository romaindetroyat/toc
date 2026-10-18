import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  plugins: [
    svelte(),
    // The installable app (plan 04-08, D-09, 04-RESEARCH Pattern 8): our own service worker src/sw.ts,
    // built into dist/sw.js with the precache list injected. The update waits for the player
    // (registerType prompt, no automatic skipWaiting); src/pwa/update.svelte.ts registers it, and the
    // manifest stays public/manifest.webmanifest. The bench and the debug chunks are not precached,
    // nor the iOS splash images (iOS reads them when the app is added, not offline).
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2,ico,webmanifest}"],
        globIgnores: ["**/Bench-*", "**/DebugGeometry-*", "**/debugParams-*", "splash/**"],
      },
      devOptions: { enabled: false },
    }),
  ],
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
