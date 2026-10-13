import { expect, test } from "@playwright/test";

type TocWindow = Window & { __tocDebug?: { audio: { scheduled: number[] } } };

test("tracer: Jouer la partie -> plateau -> le cavalier bleu bondit de 4 cases", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer la partie" }).click();
  await expect(page).toHaveURL(/#\/partie$/);

  // The four quarters are assembled into one board image.
  const board = page.locator("img[src*='plateau']");
  await expect(board).toBeVisible();
  await expect
    .poll(() => board.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  // Audio was unlocked inside the tap.
  await expect(page.locator("body")).toHaveAttribute("data-audio", "running");

  const knight = page.locator('[data-pawn="bleu0"]');
  await expect(knight).toHaveAttribute("data-ring", "0");
  await knight.click();

  // One animation lasts hopTimeline(4).total = 799 ms.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .some((a) => Math.abs(Number(a.effect?.getTiming().duration) - 799) <= 1),
  );

  await expect(knight).toHaveAttribute("data-ring", "4");

  // hopTimeline(4).clops, written as a literal so the spec does not import workspace TypeScript.
  const scheduled = await page.evaluate(() => (window as TocWindow).__tocDebug?.audio.scheduled);
  expect(scheduled).toEqual([199.75, 399.5, 599.25, 799]);
});
