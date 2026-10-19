import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// The installable app, service workers ALLOWED (plan 04-08, 04-RESEARCH Pitfall 8): every other suite
// blocks them (playwright.config.ts, playwright.online.config.ts); this one checks the registration,
// the offline start with the solo game, the update prompt and the push display. The debug build is
// served by `vite preview` on its own port (no Worker needed); the update test serves a copy of the
// build from its own small server. Same Chromium fallback and the same two projects as the others.
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath =
  process.env.CHROMIUM_PATH || (fs.existsSync(FALLBACK_CHROMIUM) ? FALLBACK_CHROMIUM : undefined);

export default defineConfig({
  testDir: "e2e-pwa",
  webServer: {
    command:
      "VITE_TOC_DEBUG=1 pnpm --filter @toc/web build && pnpm --filter @toc/web preview --port 4174 --strictPort",
    port: 4174,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:4174",
    launchOptions: { executablePath, args: ["--no-sandbox"] },
    serviceWorkers: "allow",
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["iPhone 13 landscape"], defaultBrowserType: "chromium" },
    },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
