import { expect, type Page, test } from "@playwright/test";
import { audit } from "./audit.ts";
import { zone } from "./jouer.ts";
import { etatParam } from "./position.ts";

// « Les cartes du paquet » (quick task 261109-6an): for each rank, how many of its 4 cards the player
// has not seen in this pack, exactly what a computer player remembers (deckCount on the PlayerView).
// « T », the computer's info-row button and the button of « Sur le tapis » open it; the solo
// computers wait while it is open; it fits at the reference sizes and passes the audit. Positions are
// made by hand with the `etat` debug parameter at test speed.

async function openPosition(page: Page, etat: unknown, state = "idle") {
  await page.goto("/");
  await page.goto(`/#/partie?etat=${etatParam(etat)}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(zone(page)).toHaveAttribute("data-state", state);
}

const sheet = (page: Page) => page.getByRole("dialog", { name: "Les cartes du paquet" });
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

// The second deal of a pack: four cards in each hand, 36 in the talon. Bleu holds an As, a 7, a Valet
// and a Roi; nobody else holds one, so those ranks show 3 hidden and every other rank 4.
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

// A Dame for Bleu's lone knight; Jaune holds a 3 and plays right after Bleu.
const QUEEN = {
  turn: "bleu",
  pawns: { bleu: [{ p: 10 }, "S", "S", "S"], jaune: [{ p: 20 }, "S", "S", "S"] },
  hands: { bleu: ["12H"], jaune: ["3S"] },
};

test.describe("la feuille « Les cartes du paquet »", () => {
  test("« T » ouvre et ferme « Les cartes du paquet »", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard shortcuts are for computers");
    await openPosition(page, PACK);
    await page.keyboard.press("t");
    await expect(sheet(page)).toBeVisible();

    const ranks = page.locator("[data-deck-rank]");
    await expect(ranks).toHaveCount(13);
    for (let rank = 1; rank <= 13; rank++) {
      const hidden = [1, 7, 11, 13].includes(rank) ? "3" : "4";
      await expect(page.locator(`[data-deck-rank="${rank}"]`), `rank ${rank}`).toHaveAttribute(
        "data-hidden",
        hidden,
      );
    }
    await expect(page.locator("[data-key-rank]")).toHaveCount(4);
    const deal = page.locator("[data-deck-deal]");
    await expect(deal).toContainText("Donne 2 sur 3 de ce paquet");
    await expect(deal).toContainText("36 cartes au talon");

    // Game keys do nothing behind it.
    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    await page.keyboard.press("T");
    await expect(sheet(page)).toBeHidden();

    // Under another sheet « T » does nothing.
    await page.keyboard.press("?");
    const help = page.getByRole("dialog", { name: "Raccourcis clavier" });
    await expect(help).toBeVisible();
    await expect(help).toContainText("Ouvrir les cartes du paquet");
    await page.keyboard.press("t");
    await expect(sheet(page)).toHaveCount(0);
  });

  test("le bouton de la rangée ouvre la feuille", async ({ page, isMobile }) => {
    test.skip(isMobile, "the info row's buttons are the computer's");
    await openPosition(page, PACK);
    const names = await page
      .locator("[data-table-row-buttons] button")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
    expect(names.slice(0, 2)).toEqual(["Règles du jeu", "Les cartes du paquet"]);
    const button = page.locator("[data-deck-button]");
    await expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await expect(button).toHaveAttribute("title", "Les cartes du paquet");
    await expect(button).toHaveAttribute("aria-keyshortcuts", "T");
    await expect(page.locator('[data-deck-button] [data-key-hint="T"]')).toBeVisible();
    await button.click();
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("depuis « Sur le tapis »", async ({ page }) => {
    await openPosition(page, PACK);
    await page.locator("[data-felt-button]").click();
    await expect(tapis(page)).toBeVisible();
    await page.locator("[data-tapis-deck]").click();
    await expect(tapis(page)).toHaveCount(0);
    await expect(sheet(page)).toBeVisible();
    await expect(page.locator('[data-deck-rank="1"]')).toHaveAttribute("data-hidden", "3");
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

  test("tout tient et passe l’audit", async ({ page, isMobile }) => {
    await openPosition(page, PACK);
    if (isMobile) {
      await page.locator("[data-felt-button]").click();
      await expect(tapis(page)).toBeVisible();
      await page.locator("[data-tapis-deck]").click();
    } else {
      await page.locator("[data-deck-button]").click();
    }
    await expect(sheet(page)).toBeVisible();
    await settled(page);

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
    expect(await audit(page, "les cartes du paquet")).toEqual([]);
  });
});
