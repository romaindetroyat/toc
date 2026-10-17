import { type Browser, expect, type Page, type TestInfo, test } from "@playwright/test";
import { createTable, deviceOptions, join, seatTile } from "./online.ts";

// The table's « Avance rapide » (plan 02-10b, Romain 2026-10-17: « Oui, ajoute l’avance rapide »).
// Only the chef de table switches it, in « Réglages »; everyone else sees the switch disabled. Once on,
// every page shows the badge on the « Réglages » gear, and the others read the toast « Ana a mis
// l’avance rapide. »; switched off, the badge goes and the toast says so.

const toast = (page: Page) => page.locator("[data-toast]");
const gear = (page: Page) => page.locator("[data-settings-slot] button").first();
const badge = (page: Page) => page.locator("[data-fast-badge]");
const settingsSheet = (page: Page) => page.getByRole("dialog", { name: "Réglages" });
const fastSwitch = (page: Page) =>
  settingsSheet(page).getByRole("switch", { name: "Avance rapide" });

async function device(browser: Browser, testInfo: TestInfo) {
  const context = await browser.newContext(deviceOptions(testInfo));
  return { context, page: await context.newPage() };
}

/**
 * Saves a screenshot when TOC_SHOTS names a directory: the computer's page at its 1280 x 800, a
 * phone's page at 844 x 390 (then back to its own size).
 */
async function shot(page: Page, name: string): Promise<void> {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?.env;
  const dir = env?.TOC_SHOTS;
  if (!dir) return;
  const own = page.viewportSize();
  const size = own !== null && own.width >= 1000 ? own : { width: 844, height: 390 };
  if (own !== size) await page.setViewportSize(size);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${dir}/02-10b-${name}-${size.width}x${size.height}.png` });
  if (own !== null && own !== size) {
    await page.setViewportSize(own);
    await page.waitForTimeout(200);
  }
}

async function closeSettings(page: Page): Promise<void> {
  await settingsSheet(page).getByRole("button", { name: "Fermer" }).click();
  await expect(settingsSheet(page)).toHaveCount(0);
}

test("the chef de table switches « Avance rapide » for the whole table; everyone sees it", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const id = await createTable(request, { pace: "zero" });
  const { page: ana } = await device(browser, testInfo);
  const { page: bea } = await device(browser, testInfo);

  await join(ana, id, "Ana");
  await seatTile(ana, "bleu").click();
  await expect(seatTile(ana, "bleu")).toHaveAttribute("data-seat-state", "you");
  await join(bea, id, "Bea");
  await seatTile(bea, "jaune").click();
  await expect(seatTile(bea, "jaune")).toHaveAttribute("data-seat-state", "you");

  // The waiting room: off by default; Bea's switch shows it, disabled, and names the chef de table.
  await gear(bea).click();
  await expect(fastSwitch(bea)).toBeDisabled();
  await expect(fastSwitch(bea)).toHaveAttribute("aria-checked", "false");
  await expect(settingsSheet(bea)).toContainText("Seul le chef de table, Ana, peut la changer.");
  await closeSettings(bea);
  await expect(badge(bea)).toHaveCount(0);

  await ana.getByRole("button", { name: "Lancer la partie" }).click();
  for (const page of [ana, bea]) {
    await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
    await expect(badge(page)).toHaveCount(0);
  }

  // In the game Ana switches it on from « Réglages ».
  await gear(ana).click();
  await expect(fastSwitch(ana)).toBeEnabled();
  await fastSwitch(ana).click();
  await expect(fastSwitch(ana)).toHaveAttribute("aria-checked", "true");
  await shot(ana, "reglages");
  await closeSettings(ana);

  await expect(badge(bea)).toBeVisible();
  await expect(toast(bea)).toContainText("Ana a mis l’avance rapide.");
  await expect(gear(bea)).toHaveAccessibleName("Réglages (avance rapide pour toute la table)");
  await expect(badge(ana)).toBeVisible();
  await expect(toast(ana)).not.toContainText("avance rapide");
  await shot(bea, "badge");

  // Bea's switch follows the table, still disabled.
  await gear(bea).click();
  await expect(fastSwitch(bea)).toHaveAttribute("aria-checked", "true");
  await expect(fastSwitch(bea)).toBeDisabled();
  await closeSettings(bea);

  // Off again: the badge goes on both pages, Bea reads it.
  await gear(ana).click();
  await fastSwitch(ana).click();
  await closeSettings(ana);
  await expect(toast(bea)).toContainText("Ana a enlevé l’avance rapide.");
  for (const page of [ana, bea]) await expect(badge(page)).toHaveCount(0);
});
