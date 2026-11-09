import { expect, test } from "@playwright/test";

// The short message (Toast.svelte) that is already up when the game screen appears (plan 04-12, a
// bug the phase's cross-browser path found on the phone held sideways): the message looks for the
// board on the next frames, finds it, moves over the felt, and that is all. Before the fix, finding the
// board re-ran the message's own effect without end (Svelte's effect_update_depth_exceeded), and the
// update that came with it was lost: on a phone, a knight could stay in place after « Jouer ».

test("un message affiché avant le plateau se place sur le tapis sans boucle sans fin", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  // A browser that cannot start the sound: its message comes at the first tap, before the board.
  await page.addInitScript(() => {
    const refuse = function refuse() {
      throw new Error("AudioContext indisponible");
    };
    Object.assign(window, { AudioContext: refuse, webkitAudioContext: refuse });
  });
  await page.goto("/#/ordinateur");
  await page.getByRole("button", { name: "Jouer la partie" }).click();
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  const toast = page.locator("[data-toast]");
  await expect(toast).toContainText("Le son n’a pas pu démarrer.");

  // The board is found within the two seconds of frames the message looks for it.
  const compact = (await page.locator('main.game[data-chrome="compact"]').count()) > 0;
  if (compact) {
    await expect(page.locator(".toast-region")).toHaveClass(/over-felt/);
  }
  await page.waitForTimeout(2500);
  expect(errors.filter((text) => /effect_update_depth_exceeded/.test(text))).toEqual([]);
  // The message is still there, over the felt on the phone, at the bottom elsewhere.
  await expect(toast).toBeVisible();
});
