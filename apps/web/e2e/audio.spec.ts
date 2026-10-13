import { expect, test } from "@playwright/test";

type Rendered = Record<string, { duration: number; peak: number }>;
type TocWindow = Window & { __tocDebug?: { audio: { sounds?: Rendered } } };

// Every synthesized Phase 1 sound renders to a non-silent buffer in a real browser (no listening
// here: whether it sounds like a horse is Romain's call on the sound test page).
test("audio: tous les sons synthétisés sont rendus, audibles et de la bonne durée", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer la partie" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-audio", "running");
  await expect
    .poll(() =>
      page.evaluate(() => Object.keys((window as TocWindow).__tocDebug?.audio.sounds ?? {}).length),
    )
    .toBe(13); // 3 hoof variants + 6 neighs + 3 card sounds + 1 ambience
  const sounds = await page.evaluate(() => (window as TocWindow).__tocDebug?.audio.sounds ?? {});

  for (const [key, { peak }] of Object.entries(sounds)) {
    expect(peak, key).toBeGreaterThan(0.05);
    expect(peak, key).toBeLessThanOrEqual(1);
  }
  const seconds = (key: string) => sounds[key]?.duration ?? 0;
  expect(seconds("neigh-sortie#0")).toBeCloseTo(1.15, 1);
  expect(seconds("neigh-surpris#0")).toBeLessThan(0.5);
  expect(seconds("neigh-ruade#0")).toBeLessThan(0.4);
  expect(seconds("neigh-fete#0")).toBeGreaterThan(seconds("neigh-joyeux#0"));
  expect(seconds("card-donne#0")).toBeGreaterThan(seconds("card-pose#0"));
  expect(seconds("ambience#0")).toBeCloseTo(8, 2);
});

// A reload or a PWA relaunch lands on #/partie without the launch screen's « Jouer la partie » tap:
// the first gesture on the game screen creates and resumes the audio.
test("audio: une partie ouverte directement démarre le son au premier geste", async ({ page }) => {
  await page.goto("/#/partie?vitesse=test");
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(page.locator("body")).not.toHaveAttribute("data-audio", /.*/);
  await page.locator("[data-board]").click({ position: { x: 4, y: 4 } });
  await expect(page.locator("body")).toHaveAttribute("data-audio", "running");
});
