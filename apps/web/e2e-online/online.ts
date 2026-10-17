import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";

// Shared helpers of the online specs: a table created through the Worker, a browser that opens its link
// and types a first name, the seat tiles of the waiting room.

/** POST /api/tables; `test` is honoured because `wrangler dev` runs with TOC_TEST_MODE=1. */
export async function createTable(
  request: APIRequestContext,
  test: { pace: "zero" | "normal" } = { pace: "zero" },
): Promise<string> {
  const response = await request.post("/api/tables", { data: { test } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  return id;
}

/** A new browser (its own storage, so its own device) with the project's device settings. */
export function newDevice(browser: Browser, testInfo: TestInfo): Promise<BrowserContext> {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } =
    testInfo.project.use;
  return browser.newContext({
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    baseURL,
  });
}

export const seatTile = (page: Page, couleur: string) =>
  page.locator(`[data-seat-tile="${couleur}"]`);

/** Opens the table's link (test pace), types the first name once, and waits for the waiting room. */
export async function join(page: Page, id: string, name: string): Promise<void> {
  await page.goto("/");
  await page.goto(`/#/table/${id}?vitesse=test`);
  const prompt = page.locator("[data-name-prompt]");
  await expect(prompt).toBeVisible();
  await prompt.getByRole("textbox").fill(name);
  await prompt.getByRole("button", { name: "Continuer" }).click();
  await expect(seatTile(page, "bleu")).toBeVisible();
}

/** Where every knight stands, by its logical place (the same on every screen, whatever its turn). */
export function knightPlaces(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll("[data-pawn]")].map((knight) => [
        knight.getAttribute("data-pawn") ?? "",
        knight.getAttribute("data-place") ?? "",
      ]),
    ),
  );
}
