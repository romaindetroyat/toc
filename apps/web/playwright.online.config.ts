import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { TEST_BOOTSTRAP, TEST_PEPPER, TEST_VAPID } from "./e2e-online/comptes.ts";

// The online table, end to end: the app built with the debug switch, served by `wrangler dev` with the
// Worker, the GameRoom Durable Object and its SQLite storage on one origin (02-RESEARCH « Validation
// Map »). TOC_TEST_MODE=1 lets a test create a table whose computer players play at once.
// Same Chromium fallback and the same two projects as playwright.config.ts.
// Plan 04-01: the local D1 gets its migrations first (--local only: nothing remote), and the Worker
// gets fixed TEST-ONLY values of the two account secrets (e2e-online/comptes.ts). Plan 04-07: and the
// TEST-ONLY VAPID pair of Web Push (TEST_VAPID, never deployed).
const FALLBACK_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath =
  process.env.CHROMIUM_PATH || (fs.existsSync(FALLBACK_CHROMIUM) ? FALLBACK_CHROMIUM : undefined);

export default defineConfig({
  testDir: "e2e-online",
  webServer: {
    // Run from the repository root, where wrangler.jsonc lives.
    command:
      "VITE_TOC_DEBUG=1 pnpm --filter @toc/web build && cd ../.. && " +
      "CI=1 WRANGLER_SEND_METRICS=false pnpm exec wrangler d1 migrations apply toc --local -c wrangler.jsonc && " +
      "WRANGLER_SEND_METRICS=false pnpm exec wrangler dev -c wrangler.jsonc --port 8787 --var TOC_TEST_MODE:1 " +
      `--var TOC_PEPPER:${TEST_PEPPER} --var TOC_BOOTSTRAP:${TEST_BOOTSTRAP} ` +
      `--var VAPID_PRIVATE_KEY:${TEST_VAPID} --show-interactive-dev-session=false`,
    port: 8787,
    reuseExistingServer: true,
    timeout: 180_000,
  },
  use: {
    baseURL: "http://localhost:8787",
    launchOptions: { executablePath, args: ["--no-sandbox"] },
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["iPhone 13 landscape"], defaultBrowserType: "chromium" },
    },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
});
