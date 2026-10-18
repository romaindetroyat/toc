import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Chromium comes preinstalled in the container (no browser download): CHROMIUM_PATH wins,
// then the known container path, else Playwright's own browser.
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath =
  process.env.CHROMIUM_PATH || (fs.existsSync(FALLBACK_CHROMIUM) ? FALLBACK_CHROMIUM : undefined);

export default defineConfig({
  testDir: "e2e",
  webServer: {
    command:
      "VITE_TOC_DEBUG=1 pnpm --filter @toc/web build && pnpm --filter @toc/web preview --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:4173",
    launchOptions: { executablePath, args: ["--no-sandbox"] },
    // Plan 04-08 (04-RESEARCH Pitfall 8): no service worker in these suites, so a precache never serves
    // an old build between runs; playwright.pwa.config.ts is the one suite that allows them.
    serviceWorkers: "block",
  },
  projects: [
    // Romain's « paysage obligatoire » (2026-10-14): the phone is played held sideways, so the phone
    // project is Playwright's iPhone 13 held sideways, a 750 x 342 window with touch and a mobile
    // viewport (Playwright 1.64). Held upright it shows « Tourne ton téléphone » (e2e/tourne.spec.ts).
    {
      name: "phone",
      use: { ...devices["iPhone 13 landscape"], defaultBrowserType: "chromium" },
    },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
