import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { deviceOptions } from "./online.ts";

// Shared helpers of the account specs (plan 04-01): an invitation minted through the test-only route,
// a browser context with Playwright's virtual passkey authenticator, and the whole sign-up from the
// invitation link to the home.

/**
 * TEST-ONLY values passed to `wrangler dev` by playwright.online.config.ts (--var). They are not the
 * production secrets, which exist only as Worker secrets (wrangler secret put) and are never committed.
 */
export const TEST_PEPPER = "test-only-pepper-not-a-secret-0123456789";
/** TEST-ONLY bootstrap code (22 base64url characters, the shape of an invitation code). */
export const TEST_BOOTSTRAP = "TestOnlyBootstrap00000";

export const BASE_URL = "http://localhost:8787";

/** POST /api/test/invitation (TOC_TEST_MODE only): a fresh invitation, or a used or expired one. */
export async function mintInvitation(
  request: APIRequestContext,
  options: { used?: boolean; expired?: boolean } = {},
): Promise<string> {
  const response = await request.post("/api/test/invitation", {
    data: options,
    headers: { Origin: BASE_URL },
  });
  expect(response.status()).toBe(201);
  const { code } = (await response.json()) as { code: string };
  expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
  return code;
}

/** A pseudo no other run has taken (the local D1 keeps its accounts between runs). */
export function uniquePseudo(prefix: string): string {
  const letters = "abcdefghijkmnpqrstuvwxyz";
  let tail = "";
  for (let i = 0; i < 6; i++) tail += letters[Math.floor(Math.random() * letters.length)];
  return `${prefix} ${tail}`.slice(0, 20);
}

/** A new browser context of the project's device, with the virtual passkey authenticator installed. */
export async function passkeyContext(
  browser: Browser,
  testInfo: TestInfo,
): Promise<BrowserContext> {
  const context = await browser.newContext(deviceOptions(testInfo));
  await context.credentials.install();
  return context;
}

/**
 * The whole sign-up from the invitation link: the pseudo, « Créer mon compte », the code screen,
 * « J’ai gardé mon code », « Oui, je l’ai gardé », and the home with « Mon compte ». Answers the code.
 */
export async function signUp(page: Page, code: string, pseudo: string): Promise<string> {
  await page.goto(`/#/invitation/${code}`);
  const form = page.locator("[data-pseudo-form]");
  await expect(form).toBeVisible();
  await form.getByRole("textbox").fill(pseudo);
  await form.getByRole("button", { name: "Créer mon compte" }).click();
  const screen = page.locator("[data-backup-code]");
  await expect(screen).toBeVisible();
  const shown = (await screen.locator("[data-code]").innerText()).replace(/\s/g, "");
  await screen.getByRole("button", { name: "J’ai gardé mon code" }).click();
  const confirm = page.getByRole("dialog", { name: /^Tu as bien gardé ton code\s\?$/ });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Oui, je l’ai gardé" }).click();
  await expect(page.locator('[data-small-tile="compte"]')).toBeVisible();
  return shown;
}
