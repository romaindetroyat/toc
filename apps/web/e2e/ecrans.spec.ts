import { expect, type Page, test } from "@playwright/test";
import { playSimpleMove, untilOwnTurn, zone } from "./jouer.ts";
import { etatParam } from "./position.ts";

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
 * units: both are read in the scene's own coordinates (the attribute, and getBBox() mapped by the
 * cell's own transform).
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
      // An exit cell is a turned square: its box is in its own coordinates, mapped by its transform.
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

    // min(1280 − 32, (800 − 160) / 0.52166, 1600) ≈ 1226.9 (the addendum’s ≈ 1227 px): height-limited, a step of about 41 px.
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

// --- Every state of the turn in the bar (Task 2) ---

const SEED = "1234567890abcdef1234567890abcdef";

/** Four hands, so the computer players have cards once the human has played. */
const HANDS = {
  jaune: ["2H", "3H", "5H", "6H", "8H"],
  rouge: ["2C", "3C", "4C", "5C", "6C"],
  vert: ["7C", "8C", "9C", "10C", "12C"],
};

const POSITIONS = {
  /** The As: « Sortir un cheval » or « Avancer de 1 ». */
  as: { turn: "bleu", pawns: { bleu: [{ p: 10 }, "S", "S", "S"] }, hands: { bleu: ["1S", "13H"] } },
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
}

/**
 * The state's controls in the bar: every button and chip at least 44 x 44, inside the screen and
 * inside the bar's band, `primaries` amber buttons visible, no document scroll.
 */
async function expectControls(page: Page, what: string, primaries: number) {
  const size = page.viewportSize();
  if (!size) throw new Error("no viewport");
  await expect(page.locator("[data-error-screen]"), `${what}: error screen`).toHaveCount(0);
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
    expect(c.y, `${what}: « ${c.name} » above the bar`).toBeGreaterThanOrEqual(
      size.height - BAR - 0.5,
    );
    expect(c.y + c.height, `${what}: « ${c.name} » below the screen`).toBeLessThanOrEqual(
      size.height + 0.5,
    );
  }
  const amber = await page.locator(".btn-primary").evaluateAll(
    (nodes) =>
      nodes.filter((node) => {
        const box = node.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== "hidden";
      }).length,
  );
  expect(amber, `${what}: primary buttons`).toBe(primaries);
  await expectNoScroll(page, what);
}

for (const [width, height] of [
  [1024, 640],
  [1280, 800],
] as const) {
  test.describe(`chaque état du tour dans la barre à ${width} × ${height}`, () => {
    test.skip(({ isMobile }) => isMobile, "explicit viewports: the desktop project only");
    test.use({ viewport: { width, height } });

    test(`l’As ou le Roi, le choix de cheval, le Valet et l’aperçu (${width} × ${height})`, async ({
      page,
    }) => {
      await openPosition(page, POSITIONS.as);
      await expect(page.locator("main.game")).toHaveAttribute("data-chrome", "bar");
      await expect(zone(page)).toHaveAttribute("data-state", "idle");
      await expectControls(page, "à toi de jouer", 0);
      await page.getByRole("button", { name: "As de pique, jouable" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
      // « Sortir un cheval » and « Avancer de 1 », the two equal choices of the As (both amber since
      // 01-18, UI-SPEC « As/Roi mode »).
      await expectControls(page, "l’As", 2);
      await page.getByRole("button", { name: "Avancer de 1" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
      await expectControls(page, "l’As, avancer", 0);
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(zone(page)).toHaveAttribute("data-state", "preview");
      await expectControls(page, "l’aperçu", 1);

      await openPosition(page, POSITIONS.tray);
      await page.getByRole("button", { name: "3 de pique, jouable" }).click();
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(zone(page)).toHaveAttribute("data-state", "tray");
      await expect(page.locator("[data-tray-option]")).toHaveCount(2);
      const chip = await boxOf(page, "[data-tray-option]");
      expect(chip.height).toBeGreaterThanOrEqual(56);
      await expectControls(page, "« Lequel ? »", 0);
      await page.getByRole("button", { name: "Cheval B, bleu" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "preview");
      await expectControls(page, "l’aperçu du cheval B", 1);
    });

    test(`l’échange, son attente et la main morte (${width} × ${height})`, async ({ page }) => {
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
      await expect(page.locator("[data-givers] [data-giver]")).toHaveCount(3);
      await expectBar(page, "l’attente de l’échange", [
        "[data-info-bar]",
        "[data-hand]",
        "[data-action-zone]",
      ]);
      await expectControls(page, "l’attente de l’échange", 0);

      // The choice, in test speed: « Passer cette carte » waits for a card.
      await page.goto("/");
      await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
      await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
      await expect(zone(page)).toHaveAttribute("data-state", "exchange");
      await expectControls(page, "l’échange", 1);
      await page.locator("[data-hand] [data-card]").first().click();
      await expectControls(page, "l’échange, carte choisie", 1);

      await openPosition(page, POSITIONS.dead);
      await expect(zone(page)).toHaveAttribute("data-state", "deadHand");
      await expectBar(page, "la main morte", [
        "[data-info-bar]",
        "[data-hand]",
        "[data-action-zone]",
      ]);
      await expectControls(page, "la main morte", 1);
    });

    test(`l’attente des joueurs de l’ordinateur et « Avance rapide » (${width} × ${height})`, async ({
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
      await expect(fast).toContainText("Avance rapide");
      await expectControls(page, "l’attente", 0);
    });

    test(`l’assistant du 7 tient dans la barre, à sa place la plus remplie (${width} × ${height})`, async ({
      page,
    }) => {
      await openPosition(page, POSITIONS.seven);
      await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
      const panel = page.locator("[data-seven-panel]");
      await expect(panel).toBeVisible();
      await expect(page.locator("[data-hand]")).toHaveCount(0);
      await expect(page.locator("[data-action-zone]")).toHaveCount(0);

      /** The assistant in place of the hand and the action zone, never taller than the bar. */
      const expectPanel = async (what: string) => {
        await expectBar(page, what, ["[data-info-bar]", "[data-seven-panel]"]);
        const box = await boxOf(page, "[data-seven-panel]");
        expect(box.height, `${what}: the assistant is taller than the bar`).toBeLessThanOrEqual(
          BAR + 0.5,
        );
        await expectControls(page, what, 1);
      };

      await expectPanel("le 7, rien de réparti");
      // A knight chosen: the seven step chips, all of them shown.
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

// --- The computer's size targets and a resized window (Task 3) ---

/**
 * UI-SPEC « Objectifs de taille », bar mode, insets 0: the board's width = min(innerWidth − 32,
 * (innerHeight − 160) / (0.5 + 0.02166), 1600).
 */
const TARGETS = [
  // (640 − 160) / 0.52166 ≈ 920.1: height-limited.
  { width: 1024, height: 640, atLeast: 900 },
  // (800 − 160) / 0.52166 ≈ 1226.9: height-limited, a step of about 41 px, ring knights about 39 px.
  { width: 1280, height: 800, atLeast: 1200 },
  // min(1440 − 32 = 1408, (900 − 160) / 0.52166 ≈ 1418.5): width-limited, 1408.
  { width: 1440, height: 900, atLeast: 1390 },
];

test.describe("les tailles visées sur ordinateur", () => {
  test.skip(({ isMobile }) => isMobile, "explicit viewports: the desktop project only");

  for (const target of TARGETS) {
    test(`à ${target.width} × ${target.height}, le galet fait au moins ${target.atLeast} px de large`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: target.width, height: target.height });
      await page.goto("/");
      await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
      await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
      await expect(page.locator("main.game")).toHaveAttribute("data-chrome", "bar");
      const expected = barWidth(target.width, target.height);
      const width = await boardWidth(page);
      test.info().annotations.push({
        type: "board",
        description: `${target.width} x ${target.height}: measured ${width} px, formula ${expected.toFixed(1)} px`,
      });
      expect(width).toBeGreaterThanOrEqual(target.atLeast);
      expect(
        Math.abs(width - expected),
        `measured ${width}, formula ${expected}`,
      ).toBeLessThanOrEqual(2);
      await expectBar(page, "l’échange", ["[data-info-bar]", "[data-hand]", "[data-action-zone]"]);
      await expectNoScroll(page, "l’échange");
    });
  }
});

type Snapshot = { hand: string[]; places: Record<string, string>; turn: string | null };

/** The hand's cards, every knight's place and the turn, as the screen shows them. */
function readGame(page: Page): Promise<Snapshot> {
  return page.evaluate(() => ({
    hand: [...document.querySelectorAll("[data-hand] [data-card]")].map(
      (card) => card.getAttribute("data-card") ?? "",
    ),
    places: Object.fromEntries(
      [...document.querySelectorAll("[data-pawn]")].map((pawn) => [
        pawn.getAttribute("data-pawn") ?? "",
        pawn.getAttribute("data-place") ?? "",
      ]),
    ),
    turn: document.querySelector("[data-turn]")?.getAttribute("data-turn") ?? null,
  }));
}

test.describe("redimensionner garde la partie", () => {
  test.skip(({ isMobile }) => isMobile, "explicit viewports: the desktop project only");
  test.use({ viewport: { width: 1280, height: 800 } });

  test("de 1280 × 800 à 1024 × 640, puis 900 × 700 et retour : même main, mêmes places, même tour", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto("/");
    await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    // One move each, so that knights stand on the ring; then his turn again.
    await untilOwnTurn(page);
    await playSimpleMove(page);
    await untilOwnTurn(page);
    const before = await readGame(page);
    expect(before.hand.length).toBeGreaterThan(0);
    expect(Object.keys(before.places)).toHaveLength(16);
    const ring = Object.entries(before.places).filter(([, place]) => place.startsWith("ring:"));
    expect(ring.length).toBeGreaterThan(0);

    for (const [width, height, chrome] of [
      [1024, 640, "bar"],
      [900, 700, "compact-bar"],
      [1280, 800, "bar"],
    ] as const) {
      const what = `${width} × ${height}`;
      await page.setViewportSize({ width, height });
      await expect(page.locator("main.game"), what).toHaveAttribute("data-chrome", chrome);
      expect(await readGame(page), `${what}: the game changed`).toEqual(before);
      for (const [pawn, place] of ring) {
        const cell = Number(place.slice("ring:".length));
        expect(
          await offCell(page, pawn, cell),
          `${what}: ${pawn} off its cell`,
        ).toBeLessThanOrEqual(0.5);
      }
      // The board only rescales: still the 2:1 galet, inside the screen.
      const board = await boxOf(page, "[data-board]");
      expect(Math.abs(board.height - board.width / 2), `${what}: 2:1`).toBeLessThanOrEqual(1.5);
      expect(board.x + board.width, `${what}: board inside`).toBeLessThanOrEqual(width + 0.5);
      expect(board.y + board.height, `${what}: board inside`).toBeLessThanOrEqual(height + 0.5);
      await expectNoScroll(page, what);
    }
    // Back at 1280 × 800, the board has its bar width again.
    expect(Math.abs((await boardWidth(page)) - barWidth(1280, 800))).toBeLessThanOrEqual(2);

    // A card selected at 1280 × 800: the lit knights and their letters, for Romain's re-test.
    const card = page
      .locator('[data-hand] [data-state="playable"]:not([data-card^="7"]):not([data-card^="11"])')
      .first();
    await card.click();
    await expect(page.locator("[data-halo]").first()).toBeVisible();
    // A picture only: past the action zone's 150 ms fade.
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/galet-emulation-1280x800.png" });
    expect(errors).toEqual([]);
  });
});
