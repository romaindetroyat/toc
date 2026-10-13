import { expect, type Page, test } from "@playwright/test";

// A seeded game (the `graine` debug parameter fixes the deck and the bots) at test speed (no think
// delay, no motion), and positions made by hand for the dead hand and the end of the game.
const SEED = "1234567890abcdef1234567890abcdef";

const zone = (page: Page) => page.locator("[data-action-zone]");

async function openGame(page: Page, query: string) {
  await page.goto("/");
  await page.goto(`/#/partie?${query}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

/** Chooses the first card of the hand and passes it to the partner. */
async function exchange(page: Page) {
  await expect(zone(page)).toHaveAttribute("data-state", "exchange");
  await page.locator("[data-hand] [data-card]").first().click();
  await page.getByRole("button", { name: "Passer cette carte" }).click();
}

/**
 * Plays the game forward until it is the player's turn with a card he can play: the exchange of every
 * deal is made with the first card, a dead hand is posed. The bots play by themselves.
 */
async function untilOwnTurn(page: Page) {
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

test("l’échange : choisir, passer, attendre, recevoir une carte marquée « Reçue »", async ({
  page,
}) => {
  await openGame(page, `graine=${SEED}&vitesse=test`);

  // The info bar names the dealer and the deal; the felt shows the talon and the empty défausse.
  await expect(page.locator("[data-info-bar]")).toContainText("Donneur");
  await expect(page.locator("[data-info-bar]")).toContainText("Donne 1 sur 3");
  await expect(page.locator("[data-info-bar] [data-team-us]")).toContainText("Nous 0/8");
  await expect(page.locator("[data-info-bar] [data-team-them]")).toContainText("Eux 0/8");
  await expect(page.locator("[data-talon]")).toHaveAttribute("data-talon", "32");
  await expect(page.locator("[data-discard]")).toHaveAttribute("data-discard", "0");
  await expect(page.locator("[data-felt-last]")).toHaveCount(0);
  await expect(page.locator("[data-felt]")).toHaveAttribute("aria-label", "Sur le tapis");

  // Every card can be passed: the button waits for a choice.
  await expect(zone(page)).toContainText("Choisis la carte à passer à");
  const pass = page.getByRole("button", { name: "Passer cette carte" });
  await expect(pass).toBeDisabled();
  const given = await page.locator("[data-hand] [data-card]").first().getAttribute("data-card");
  await page.locator("[data-hand] [data-card]").first().click();
  await expect(pass).toBeEnabled();
  await pass.click();

  // The partner's card arrives: « Échange fait », and the received card carries its tag.
  await expect(zone(page)).toContainText("Échange fait. Tu as reçu");
  await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
  await expect(page.locator("[data-hand] [data-card]").first()).toBeVisible();
  await expect(page.getByText("Reçue", { exact: true })).toBeVisible();
  await expect(page.locator(`[data-hand] [data-card="${given}"]`)).toHaveCount(0);
  await expect(page.locator("[data-info-bar]")).toContainText("Donneur");
});

test("un coup simple : carte, cheval, aperçu, rien ne bouge seul, « Jouer », la carte sur le tapis", async ({
  page,
}) => {
  await openGame(page, `graine=${SEED}&vitesse=test`);
  await untilOwnTurn(page);

  // A card that moves a knight: not the 7 nor the Valet, which come with later plans.
  const card = page
    .locator('[data-hand] [data-state="playable"]:not([data-card^="7"]):not([data-card^="11"])')
    .first();
  await expect(card).toBeVisible();
  const played = await card.getAttribute("data-card");
  await card.click();

  // The knights that can play it are lit; tap one.
  const halo = page.locator("[data-halo]").first();
  await expect(halo).toBeVisible();
  const pawn = await halo.getAttribute("data-halo");
  await page.locator(`[data-hit="${pawn}"]`).click({ force: true });
  await expect(page.locator("[data-ghost]")).toBeVisible();
  const play = page.getByRole("button", { name: /^Jouer/ });
  await expect(play).toBeVisible();
  await expect(page.getByRole("button", { name: "Annuler ce coup" })).toBeVisible();

  const places = () =>
    page
      .locator('[data-pawn^="bleu"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-place")));
  const before = await places();

  // Two seconds later nothing has moved: the game never plays for the player (D-19).
  await page.waitForTimeout(2000);
  expect(await places()).toEqual(before);
  await expect(play).toBeVisible();

  await play.click();
  await expect.poll(places).not.toEqual(before);

  // The card lies on the felt in front of his place.
  await expect(page.locator('[data-felt-last="bleu"]')).toBeVisible();
  await expect(page.locator(`[data-felt-last="bleu"] [data-felt-card="${played}"]`)).toBeVisible();
});
