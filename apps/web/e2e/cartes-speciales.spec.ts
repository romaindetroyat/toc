import { expect, type Page, test } from "@playwright/test";
import { etatParam } from "./position.ts";

// Positions made by hand with the `etat` debug parameter (the `before` block of an engine scenario) at
// test speed: no think delay, no motion. Only Bleu holds cards, so after his play the next deal starts and
// waits for the exchange: the knights stay where his move left them.

const zone = (page: Page) => page.locator("[data-action-zone]");

async function openPosition(page: Page, etat: unknown) {
  await page.goto("/");
  await page.goto(`/#/partie?etat=${etatParam(etat)}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(zone(page)).toHaveAttribute("data-state", "idle");
}

const placeOf = (page: Page, pawn: string) =>
  page.locator(`[data-pawn="${pawn}"]`).getAttribute("data-place");

test("As et Roi : « Que veux-tu faire ? », « Sortir » montre la sortie sans toucher de cheval", async ({
  page,
}) => {
  // One knight on the ring and three in the stable: both an exit and an advance are possible.
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
    hands: { bleu: ["1S", "13H"] },
  });

  await page.getByRole("button", { name: "As de pique, jouable" }).click();
  await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
  await expect(zone(page)).toContainText("Que veux-tu faire ?");
  const exit = page.getByRole("button", { name: "Sortir un cheval" });
  const advance = page.getByRole("button", { name: "Avancer de 1", exact: true });
  await expect(exit).toBeVisible();
  await expect(advance).toBeVisible();
  // The two choices are buttons of at least 48 px, side by side; no knight is lit yet.
  const [exitBox, advanceBox] = [await exit.boundingBox(), await advance.boundingBox()];
  expect(exitBox?.height).toBeGreaterThanOrEqual(48);
  expect(advanceBox?.height).toBeGreaterThanOrEqual(48);
  expect(Math.abs((exitBox?.y ?? 0) - (advanceBox?.y ?? 99))).toBeLessThan(2);
  await expect(page.locator("[data-halo]")).toHaveCount(0);

  // The Roi asks the same question with its own number.
  await page.getByRole("button", { name: "Roi de cœur, jouable" }).click();
  await expect(page.getByRole("button", { name: "Avancer de 13", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "As de pique, jouable" }).click();

  // « Sortir »: the preview shows the exit onto the diamond with no tap on a knight.
  const before = await placeOf(page, "bleu1");
  await page.getByRole("button", { name: "Sortir un cheval" }).click();
  await expect(zone(page)).toHaveAttribute("data-state", "preview");
  await expect(page.locator("[data-ghost]")).toBeVisible();
  await expect(zone(page)).toContainText("Sort de l’écurie.");

  // Nothing is played by itself (D-19).
  await page.waitForTimeout(2000);
  expect(await placeOf(page, "bleu1")).toBe(before);

  await page.getByRole("button", { name: "Jouer", exact: true }).click();
  await expect(page.locator('[data-place="ring:0"]')).toHaveCount(1);
  await expect(page.locator('[data-pawn="bleu1"]')).toHaveAttribute("data-place", "ring:0");
});

test("le Roi : « Avancer de 13 » éclaire les chevaux de l’anneau puis montre le trajet", async ({
  page,
}) => {
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
    hands: { bleu: ["13H"] },
  });
  await page.getByRole("button", { name: "Roi de cœur, jouable" }).click();
  await page.getByRole("button", { name: "Avancer de 13", exact: true }).click();
  await expect(zone(page)).toContainText("Un seul cheval peut jouer cette carte");
  await expect(page.locator("[data-halo]")).toHaveCount(1);
  await page.locator('[data-hit="bleu0"]').click({ force: true });
  await expect(page.locator("[data-ghost]")).toBeVisible();
  await expect(zone(page)).toContainText("avance de 13 cases.");
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
  await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:23");
});

test("une seule façon de jouer l’As ou le Roi : la question n’est pas posée", async ({ page }) => {
  // Every knight in the stable: only the exit.
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: ["S", "S", "S", "S"] },
    hands: { bleu: ["1S"] },
  });
  await page.getByRole("button", { name: "As de pique, jouable" }).click();
  await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
  await expect(zone(page)).not.toContainText("Que veux-tu faire ?");
  await expect(page.locator("[data-halo]")).toHaveCount(4);
});

test("une seule façon de jouer le Roi sur l’anneau : la question n’est pas posée", async ({
  page,
}) => {
  // No knight in the stable: only advancing.
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 10 }, { p: 25 }, { p: 40 }, { p: 55 }] },
    hands: { bleu: ["13H"] },
  });
  await page.getByRole("button", { name: "Roi de cœur, jouable" }).click();
  await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
  await expect(zone(page)).not.toContainText("Que veux-tu faire ?");
  await expect(page.locator("[data-halo]")).not.toHaveCount(0);
});

test("le Valet : mon cheval, puis celui à échanger, deux flèches, deux ombres, rien ne bouge seul", async ({
  page,
}) => {
  // Bleu's knight on cell 5, a Vert knight on cell 22 and a Jaune knight on cell 64: two targets.
  await openPosition(page, {
    turn: "bleu",
    pawns: {
      bleu: [{ p: 5 }, "S", "S", "S"],
      vert: [{ p: 40 }, "S", "S", "S"],
      jaune: [{ p: 46 }, "S", "S", "S"],
    },
    hands: { bleu: ["11H"] },
  });

  await page.getByRole("button", { name: "Valet de cœur, jouable" }).click();
  await expect(zone(page)).toHaveAttribute("data-state", "jackPick");
  await expect(zone(page)).toContainText("Valet : touche ton cheval, puis celui à échanger.");
  await expect(page.locator('[data-halo="bleu0"]')).toBeVisible();

  // First tap: his knight. The targets are lit.
  await page.locator('[data-hit="bleu0"]').click({ force: true });
  await expect(zone(page)).toHaveAttribute("data-state", "jackTarget");
  await expect(zone(page)).toContainText("Maintenant, touche le cheval à échanger.");
  await expect(page.locator('[data-halo="vert0"]')).toBeVisible();
  await expect(page.locator('[data-halo="jaune0"]')).toBeVisible();

  // Second tap: the target. Two crossing arrows and a ghost of each knight at the other's place.
  const mine = await placeOf(page, "bleu0");
  const theirs = await placeOf(page, "vert0");
  await page.locator('[data-hit="vert0"]').click({ force: true });
  await expect(zone(page)).toHaveAttribute("data-state", "preview");
  await expect(zone(page)).toContainText("Échange avec un cheval vert.");
  await expect(page.locator("[data-swap-preview] path[stroke-dasharray]")).toHaveCount(2);
  await expect(page.locator("[data-swap-preview] [data-ghost]")).toHaveCount(2);
  await expect(page.locator('[data-ghost="bleu0"]')).toBeVisible();
  await expect(page.locator('[data-ghost="vert0"]')).toBeVisible();

  // Two seconds later nothing has moved (D-19), even though this swap was one of two.
  await page.waitForTimeout(2000);
  expect(await placeOf(page, "bleu0")).toBe(mine);
  expect(await placeOf(page, "vert0")).toBe(theirs);
  const play = page.getByRole("button", { name: "Jouer", exact: true });
  await expect(play).toBeVisible();

  await play.click();
  await expect.poll(() => placeOf(page, "bleu0")).toBe(theirs);
  expect(await placeOf(page, "vert0")).toBe(mine);
});

test("le Valet : un seul échange possible attend quand même « Jouer »", async ({ page }) => {
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 5 }, "S", "S", "S"], vert: [{ p: 40 }, "S", "S", "S"] },
    hands: { bleu: ["11H"] },
  });
  await page.getByRole("button", { name: "Valet de cœur, jouable" }).click();
  await page.locator('[data-hit="bleu0"]').click({ force: true });
  await page.locator('[data-hit="vert0"]').click({ force: true });
  await expect(page.locator("[data-swap-preview]")).toBeVisible();

  const before = await placeOf(page, "bleu0");
  await page.waitForTimeout(2000);
  expect(await placeOf(page, "bleu0")).toBe(before);

  // « Annuler ce coup » gives the card back; nothing was played.
  await page.getByRole("button", { name: "Annuler ce coup" }).click();
  await expect(zone(page)).toHaveAttribute("data-state", "idle");
  expect(await placeOf(page, "bleu0")).toBe(before);
});

test("chevaux serrés : le plateau propose des pastilles A et B, « Choisir un autre cheval » le ferme", async ({
  page,
  isMobile,
}) => {
  // The phone project already is a phone (390 x 664); the desktop project is cut down to 375 x 667.
  if (!isMobile) await page.setViewportSize({ width: 375, height: 667 });

  // Two knights on neighbouring cells: both can play the 3, a finger cannot tell them apart.
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 5 }, { p: 6 }, "S", "S"] },
    hands: { bleu: ["3S"] },
  });
  await page.getByRole("button", { name: "3 de pique, jouable" }).click();
  await page.locator('[data-hit="bleu0"]').click({ force: true });

  // The tray replaces the prompt: two chips of 44 x 56, the same letters over the knights.
  await expect(zone(page)).toHaveAttribute("data-state", "tray");
  const chips = page.locator("[data-tray-option]");
  await expect(chips).toHaveCount(2);
  const box = await chips.first().boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(56);
  await expect(page.locator('[data-letter="bleu0"]')).toHaveText("A");
  await expect(page.locator('[data-letter="bleu1"]')).toHaveText("B");
  await expect(page.locator("[data-ghost]")).toHaveCount(0);
  await expect(zone(page)).not.toContainText("Choisis un cheval");

  // « Choisir un autre cheval » closes it: the card is still selected, both knights still lit.
  await page.getByRole("button", { name: "Choisir un autre cheval" }).click();
  await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
  await expect(page.locator("[data-tray]")).toHaveCount(0);
  await expect(page.locator("[data-halo]")).toHaveCount(2);
  await expect(page.locator('[data-card="3S"]')).toHaveAttribute("data-state", "selected");

  // Open it again and choose B: the preview is that knight's.
  await page.locator('[data-hit="bleu0"]').click({ force: true });
  await expect(zone(page)).toHaveAttribute("data-state", "tray");
  await page.getByRole("button", { name: "Cheval B, bleu" }).click();
  await expect(zone(page)).toHaveAttribute("data-state", "preview");
  await expect(page.locator('[data-selected="bleu1"]')).toBeVisible();
  await expect(zone(page)).toContainText("avance de 3 cases.");

  // Still nothing played without « Jouer ».
  await page.waitForTimeout(1000);
  expect(await placeOf(page, "bleu1")).toBe("ring:6");
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
  await expect.poll(() => placeOf(page, "bleu1")).toBe("ring:9");
});

// ---------------------------------------------------------------------------------------------
// The 7, knight by knight (PLAY-03, D-17) and the finished player's partner knights (RULE-17).

const panel = (page: Page) => page.locator("[data-seven-panel]");
const counter = (page: Page) => page.locator("[data-remaining]");
const rows = (page: Page) => page.locator("[data-seven-row]");
const chip = (page: Page, steps: number) => page.getByRole("button", { name: `${steps} pas` });
const tap = (page: Page, pawn: string) =>
  page.locator(`[data-hit="${pawn}"]`).click({ force: true });

// bleu0 on cell 5, bleu1 on cell 20, a Jaune knight on cell 8 that bleu0 eats on the way.
const SEVEN_CAPTURE = {
  turn: "bleu",
  pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
  hands: { bleu: ["7H"] },
};

test("le 7 : réparti sur deux chevaux, prise en chemin, un seul « Jouer »", async ({ page }) => {
  await openPosition(page, SEVEN_CAPTURE);
  await page.getByRole("button", { name: "7 de cœur, jouable" }).click();

  // The panel replaces the action zone and the hand; nothing is spread yet.
  await expect(panel(page)).toBeVisible();
  await expect(page.locator("[data-hand]")).toHaveCount(0);
  await expect(page.locator("[data-action-zone]")).toHaveCount(0);
  await expect(panel(page)).toContainText("Le 7 : répartis tes pas");
  await expect(counter(page)).toHaveText("Reste 7");
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Jouer", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Retirer le dernier pas" })).toBeDisabled();
  await expect(page.locator('[data-halo="bleu0"]')).toBeVisible();
  await expect(page.locator('[data-halo="bleu1"]')).toBeVisible();

  // First knight: 4 steps, which pass the Jaune knight. The × badge shows before « Jouer ».
  await tap(page, "bleu0");
  await expect(panel(page)).toContainText("Combien de pas pour ce cheval ?");
  await chip(page, 4).click();
  await expect(counter(page)).toHaveText("Reste 3");
  await expect(rows(page)).toHaveText(["Cheval A : 4 pas"]);
  await expect(page.locator('[data-capture="jaune0"]')).toBeVisible();
  await expect(page.locator('[data-seven-ghost="bleu0"]')).toBeVisible();
  await expect(page.locator("[data-seven-path]")).toHaveCount(1);
  await expect(panel(page)).toContainText("Il reste 3 pas à jouer.");
  await expect(page.getByRole("button", { name: "Jouer", exact: true })).toBeDisabled();
  // Only the chips up to what is left are offered.
  await expect(page.locator("[data-step]")).toHaveCount(3);

  // Undo takes back this micro-move only: back to Reste 7, no capture, no row.
  await page.getByRole("button", { name: "Retirer le dernier pas" }).click();
  await expect(counter(page)).toHaveText("Reste 7");
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator("[data-capture]")).toHaveCount(0);

  // Again, then a second knight for the rest.
  await tap(page, "bleu0");
  await chip(page, 4).click();
  await tap(page, "bleu1");
  await chip(page, 3).click();
  await expect(counter(page)).toHaveText("Tout est réparti.");
  await expect(rows(page)).toHaveText(["Cheval A : 4 pas", "Cheval B : 3 pas"]);
  await expect(page.locator("[data-seven-path]")).toHaveCount(2);

  // « Retirer le dernier pas » from here restores the previous preview, the capture included.
  await page.getByRole("button", { name: "Retirer le dernier pas" }).click();
  await expect(counter(page)).toHaveText("Reste 3");
  await expect(page.locator('[data-capture="jaune0"]')).toBeVisible();
  await tap(page, "bleu1");
  await chip(page, 3).click();

  // Nothing has moved yet (D-19): the victim is still on its cell.
  await page.waitForTimeout(1000);
  expect(await placeOf(page, "jaune0")).toBe("ring:8");
  expect(await placeOf(page, "bleu0")).toBe("ring:5");

  const play = page.getByRole("button", { name: "Jouer", exact: true });
  await expect(play).toBeEnabled();
  await play.click();
  await expect.poll(() => placeOf(page, "bleu0")).toBe("ring:9");
  expect(await placeOf(page, "bleu1")).toBe("ring:23");
  await expect.poll(() => placeOf(page, "jaune0")).toMatch(/^stable:jaune:/);
  await expect(panel(page)).toHaveCount(0);
});

test("le 7 : « Tout annuler » rend la main, rien n’a bougé", async ({ page }) => {
  await openPosition(page, SEVEN_CAPTURE);
  await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
  await tap(page, "bleu0");
  await chip(page, 2).click();
  await tap(page, "bleu1");
  await chip(page, 5).click();
  await expect(counter(page)).toHaveText("Tout est réparti.");

  await page.getByRole("button", { name: "Tout annuler" }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(zone(page)).toHaveAttribute("data-state", "idle");
  await expect(page.locator("[data-hand]")).toBeVisible();
  await expect(page.locator('[data-card="7H"]')).toHaveAttribute("data-state", "playable");
  expect(await placeOf(page, "bleu0")).toBe("ring:5");
  expect(await placeOf(page, "bleu1")).toBe("ring:20");
});

test("le 7 : un nombre de pas qui empêcherait de finir est grisé et s’explique au toucher", async ({
  page,
}) => {
  // bleu0 is four cells from the home: only 3 or 7 steps leave a 7 that can be finished.
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 68 }, { h: 1 }, { h: 2 }, { h: 3 }], rouge: [{ p: 9 }, "S", "S", "S"] },
    hands: { bleu: ["7H"] },
  });
  await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
  await tap(page, "bleu0");
  await expect(chip(page, 1)).toHaveAttribute("aria-disabled", "true");
  await expect(chip(page, 3)).toHaveAttribute("aria-disabled", "false");
  await expect(chip(page, 7)).toHaveAttribute("aria-disabled", "false");

  // A chip that is off is still tappable (aria-disabled): Playwright needs force to try it.
  await chip(page, 1).click({ force: true });
  await expect(panel(page)).toContainText("Ce nombre de pas t’empêcherait de finir le 7.");
  await expect(counter(page)).toHaveText("Reste 7");
  await expect(rows(page)).toHaveCount(0);

  // A good number clears the explanation and the partner's knight takes over for the rest (G12).
  await chip(page, 3).click();
  await expect(counter(page)).toHaveText("Reste 4");
  await expect(panel(page)).not.toContainText("Ce nombre de pas");
  await tap(page, "rouge0");
  await chip(page, 4).click();
  await expect(rows(page)).toHaveText(["Cheval A bleu : 3 pas", "Cheval A rouge : 4 pas"]);
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
  await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "home:bleu:0");
  await expect(page.locator('[data-pawn="rouge0"]')).toHaveAttribute("data-place", "ring:49");
});

test("le 7 : un chiffre sans cheval choisi demande d’abord un cheval", async ({ page }) => {
  await openPosition(page, SEVEN_CAPTURE);
  await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
  await chip(page, 3).click({ force: true });
  await expect(panel(page)).toContainText("Choisis un cheval.");
  await expect(counter(page)).toHaveText("Reste 7");
  await expect(rows(page)).toHaveCount(0);
});

test("RULE-17 : un joueur dont les quatre chevaux sont rentrés joue ceux de son partenaire", async ({
  page,
}) => {
  const finished = {
    turn: "bleu",
    pawns: {
      bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
      rouge: [{ p: 9 }, { p: 30 }, "S", "S"],
    },
    hands: { bleu: ["5H", "7H"] },
  };
  await page.goto("/");
  await page.goto(`/#/partie?etat=${etatParam(finished)}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(zone(page)).toHaveAttribute("data-state", "finishedPrompt");
  await expect(zone(page)).toContainText("Tes quatre chevaux sont rentrés.");

  // A number card with a partner knight.
  await page.getByRole("button", { name: "5 de cœur, jouable" }).click();
  await expect(page.locator('[data-halo="rouge0"]')).toBeVisible();
  await expect(page.locator('[data-halo="rouge1"]')).toBeVisible();
  await tap(page, "rouge0");
  await expect(zone(page)).toHaveAttribute("data-state", "preview");
  // Back to the card choice: the 7, spread over both partner knights.
  await page.getByRole("button", { name: "Annuler ce coup" }).click();
  await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
  await expect(panel(page)).toBeVisible();
  await expect(page.locator('[data-halo="rouge0"]')).toBeVisible();
  await tap(page, "rouge0");
  await chip(page, 3).click();
  await tap(page, "rouge1");
  await chip(page, 4).click();
  await expect(counter(page)).toHaveText("Tout est réparti.");
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
  await expect(page.locator('[data-pawn="rouge0"]')).toHaveAttribute("data-place", "ring:48");
  await expect(page.locator('[data-pawn="rouge1"]')).toHaveAttribute("data-place", "ring:70");
});
