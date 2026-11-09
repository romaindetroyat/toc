import { expect, type Page, test } from "@playwright/test";
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
});
