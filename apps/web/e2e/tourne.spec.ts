import { expect, type Page, test } from "@playwright/test";

// « Tourne ton téléphone » (UI-SPEC addendum « Plateau galet », item 5, plan 01-38; the copy and the
// waiting computer players are derived, « à confirmer par Romain »). Romain asked for « paysage
// obligatoire » and Safari cannot lock the orientation: every screen taller than wide shows an
// invitation to turn it instead of the game, which waits behind it, hidden and inert, exactly as it
// was. The phone project is Playwright's iPhone 13 held sideways; turning it upright is a resize of
// its window to 390 x 664 (the window Playwright gives the iPhone 13 held upright).

/** R-07.1: Bleu holds only the Dame de cœur, bleu0 three cells from its exit; the Dame takes it to ring:15. */
const R071 = "/#/partie?scenario=R-07.1";
const PORTRAIT = { width: 390, height: 664 };
const PHONE_TITLE = "Tourne ton téléphone";
const WINDOW_TITLE = "Élargis la fenêtre";
const BODY = "La partie t’attend. Elle reprend dès que l’écran est en largeur.";

/** The window the project was configured with (the phone's: 750 x 342 with Playwright 1.64). */
function configured(): { width: number; height: number } {
  const viewport = test.info().project.use.viewport;
  if (!viewport) throw new Error("the project has no viewport");
  return viewport;
}

/**
 * How far a knight's anchor (its outer translate(x y)) is from the centre of the drawn cell, in scene
 * units: both are read in the scene's own coordinates (the attribute and getBBox()). The board must be
 * displayed (getBBox() of a node that is not rendered is empty).
 */
async function offCell(page: Page, pawn: string, cell: number): Promise<number> {
  return page.evaluate(
    ([id, index]) => {
      const knight = document.querySelector(`[data-pawn="${id}"]`);
      const drawn = document.querySelector<SVGGraphicsElement>(
        `[data-board-art] [data-cell="${index}"]`,
      );
      if (!knight || !drawn) throw new Error(`no knight ${id} or no cell ${index}`);
      const match = /translate\(\s*([-\d.e]+)[\s,]+([-\d.e]+)\s*\)/.exec(
        knight.getAttribute("transform") ?? "",
      );
      if (!match) throw new Error(`knight ${id} has no translate()`);
      const box = drawn.getBBox();
      return Math.hypot(
        Number(match[1]) - (box.x + box.width / 2),
        Number(match[2]) - (box.y + box.height / 2),
      );
    },
    [pawn, cell] as const,
  );
}

const prompt = (page: Page) => page.locator("[data-rotate-prompt]");
const wrapperInert = (page: Page) =>
  page.locator("[data-game-play]").evaluate((node) => (node as HTMLElement).inert);

/** The Dame, bleu0, « Jouer »: bleu0 lands on ring:15. */
async function playDame(page: Page) {
  await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
  await expect(page.locator('[data-halo="bleu0"]')).toBeVisible();
  await page.locator('[data-hit="bleu0"]').click();
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
}

test.describe("le téléphone tenu debout", () => {
  test.skip(({ isMobile }) => !isMobile, "the phone project");

  test("traceur : l’invitation à tourner remplace le plateau, et la partie revient telle quelle", async ({
    page,
  }) => {
    const landscape = configured();
    expect(landscape.width, "the phone project is held sideways").toBeGreaterThan(landscape.height);
    await page.goto("/");
    await page.goto(`${R071}&vitesse=test`);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expect(page.locator("[data-board]")).toBeVisible();
    await expect(prompt(page)).toHaveCount(0);
    await expect(page.locator("main.game")).toHaveAttribute("data-chrome", "compact-bar");

    await playDame(page);
    await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:15");

    // Held upright: the invitation, its heading focused, and no game to be seen or reached.
    await page.setViewportSize(PORTRAIT);
    const heading = page.getByRole("heading", { name: PHONE_TITLE });
    await expect(heading).toBeVisible();
    await expect(page.getByText(BODY)).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText(WINDOW_TITLE)).toBeHidden();
    await expect(page.locator("main.game")).toHaveAttribute("data-chrome", "rotate");
    await expect(page.locator("[data-board]")).toBeHidden();
    await expect(page.locator("[data-hand]")).toBeHidden();
    await expect(page.locator("[data-action-zone]")).toBeHidden();
    expect(await wrapperInert(page), "the game's wrapper is inert").toBe(true);

    // Held sideways again: the same game, bleu0 still on the drawn cell 15.
    await page.setViewportSize(landscape);
    await expect(prompt(page)).toHaveCount(0);
    await expect(page.locator("[data-board]")).toBeVisible();
    expect(await wrapperInert(page)).toBe(false);
    await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:15");
    await expect.poll(() => offCell(page, "bleu0", 15)).toBeLessThanOrEqual(0.5);
  });
});

test.describe("la fenêtre d’ordinateur plus haute que large", () => {
  test.skip(({ isMobile }) => isMobile, "the desktop project");

  test("« Élargis la fenêtre », puis la partie revient", async ({ page }) => {
    await page.goto("/");
    await page.goto(`${R071}&vitesse=test`);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expect(prompt(page)).toHaveCount(0);

    await page.setViewportSize({ width: 800, height: 1000 });
    const heading = page.getByRole("heading", { name: WINDOW_TITLE });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText(PHONE_TITLE)).toBeHidden();
    await expect(page.getByText(BODY)).toBeVisible();
    await expect(page.locator("[data-board]")).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(prompt(page)).toHaveCount(0);
    await expect(page.locator("[data-board]")).toBeVisible();
    await expect(page.locator("main.game")).toHaveAttribute("data-chrome", "bar");
    await expect(page.getByRole("button", { name: "Dame de cœur, jouable" })).toBeVisible();
  });
});
