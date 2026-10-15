import { devices, expect, type Page, test } from "@playwright/test";
import { zone } from "./jouer.ts";
import { etatParam } from "./position.ts";

// The compact mode (UI-SPEC addendum « Recette 3 de Romain », plan 01-47, « à confirmer par
// Romain »): on every landscape screen below 960 x 600 (a phone held sideways, a small window) the
// galet takes the full height under a 24 px prompt row, with a strip of at least 60 px at each side:
// the info and the hand at the left, « Avance rapide » and the state's buttons at the right. Explicit
// landscape viewports in Playwright's Chromium emulation (safe-area insets 0), so the desktop project
// only.

/** The window Playwright emulates for an iPhone 13 held sideways (750 x 342 with Playwright 1.64). */
const PHONE = devices["iPhone 13 landscape"].viewport;

/** Each side strip, at least, and the prompt row over the board. */
const STRIP = 60;
const PROMPT_ROW = 24;
/** The landscape galet: 1600 / 3200 tall; no head room of its own (the prompt row is that room). */
const RATIO = 0.5;

/** The board's width in the compact mode, insets 0: max(0, min(w − 2 × 60, (h − 24) / 0.5)). */
function compactWidth(width: number, height: number): number {
  return Math.max(0, Math.min(width - 2 * STRIP, (height - PROMPT_ROW) / RATIO));
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

/** The cards' 200 ms moves have ended (no CSS transition is running). */
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

/** Everything the strips show: the info, the gear, « Avance rapide », the buttons, the cards, the chips. */
const STRIP_ITEMS =
  "[data-info-bar], [data-settings-slot] button, [data-fast], [data-action-buttons] button, [data-hand] [data-card], [data-tray-option], [data-seven-chips] [data-step], [data-seven-buttons] button";

type Item = Box & {
  name: string;
  side: "left" | "right" | "either";
  /** Cut by the column it scrolls in (the 7's step chips), and whether that column scrolls. */
  cut: boolean;
  scrolls: boolean;
};

/**
 * The strips' visible items, each with the strip it belongs to. An item of a scrolling column (the
 * 7's step chips, when the strip is too short for the seven of them) counts by its part inside the
 * column; an item scrolled out of sight is left out.
 */
function stripItems(page: Page): Promise<Item[]> {
  return page.locator(STRIP_ITEMS).evaluateAll((nodes) =>
    nodes
      .map((node) => {
        let box = node.getBoundingClientRect();
        let cut = false;
        let scrolls = false;
        for (
          let up = node.parentElement;
          up !== null && up !== document.body;
          up = up.parentElement
        ) {
          const overflow = getComputedStyle(up).overflowY;
          if (overflow !== "auto" && overflow !== "scroll") continue;
          const column = up.getBoundingClientRect();
          const top = Math.max(box.top, column.top);
          const bottom = Math.min(box.bottom, column.bottom);
          cut = bottom - top < box.height - 0.5;
          scrolls = up.scrollHeight > up.clientHeight + 1;
          box = new DOMRect(box.x, top, box.width, Math.max(0, bottom - top));
          break;
        }
        const left = node.matches(
          "[data-info-bar], [data-hand] [data-card], [data-tray-option], [data-seven-chips] [data-step]",
        );
        const right = node.matches(
          "[data-settings-slot] button, [data-fast], [data-action-buttons] button, [data-seven-buttons] button",
        );
        return {
          name:
            node.getAttribute("aria-label") ??
            node.getAttribute("data-card") ??
            node.textContent?.trim() ??
            "",
          side: (left ? "left" : right ? "right" : "either") as "left" | "right" | "either",
          cut,
          scrolls,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        };
      })
      .filter((box) => box.width > 0 && box.height > 0),
  );
}

/**
 * The compact mode: the board centred under the prompt row, inside the screen; every item of the
 * strips inside the screen, in its own strip, never over the board's rectangle.
 */
async function expectStrips(page: Page, what: string) {
  const size = page.viewportSize();
  if (!size) throw new Error("no viewport");
  await expect(page.locator("main.game"), what).toHaveAttribute("data-chrome", "compact");
  const board = await boxOf(page, "[data-board]");
  expect(board.x, `${what}: the board left of the screen`).toBeGreaterThanOrEqual(STRIP - 0.5);
  expect(board.x + board.width, `${what}: the board in the right strip`).toBeLessThanOrEqual(
    size.width - STRIP + 0.5,
  );
  expect(
    Math.abs(board.x + board.width / 2 - size.width / 2),
    `${what}: the board is centred`,
  ).toBeLessThanOrEqual(1);
  expect(board.y, `${what}: the board under the prompt row`).toBeGreaterThanOrEqual(
    PROMPT_ROW - 0.5,
  );
  expect(board.y + board.height, `${what}: the board inside the screen`).toBeLessThanOrEqual(
    size.height + 0.5,
  );
  const row = await boxOf(page, "[data-action-zone], [data-seven-line]");
  expect(row.y + row.height, `${what}: the prompt row over the board`).toBeLessThanOrEqual(
    board.y + 0.5,
  );

  const items = await stripItems(page);
  expect(items.length, `${what}: nothing in the strips`).toBeGreaterThan(0);
  for (const item of items) {
    const label = `${what}: « ${item.name} »`;
    if (item.cut) expect(item.scrolls, `${label} cut, its column does not scroll`).toBe(true);
    expect(item.x, `${label} left of the screen`).toBeGreaterThanOrEqual(-0.5);
    expect(item.y, `${label} above the screen`).toBeGreaterThanOrEqual(-0.5);
    expect(item.x + item.width, `${label} right of the screen`).toBeLessThanOrEqual(
      size.width + 0.5,
    );
    expect(item.y + item.height, `${label} below the screen`).toBeLessThanOrEqual(
      size.height + 0.5,
    );
    const leftOf = item.x + item.width <= board.x + 0.5;
    const rightOf = item.x >= board.x + board.width - 0.5;
    if (item.side === "left") expect(leftOf, `${label} not in the left strip`).toBe(true);
    else if (item.side === "right") expect(rightOf, `${label} not in the right strip`).toBe(true);
    else expect(leftOf || rightOf, `${label} over the board`).toBe(true);
  }
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

test.describe("sur le téléphone tenu en largeur, le plateau sur toute la hauteur", () => {
  test.skip(({ isMobile }) => isMobile, "explicit landscape viewports");
  test.use({ viewport: PHONE });

  test("traceur : à 750 × 342, le plateau sur toute la hauteur, la Dame se joue depuis les bandes", async ({
    page,
  }) => {
    await page.goto("/");
    await page.goto("/#/partie?scenario=R-07.1");
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    // min(750 − 120 = 630, (342 − 24) / 0.5 = 636): width-limited, 630 px, cells about 21.1 px
    // apart (533 px with the compact bar of 01-37).
    await expectBoard(page, "à toi de jouer", 615);
    await expectStrips(page, "à toi de jouer");
    await expectNoScroll(page, "à toi de jouer");

    // The hand in the left strip: a column of 52 x 73 cards, each showing at least its top 44 px.
    const board = await boxOf(page, "[data-board]");
    const cards = await page.locator("[data-hand] [data-card]").evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }),
    );
    expect(cards.length).toBeGreaterThan(0);
    for (const [i, card] of cards.entries()) {
      expect(card.width, "a 52 px card").toBeCloseTo(52, 0);
      expect(card.height, "a 73 px card").toBeCloseTo(73, 0);
      expect(card.x + card.width, "the card in the left strip").toBeLessThanOrEqual(board.x + 0.5);
      const next = cards[i + 1];
      if (next) expect(next.y - card.y, "at least 44 px of the card").toBeGreaterThanOrEqual(43.5);
    }

    // The Dame: her lone knight is chosen by itself and the preview shows at once (recette 3,
    // test 27); the selected card moves 6 px toward the board, still in its strip.
    const dame = page.getByRole("button", { name: "Dame de cœur, jouable" });
    const before = await dame.boundingBox();
    await dame.click();
    await expect(page.locator('[data-selected="bleu0"]')).toBeVisible();
    await settled(page);
    const after = await dame.boundingBox();
    if (!before || !after) throw new Error("no box for the Dame");
    expect(after.x - before.x, "the selected card moves toward the board").toBeCloseTo(6, 0);
    await expectStrips(page, "aperçu du coup");

    // « Jouer » at the bottom of the right strip, under « Annuler », the primary one lowest.
    await expect(page.locator("[data-ghost]")).toBeVisible();
    const play = page.getByRole("button", { name: "Jouer", exact: true });
    const cancel = page.getByRole("button", { name: "Annuler ce coup" });
    await expect(play).toBeVisible();
    await expect(cancel).toHaveText("Annuler");
    const button = await play.boundingBox();
    const other = await cancel.boundingBox();
    if (!button || !other) throw new Error("no box for « Jouer » or « Annuler »");
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.x, "« Jouer » in the right strip").toBeGreaterThanOrEqual(
      board.x + board.width - 0.5,
    );
    expect(button.y, "« Jouer » under « Annuler »").toBeGreaterThanOrEqual(other.y + other.height);
    await expectNoScroll(page, "aperçu du coup");
    await play.click();

    // bleu0 hops from cell 3 to the drawn cell 15.
    await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:15");
    await expect.poll(() => offCell(page, "bleu0", 15)).toBeLessThanOrEqual(0.5);
    await expectStrips(page, "après le coup");
    await expectNoScroll(page, "après le coup");
    await expect(zone(page)).toBeVisible();
  });

  test("traceur : à 750 × 342, le 7 se répartit et se joue depuis les bandes, « Reste n » dans la ligne de consigne", async ({
    page,
  }) => {
    await page.goto("/");
    await page.goto(`/#/partie?etat=${etatParam(POSITIONS.seven)}&vitesse=test`);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expectBoard(page, "le 7", 615);
    const board = await boxOf(page, "[data-board]");
    const start0 = await page.locator('[data-pawn="bleu0"]').getAttribute("data-place");
    const start1 = await page.locator('[data-pawn="bleu1"]').getAttribute("data-place");

    await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
    // « Reste 7 » in the prompt row, over the board; no hand, no action zone while the 7 is built.
    const line = page.locator("[data-seven-line]");
    const remaining = line.locator("[data-remaining]");
    await expect(remaining).toHaveText("Reste 7");
    const row = await boxOf(page, "[data-seven-line]");
    expect(row.y + row.height, "« Reste n » over the board").toBeLessThanOrEqual(board.y + 0.5);
    expect(row.height, "the prompt row is one line").toBeLessThanOrEqual(PROMPT_ROW + 0.5);
    await expect(page.locator("[data-hand]")).toHaveCount(0);
    await expectStrips(page, "le 7, rien de réparti");

    // A knight, then its steps: the chips in the left strip, « Reste n » counts down.
    await page.locator('[data-hit="bleu0"]').click({ force: true });
    const chips = page.locator("[data-seven-chips] [data-step]");
    await expect(chips).toHaveCount(7);
    for (const chip of await chips.all()) {
      const box = await chip.boundingBox();
      if (!box) throw new Error("no box for a step chip");
      expect(box.x + box.width, "a step chip in the left strip").toBeLessThanOrEqual(board.x + 0.5);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expectStrips(page, "le 7, sept pastilles");
    await page.getByRole("button", { name: "4 pas" }).click();
    await expect(remaining).toHaveText("Reste 3");
    await page.locator('[data-hit="bleu1"]').click({ force: true });
    await page.getByRole("button", { name: "3 pas" }).click();
    await expect(remaining).toHaveText("Tout est réparti.");
    await expect(page.locator("[data-seven-row]")).toHaveCount(2);
    await expectStrips(page, "le 7, tout réparti");

    // « Jouer » at the bottom of the right strip plays the plan: each knight leaves its cell.
    const play = page.getByRole("button", { name: "Jouer", exact: true });
    await expect(play).toBeEnabled();
    const button = await play.boundingBox();
    if (!button) throw new Error("no box for « Jouer »");
    expect(button.x, "« Jouer » in the right strip").toBeGreaterThanOrEqual(
      board.x + board.width - 0.5,
    );
    await expectNoScroll(page, "le 7, tout réparti");
    await play.click();
    await expect(page.locator("[data-seven-line]")).toHaveCount(0);
    await expect(page.locator('[data-pawn="bleu0"]')).not.toHaveAttribute(
      "data-place",
      start0 ?? "",
    );
    await expect(page.locator('[data-pawn="bleu1"]')).not.toHaveAttribute(
      "data-place",
      start1 ?? "",
    );
    await expectNoScroll(page, "après le 7");
  });
});

// --- Every state of the turn beside the full-height galet (plan 01-48) ---

const SEED = "1234567890abcdef1234567890abcdef";

/** Four hands, so the computer players have cards once the human has played. */
const HANDS = {
  jaune: ["2H", "3H", "5H", "6H", "8H"],
  rouge: ["2C", "3C", "4C", "5C", "6C"],
  vert: ["7C", "8C", "9C", "10C", "12C"],
};

const POSITIONS = {
  /**
   * The As: « Sortir un cheval » or « Avancer de 1 ». Two knights on the ring, so « Avancer » lights
   * them both (a lone one would be chosen by itself, recette 3, test 27).
   */
  as: {
    turn: "bleu",
    pawns: { bleu: [{ p: 10 }, { p: 30 }, "S", "S"] },
    hands: { bleu: ["1S", "13H"] },
  },
  /** The Valet: bleu's knight, then a green and a yellow one to swap with. */
  jack: {
    turn: "bleu",
    pawns: {
      bleu: [{ p: 5 }, "S", "S", "S"],
      vert: [{ p: 40 }, "S", "S", "S"],
      jaune: [{ p: 46 }, "S", "S", "S"],
    },
    hands: { bleu: ["11H"] },
  },
  /** Two knights on neighbouring cells: the « Lequel ? » tray. */
  tray: { turn: "bleu", pawns: { bleu: [{ p: 5 }, { p: 6 }, "S", "S"] }, hands: { bleu: ["3S"] } },
  /** The same two neighbours with a 7: « Lequel ? » inside the 7 assistant. */
  sevenTray: {
    turn: "bleu",
    pawns: { bleu: [{ p: 5 }, { p: 6 }, "S", "S"] },
    hands: { bleu: ["7H"] },
  },
  /** Every knight in its stable and no card to leave it: a dead hand. */
  dead: {
    turn: "bleu",
    dealer: "vert",
    hands: { bleu: ["2S", "4S", "11S", "5D", "6D"], ...HANDS },
  },
  /** A 7 and two knights far apart on the ring (each tap picks its knight). */
  seven: {
    turn: "bleu",
    pawns: { bleu: [{ p: 5 }, { p: 40 }, "S", "S"] },
    hands: { bleu: ["7H", "12H"] },
  },
  /**
   * A Dame and a lone knight on the ring: its preview comes by itself (recette 3, test 27); then the
   * computer players think and play at their natural pace.
   */
  lone: {
    turn: "bleu",
    pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
    hands: { bleu: ["12H", "4S"], ...HANDS },
  },
};

async function openPosition(page: Page, etat: unknown, extra = "&vitesse=test") {
  await page.goto("/");
  await page.goto(`/#/partie?etat=${etatParam(etat)}${extra}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(page.locator("main.game")).toHaveAttribute("data-chrome", "compact");
}

type Control = Box & {
  name: string;
  /** The column the control scrolls in (the 7's step chips), if any, and whether it scrolls. */
  scroller: (Box & { scrolls: boolean }) | null;
};

/**
 * Every visible control of the page (buttons, the hand's cards, the chips) except the board's own
 * (its knights, its hit layer and its felt), each with the column it scrolls in, if any.
 */
function controlsOf(page: Page): Promise<Control[]> {
  return page.evaluate(() => {
    const controls: Control[] = [];
    const nodes = document.querySelectorAll<HTMLElement>(
      "main.game :is(button, a[href], input, [data-card], [data-tray-option], [data-step])",
    );
    for (const node of nodes) {
      if (node.closest("[data-board]") !== null) continue;
      const box = node.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (getComputedStyle(node).visibility === "hidden") continue;
      let scroller: Control["scroller"] = null;
      for (
        let up = node.parentElement;
        up !== null && up !== document.body;
        up = up.parentElement
      ) {
        const overflow = getComputedStyle(up).overflowY;
        if (overflow === "auto" || overflow === "scroll") {
          const r = up.getBoundingClientRect();
          scroller = {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            scrolls: up.scrollHeight > up.clientHeight + 1,
          };
          break;
        }
      }
      controls.push({
        name:
          node.getAttribute("aria-label") ??
          node.getAttribute("data-card") ??
          node.textContent?.trim() ??
          "",
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        scroller,
      });
    }
    return controls;
  });
}

/** The part of `a` inside `b` (a zero-size box when they do not meet). */
function clip(a: Box, b: Box): Box {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

/** The state's own buttons, at the bottom of the right strip. */
const STATE_BUTTONS =
  "[data-action-buttons] button, [data-seven-buttons] button, [data-tray-close]";

/**
 * One state of the turn beside the full-height galet:
 * - the board and every strip item in place (`expectStrips`);
 * - every visible control inside the screen, never over the board's rectangle (the board's own
 *   knights, hit layer and felt excepted), and at least 44 x 44. A control of a column that scrolls
 *   (the 7's step chips at 480 x 320) may stand past the column's edge, but only the part inside
 *   the column shows, and the column scrolls;
 * - at most three state buttons, and exactly `primaries` amber ones: one at most, except the As and
 *   the Roi, whose « Sortir » and « +n » are two equal amber choices (01-36, kept by 01-47);
 * - the prompt row: one line of at most 24 px, right over the board; a « +n » badge of the preview
 *   never rises into it (it stays inside the board);
 * - the page never scrolls (document.scrollingElement).
 */
async function expectState(page: Page, what: string, primaries: number) {
  const size = page.viewportSize();
  if (!size) throw new Error("no viewport");
  await expect(page.locator("[data-error-screen]"), `${what}: error screen`).toHaveCount(0);
  // Past the zone's 150 ms fade and the cards' 200 ms moves.
  await settled(page);
  await expectStrips(page, what);
  const screenBox = { x: 0, y: 0, width: size.width, height: size.height };
  const board = await boxOf(page, "[data-board]");

  const controls = await controlsOf(page);
  expect(controls.length, `${what}: no control`).toBeGreaterThan(0);
  for (const control of controls) {
    const label = `${what}: « ${control.name} »`;
    expect(control.width, `${label} under 44 px wide`).toBeGreaterThanOrEqual(44);
    expect(control.height, `${label} under 44 px high`).toBeGreaterThanOrEqual(44);
    let shown: Box = control;
    if (control.scroller !== null) {
      shown = clip(control, control.scroller);
      const whole = shown.width >= control.width - 0.5 && shown.height >= control.height - 0.5;
      if (!whole)
        expect(control.scroller.scrolls, `${label} cut, its column does not scroll`).toBe(true);
      // The column itself is inside the screen and beside the board.
      const column = control.scroller;
      expect(clip(column, screenBox).height, `${label}: its column leaves the screen`).toBeCloseTo(
        column.height,
        0,
      );
      const over = clip(column, board);
      expect(
        over.width * over.height,
        `${label}: its column is over the board`,
      ).toBeLessThanOrEqual(1);
    }
    if (shown.width === 0 || shown.height === 0) continue;
    expect(shown.x, `${label} left of the screen`).toBeGreaterThanOrEqual(-0.5);
    expect(shown.y, `${label} above the screen`).toBeGreaterThanOrEqual(-0.5);
    expect(shown.x + shown.width, `${label} right of the screen`).toBeLessThanOrEqual(
      size.width + 0.5,
    );
    expect(shown.y + shown.height, `${label} below the screen`).toBeLessThanOrEqual(
      size.height + 0.5,
    );
    const over = clip(shown, board);
    expect(over.width * over.height, `${label} over the board`).toBeLessThanOrEqual(1);
  }

  const buttons = await page.locator(STATE_BUTTONS).evaluateAll(
    (nodes) =>
      nodes.filter((node) => {
        const box = node.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      }).length,
  );
  expect(buttons, `${what}: more than three buttons`).toBeLessThanOrEqual(3);
  const amber = await page.locator(".btn-primary").evaluateAll(
    (nodes) =>
      nodes.filter((node) => {
        const box = node.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== "hidden";
      }).length,
  );
  expect(amber, `${what}: primary buttons`).toBe(primaries);

  // The prompt row: one line, right over the board.
  const row = await boxOf(page, "[data-action-zone], [data-seven-line]");
  expect(row.height, `${what}: the prompt row is not one line`).toBeLessThanOrEqual(
    PROMPT_ROW + 0.5,
  );
  expect(
    Math.abs(board.y - (row.y + row.height)),
    `${what}: the prompt row is not over the board`,
  ).toBeLessThanOrEqual(PROMPT_ROW);
  for (const badge of await page.locator("[data-badge] circle").all()) {
    const box = await badge.boundingBox();
    if (!box) continue;
    expect(box.y, `${what}: a « +n » badge rises into the prompt row`).toBeGreaterThanOrEqual(
      board.y - 0.5,
    );
  }

  // The page never scrolls: the scrolling element cannot even be scrolled by a script.
  const scrolled = await page.evaluate(() => {
    const doc = document.scrollingElement ?? document.documentElement;
    doc.scrollTop = 1000;
    doc.scrollLeft = 1000;
    const moved = { top: doc.scrollTop, left: doc.scrollLeft };
    doc.scrollTop = 0;
    doc.scrollLeft = 0;
    return moved;
  });
  expect(scrolled, `${what}: the page scrolls`).toEqual({ top: 0, left: 0 });
  await expectNoScroll(page, what);
}

for (const screenSize of [PHONE, { width: 480, height: 320 }]) {
  const name = `${screenSize.width} × ${screenSize.height}`;

  test.describe(`chaque état du tour, plateau sur toute la hauteur, à ${name}`, () => {
    test.skip(({ isMobile }) => isMobile, "explicit landscape viewports");
    test.use({ viewport: screenSize });

    test(`à toi, la question de l’As ou du Roi, deux chevaux éclairés et l’aperçu (${name})`, async ({
      page,
    }) => {
      await openPosition(page, POSITIONS.as);
      await expect(zone(page)).toHaveAttribute("data-state", "idle");
      await expectState(page, "à toi de jouer, aucune carte choisie", 0);
      await page.getByRole("button", { name: "As de pique, jouable" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
      // « Sortir » and « +1 », the two equal choices of the As, both amber, stacked.
      await expectState(page, "l’As, la question", 2);
      await page.getByRole("button", { name: "Avancer de 1" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
      // A card with two knights: both lit, « Autre carte » in the right strip.
      await expect(page.locator('[data-halo="bleu0"]')).toBeVisible();
      await expect(page.locator('[data-halo="bleu1"]')).toBeVisible();
      await expectState(page, "l’As, deux chevaux éclairés", 0);
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(zone(page)).toHaveAttribute("data-state", "preview");
      await expectState(page, "l’As, l’aperçu", 1);

      await openPosition(page, POSITIONS.as);
      await page.getByRole("button", { name: "Roi de cœur, jouable" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
      await expect(page.getByRole("button", { name: "Avancer de 13" })).toBeVisible();
      await expectState(page, "le Roi, la question", 2);
    });

    test(`un cheval seul : l’aperçu vient tout seul, puis l’attente et « Avance rapide » (${name})`, async ({
      page,
    }) => {
      await openPosition(page, POSITIONS.lone, "");
      await expect(zone(page)).toHaveAttribute("data-state", "idle");
      await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "preview");
      await expect(page.locator('[data-selected="bleu0"]')).toBeVisible();
      await expectState(page, "la Dame, l’aperçu tout seul", 1);
      await page.getByRole("button", { name: "Jouer", exact: true }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "waiting");
      // « Avance rapide »: its icon only at the top of the right strip, a toggle with its full name.
      const fast = page.getByRole("button", { name: "Avance rapide" });
      await expect(fast).toBeVisible();
      await expect(fast).toHaveAttribute("aria-pressed", "false");
      await expect(fast).toHaveAttribute("title", "Avance rapide");
      await expectState(page, "l’attente des ordinateurs", 0);
    });

    test(`le Valet en deux touchers (${name})`, async ({ page }) => {
      await openPosition(page, POSITIONS.jack);
      await page.getByRole("button", { name: "Valet de cœur, jouable" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "jackPick");
      await expectState(page, "le Valet, son cheval", 0);
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(zone(page)).toHaveAttribute("data-state", "jackTarget");
      await expectState(page, "le Valet, le cheval à échanger", 0);
      await page.locator('[data-hit="vert0"]').click({ force: true });
      await expect(zone(page)).toHaveAttribute("data-state", "preview");
      await expect(page.locator("[data-swap-preview]")).toBeVisible();
      await expectState(page, "le Valet, l’aperçu de l’échange", 1);
    });

    test(`le choix « Lequel ? » de deux chevaux voisins, seul ou dans le 7 (${name})`, async ({
      page,
    }) => {
      await openPosition(page, POSITIONS.tray);
      await page.getByRole("button", { name: "3 de pique, jouable" }).click();
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(zone(page)).toHaveAttribute("data-state", "tray");
      // The chips A and B in the left strip, « Autre cheval » in the right one.
      await expect(page.locator("[data-tray-option]")).toHaveCount(2);
      const chip = await boxOf(page, "[data-tray-option]");
      expect(chip.width).toBeGreaterThanOrEqual(44);
      expect(chip.height).toBeGreaterThanOrEqual(56);
      const board = await boxOf(page, "[data-board]");
      expect(chip.x + chip.width, "the chips in the left strip").toBeLessThanOrEqual(board.x + 0.5);
      const other = await boxOf(page, "[data-tray-close]");
      expect(other.x, "« Autre cheval » in the right strip").toBeGreaterThanOrEqual(
        board.x + board.width - 0.5,
      );
      await expectState(page, "« Lequel ? »", 0);
      await page.getByRole("button", { name: "Cheval B, bleu" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "preview");
      await expectState(page, "l’aperçu du cheval B", 1);

      await openPosition(page, POSITIONS.sevenTray);
      await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
      await expect(page.locator("[data-seven-line]")).toBeVisible();
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(page.locator("[data-tray-option]")).toHaveCount(2);
      await expect(page.locator("[data-seven-chips]")).toHaveCount(0);
      await expectState(page, "le 7, « Lequel ? »", 0);
    });

    test(`le 7 et ses pastilles de pas dans la bande de gauche (${name})`, async ({ page }) => {
      await openPosition(page, POSITIONS.seven);
      await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
      await expect(page.locator("[data-seven-line]")).toBeVisible();
      await expect(page.locator("[data-hand]")).toHaveCount(0);
      await expect(page.locator("[data-action-zone]")).toHaveCount(0);
      await expectState(page, "le 7, rien de réparti", 1);
      // A knight chosen: the seven step chips, all 44 x 44, in a column of the left strip (it
      // scrolls when the strip is too short for them).
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(page.locator("[data-seven-chips] [data-step]")).toHaveCount(7);
      await expectState(page, "le 7, sept pastilles", 1);
      await page.getByRole("button", { name: "4 pas" }).click();
      await page.locator('[data-hit="bleu1"]').click({ force: true });
      await expectState(page, "le 7, un cheval et ses pas", 1);
      await page.getByRole("button", { name: "3 pas" }).click();
      await expect(page.locator("[data-remaining]")).toHaveText("Tout est réparti.");
      await expect(page.locator("[data-seven-row]")).toHaveCount(2);
      await expectState(page, "le 7, tout réparti", 1);
      await expect(page.getByRole("button", { name: "Jouer", exact: true })).toBeEnabled();
    });

    test(`l’échange, son attente, la main morte et la main posée (${name})`, async ({ page }) => {
      // The exchange at its natural pace: once the human has passed his card, the computer players
      // are still choosing theirs.
      await page.goto("/");
      await page.goto(`/#/partie?graine=${SEED}`);
      await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
      await expect(zone(page)).toHaveAttribute("data-state", "exchange");
      const first = page.locator("[data-hand] [data-card]").first();
      await expect(first).toBeVisible();
      await first.click();
      await page.getByRole("button", { name: "Passer cette carte" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "exchangeWaiting");
      // The givers, with their hourglass or check, in the prompt row.
      await expect(page.locator("[data-givers] [data-giver]")).toHaveCount(3);
      const givers = await boxOf(page, "[data-givers]");
      const row = await boxOf(page, "[data-action-zone]");
      expect(givers.y).toBeGreaterThanOrEqual(row.y - 0.5);
      expect(givers.y + givers.height).toBeLessThanOrEqual(row.y + row.height + 0.5);
      await expectState(page, "l’attente de l’échange", 0);

      // The choice, in test speed: « Passer » waits for a card.
      await page.goto("/");
      await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
      await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
      await expect(zone(page)).toHaveAttribute("data-state", "exchange");
      await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
      await expectState(page, "l’échange", 1);
      await page.locator("[data-hand] [data-card]").first().click();
      await expectState(page, "l’échange, carte choisie", 1);

      // The dead hand, then posed: the computer players go on at their natural pace.
      await openPosition(page, POSITIONS.dead, "");
      await expect(zone(page)).toHaveAttribute("data-state", "deadHand");
      await expect(page.getByRole("button", { name: "Poser mes cartes" })).toBeVisible();
      await expectState(page, "la main morte", 1);
      await page.getByRole("button", { name: "Poser mes cartes" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "posed");
      await expect(page.locator("[data-hand] [data-card]")).toHaveCount(0);
      await expectState(page, "la main posée", 0);
    });
  });
}
// --- The phone held sideways: the size targets, émulation Chromium (insets 0) ---

/**
 * UI-SPEC addendum « Recette 3 de Romain », Chromium emulation with insets 0: the board's width =
 * max(0, min(innerWidth − 2 × 60, (innerHeight − 24) / 0.5)); a step of width × 107.05 / 3200.
 */
const TARGETS = [
  // min(844 − 120 = 724, (390 − 24) / 0.5 = 732): width-limited, 724 (625 before), cells ≈ 24.2 px.
  { width: 844, height: 390, atLeast: 710 },
  // The configured iPhone 13 landscape window: min(630, 636) = 630 (533 before), cells ≈ 21.1 px.
  { width: PHONE.width, height: PHONE.height, atLeast: 615 },
  // min(667 − 120 = 547, (375 − 24) / 0.5 = 702): width-limited, 547 (559 before), cells ≈ 18.3 px.
  { width: 667, height: 375, atLeast: 535 },
  // min(568 − 120 = 448, (320 − 24) / 0.5 = 592): width-limited, 448 (383 before), cells ≈ 15 px.
  { width: 568, height: 320, atLeast: 435 },
  // min(480 − 120 = 360, 592): width-limited, 360 (372 before), cells ≈ 12 px.
  { width: 480, height: 320, atLeast: 350 },
];

/**
 * The frame at this window: each strip at least 60 px, exactly 60 when the board is limited by the
 * width (all five sizes), and the 24 px prompt row right over the board.
 */
async function expectFrame(page: Page, what: string) {
  const size = page.viewportSize();
  if (!size) throw new Error("no viewport");
  const board = await boxOf(page, "[data-board]");
  const widthLimited = size.width - 2 * STRIP <= (size.height - PROMPT_ROW) / RATIO;
  const strips = { left: board.x, right: size.width - board.x - board.width };
  for (const [side, strip] of Object.entries(strips)) {
    expect(strip, `${what}: the ${side} strip under ${STRIP} px`).toBeGreaterThanOrEqual(
      STRIP - 0.5,
    );
    if (widthLimited) {
      expect(
        Math.abs(strip - STRIP),
        `${what}: the ${side} strip is ${strip} px`,
      ).toBeLessThanOrEqual(1);
    }
  }
  const row = await boxOf(page, "[data-action-zone], [data-seven-line]");
  expect(
    Math.abs(board.y - PROMPT_ROW - row.y),
    `${what}: the prompt row's top`,
  ).toBeLessThanOrEqual(1);
  expect(row.height, `${what}: the prompt row is not ${PROMPT_ROW} px`).toBeLessThanOrEqual(
    PROMPT_ROW + 0.5,
  );
}

test.describe("les tailles visées du téléphone tenu en largeur (émulation Chromium, insets 0)", () => {
  test.skip(({ isMobile }) => isMobile, "explicit landscape viewports");

  for (const target of TARGETS) {
    test(`à ${target.width} × ${target.height}, le galet fait au moins ${target.atLeast} px de large et la Dame se joue`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: target.width, height: target.height });
      await page.goto("/");
      await page.goto("/#/partie?scenario=R-07.1");
      await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
      const what = `${target.width} × ${target.height}`;
      await expectBoard(page, what, target.atLeast);
      await expectStrips(page, what);
      await expectFrame(page, what);
      await expectNoScroll(page, what);

      // A move: the Dame, then « Jouer » (her lone knight is chosen by itself, recette 3, test 27);
      // bleu0 lands on the drawn cell 15.
      await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
      await expect(page.locator('[data-selected="bleu0"]')).toBeVisible();
      await settled(page);
      await expectStrips(page, `${what}, aperçu`);
      await expectFrame(page, `${what}, aperçu`);
      // A picture for Romain's re-test, a card selected and its knight chosen, past the zone's fade.
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `test-results/galet-emulation-${target.width}x${target.height}.png`,
      });
      const play = page.getByRole("button", { name: "Jouer", exact: true });
      await expect(play).toBeVisible();
      await expectNoScroll(page, `${what}, aperçu`);
      await play.click();
      await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:15");
      await expect.poll(() => offCell(page, "bleu0", 15)).toBeLessThanOrEqual(0.5);
      await boardWidth(page);
      await expectNoScroll(page, `${what}, après le coup`);
    });
  }
});
