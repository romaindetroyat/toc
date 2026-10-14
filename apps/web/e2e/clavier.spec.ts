import { expect, type Page, test } from "@playwright/test";
import { zone } from "./jouer.ts";
import { etatParam } from "./position.ts";

// The keyboard shortcuts of the game screen (UI-SPEC « Addendum 2026-10-14 — Raccourcis clavier »): a
// computer player plays with the keyboard alone. Positions are made by hand with the `etat` debug
// parameter at test speed; after the page has loaded, nothing is clicked (the keys do everything).

async function openPosition(page: Page, etat: unknown, state = "idle") {
  await page.goto("/");
  await page.goto(`/#/partie?etat=${etatParam(etat)}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(zone(page)).toHaveAttribute("data-state", state);
}

const pawn = (page: Page, id: string) => page.locator(`[data-pawn="${id}"]`);

test.describe("au clavier seul", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard shortcuts are for computers");

  test("la Dame : 1, A, Entrée jouent le coup sans la souris", async ({ page }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
      hands: { bleu: ["12H"] },
    });

    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
    await page.keyboard.press("a");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.keyboard.press("Enter");
    await expect(pawn(page, "bleu0")).toHaveAttribute("data-place", "ring:22");
  });
});
