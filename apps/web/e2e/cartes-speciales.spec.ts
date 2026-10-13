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
