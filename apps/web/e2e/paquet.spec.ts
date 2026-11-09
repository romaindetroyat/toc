import { expect, type Page, test } from "@playwright/test";
import { audit } from "./audit.ts";
import { playSimpleMove, zone } from "./jouer.ts";
import { etatParam } from "./position.ts";

// « Les cartes jouées » (quick task 261109-80e, the sheet of 261109-6an turned round): for each rank,
// how many of its 4 cards were already played in this pack, the dead hands laid down included
// (deckCount(view).played). One tap on the défausse pile opens it, on the phone as on the computer;
// « T », the computer's info-row button and the button at the top of « Sur le tapis » too; the solo
// computers wait while it is open; it fits without scrolling at the reference sizes and passes the
// audit. Positions are made by hand with the `etat` debug parameter at test speed.

async function openPosition(page: Page, etat: unknown, state = "idle") {
  await page.goto("/");
  await page.goto(`/#/partie?etat=${etatParam(etat)}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(zone(page)).toHaveAttribute("data-state", state);
}

const sheet = (page: Page) => page.getByRole("dialog", { name: "Les cartes jouées" });
const defausse = (page: Page) => page.locator("[data-defausse-button]");
const tapis = (page: Page) => page.getByRole("dialog", { name: "Sur le tapis" });
const boardPawn = (page: Page, id: string) => page.locator(`[data-board] [data-pawn="${id}"]`);

/** Waits for the open sheet's slide in to end. */
async function settled(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.querySelector("[data-deck-ranks]")?.closest('[role="dialog"]')?.getAnimations()
            .length ?? -1,
      ),
    )
    .toBe(0);
}

// The second deal of a pack, as a position: four cards in each hand, 36 in the talon, nothing played
// yet (a position starts with an empty discard pile).
const PACK = {
  turn: "bleu",
  dealIndex: 1,
  pawns: { bleu: [{ p: 10 }, "S", "S", "S"], jaune: [{ p: 20 }, "S", "S", "S"] },
  hands: {
    bleu: ["1S", "7H", "11D", "13C"],
    jaune: ["2S", "3S", "4S", "5S"],
    rouge: ["2H", "3H", "4H", "5H"],
    vert: ["2D", "3D", "4D", "5D"],
  },
};

// The first deal of a pack, one card each, every knight in its stable: Bleu brings a knight out with
// its As, Jaune with its As, Rouge with its Roi, and Vert, who cannot play its 3, lays it down. The deal
// is over and the second one opens on the exchange: 4 cards played in this pack, the As twice.
const PLAYED = {
  turn: "bleu",
  hands: { bleu: ["1S"], jaune: ["1H"], rouge: ["13S"], vert: ["3S"] },
};

/** Plays PLAYED out: Bleu's As, then the computers, until the exchange of the second deal. */
async function playFourCards(page: Page) {
  await openPosition(page, PLAYED);
  await playSimpleMove(page);
  await expect(zone(page)).toHaveAttribute("data-state", "exchange", { timeout: 20_000 });
}

// A Dame for Bleu's lone knight; Jaune holds a 3 and plays right after Bleu.
const QUEEN = {
  turn: "bleu",
  pawns: { bleu: [{ p: 10 }, "S", "S", "S"], jaune: [{ p: 20 }, "S", "S", "S"] },
  hands: { bleu: ["12H"], jaune: ["3S"] },
};

test.describe("la feuille « Les cartes jouées »", () => {
  test("une touche sur la défausse l’ouvre : As 2, Roi 1, 3 1", async ({ page }) => {
    await playFourCards(page);
    const target = defausse(page);
    await expect(target).toHaveAttribute("aria-label", "Cartes jouées");
    await expect(target).toHaveAttribute("aria-haspopup", "dialog");
    const box = await target.boundingBox();
    if (!box) throw new Error("no box for the défausse target");
    expect(box.width).toBeGreaterThanOrEqual(43.8);
    expect(box.height).toBeGreaterThanOrEqual(43.8);
    // The pile drawn under it, its top card face up, lies inside the target.
    const pile = await page.locator("[data-discard]").boundingBox();
    if (!pile) throw new Error("no box for the défausse pile");
    const middle = [pile.x + pile.width / 2, pile.y + pile.height / 2] as const;
    expect(middle[0]).toBeGreaterThan(box.x);
    expect(middle[0]).toBeLessThan(box.x + box.width);
    expect(middle[1]).toBeGreaterThan(box.y);
    expect(middle[1]).toBeLessThan(box.y + box.height);

    await page.mouse.click(middle[0], middle[1]);
    await expect(sheet(page)).toBeVisible();
    const expected: Record<number, number> = { 1: 2, 13: 1, 3: 1 };
    for (let rank = 1; rank <= 13; rank++) {
      await expect(page.locator(`[data-deck-rank="${rank}"]`), `rank ${rank}`).toHaveAttribute(
        "data-played",
        String(expected[rank] ?? 0),
      );
    }
    const as = page.locator('[data-deck-rank="1"]');
    await expect(as.locator(".face")).toHaveText(/^\s*As\s*2\s*$/);
    await expect(as.locator(".sr-only")).toHaveText("As : 2 jouées sur 4");
    await expect(page.locator('[data-deck-rank="13"] .sr-only')).toHaveText("Roi : 1 jouée sur 4");
    await expect(page.locator('[data-deck-rank="5"] .sr-only')).toHaveText("5 : aucune jouée");
    await expect(as.locator(".dot.full")).toHaveCount(2);
    await expect(page.locator("[data-deck-deal]")).toHaveText(
      "Donne 2 sur 3 de ce paquet · 4 cartes jouées",
    );
    await expect(page.locator("[data-deck-talon]")).toHaveText("32 cartes au talon.");

    await sheet(page).getByRole("button", { name: "Fermer" }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(target).toBeFocused();
  });

  test("le milieu du tapis ouvre toujours « Sur le tapis »", async ({ page }) => {
    await openPosition(page, PACK);
    await page.locator("[data-felt-button]").click();
    await expect(tapis(page)).toBeVisible();
    await expect(sheet(page)).toHaveCount(0);
  });

  test("« T » ouvre et ferme « Les cartes jouées »", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard shortcuts are for computers");
    await openPosition(page, PACK);
    await page.keyboard.press("t");
    await expect(sheet(page)).toBeVisible();

    const ranks = page.locator("[data-deck-rank]");
    await expect(ranks).toHaveCount(13);
    // Nothing played yet in this position: every rank shows 0.
    for (let rank = 1; rank <= 13; rank++) {
      await expect(page.locator(`[data-deck-rank="${rank}"]`), `rank ${rank}`).toHaveAttribute(
        "data-played",
        "0",
      );
    }
    await expect(page.locator("[data-key-rank]")).toHaveCount(4);
    await expect(page.locator("[data-deck-deal]")).toHaveText(
      "Donne 2 sur 3 de ce paquet · aucune carte jouée",
    );
    await expect(page.locator("[data-deck-talon]")).toHaveText("36 cartes au talon.");

    // Game keys do nothing behind it.
    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    await page.keyboard.press("T");
    await expect(sheet(page)).toBeHidden();

    // Under another sheet « T » does nothing.
    await page.keyboard.press("?");
    const help = page.getByRole("dialog", { name: "Raccourcis clavier" });
    await expect(help).toBeVisible();
    await expect(help).toContainText("Ouvrir les cartes jouées");
    await page.keyboard.press("t");
    await expect(sheet(page)).toHaveCount(0);
  });

  test("le bouton de la rangée ouvre la feuille", async ({ page, isMobile }) => {
    test.skip(isMobile, "the info row's buttons are the computer's");
    await openPosition(page, PACK);
    const names = await page
      .locator("[data-table-row-buttons] button")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
    expect(names.slice(0, 2)).toEqual(["Règles du jeu", "Cartes jouées"]);
    const button = page.locator("[data-deck-button]");
    await expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await expect(button).toHaveAttribute("title", "Cartes jouées");
    await expect(button).toHaveAttribute("aria-keyshortcuts", "T");
    await expect(page.locator('[data-deck-button] [data-key-hint="T"]')).toBeVisible();
    await button.click();
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("depuis « Sur le tapis », son bouton tout en haut", async ({ page }) => {
    await openPosition(page, PACK);
    await page.locator("[data-felt-button]").click();
    await expect(tapis(page)).toBeVisible();
    // The button comes first, before the rows of the seats.
    await expect(page.locator("[data-tapis] > :first-child")).toHaveAttribute(
      "data-tapis-deck",
      "",
    );
    const button = page.locator("[data-tapis-deck]");
    await expect(button).toHaveText("Cartes jouées");
    await expect(button).toBeInViewport();
    await button.click();
    await expect(tapis(page)).toHaveCount(0);
    await expect(sheet(page)).toBeVisible();
    await expect(page.locator('[data-deck-rank="1"]')).toHaveAttribute("data-played", "0");
    await sheet(page).getByRole("button", { name: "Fermer" }).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.locator("[data-felt-button]")).toBeFocused();
  });

  test("en leçon aussi", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard shortcuts are for computers");
    await page.goto("/");
    await page.goto("/#/apprendre/1?vitesse=test");
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await page.keyboard.press("t");
    await expect(sheet(page)).toBeVisible();
    await expect(page.locator("[data-deck-rank]")).toHaveCount(13);
  });

  test("contre l’ordinateur, personne ne joue tant que la feuille est ouverte", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the info row's button is the computer's");
    await openPosition(page, QUEEN);
    await page.locator('[data-hand] [data-card="12H"]').click();
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    const before = await boardPawn(page, "jaune0").getAttribute("data-place");
    // Bleu plays and opens the sheet in the same instant: Jaune is due right after.
    await page.evaluate(() => {
      const play = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
        /^Jouer/.test(button.textContent?.trim() ?? ""),
      );
      if (play === undefined) throw new Error("no « Jouer » button");
      play.click();
      (document.querySelector("[data-deck-button]") as HTMLButtonElement).click();
    });
    await expect(sheet(page)).toBeVisible();
    await expect(boardPawn(page, "bleu0")).toHaveAttribute("data-place", "ring:22");
    await page.waitForTimeout(3000);
    await expect(boardPawn(page, "jaune0")).toHaveAttribute("data-place", before ?? "");
    await expect(page.locator('[data-felt-last="jaune"]')).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();
    await expect(boardPawn(page, "jaune0")).not.toHaveAttribute("data-place", before ?? "");
  });

  for (const size of [
    { width: 844, height: 390, phone: true },
    { width: 480, height: 320, phone: true },
    { width: 1280, height: 800, phone: false },
  ]) {
    test(`tout tient sans défiler et passe l’audit en ${size.width} x ${size.height}`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile !== size.phone, "each size on its own project");
      await page.setViewportSize({ width: size.width, height: size.height });
      await playFourCards(page);
      await defausse(page).click();
      await expect(sheet(page)).toBeVisible();
      await settled(page);
      await expect(page.locator('[data-deck-rank="1"]')).toHaveAttribute("data-played", "2");
      await fits(page);
      expect(await audit(page, `les cartes jouées ${size.width} x ${size.height}`)).toEqual([]);
    });
  }
});

/** The deal line and the 13 ranks inside the sheet's body, without any scroll. */
async function fits(page: Page) {
  const fit = await page.evaluate(() => {
    const dialog = document.querySelector("[data-deck-ranks]")?.closest('[role="dialog"]');
    const body = document.querySelector("[data-deck-ranks]")?.closest("[data-sheet-body]");
    if (!dialog || !body) throw new Error("no sheet");
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const root = document.documentElement;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      dialog: rect(dialog),
      body: rect(body),
      pageScroll: root.scrollWidth > root.clientWidth || root.scrollHeight > root.clientHeight,
      bodySideways: body.scrollWidth > body.clientWidth + 1,
      scrolled: body.scrollTop,
      parts: [
        { what: "deal", ...rect(document.querySelector("[data-deck-deal]") as Element) },
        ...[...document.querySelectorAll("[data-deck-rank]")].map((el) => ({
          what: `rank ${el.getAttribute("data-deck-rank")}`,
          ...rect(el),
        })),
      ],
    };
  });
  expect(fit.dialog.left).toBeGreaterThanOrEqual(-0.5);
  expect(fit.dialog.top).toBeGreaterThanOrEqual(-0.5);
  expect(fit.dialog.right).toBeLessThanOrEqual(fit.viewport.width + 0.5);
  expect(fit.dialog.bottom).toBeLessThanOrEqual(fit.viewport.height + 0.5);
  expect(fit.pageScroll, "page scroll").toBe(false);
  expect(fit.bodySideways, "sideways scroll in the sheet").toBe(false);
  expect(fit.scrolled).toBe(0);
  expect(fit.parts).toHaveLength(14);
  for (const part of fit.parts) {
    expect(part.left, part.what).toBeGreaterThanOrEqual(fit.body.left - 0.5);
    expect(part.right, part.what).toBeLessThanOrEqual(fit.body.right + 0.5);
    expect(part.top, part.what).toBeGreaterThanOrEqual(fit.body.top - 0.5);
    expect(part.bottom, part.what).toBeLessThanOrEqual(fit.body.bottom + 0.5);
  }
}
