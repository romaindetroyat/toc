import { expect, type Page, test } from "@playwright/test";
import { chooseKnight, playSimpleMove, playToEnd, untilOwnTurn, zone } from "./jouer.ts";
import { etatParam } from "./position.ts";

// The finishing checks of phase 1 (plan 01-24): the felt in large form, then (further down) the five
// screen sizes, the keyboard path and a whole game played without sound. Debug build, seeded game in
// test speed.

const SEED = "1234567890abcdef1234567890abcdef";
const dialog = (page: Page, name: string) => page.getByRole("dialog", { name });

async function openGame(page: Page) {
  await page.goto("/");
  await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

test.describe("le tapis en grand", () => {
  test("tapis: toucher le tapis ouvre « Sur le tapis », quatre places, talon et défausse; Échap le ferme", async ({
    page,
  }) => {
    await openGame(page);
    await untilOwnTurn(page);
    await playSimpleMove(page);
    const played = await page
      .locator('[data-felt-last="bleu"] [data-felt-card]')
      .first()
      .getAttribute("data-felt-card");
    expect(played).not.toBeNull();

    // The whole felt is the target: at least 44 px each way.
    const felt = page.getByRole("button", { name: "Sur le tapis" });
    const box = await felt.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await felt.click();

    const sheet = dialog(page, "Sur le tapis");
    await expect(sheet).toBeVisible();
    const seats = sheet.locator("[data-tapis-seat]");
    await expect(seats).toHaveCount(4);

    // Our row: « Toi : {Carte} » with the card in large form, the card we just played.
    const own = sheet.locator('[data-tapis-seat="bleu"]');
    await expect(own.locator("[data-tapis-text]")).toHaveText(
      /^Toi\s:\s.+ de (pique|cœur|carreau|trèfle)$/,
    );
    const card = own.locator(`[data-card="${played}"]`);
    await expect(card).toBeVisible();
    // Measured once the sheet has stopped sliding in: during its 250 ms slide the box is translated by
    // a fraction of a pixel, which reads 99.99999 px at the phone's scale factor of 3.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.querySelector("[data-sheet-layer]")?.getAnimations({ subtree: true }).length,
        ),
      )
      .toBe(0);
    const size = await card.boundingBox();
    expect(size?.width).toBeGreaterThanOrEqual(72);
    expect(size?.height).toBeGreaterThanOrEqual(100);

    // Every other row is « {Nom} : {Carte} » or « {Nom} : — » when the seat has not played yet.
    for (const color of ["jaune", "rouge", "vert"]) {
      await expect(sheet.locator(`[data-tapis-seat="${color}"] [data-tapis-text]`)).toHaveText(
        /^.+\s:\s(—|.+ de (pique|cœur|carreau|trèfle))$/,
      );
    }

    // The two piles are counted, as on the felt.
    const talon = Number(
      await sheet.locator("[data-tapis-talon]").getAttribute("data-tapis-talon"),
    );
    const defausse = Number(
      await sheet.locator("[data-tapis-discard]").getAttribute("data-tapis-discard"),
    );
    expect(talon).toBeGreaterThanOrEqual(0);
    expect(defausse).toBeGreaterThanOrEqual(1);
    await expect(sheet.locator("[data-tapis-talon]")).toHaveText(
      new RegExp(`^Talon\\s:\\s${talon} cartes$`),
    );
    await expect(sheet.locator("[data-tapis-discard]")).toHaveText(
      new RegExp(`^Défausse\\s:\\s${defausse} cartes$`),
    );

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    // Échap closed the sheet only: the game is still on screen.
    await expect(page.locator("[data-board]")).toBeVisible();
    await expect(zone(page)).toBeVisible();
  });

  test("tapis: au clavier, le tapis prend le focus et Entrée l’ouvre; une place sans carte affiche « — »", async ({
    page,
  }) => {
    await openGame(page);
    await expect(zone(page)).toHaveAttribute("data-state", "exchange");
    const felt = page.getByRole("button", { name: "Sur le tapis" });
    await felt.focus();
    await expect(felt).toBeFocused();
    await page.keyboard.press("Enter");
    const sheet = dialog(page, "Sur le tapis");
    await expect(sheet).toBeVisible();
    // Nothing has been played yet: four blank places, a full talon and an empty défausse.
    for (const color of ["bleu", "jaune", "rouge", "vert"]) {
      await expect(sheet.locator(`[data-tapis-seat="${color}"] [data-tapis-text]`)).toHaveText(
        /:\s—$/,
      );
    }
    await expect(sheet.locator("[data-tapis-discard]")).toHaveText(/^Défausse\s:\s0 cartes$/);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(felt).toBeFocused();
  });
});

// --- Every supported screen size (FX-01) ---

// Every screen is held sideways: from 01-38 a screen taller than wide no longer shows the game
// (« Tourne ton téléphone », Romain's « paysage obligatoire »). The four small landscape sizes are
// the compact mode (the full-height galet of 01-47); 1280 x 800 is the computer's bottom bar (01-36).
type Gauge = { name: string; width: number; height: number };
const SIZES: Gauge[] = [
  { name: "480x320", width: 480, height: 320 },
  { name: "568x320", width: 568, height: 320 },
  { name: "667x375", width: 667, height: 375 },
  { name: "844x390", width: 844, height: 390 },
  { name: "1280x800", width: 1280, height: 800 },
];

/**
 * The computer's bottom bar (UI-SPEC addendum « Plateau galet », item 7): from 960 x 600 held
 * sideways the board is min(innerWidth − 32, (innerHeight − 160) / (0.5 + 0.02166), 1600) wide,
 * insets 0 (≈ 1227 at 1280 x 800). Null for the other sizes.
 */
function barBoardWidth(width: number, height: number): number | null {
  if (width < 960 || height < 600 || height >= width) return null;
  return Math.min(width - 32, (height - 160) / (0.5 + 0.02166), 1600);
}

/** On a computer screen, the measured board is at least 1200 px wide and within 2 px of the formula. */
async function expectBarBoard(page: Page, what: string) {
  const size = page.viewportSize();
  if (!size) throw new Error("no viewport");
  const expected = barBoardWidth(size.width, size.height);
  if (expected === null) return;
  const box = await page.locator("[data-board]").boundingBox();
  const width = box?.width ?? 0;
  expect(width, `${what}: the board is under 1200 px`).toBeGreaterThanOrEqual(1200);
  expect(
    Math.abs(width - expected),
    `${what}: measured ${width}, formula ${expected}`,
  ).toBeLessThanOrEqual(2);
}

/**
 * Bleu holds a 7 and two knights on the ring: the 7 panel opens with one tap on the card. The knights
 * stand on opposite sides of the ring, more than 44 px apart even on the smallest landscape galet
 * (360 px wide at 480 x 320, plan 01-47), so each tap picks its knight without the « Lequel ? » tray.
 */
const SEVEN = {
  turn: "bleu",
  pawns: { bleu: [{ p: 5 }, { p: 40 }, "S", "S"] },
  hands: { bleu: ["7H", "12H"] },
};

/** Everything the player needs is on screen: nothing cut off, nothing to scroll. */
async function expectFits(page: Page, what: string, selectors: string[]) {
  const size = page.viewportSize();
  if (!size) throw new Error("no viewport");
  // An unexpected error would have replaced the game by the error screen.
  await expect(page.locator("[data-error-screen]"), `${what}: error screen`).toHaveCount(0);
  const page_ = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(page_.scrollWidth, `${what}: page scrolls sideways`).toBeLessThanOrEqual(size.width);
  expect(page_.scrollHeight, `${what}: page scrolls down`).toBeLessThanOrEqual(size.height);
  for (const selector of selectors) {
    const boxes = await page.locator(selector).evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, right: box.right, bottom: box.bottom };
      }),
    );
    expect(boxes.length, `${what}: ${selector} is missing`).toBeGreaterThan(0);
    for (const box of boxes) {
      // Half a pixel of slack for sub-pixel layout.
      expect(box.x, `${what}: ${selector} starts left of the screen`).toBeGreaterThanOrEqual(-0.5);
      expect(box.y, `${what}: ${selector} starts above the screen`).toBeGreaterThanOrEqual(-0.5);
      expect(box.right, `${what}: ${selector} ends right of the screen`).toBeLessThanOrEqual(
        size.width + 0.5,
      );
      expect(box.bottom, `${what}: ${selector} ends below the screen`).toBeLessThanOrEqual(
        size.height + 0.5,
      );
    }
  }
}

/**
 * The hand's cards may run past the screen's edges since plan 03-10 (Romain's larger cards: past the
 * left edge in the phone's corner, past the bottom edge in the computer's bar), but each shows on the
 * screen at least 44 x 44 px and its whole top corner index, and none starts above the screen or ends
 * past its right edge.
 */
async function expectCardsShown(page: Page, what: string) {
  const size = page.viewportSize();
  if (!size) throw new Error("no viewport");
  const cards = await page.locator("[data-hand] [data-card]").evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const index = node.querySelector(".corner.top")?.getBoundingClientRect();
      return {
        name: node.getAttribute("aria-label") ?? "",
        x: box.x,
        y: box.y,
        right: box.right,
        bottom: box.bottom,
        index: index ? { x: index.x, y: index.y, right: index.right, bottom: index.bottom } : null,
      };
    }),
  );
  expect(cards.length, `${what}: no card`).toBeGreaterThan(0);
  for (const card of cards) {
    const label = `${what}: « ${card.name} »`;
    expect(card.y, `${label} starts above the screen`).toBeGreaterThanOrEqual(-0.5);
    expect(card.right, `${label} ends right of the screen`).toBeLessThanOrEqual(size.width + 0.5);
    const shownX = Math.min(size.width, card.right) - Math.max(0, card.x);
    const shownY = Math.min(size.height, card.bottom) - Math.max(0, card.y);
    expect(shownX, `${label} shows under 44 px across`).toBeGreaterThanOrEqual(43.8);
    expect(shownY, `${label} shows under 44 px down`).toBeGreaterThanOrEqual(43.8);
    expect(card.index, `${label} has no index`).not.toBeNull();
    if (card.index) {
      expect(card.index.x, `${label}: its index past the left edge`).toBeGreaterThanOrEqual(-0.5);
      expect(card.index.bottom, `${label}: its index past the bottom`).toBeLessThanOrEqual(
        size.height + 0.5,
      );
    }
  }
}

/**
 * The landscape galet, the game's only board (Romain's « paysage obligatoire », D-07): twice as wide
 * as it is tall.
 */
async function expectLandscapeGalet(page: Page, what: string) {
  const box = await page.locator("[data-board]").boundingBox();
  expect(box, `${what}: no board`).not.toBeNull();
  expect(
    Math.abs((box?.height ?? 0) - 0.5 * (box?.width ?? 1)),
    `${what}: the board is not 2:1`,
  ).toBeLessThan(2);
  expect(box?.width ?? 0, `${what}: the board has no size`).toBeGreaterThan(90);
}

for (const size of SIZES) {
  test.describe(`écran ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test.skip(
      ({ isMobile }) => isMobile && size.width >= 1000,
      "a 1280 px wide screen is the desktop project",
    );

    test(`tient entier, sans défiler, de l’échange au coup joué (${size.name})`, async ({
      page,
    }) => {
      // From the launch screen, then into a seeded game in test speed.
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Jouer la partie" })).toBeVisible();
      await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
      await expect(page.locator("[data-board]")).toHaveClass(/loaded/);

      const chrome = ["[data-board]", "[data-info-bar]", "[data-action-zone]", "[data-hand]"];
      const fits = async (what: string) => {
        await expectFits(page, what, chrome);
        await expectCardsShown(page, what);
      };

      // The exchange: five cards in the hand, the choice asked in the action zone.
      await expect(zone(page)).toHaveAttribute("data-state", "exchange");
      await expectLandscapeGalet(page, "échange");
      await expectBarBoard(page, "échange");
      await fits("échange");
      await page.locator("[data-hand] [data-card]").first().click();
      await fits("échange, carte choisie");
      await page.getByRole("button", { name: "Passer cette carte" }).click();

      // His turn: card selected, knight tapped (the preview; at once for a lone knight, recette 3,
      // test 27), then the move.
      await untilOwnTurn(page);
      await fits("à toi de jouer");
      const card = page
        .locator('[data-hand] [data-state="playable"]:not([data-card^="7"]):not([data-card^="11"])')
        .first();
      await card.click();
      await chooseKnight(page, () => fits("carte choisie"));
      await expect(page.locator("[data-ghost]")).toBeVisible();
      await fits("aperçu du coup");
      await expectLandscapeGalet(page, "aperçu");
      await page.getByRole("button", { name: /^Jouer/ }).click();
      await expect(page.locator('[data-felt-last="bleu"]')).toBeVisible();
      await fits("après le coup");
    });

    test(`l’assistant du 7 tient sous le plateau ou autour de lui (${size.name})`, async ({
      page,
    }) => {
      await page.goto("/");
      await page.goto(`/#/partie?etat=${etatParam(SEVEN)}&vitesse=test`);
      await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
      await expect(zone(page)).toHaveAttribute("data-state", "idle");
      await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
      await expect(page.locator("[data-seven-panel]")).toBeVisible();
      await expectLandscapeGalet(page, "le 7");
      await expectBarBoard(page, "le 7");
      // In the computer's bar the assistant is one panel under the board; in the compact mode
      // (plan 01-47) its region has no box of its own and its parts stand around the board: the line
      // over it, the step chips in the left strip, the buttons in the right one.
      const compact = (await page.locator("main.game").getAttribute("data-chrome")) === "compact";
      const parts = compact
        ? ["[data-seven-line]", "[data-seven-chips]", "[data-seven-buttons]"]
        : ["[data-seven-panel]"];
      // The step chips' column may run past the screen inside its scrolling strip (480 x 320): it is
      // checked by compact.spec; here only that it stays beside the board.
      const chrome = [
        "[data-board]",
        "[data-info-bar]",
        ...parts.filter((part) => part !== "[data-seven-chips]"),
      ];

      /** None of the assistant's parts covers the board: each is below it, above it or beside it. */
      const expectClear = async (what: string) => {
        const board = await page.locator("[data-board]").boundingBox();
        if (!board) throw new Error("no box for the board");
        for (const part of parts) {
          for (const spot of await page.locator(part).all()) {
            const box = await spot.boundingBox();
            if (!box || box.width === 0 || box.height === 0) continue;
            const below = box.y >= board.y + board.height - 1;
            const above = box.y + box.height <= board.y + 1;
            const beside = box.x >= board.x + board.width - 1 || box.x + box.width <= board.x + 1;
            expect(below || above || beside, `${what}: ${part} covers the board`).toBe(true);
          }
        }
      };

      await expectFits(page, "le 7, rien de réparti", chrome);
      await expectClear("le 7, rien de réparti");

      // Two knights and their steps: the assistant at its fullest still fits.
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expectClear("le 7, sept pastilles");
      await page.getByRole("button", { name: "4 pas" }).click();
      await page.locator('[data-hit="bleu1"]').click({ force: true });
      await page.getByRole("button", { name: "3 pas" }).click();
      await expect(page.locator("[data-remaining]")).toHaveText("Tout est réparti.");
      await expectFits(page, "le 7, tout réparti", chrome);
      await expectClear("le 7, tout réparti");
      await expect(page.getByRole("button", { name: "Jouer", exact: true })).toBeEnabled();
    });
  });
}

// --- Keyboard and assistive technology ---

/** The accessible name of a control, as the page itself gives it (label, labelled-by, then its text). */
function namesOfControls(page: Page) {
  return page.evaluate(() => {
    const controls = document.querySelectorAll(
      'button, a[href], [role="button"], [role="switch"], [role="radio"], input, select, textarea, [tabindex="0"]',
    );
    const out: { tag: string; name: string }[] = [];
    for (const control of controls) {
      const box = control.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      const labelled = control.getAttribute("aria-labelledby");
      const labels = (control as HTMLInputElement).labels;
      const name =
        control.getAttribute("aria-label") ??
        (labelled
          ? labelled
              .split(" ")
              .map((id) => document.getElementById(id)?.textContent ?? "")
              .join(" ")
          : null) ??
        (labels && labels.length > 0
          ? [...labels].map((label) => label.textContent).join(" ")
          : null) ??
        control.textContent ??
        "";
      out.push({ tag: control.tagName.toLowerCase(), name: name.trim() });
    }
    return out;
  });
}

const FOCUS = () => {
  const element = document.activeElement as HTMLElement | null;
  if (!element || element === document.body) return "";
  return `${element.getAttribute("aria-label") ?? element.textContent?.trim() ?? ""}`;
};

/** Presses Tab until the focus is back where it started (or `limit` times) and lists where it landed. */
async function tabOrder(page: Page, limit = 40): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const where = await page.evaluate(FOCUS);
    if (where === "") continue; // the focus left the page for the browser's own controls
    if (seen[0] === where) break;
    seen.push(where);
  }
  return seen;
}

test.describe("au clavier", () => {
  // Two knights on the ring can play the Dame, so she lights them both (a lone knight would be
  // chosen by itself, recette 3, test 27).
  const HAND = {
    turn: "bleu",
    pawns: { bleu: [{ p: 10 }, { p: 30 }, "S", "S"] },
    hands: { bleu: ["12H", "4S", "11S"] },
  };

  async function openHand(page: Page) {
    await page.goto("/");
    await page.goto(`/#/partie?etat=${etatParam(HAND)}&vitesse=test`);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
  }

  test("l’ordre de Tab: réglages, chevaux éclairés, tapis, boutons d’action, cartes de la main", async ({
    page,
  }) => {
    await openHand(page);

    // No card selected: the settings, the felt, then the hand (one card holds the tab stop). In the
    // compact mode of a phone held sideways (plan 01-47) the info pill, at the top of the left strip,
    // comes first, then « Réglages » at the top of the right one.
    const idle = await tabOrder(page);
    const compact = (await page.locator("main.game").getAttribute("data-chrome")) === "compact";
    if (compact) {
      expect(idle[0]).toMatch(/^Infos de la partie\s:\s/);
      expect(idle[1]).toBe("Réglages");
    } else {
      expect(idle[0]).toBe("Réglages");
    }
    expect(idle.indexOf("Sur le tapis")).toBeGreaterThan(0);
    expect(
      idle.findIndex((name) => /^(?!Cheval).+, (jouable|pas jouable)$/.test(name)),
    ).toBeGreaterThan(idle.indexOf("Sur le tapis"));

    // Arrow keys walk across the cards, Entrée selects.
    const labels = await page
      .locator("[data-hand] [data-card]")
      .evaluateAll((cards) => cards.map((card) => card.getAttribute("aria-label")));
    expect(labels).toHaveLength(3);
    await page.locator("[data-hand] [data-card]").first().focus();
    expect(await page.evaluate(FOCUS)).toBe(labels[0]);
    await page.keyboard.press("ArrowRight");
    expect(await page.evaluate(FOCUS)).toBe(labels[1]);
    await page.keyboard.press("ArrowRight");
    expect(await page.evaluate(FOCUS)).toBe(labels[2]);
    await page.keyboard.press("ArrowLeft");
    expect(await page.evaluate(FOCUS)).toBe(labels[1]);
    // Walk to the queen and select it with Entrée.
    for (let i = 0; i < 3 && (await page.evaluate(FOCUS)) !== "Dame de cœur, jouable"; i++) {
      await page.keyboard.press("ArrowRight");
    }
    expect(await page.evaluate(FOCUS)).toBe("Dame de cœur, jouable");
    await page.keyboard.press("Enter");
    await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");

    // A card is selected: the lit knight and the action buttons come before the hand.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const lit = await tabOrder(page);
    const at = (pattern: RegExp | string) =>
      lit.findIndex((name) =>
        typeof pattern === "string" ? name === pattern : pattern.test(name),
      );
    expect(at("Réglages"), "Réglages").toBeGreaterThanOrEqual(0);
    const knight = "Cheval bleu A, à 10 cases de sa sortie, jouable";
    expect(at(knight), "Cheval bleu A").toBeGreaterThan(at("Réglages"));
    expect(at("Sur le tapis"), "tapis").toBeGreaterThan(at(knight));
    expect(at("Changer de carte"), "Changer de carte").toBeGreaterThan(at("Sur le tapis"));
    expect(at(/^(?!Cheval).+, (jouable|pas jouable)$/), "main").toBeGreaterThan(
      at("Changer de carte"),
    );
  });

  test("Échap ferme la feuille ouverte, ferme le plateau de choix, ou désélectionne la carte", async ({
    page,
  }) => {
    await openHand(page);
    await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
    await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");

    // A sheet open over the game: Échap closes it and keeps the card selected.
    await page.getByRole("button", { name: "Réglages", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Réglages" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Réglages" })).toHaveCount(0);
    await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
    await page.getByRole("button", { name: "Sur le tapis" }).click();
    await expect(page.getByRole("dialog", { name: "Sur le tapis" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Sur le tapis" })).toHaveCount(0);
    await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");

    // Nothing open: Échap deselects the card.
    await page.keyboard.press("Escape");
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
  });

  test("deux chevaux éclairés d’une couleur se distinguent : lettre et place", async ({ page }) => {
    await page.goto("/");
    await page.goto(
      `/#/partie?etat=${etatParam({
        turn: "bleu",
        pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"] },
        hands: { bleu: ["3S", "13H"] },
      })}&vitesse=test`,
    );
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await page.getByRole("button", { name: "3 de pique, jouable" }).click();
    await expect(
      page.getByRole("button", { name: "Cheval bleu A, à 5 cases de sa sortie, jouable" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cheval bleu B, à 20 cases de sa sortie, jouable" }),
    ).toBeVisible();
  });

  test("Échap ferme le plateau de choix des chevaux serrés", async ({ page }) => {
    await page.goto("/");
    await page.goto(
      `/#/partie?etat=${etatParam({
        turn: "bleu",
        pawns: { bleu: [{ p: 5 }, { p: 6 }, "S", "S"] },
        hands: { bleu: ["3S"] },
      })}&vitesse=test`,
    );
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await page.getByRole("button", { name: "3 de pique, jouable" }).click();
    await page.locator('[data-hit="bleu0"]').click({ force: true });
    await expect(zone(page)).toHaveAttribute("data-state", "tray");
    await expect(page.locator("[data-tray-option]")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-tray-option]")).toHaveCount(0);
    await expect(zone(page)).not.toHaveAttribute("data-state", "tray");
  });

  test("tout contrôle a un nom en français; cartes et chevaux se lisent « …, jouable »", async ({
    page,
  }) => {
    await openHand(page);
    await expect(page.getByRole("button", { name: "Dame de cœur, jouable" })).toBeVisible();
    // A card that cannot be played says so as well.
    await expect(page.getByRole("button", { name: "Valet de pique, pas jouable" })).toBeVisible();
    await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
    await expect(
      page.getByRole("button", { name: "Cheval bleu A, à 10 cases de sa sortie, jouable" }),
    ).toBeVisible();

    const controls = await namesOfControls(page);
    expect(controls.length).toBeGreaterThan(5);
    for (const control of controls) {
      expect(control.name, `un ${control.tag} sans nom`).not.toBe("");
    }

    // The settings and the felt, in an open sheet, are named too.
    await page.getByRole("button", { name: "Réglages", exact: true }).click();
    for (const control of await namesOfControls(page)) {
      expect(control.name, `un ${control.tag} sans nom dans Réglages`).not.toBe("");
    }
  });
});

// --- Without any sound (FX-06) ---

test.describe("sans le son", () => {
  test.skip(({ isMobile }) => isMobile, "one long game, on the desktop project only");

  test("« Son » coupé dès le départ, une partie entière se joue jusqu’à l’écran de fin", async ({
    page,
  }) => {
    test.setTimeout(10 * 60_000);
    // « Son » off before the first load; the audio of the page cannot even be created.
    await page.addInitScript(() => {
      localStorage.setItem("toc.settings.v1", JSON.stringify({ sound: false }));
      const refuse = function refuse() {
        throw new Error("AudioContext indisponible");
      };
      Object.assign(window, { AudioContext: refuse, webkitAudioContext: refuse });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Réglages", exact: true }).click();
    await expect(page.getByRole("switch", { name: "Son", exact: true })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await page.keyboard.press("Escape");

    await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);

    const { plays } = await playToEnd(page);
    expect(plays).toBeGreaterThan(20);
    const end = page.locator("[data-end-screen]");
    await expect(end.getByRole("heading", { name: /^(Victoire !|Défaite)$/ })).toBeVisible();
    // The end plank (plan 01-50): the winning team has its 8 knights home on the score.
    const won = (await end.getAttribute("data-result")) === "win";
    await expect(end.locator(`[data-score="${won ? "nous" : "eux"}"] .number`)).toHaveText("8");
    await expect(end.locator("[data-end-knight] img")).toHaveCount(2);
    // The sound stayed off all along.
    const gains = await page.evaluate(
      () =>
        (window as unknown as { __tocDebug?: { audio: { gains?: { master: number } } } }).__tocDebug
          ?.audio.gains,
    );
    expect(gains?.master).toBe(0);
  });
});
