import { expect, test } from "@playwright/test";
import { playToEnd } from "./jouer.ts";

// A whole game against three computer players, played through the screen alone: only taps on cards,
// knights, chips and buttons, as a person would (success criterion 2 of phase 1). The deck and the bots
// are seeded (`graine`) and there is no think delay (`vitesse=test`), so the game is the same each time.
// The player's strategy is the plainest one: the first card that can be played, the first knight lit.

const SEED = "00c0ffee00c0ffee1234567890abcdef";

test.skip(({ isMobile }) => isMobile, "one long game, on the desktop project only");

test("une partie entière contre trois ordinateurs, au doigt, jusqu’à l’écran de fin", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  await page.goto("/");
  await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);

  const { dealSizes, dealers, banners, posed, sevens, valets, plays } = await playToEnd(page);

  // The end screen is the only way out of the loop: « Victoire ! » or « Défaite ».
  const end = page.locator("[data-end-screen]");
  await expect(end).toBeVisible();
  await expect(end.getByRole("heading", { name: /^(Victoire !|Défaite)$/ })).toBeVisible();
  await expect(end.locator('[data-stat="deals"]')).toContainText(/Donnes jouées/);

  // Deals of 5, 4 then 4 cards, over and over.
  expect(dealSizes.slice(0, 4)).toEqual([5, 4, 4, 5]);
  for (const [i, size] of dealSizes.entries()) expect(size, `deal ${i + 1}`).toBe([5, 4, 4][i % 3]);
  // The dealer changes, the banner announces the deals.
  expect(dealers.size).toBeGreaterThanOrEqual(2);
  expect([...banners].some((text) => /Donne 1 sur 3\s*·\s*5 cartes/.test(text))).toBe(true);
  expect([...banners].some((text) => /Donne 2 sur 3\s*·\s*4 cartes/.test(text))).toBe(true);
  // A hand that could not be played was laid down at least once.
  expect(posed).toBeGreaterThanOrEqual(1);
  // The game was a real one.
  expect(plays).toBeGreaterThan(20);
  test.info().annotations.push({
    type: "partie",
    description: `${dealSizes.length} donnes, ${plays} coups, ${sevens} sept, ${valets} valets, ${posed} mains posées, donneurs ${[...dealers].join("/")}`,
  });
});
