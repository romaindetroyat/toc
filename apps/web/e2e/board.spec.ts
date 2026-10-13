import { expect, test } from "@playwright/test";

const VARIANTS = ["plateau-640.webp", "plateau-1280.webp", "plateau-2560.webp"];

const VIEWPORTS = [
  { width: 320, height: 480 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 480, height: 320 },
  { width: 1280, height: 800 },
];

// Explicit viewports: the phone project's device emulation would override them.
test.skip(({ isMobile }) => isMobile, "the viewport matrix runs in the desktop project");

for (const viewport of VIEWPORTS) {
  test(`plateau carré, net et jamais coupé à ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#/partie");

    const board = page.locator("[data-board]");
    await expect(board).toBeVisible();
    const img = board.locator("img");
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);

    const box = await board.boundingBox();
    if (!box) throw new Error("the board has no bounding box");
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);

    const current = await img.evaluate((el: HTMLImageElement) => el.currentSrc);
    expect(VARIANTS.some((name) => current.endsWith(name))).toBe(true);
  });
}

test("l’image du plateau en erreur : message, puis « Réessayer » recharge le plateau", async ({
  page,
}) => {
  await page.route("**/plateau-*.webp*", (route) => route.fulfill({ status: 404 }));
  await page.goto("/#/partie");

  const failure = page.getByText("Le plateau n’a pas pu se charger.");
  await expect(failure).toBeVisible();
  const retry = page.getByRole("button", { name: "Réessayer" });
  await expect(retry).toBeVisible();
  const size = await retry.boundingBox();
  expect(size?.height).toBeGreaterThanOrEqual(44);

  await page.unroute("**/plateau-*.webp*");
  await retry.click();

  await expect(failure).toHaveCount(0);
  const img = page.locator("[data-board] img");
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
});

test("?debug=geometry (build de debug) : l’overlay numérote les 72 cases", async ({ page }) => {
  await page.goto("/#/partie?debug=geometry");

  const overlay = page.locator("[data-debug-geometry]");
  await expect(overlay).toBeAttached();
  await expect(overlay.locator("text[data-ring]")).toHaveCount(72);
  await expect(overlay.locator("text").filter({ hasText: /^71$/ })).toHaveCount(1);
  await expect(overlay.locator("text").filter({ hasText: /^71$/ })).toBeVisible();
});

test("sans paramètre debug, aucun overlay", async ({ page }) => {
  await page.goto("/#/partie?debug=autre");
  await expect(page.locator("[data-board]")).toBeVisible();
  await expect(page.locator("[data-debug-geometry]")).toHaveCount(0);
});
