import { devices, expect, type Page, test } from "@playwright/test";
import { zone } from "./jouer.ts";

// The compact bar (UI-SPEC addendum « Plateau galet », items 8 to 10, plan 01-37, « à confirmer par
// Romain »): on every landscape screen below 960 x 600 (a phone held sideways, a small window) the
// info stands in a 96 px column at the left of the board, and under them the band runs across the
// screen. From 640 px wide it is one 64 px row (the hand at the left, the prompt in the middle, the
// state's buttons at the right); below 640 px two rows, 56 px (the prompt, the buttons) over 64 px
// (the hand). Explicit landscape viewports in Playwright's Chromium emulation (safe-area insets 0),
// so the desktop project only.

/** The window Playwright emulates for an iPhone 13 held sideways (750 x 342 with Playwright 1.64). */
const PHONE = devices["iPhone 13 landscape"].viewport;

/** The info column and the right margin of the board. */
const INFO_COL = 96;
const EDGE = 12;
/** The band's hand row, and its prompt row below 640 px wide. */
const BAND_ROW = 64;
const PROMPT_ROW = 56;
/** The landscape galet: 1600 / 3200 tall, and the head room of a lifted top-row knight above it. */
const RATIO = 0.5;
const HEAD_ROOM = 0.02166;

/** The band's height: one 64 px row from 640 px wide, else 56 + 64 = 120 px. */
function bandHeight(width: number): number {
  return width >= 640 ? BAND_ROW : PROMPT_ROW + BAND_ROW;
}

/**
 * The board's width on the compact bar, insets 0: max(0, min(innerWidth − 96 − 12, (innerHeight −
 * band) / (0.5 + head room))).
 */
function compactWidth(width: number, height: number): number {
  return Math.max(
    0,
    Math.min(width - INFO_COL - EDGE, (height - bandHeight(width)) / (RATIO + HEAD_ROOM)),
  );
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

/**
 * How far a knight's anchor (its outer translate(x y)) is from the centre of the drawn cell, in scene
 * units (the cell's box mapped by its own transform, as in ecrans.spec).
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
      let x = box.x + box.width / 2;
      let y = box.y + box.height / 2;
      const m = drawn.transform.baseVal.consolidate()?.matrix;
      if (m) [x, y] = [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
      return Math.hypot(Number(match[1]) - x, Number(match[2]) - y);
    },
    [pawn, cell] as const,
  );
}

/** The cards' 200 ms rise has ended (no CSS transition is running). */
async function settled(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((animation) => animation instanceof CSSTransition).length,
      ),
    )
    .toBe(0);
}

/** The compact bar's mode, the info column at the left of the board, the board inside the screen. */
async function expectInfoBeside(page: Page, what: string) {
  const size = page.viewportSize();
  if (!size) throw new Error("no viewport");
  await expect(page.locator("main.game"), what).toHaveAttribute("data-chrome", "compact-bar");
  const board = await boxOf(page, "[data-board]");
  const info = await boxOf(page, "[data-info-bar]");
  expect(info.x, `${what}: the info inside the screen`).toBeGreaterThanOrEqual(-0.5);
  expect(info.y, `${what}: the info inside the screen`).toBeGreaterThanOrEqual(-0.5);
  expect(info.x + info.width, `${what}: the info at the left of the board`).toBeLessThanOrEqual(
    board.x + 0.5,
  );
  expect(info.y + info.height, `${what}: the info above the band`).toBeLessThanOrEqual(
    size.height - bandHeight(size.width) + 0.5,
  );
  expect(board.x + board.width, `${what}: the board inside the screen`).toBeLessThanOrEqual(
    size.width + 0.5,
  );
  expect(board.y + board.height, `${what}: the board above the band`).toBeLessThanOrEqual(
    size.height - bandHeight(size.width) + 0.5,
  );
}

/**
 * The band's rows at their properties: the hand's box is --band-row high at the bottom of the
 * screen; the action zone is on the same row at its right from 640 px wide, else the 56 px row
 * above it.
 */
async function expectBandRows(page: Page, what: string) {
  const size = page.viewportSize();
  if (!size) throw new Error("no viewport");
  const board = await boxOf(page, "[data-board]");
  const hand = await boxOf(page, "[data-hand]");
  const action = await boxOf(page, "[data-action-zone]");
  expect(Math.abs(hand.height - BAND_ROW), `${what}: the hand row is 64 px`).toBeLessThanOrEqual(1);
  expect(
    Math.abs(hand.y + hand.height - size.height),
    `${what}: the hand at the bottom`,
  ).toBeLessThanOrEqual(1);
  for (const [name, box] of [
    ["the hand", hand],
    ["the action zone", action],
  ] as const) {
    expect(box.y, `${what}: ${name} under the board`).toBeGreaterThanOrEqual(
      board.y + board.height - 0.5,
    );
    expect(box.x, `${what}: ${name} inside the screen`).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width, `${what}: ${name} inside the screen`).toBeLessThanOrEqual(
      size.width + 0.5,
    );
  }
  if (size.width >= 640) {
    expect(
      Math.abs(action.height - BAND_ROW),
      `${what}: the action zone is 64 px`,
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(action.y - hand.y), `${what}: one row`).toBeLessThanOrEqual(1);
    expect(action.x, `${what}: the hand left of the action zone`).toBeGreaterThanOrEqual(
      hand.x + hand.width - 0.5,
    );
  } else {
    expect(
      Math.abs(action.height - PROMPT_ROW),
      `${what}: the action zone is 56 px`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(action.y + action.height - hand.y),
      `${what}: the action zone over the hand`,
    ).toBeLessThanOrEqual(1);
  }
  // The band, from its top row to the bottom of the screen, is exactly var(--band) high.
  const band = await bandPx(page);
  expect(band, `${what}: --band`).toBe(bandHeight(size.width));
  const top = Math.min(hand.y, action.y);
  expect(Math.abs(size.height - top - band), `${what}: the band's height`).toBeLessThanOrEqual(1);
}

/** var(--band) as the game resolves it, px. */
function bandPx(page: Page): Promise<number> {
  return page.locator("main.game").evaluate((game) => {
    const probe = document.createElement("div");
    probe.style.cssText = "position: absolute; visibility: hidden; height: var(--band)";
    game.appendChild(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  });
}

/** The measured board width against the formula at this window, and its target. */
async function expectBoard(page: Page, what: string, atLeast: number) {
  const size = page.viewportSize();
  if (!size) throw new Error("no viewport");
  const expected = compactWidth(size.width, size.height);
  const width = await boardWidth(page);
  test.info().annotations.push({
    type: "board",
    description: `${size.width} x ${size.height}: measured ${width} px, formula ${expected.toFixed(1)} px`,
  });
  expect(width, `${what}: the board is under ${atLeast} px`).toBeGreaterThanOrEqual(atLeast);
  expect(
    Math.abs(width - expected),
    `${what}: measured ${width}, formula ${expected}`,
  ).toBeLessThanOrEqual(2);
}

test.describe("sur le téléphone tenu en largeur, la barre compacte", () => {
  test.skip(({ isMobile }) => isMobile, "explicit landscape viewports");
  test.use({ viewport: PHONE });

  test("traceur : à 750 × 342, l’info à gauche du galet, la rangée de 64 px dessous, et la Dame se joue", async ({
    page,
  }) => {
    await page.goto("/");
    await page.goto("/#/partie?scenario=R-07.1");
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expectInfoBeside(page, "à toi de jouer");
    await expectBandRows(page, "à toi de jouer");
    // min(750 − 108 = 642, (342 − 64) / 0.52166 ≈ 532.9): height-limited, about 533 px, cells about
    // 17.8 px apart.
    await expectBoard(page, "à toi de jouer", 520);
    await expectNoScroll(page, "à toi de jouer");

    // The Dame: every hand card's top lies 8 px under the band's top, so its top 56 px show.
    await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
    await expect(page.locator('[data-halo="bleu0"]')).toBeVisible();
    await settled(page);
    const band = await boxOf(page, "[data-hand]");
    const cards = await page.locator("[data-hand] [data-card]").evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return {
          top: box.top,
          bottom: box.bottom,
          selected: node.getAttribute("data-state") === "selected",
        };
      }),
    );
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      // The selected card has risen 8 px: its top meets the band's top.
      const lift = card.selected ? 8 : 0;
      expect(Math.abs(card.top - (band.y + 8 - lift)), "the card's top").toBeLessThanOrEqual(1);
      expect(band.y + band.height - card.top, "at least 56 px of the card").toBeGreaterThanOrEqual(
        56,
      );
      expect(card.bottom, "the card is cut at the band's edge").toBeLessThanOrEqual(
        band.y + band.height + 0.5,
      );
    }
    await expectBandRows(page, "carte choisie");

    // The knight, then « Jouer » in the band, right of the fan.
    await page.locator('[data-hit="bleu0"]').click();
    await expect(page.locator("[data-ghost]")).toBeVisible();
    const play = page.getByRole("button", { name: "Jouer", exact: true });
    await expect(play).toBeVisible();
    const button = await play.boundingBox();
    if (!button) throw new Error("no box for « Jouer »");
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.x).toBeGreaterThanOrEqual(band.x + band.width - 0.5);
    expect(button.y).toBeGreaterThanOrEqual(band.y - 0.5);
    expect(button.y + button.height).toBeLessThanOrEqual(band.y + band.height + 0.5);
    await expectBandRows(page, "aperçu du coup");
    await expectNoScroll(page, "aperçu du coup");
    await play.click();

    // bleu0 hops from cell 3 to the drawn cell 15.
    await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:15");
    await expect.poll(() => offCell(page, "bleu0", 15)).toBeLessThanOrEqual(0.5);
    await expectNoScroll(page, "après le coup");
    await expect(zone(page)).toBeVisible();
  });
});
