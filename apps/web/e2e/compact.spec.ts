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

type Item = Box & { name: string; side: "left" | "right" | "either" };

/** The strips' visible items, each with the strip it belongs to. */
function stripItems(page: Page): Promise<Item[]> {
  return page.locator(STRIP_ITEMS).evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const box = node.getBoundingClientRect();
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
});

// --- Every state of the turn (the compact bar of 01-37; rewritten for the strips in plan 01-48) ---
//
// These tests still assert the band under the board of 01-37 (its 64 or 120 px rows, the buttons
// inside it): they fail against the full-height galet until plan 01-48 rewrites them.

/** The band's height of 01-37: one 64 px row from 640 px wide, else 56 + 64 = 120 px. */
function bandHeight(width: number): number {
  return width >= 640 ? 64 : 120;
}

/** var(--band) as the game resolves it, px (01-37). */
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
  /** Two knights on neighbouring cells: the « Lequel ? » tray. */
  tray: { turn: "bleu", pawns: { bleu: [{ p: 5 }, { p: 6 }, "S", "S"] }, hands: { bleu: ["3S"] } },
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
  /** A Dame to play, then the computer players think and play at their natural pace. */
  waiting: {
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

/**
 * One state in the compact bar:
 * - every button and tray chip of the band (and the gear) at least 44 x 44 and inside the screen,
 *   the band's ones inside the band;
 * - `primaries` amber buttons visible;
 * - the band, from its top row to the bottom of the screen, exactly var(--band) high;
 * - from 640 px wide, every prompt shown whole (three lines at most in the 64 px row);
 * - no document scroll.
 */
async function expectState(page: Page, what: string, primaries: number) {
  const size = page.viewportSize();
  if (!size) throw new Error("no viewport");
  await expect(page.locator("[data-error-screen]"), `${what}: error screen`).toHaveCount(0);
  // Past the zone's 150 ms fade and the cards' 200 ms rise.
  await settled(page);
  const band = await bandPx(page);
  expect(band, `${what}: --band`).toBe(bandHeight(size.width));
  const top = size.height - band;

  const controls = await page
    .locator(
      "[data-info-bar] button, [data-action-zone] button, [data-seven-panel] button, [data-tray-option]",
    )
    .evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const box = node.getBoundingClientRect();
          return {
            name: node.getAttribute("aria-label") ?? node.textContent?.trim() ?? "",
            info: node.closest("[data-info-bar]") !== null,
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          };
        })
        .filter((box) => box.width > 0 && box.height > 0),
    );
  // The gear at least.
  expect(controls.length, `${what}: no control`).toBeGreaterThanOrEqual(1);
  for (const c of controls) {
    expect(c.width, `${what}: « ${c.name} » under 44 px wide`).toBeGreaterThanOrEqual(44);
    expect(c.height, `${what}: « ${c.name} » under 44 px high`).toBeGreaterThanOrEqual(44);
    expect(c.x, `${what}: « ${c.name} » left of the screen`).toBeGreaterThanOrEqual(-0.5);
    expect(c.x + c.width, `${what}: « ${c.name} » right of the screen`).toBeLessThanOrEqual(
      size.width + 0.5,
    );
    expect(c.y, `${what}: « ${c.name} » above the screen`).toBeGreaterThanOrEqual(-0.5);
    expect(c.y + c.height, `${what}: « ${c.name} » below the screen`).toBeLessThanOrEqual(
      size.height + 0.5,
    );
    if (!c.info) {
      expect(c.y, `${what}: « ${c.name} » above the band`).toBeGreaterThanOrEqual(top - 0.5);
    }
  }

  const amber = await page.locator(".btn-primary").evaluateAll(
    (nodes) =>
      nodes.filter((node) => {
        const box = node.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== "hidden";
      }).length,
  );
  expect(amber, `${what}: primary buttons`).toBe(primaries);

  // The key hints stay corner badges of 20 px (computers only): none takes its host's size.
  const hints = await page.locator("[data-key-hint]").evaluateAll((nodes) =>
    nodes
      .map((node) => node.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0)
      .map((box) => box.height),
  );
  for (const height of hints) {
    expect(height, `${what}: a key hint is ${height} px high`).toBeLessThanOrEqual(24);
  }

  // The band's boxes start at its top and end at the bottom of the screen: it never grows.
  const boxes = await page
    .locator("[data-action-zone], [data-hand], [data-seven-panel]")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom };
      }),
    );
  expect(boxes.length, `${what}: no band`).toBeGreaterThan(0);
  const first = Math.min(...boxes.map((box) => box.top));
  const last = Math.max(...boxes.map((box) => box.bottom));
  expect(Math.abs(first - top), `${what}: the band's top`).toBeLessThanOrEqual(1);
  expect(last, `${what}: the band below the screen`).toBeLessThanOrEqual(size.height + 0.5);
  const board = await boxOf(page, "[data-board]");
  expect(board.y + board.height, `${what}: the board over the band`).toBeLessThanOrEqual(top + 0.5);

  if (size.width >= 640) {
    // Three lines at most in the 64 px row: the prompt shows whole, nothing to scroll.
    const prompts = await page
      // A sentence kept for screen readers only (the exchange's, in the givers' place) is not shown.
      .locator("[data-action-zone] .text:not(.spoken)")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({ scroll: node.scrollHeight, client: node.clientHeight })),
      );
    for (const prompt of prompts) {
      expect(prompt.scroll, `${what}: the prompt is cut`).toBeLessThanOrEqual(prompt.client + 1);
    }
  }
  await expectNoScroll(page, what);
}

for (const screenSize of [PHONE, { width: 480, height: 320 }]) {
  const name = `${screenSize.width} × ${screenSize.height}`;

  test.describe(`chaque état du tour dans la barre compacte à ${name}`, () => {
    test.skip(({ isMobile }) => isMobile, "explicit landscape viewports");
    test.use({ viewport: screenSize });

    test(`à toi, l’As ou le Roi, le choix de cheval et l’aperçu (${name})`, async ({ page }) => {
      await openPosition(page, POSITIONS.as);
      await expect(zone(page)).toHaveAttribute("data-state", "idle");
      await expectState(page, "à toi de jouer", 0);
      if (screenSize.width < 640) {
        // Two rows: --band is 120 px and the board at least 360 px wide (≈ 372 at 480 × 320).
        await expectBoard(page, "deux rangées", 360);
      }
      await page.getByRole("button", { name: "As de pique, jouable" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
      // « Sortir un cheval » and « Avancer de 1 », the two equal choices of the As (both amber since
      // 01-18, UI-SPEC « As/Roi mode »; the same count as the computer's bar of 01-36).
      await expectState(page, "l’As", 2);
      await page.getByRole("button", { name: "Avancer de 1" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
      await expectState(page, "l’As, avancer", 0);
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(zone(page)).toHaveAttribute("data-state", "preview");
      await expectState(page, "l’aperçu", 1);
      await openPosition(page, POSITIONS.as);
      await page.getByRole("button", { name: "Roi de cœur, jouable" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
      await expect(page.getByRole("button", { name: "Avancer de 13" })).toBeVisible();
      await expectState(page, "le Roi", 2);
    });

    test(`le choix « Lequel ? » de deux chevaux voisins (${name})`, async ({ page }) => {
      await openPosition(page, POSITIONS.tray);
      await page.getByRole("button", { name: "3 de pique, jouable" }).click();
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(zone(page)).toHaveAttribute("data-state", "tray");
      const chips = page.locator("[data-tray-option]");
      await expect(chips).toHaveCount(2);
      const chip = await boxOf(page, "[data-tray-option]");
      expect(chip.width).toBeGreaterThanOrEqual(44);
      expect(chip.height).toBeGreaterThanOrEqual(56);
      // The chips in the prompt's place, « Choisir un autre cheval » in the buttons' place.
      const other = await boxOf(page, "[data-tray-close]");
      expect(other.x).toBeGreaterThanOrEqual(chip.x + chip.width);
      await expectState(page, "« Lequel ? »", 0);
      await page.getByRole("button", { name: "Cheval B, bleu" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "preview");
      await expectState(page, "l’aperçu du cheval B", 1);
    });

    test(`l’échange, son attente et la main morte (${name})`, async ({ page }) => {
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
      // The givers, with their hourglass or check, in the prompt's place.
      await expect(page.locator("[data-givers] [data-giver]")).toHaveCount(3);
      const givers = await boxOf(page, "[data-givers]");
      const action = await boxOf(page, "[data-action-zone]");
      expect(givers.y).toBeGreaterThanOrEqual(action.y - 0.5);
      expect(givers.y + givers.height).toBeLessThanOrEqual(action.y + action.height + 0.5);
      await expectState(page, "l’attente de l’échange", 0);

      // The choice, in test speed: « Passer cette carte » waits for a card.
      await page.goto("/");
      await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
      await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
      await expect(zone(page)).toHaveAttribute("data-state", "exchange");
      await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
      await expectState(page, "l’échange", 1);
      await page.locator("[data-hand] [data-card]").first().click();
      await expectState(page, "l’échange, carte choisie", 1);

      await openPosition(page, POSITIONS.dead);
      await expect(zone(page)).toHaveAttribute("data-state", "deadHand");
      await expect(page.getByRole("button", { name: "Poser mes cartes" })).toBeVisible();
      await expectState(page, "la main morte", 1);
    });

    test(`l’attente des joueurs de l’ordinateur et « Avance rapide » (${name})`, async ({
      page,
    }) => {
      await openPosition(page, POSITIONS.waiting, "");
      await expect(zone(page)).toHaveAttribute("data-state", "idle");
      await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await page.getByRole("button", { name: "Jouer", exact: true }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "waiting");
      const fast = page.getByRole("button", { name: "Avance rapide" });
      await expect(fast).toBeVisible();
      // Its icon and its label, a toggle.
      await expect(fast).toContainText("Avance rapide");
      await expect(fast).toHaveAttribute("aria-pressed", "false");
      await expectState(page, "l’attente", 0);
    });

    test(`l’assistant du 7 tient dans la barre, à sa place la plus remplie (${name})`, async ({
      page,
    }) => {
      await openPosition(page, POSITIONS.seven);
      await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
      const panel = page.locator("[data-seven-panel]");
      await expect(panel).toBeVisible();
      await expect(page.locator("[data-hand]")).toHaveCount(0);
      await expect(page.locator("[data-action-zone]")).toHaveCount(0);

      /** The assistant takes the band, never taller than var(--band). */
      const expectPanel = async (what: string) => {
        const size = page.viewportSize();
        if (!size) throw new Error("no viewport");
        const box = await boxOf(page, "[data-seven-panel]");
        expect(
          Math.abs(box.height - bandHeight(size.width)),
          `${what}: the assistant is not the band's height`,
        ).toBeLessThanOrEqual(1);
        await expectState(page, what, 1);
      };

      await expectPanel("le 7, rien de réparti");
      // A knight chosen: the seven step chips, all 44 x 44 (they scroll sideways when narrower).
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(page.locator("[data-seven-chips] [data-step]")).toHaveCount(7);
      await expectPanel("le 7, sept pastilles");
      await page.getByRole("button", { name: "4 pas" }).click();
      await page.locator('[data-hit="bleu1"]').click({ force: true });
      await expectPanel("le 7, un cheval et ses pas");
      await page.getByRole("button", { name: "3 pas" }).click();
      await expect(page.locator("[data-remaining]")).toHaveText("Tout est réparti.");
      await expect(page.locator("[data-seven-row]")).toHaveCount(2);
      await expectPanel("le 7, tout réparti");
      await expect(page.getByRole("button", { name: "Jouer", exact: true })).toBeEnabled();
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
  { width: 844, height: 390, atLeast: 710, shot: true },
  // The configured iPhone 13 landscape window: min(630, 636) = 630 (533 before), cells ≈ 21.1 px.
  { width: PHONE.width, height: PHONE.height, atLeast: 615, shot: true },
  // min(667 − 120 = 547, (375 − 24) / 0.5 = 702): width-limited, 547 (559 before), cells ≈ 18.3 px.
  { width: 667, height: 375, atLeast: 535, shot: false },
  // min(568 − 120 = 448, (320 − 24) / 0.5 = 592): width-limited, 448 (383 before), cells ≈ 15 px.
  { width: 568, height: 320, atLeast: 435, shot: false },
  // min(480 − 120 = 360, 592): width-limited, 360 (372 before), cells ≈ 12 px.
  { width: 480, height: 320, atLeast: 350, shot: true },
];

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
      await expectNoScroll(page, what);

      // A move: the Dame, then « Jouer » (her lone knight is chosen by itself, recette 3, test 27);
      // bleu0 lands on the drawn cell 15.
      await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
      await expect(page.locator('[data-selected="bleu0"]')).toBeVisible();
      await settled(page);
      await expectStrips(page, `${what}, aperçu`);
      if (target.shot) {
        // A picture for Romain's re-test, a card selected and its knight chosen, past the zone's fade.
        await page.waitForTimeout(400);
        await page.screenshot({
          path: `test-results/galet-emulation-${target.width}x${target.height}.png`,
        });
      }
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
