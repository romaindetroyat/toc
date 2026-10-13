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
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
