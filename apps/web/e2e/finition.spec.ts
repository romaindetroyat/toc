import { expect, type Page, test } from "@playwright/test";
import { playSimpleMove, playToEnd, untilOwnTurn, zone } from "./jouer.ts";
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

    // The whole felt square is the target: at least 44 px each way.
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

type Gauge = { name: string; width: number; height: number };
const SIZES: Gauge[] = [
  { name: "320x480", width: 320, height: 480 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "480x320 (paysage)", width: 480, height: 320 },
  { name: "1280x800", width: 1280, height: 800 },
];

/** Bleu holds a 7 and two knights on the ring: the 7 panel opens with one tap on the card. */
const SEVEN = {
  turn: "bleu",
  pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"] },
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

async function expectSquareBoard(page: Page, what: string) {
  const box = await page.locator("[data-board]").boundingBox();
  expect(box, `${what}: no board`).not.toBeNull();
  expect(
    Math.abs((box?.width ?? 0) - (box?.height ?? 1)),
    `${what}: the board is not square`,
  ).toBeLessThan(1.5);
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
      const hand = [...chrome, "[data-hand] [data-card]"];

      // The exchange: five cards in the hand, the choice asked in the action zone.
      await expect(zone(page)).toHaveAttribute("data-state", "exchange");
      await expectSquareBoard(page, "échange");
      await expectFits(page, "échange", hand);
      await page.locator("[data-hand] [data-card]").first().click();
      await expectFits(page, "échange, carte choisie", hand);
      await page.getByRole("button", { name: "Passer cette carte" }).click();

      // His turn: card selected, knight tapped (the preview), then the move.
      await untilOwnTurn(page);
      await expectFits(page, "à toi de jouer", hand);
      const card = page
        .locator('[data-hand] [data-state="playable"]:not([data-card^="7"]):not([data-card^="11"])')
        .first();
      await card.click();
      await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
      await expectFits(page, "carte choisie", hand);
      const pawn = await page.locator("[data-halo]").first().getAttribute("data-halo");
      await page.locator(`[data-hit="${pawn}"]`).click({ force: true });
      await expect(page.locator("[data-ghost]")).toBeVisible();
      await expectFits(page, "aperçu du coup", hand);
      await expectSquareBoard(page, "aperçu");
      await page.getByRole("button", { name: /^Jouer/ }).click();
      await expect(page.locator('[data-felt-last="bleu"]')).toBeVisible();
      await expectFits(page, "après le coup", hand);
    });

    test(`le panneau du 7 tient sous le plateau (${size.name})`, async ({ page }) => {
      await page.goto("/");
      await page.goto(`/#/partie?etat=${etatParam(SEVEN)}&vitesse=test`);
      await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
      await expect(zone(page)).toHaveAttribute("data-state", "idle");
      await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
      const panel = page.locator("[data-seven-panel]");
      await expect(panel).toBeVisible();
      await expectSquareBoard(page, "le 7");
      await expectFits(page, "le 7, rien de réparti", [
        "[data-board]",
        "[data-info-bar]",
        "[data-seven-panel]",
      ]);

      // Under the board on a portrait screen, beside it on a landscape one.
      const board = await page.locator("[data-board]").boundingBox();
      const below = await panel.boundingBox();
      if (size.height > size.width) {
        expect(below?.y ?? 0, "le panneau passe sous le plateau").toBeGreaterThanOrEqual(
          (board?.y ?? 0) + (board?.height ?? 0) - 1,
        );
      } else {
        expect(below?.x ?? 0, "le panneau passe à côté du plateau").toBeGreaterThanOrEqual(
          (board?.x ?? 0) + (board?.width ?? 0) - 1,
        );
      }

      // Two knights and their steps: the panel at its fullest still fits.
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await page.getByRole("button", { name: "4 pas" }).click();
      await page.locator('[data-hit="bleu1"]').click({ force: true });
      await page.getByRole("button", { name: "3 pas" }).click();
      await expect(page.locator("[data-remaining]")).toHaveText("Tout est réparti.");
      await expectFits(page, "le 7, tout réparti", [
        "[data-board]",
        "[data-info-bar]",
        "[data-seven-panel]",
      ]);
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
  const HAND = {
    turn: "bleu",
    pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
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

    // No card selected: the settings, the felt, then the hand (one card holds the tab stop).
    const idle = await tabOrder(page);
    expect(idle[0]).toBe("Réglages");
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
    // The sound stayed off all along.
    const gains = await page.evaluate(
      () =>
        (window as unknown as { __tocDebug?: { audio: { gains?: { master: number } } } }).__tocDebug
          ?.audio.gains,
    );
    expect(gains?.master).toBe(0);
  });
});
