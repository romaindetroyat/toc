import { expect, type Page } from "@playwright/test";

// Shared helpers of the specs that play through the screen alone: only taps on cards, knights, chips
// and buttons, as a person would.

export const zone = (page: Page) => page.locator("[data-action-zone]");

/** Chooses the first card of the hand and passes it to the partner. */
export async function exchange(page: Page) {
  await expect(zone(page)).toHaveAttribute("data-state", "exchange");
  await page.locator("[data-hand] [data-card]").first().click();
  await page.getByRole("button", { name: "Passer cette carte" }).click();
}

/**
 * Plays the game forward until it is the player's turn with a card he can play: the exchange of every
 * deal is made with the first card, a dead hand is posed. The bots play by themselves.
 */
export async function untilOwnTurn(page: Page) {
  for (let i = 0; i < 300; i++) {
    const state = await zone(page).getAttribute("data-state");
    if (state === "idle" || state === "finishedPrompt") return;
    if (state === "exchange") await exchange(page);
    else if (state === "deadHand")
      await page.getByRole("button", { name: "Poser mes cartes" }).click();
    else await page.waitForTimeout(50);
  }
  throw new Error("the player's turn never came");
}

/** Plays one simple card: a card that moves a knight (not the 7 nor the Valet), the first lit knight, « Jouer ». */
export async function playSimpleMove(page: Page) {
  const card = page
    .locator('[data-hand] [data-state="playable"]:not([data-card^="7"]):not([data-card^="11"])')
    .first();
  await expect(card).toBeVisible();
  await card.click();
  const halo = page.locator("[data-halo]").first();
  await expect(halo).toBeVisible();
  const pawn = await halo.getAttribute("data-halo");
  const before = await page.locator(`[data-pawn="${pawn}"]`).getAttribute("data-place");
  await page.locator(`[data-hit="${pawn}"]`).click({ force: true });
  await page.getByRole("button", { name: /^Jouer/ }).click();
  await expect(page.locator(`[data-pawn="${pawn}"]`)).not.toHaveAttribute(
    "data-place",
    before ?? "",
  );
}
