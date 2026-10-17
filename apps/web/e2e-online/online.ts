import {
  type APIRequestContext,
  type BrowserContextOptions,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { playSimpleMove, snapshot } from "../e2e/jouer.ts";

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

/** The project's device settings, for a new browser context (its own storage, so its own device). */
export function deviceOptions(testInfo: TestInfo): BrowserContextOptions {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } =
    testInfo.project.use;
  return { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL };
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

/**
 * Where every knight stands, by its logical place (the same on every screen, whatever its turn), in
 * knight order: each board draws its knights in its own front-to-back order.
 */
export function knightPlaces(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll("[data-pawn]")]
        .map((knight) => [
          knight.getAttribute("data-pawn") ?? "",
          knight.getAttribute("data-place") ?? "",
        ])
        .sort(([a], [b]) => (a as string).localeCompare(b as string)),
    ),
  );
}

/** What the felt shows: the face-up cards (played, posed) and the size of the discard pile. */
export function feltCards(page: Page): Promise<{ cards: string[]; discard: string | null }> {
  return page.evaluate(() => ({
    cards: [...document.querySelectorAll("[data-felt-card]")]
      .map((card) => card.getAttribute("data-felt-card") ?? "")
      .sort(),
    discard: document.querySelector("[data-discard]")?.getAttribute("data-discard") ?? null,
  }));
}

/** The whole table as one comparable text: the knights and the felt. */
export async function tablePicture(page: Page): Promise<string> {
  return JSON.stringify({ knights: await knightPlaces(page), felt: await feltCards(page) });
}

/** Plays one move of the page whose turn it is: a simple card, else the first playable thing. */
export async function playOneMove(page: Page): Promise<void> {
  const s = await snapshot(page);
  if (s.state === "deadHand") {
    await page.getByRole("button", { name: "Poser mes cartes" }).click();
    return;
  }
  const simple = page.locator(
    '[data-hand] [data-state="playable"]:not([data-card^="7"]):not([data-card^="11"])',
  );
  if ((await simple.count()) > 0) {
    await playSimpleMove(page);
    return;
  }
  // Only a 7 or a Valet: take it through to « Jouer », the first knight and the largest step each time.
  await page.locator(`[data-hand] [data-card="${s.playable[0]}"]`).click();
  for (let i = 0; i < 200; i++) {
    const now = await snapshot(page);
    if (now.state !== "sevenBuilding" && now.state !== "cardSelected" && !now.seven) {
      if (now.state === "preview") {
        await page.getByRole("button", { name: /^Jouer/ }).click();
        return;
      }
      if (now.state === "modeChoice") await page.locator("button[data-mode]").first().click();
      else if (now.state === "tray") await page.locator("[data-tray-option]").first().click();
      else if (now.halos.length > 0)
        await page.locator(`[data-hit="${now.halos[0]}"]`).click({ force: true });
      else await page.waitForTimeout(20);
      continue;
    }
    if (now.done) {
      await page.getByRole("button", { name: "Jouer", exact: true }).click();
      return;
    }
    if (now.tray.length > 0) await page.locator("[data-tray-option]").first().click();
    else if (now.chips.length > 0)
      await page.locator(`[data-seven-chips] [data-step="${Math.max(...now.chips)}"]`).click();
    else if (now.halos.length > 0)
      await page.locator(`[data-hit="${now.halos[0]}"]`).click({ force: true });
    else await page.waitForTimeout(20);
  }
  throw new Error("the move never finished");
}
