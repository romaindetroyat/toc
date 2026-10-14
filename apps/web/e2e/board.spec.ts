import { expect, test } from "@playwright/test";

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
  test(`plateau portrait 2:3, dessiné et jamais coupé à ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/#/partie");

    const board = page.locator("[data-board]");
    await expect(board).toBeVisible();
    await expect(board).toHaveClass(/loaded/);

    // Board C+ (D-05, D-07): drawn by code, 72 ring cells, no raster image.
    await expect(board.locator("img")).toHaveCount(0);
    await expect(page.locator("[data-board-art] [data-cell]")).toHaveCount(72);

    const box = await board.boundingBox();
    if (!box) throw new Error("the board has no bounding box");
    expect(Math.abs(box.height - 1.5 * box.width)).toBeLessThanOrEqual(1.5);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);

    // Nothing of the board is turned: the colours take their side, the drawing never rotates.
    await expect(board).toHaveCSS("transform", "none");
    await expect(board.locator("svg").first()).toHaveCSS("transform", "none");
    await expect(page.locator("[data-board-art]")).toHaveCSS("transform", "none");
  });
}

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
