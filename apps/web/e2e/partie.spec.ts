import { expect, type Page, test } from "@playwright/test";
import { etatParam } from "./position.ts";

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

// R-14.2 (packages/engine/scenarios/fin.ts) with a Jaune hand that can play: in the fixture itself the
// other hands are empty, so the next deal starts the moment Bleu lays his cards down and the posed
// hand would not stay on the felt long enough to be seen. Bleu holds a 2, a 4 and a Valet with every
// knight in its stable: nothing can be played.
const DEAD_HAND = {
  turn: "bleu",
  hands: { bleu: ["2S", "4S", "11S"], jaune: ["2H", "3H", "5H"] },
  pawns: { jaune: [{ p: 5 }, "S", "S", "S"] },
};

test("main injouable : rien ne se pose seul, « Poser mes cartes » étale la main sur le tapis", async ({
  page,
}) => {
  await openGame(page, `etat=${etatParam(DEAD_HAND)}`);

  await expect(zone(page)).toHaveAttribute("data-state", "deadHand");
  await expect(zone(page)).toContainText("Aucune carte ne peut être jouée.");
  const pose = page.getByRole("button", { name: "Poser mes cartes" });
  await expect(pose).toBeVisible();
  await expect(page.locator('[data-hand] [data-state="unplayable"]')).toHaveCount(3);

  // Two seconds later the hand is still in the hand zone: the game never poses it for the player (D-20).
  await page.waitForTimeout(2000);
  await expect(page.locator("[data-hand] [data-card]")).toHaveCount(3);
  await expect(page.locator("[data-felt-posed]")).toHaveCount(0);

  await pose.click();
  await expect(page.locator('[data-felt-posed="bleu"] [data-felt-card]')).toHaveCount(3);
  await expect(zone(page)).toContainText("Tu attends la prochaine donne.");
  await expect(page.locator("[data-hand] [data-card]")).toHaveCount(0);
  await expect(page.locator("[data-hand-empty]")).toContainText("Plus de cartes");
  await expect(page.locator("[data-hand-empty]")).toContainText(
    "Attends la prochaine donne : les autres joueurs finissent leur tour.",
  );
});

test("fin de partie : « Victoire ! », les chiffres, « Changer de couleur » revient au départ", async ({
  page,
}) => {
  // R-16.4: Bleu's four knights are home and the 5 brings Rouge's last knight home (RULE-17, RULE-18).
  await openGame(page, "scenario=R-16.4&vitesse=test");
  // The partner is a horse picked at random: « ceux de Marengo » or « ceux d’Ourasi ».
  await expect(zone(page)).toContainText(
    /Tes quatre chevaux sont rentrés\. Tu joues avec ceux d(e |’)\S+\./,
  );
  await expect(page.locator("[data-info-bar] [data-team-us]")).toContainText("Nous 7/8");

  await page.getByRole("button", { name: "5 de pique, jouable" }).click();
  // The partner's knights carry the halos.
  await expect(page.locator('[data-halo="rouge3"]')).toBeVisible();
  await page.locator('[data-hit="rouge3"]').click({ force: true });
  await page.getByRole("button", { name: "Jouer", exact: true }).click();

  const end = page.locator("[data-end-screen]");
  await expect(end).toBeVisible();
  await expect(end.getByRole("heading", { name: "Victoire !" })).toBeVisible();
  await expect(end).toContainText("Ton équipe a rentré ses 8 chevaux.");
  await expect(end).toContainText(/Donnes jouées\s*: 0/);
  await expect(end).toContainText(/Chevaux mangés\s*: nous 0, eux 0/);
  await expect(page.getByRole("button", { name: "Rejouer" })).toBeFocused();

  // The game behind the panel is inert: none of its controls can take the focus, and after a tap on
  // the dimmed board Tab stays in the panel.
  await expect(page.locator("[data-layout]")).toHaveAttribute("inert", "");
  const behind = await page.evaluate(() => {
    const gear = document.querySelector<HTMLElement>("[data-layout] button");
    gear?.focus();
    return gear !== null && document.activeElement === gear;
  });
  expect(behind, "a button of the game behind takes the focus").toBe(false);
  await page.mouse.click(4, 4);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    const inPanel = await page.evaluate(
      () => document.activeElement?.closest("[data-end-screen]") !== null,
    );
    expect(inPanel, `Tab ${i + 1} stays in the end screen`).toBe(true);
  }

  await page.getByRole("button", { name: "Changer de couleur" }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole("button", { name: "Jouer la partie" })).toBeVisible();
});

test("fin de partie : « Rejouer » ouvre une nouvelle partie avec la même couleur", async ({
  page,
}) => {
  // R-16.1: Rouge plays the 5 that brings his last knight home, which wins for Bleu and Rouge.
  await openGame(page, "scenario=R-16.1&vitesse=test");
  const turns = await page.locator("[data-board]").getAttribute("data-k");
  expect(turns).not.toBe("0");

  await page.getByRole("button", { name: "5 de pique, jouable" }).click();
  await page.locator('[data-hit="rouge3"]').click({ force: true });
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
  await expect(page.locator("[data-end-screen]")).toBeVisible();

  await page.getByRole("button", { name: "Rejouer" }).click();
  await expect(page.locator("[data-end-screen]")).toHaveCount(0);
  await expect(page.locator("[data-board]")).toHaveAttribute("data-k", turns as string);
  await expect(zone(page)).toHaveAttribute("data-state", "exchange");
  await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
  await expect(page.locator("[data-info-bar]")).toContainText("Donne 1 sur 3");
  await expect(page.locator("[data-info-bar] [data-team-us]")).toContainText("Nous 0/8");
});
