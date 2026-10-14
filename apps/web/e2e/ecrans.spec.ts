import { expect, type Page, test } from "@playwright/test";

// The computer's screen (UI-SPEC addendum « Plateau galet », items 6 and 7, plan 01-36): from 960 x 600
// held sideways the landscape galet spans the width and one 160 px bar under it holds the info at the
// left, the hand in the middle and the action zone at the right. Explicit viewports in Playwright's
// Chromium emulation (safe-area insets 0), so the desktop project only.

/** The bar's height (the regular fan's box: an 88 x 124 card + 36 px). */
const BAR = 160;
/** The landscape galet: 1600 / 3200 tall, and the head room of a lifted top-row knight above it. */
const RATIO = 0.5;
const HEAD_ROOM = 0.02166;

/**
 * The board's width in the bar mode: min(100vw − 32 px, (100dvh − 160 px) / (0.5 + head room),
 * 1600 px), the insets being 0 here.
 */
function barWidth(width: number, height: number): number {
  return Math.min(width - 32, (height - BAR) / (RATIO + HEAD_ROOM), 1600);
}

/**
 * How far a knight's anchor (its outer translate(x y)) is from the centre of the drawn cell, in scene
 * units: both are read in the scene's own coordinates (the attribute and getBBox()).
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

/** The document never scrolls, either way. */
async function expectNoScroll(page: Page, what: string) {
  const size = page.viewportSize();
  if (!size) throw new Error("no viewport");
  const doc = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }));
  expect(doc.width, `${what}: the page scrolls sideways`).toBeLessThanOrEqual(size.width);
  expect(doc.height, `${what}: the page scrolls down`).toBeLessThanOrEqual(size.height);
}

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(page: Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector}`);
  return box;
}

/** The board's width, measured, after checking it is the 2:1 galet. */
async function boardWidth(page: Page): Promise<number> {
  const board = await boxOf(page, "[data-board]");
  expect(Math.abs(board.height - board.width / 2), "the board is 2:1").toBeLessThanOrEqual(1.5);
  return board.width;
}

/**
 * The bar: the info, the hand (or the 7 assistant) and the action zone lie under the board, inside the
 * screen, within one band at most 161 px high at the bottom, from left to right in that order.
 */
async function expectBar(page: Page, what: string, zones: string[]) {
  const size = page.viewportSize();
  if (!size) throw new Error("no viewport");
  const board = await boxOf(page, "[data-board]");
  const boxes = [];
  for (const selector of zones) boxes.push({ selector, box: await boxOf(page, selector) });
  const top = Math.min(...boxes.map(({ box }) => box.y));
  const bottom = Math.max(...boxes.map(({ box }) => box.y + box.height));
  expect(bottom - top, `${what}: the bar is one band`).toBeLessThanOrEqual(BAR + 1);
  for (const { selector, box } of boxes) {
    expect(box.y, `${what}: ${selector} under the board`).toBeGreaterThanOrEqual(
      board.y + board.height - 0.5,
    );
    expect(box.x, `${what}: ${selector} inside the screen`).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width, `${what}: ${selector} inside the screen`).toBeLessThanOrEqual(
      size.width + 0.5,
    );
    expect(box.y + box.height, `${what}: ${selector} inside the screen`).toBeLessThanOrEqual(
      size.height + 0.5,
    );
  }
  for (let i = 1; i < boxes.length; i++) {
    const before = boxes[i - 1];
    const after = boxes[i];
    if (!before || !after) continue;
    expect(
      after.box.x,
      `${what}: ${after.selector} right of ${before.selector}`,
    ).toBeGreaterThanOrEqual(before.box.x + before.box.width - 0.5);
  }
}

test.describe("sur ordinateur, le galet en largeur et la barre du bas", () => {
  test.skip(({ isMobile }) => isMobile, "explicit viewports: the desktop project only");
  test.use({ viewport: { width: 1280, height: 800 } });

  test("traceur : à 1280 × 800, la barre tient l’info, la main et « Jouer », et la Dame se joue", async ({
    page,
  }) => {
    await page.goto("/");
    await page.goto("/#/partie?scenario=R-07.1");
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expect(page.locator("main.game")).toHaveAttribute("data-chrome", "bar");

    // min(1280 − 32, (800 − 160) / 0.52166, 1600) ≈ 1226.9: height-limited, a step of about 41 px.
    const expected = barWidth(1280, 800);
    const width = await boardWidth(page);
    expect(width).toBeGreaterThanOrEqual(1200);
    expect(
      Math.abs(width - expected),
      `measured ${width}, formula ${expected}`,
    ).toBeLessThanOrEqual(2);

    const zones = ["[data-info-bar]", "[data-hand]", "[data-action-zone]"];
    await expectBar(page, "à toi de jouer", zones);
    const gear = await boxOf(page, "[data-settings-slot] button");
    expect(gear.width).toBeGreaterThanOrEqual(44);
    expect(gear.height).toBeGreaterThanOrEqual(44);
    await expectNoScroll(page, "à toi de jouer");

    // The Dame, the knight, « Jouer »: bleu0 hops from cell 3 to cell 15.
    await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
    await expect(page.locator('[data-halo="bleu0"]')).toBeVisible();
    await expectBar(page, "carte choisie", zones);
    await page.locator('[data-hit="bleu0"]').click();
    await expect(page.locator("[data-ghost]")).toBeVisible();
    const play = page.getByRole("button", { name: "Jouer", exact: true });
    await expect(play).toBeVisible();
    await expectBar(page, "aperçu du coup", zones);
    // « Jouer » lies inside the action zone, in the bar.
    const button = await play.boundingBox();
    const action = await boxOf(page, "[data-action-zone]");
    if (!button) throw new Error("no box for « Jouer »");
    expect(button.x).toBeGreaterThanOrEqual(action.x - 0.5);
    expect(button.x + button.width).toBeLessThanOrEqual(action.x + action.width + 0.5);
    expect(button.y + button.height).toBeLessThanOrEqual(action.y + action.height + 0.5);
    await expectNoScroll(page, "aperçu du coup");
    await play.click();

    await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:15");
    await expect.poll(() => offCell(page, "bleu0", 15)).toBeLessThanOrEqual(0.5);
    await expect(page.locator('[data-felt-last="bleu"] [data-felt-card]')).toBeVisible();
    await expectNoScroll(page, "après le coup");
  });
});
