import { expect, type Page, test } from "@playwright/test";
import { playSimpleMove, untilOwnTurn, zone } from "./jouer.ts";

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
