import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 320, height: 480 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 480, height: 320 },
  { width: 1280, height: 800 },
];

// Romain's riders (his ink horseman, recoloured for each colour): one per colour, in the corner of
// the side its colour sets off towards. With bleu at the bottom: bleu below-left of the board's
// centre, jaune above-left, rouge above-right, vert below-right. Never a target.
const RIDER_CORNERS = [
  { color: "bleu", below: true, left: true },
  { color: "jaune", below: false, left: true },
  { color: "rouge", below: false, left: false },
  { color: "vert", below: true, left: false },
] as const;

test("les cavaliers de Romain aux quatre coins du galet en largeur", async ({ page }) => {
  await page.goto("/#/partie");

  const board = page.locator("[data-board]");
  await expect(board).toHaveClass(/loaded/);
  const art = page.locator("[data-board-art]");
  await expect(art).toHaveAttribute("data-bottom", "bleu");

  const riders = page.locator("[data-board-art] image[data-rider]");
  await expect(riders).toHaveCount(4);
  const frame = await board.boundingBox();
  if (!frame) throw new Error("the board has no bounding box");
  const centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };

  for (const corner of RIDER_CORNERS) {
    const rider = page.locator(`[data-board-art] image[data-rider="${corner.color}"]`);
    await expect(rider).toHaveCount(1);
    await expect(rider).toHaveAttribute("opacity", "0.85");
    await expect(rider).toHaveAttribute("aria-hidden", "true");
    await expect(rider).toHaveCSS("pointer-events", "none");
    const box = await rider.boundingBox();
    if (!box) throw new Error(`the ${corner.color} rider has no bounding box`);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    expect(y > centre.y, `${corner.color} below the centre`).toBe(corner.below);
    expect(x < centre.x, `${corner.color} left of the centre`).toBe(corner.left);
    // Inside the board, not on its edge.
    expect(box.x).toBeGreaterThanOrEqual(frame.x);
    expect(box.y).toBeGreaterThanOrEqual(frame.y);
    expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height);

    // The picture is served, as an image.
    const href = await rider.getAttribute("href");
    if (!href) throw new Error(`the ${corner.color} rider has no href`);
    const response = await page.request.get(new URL(href, page.url()).href);
    expect(response.status(), `${href} answers`).toBe(200);
    expect(response.headers()["content-type"] ?? "").toMatch(/^image\//);
  }
});

// Explicit viewports: the phone project's device emulation would override them.
test.describe(() => {
  test.skip(({ isMobile }) => isMobile, "the viewport matrix runs in the desktop project");

  for (const viewport of VIEWPORTS) {
    test(`plateau galet en largeur, dessiné et jamais coupé à ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto("/#/partie");

      const board = page.locator("[data-board]");
      await expect(board).toBeVisible();
      await expect(board).toHaveClass(/loaded/);

      // The landscape galet, the game's only board (Romain's « paysage obligatoire », D-05, D-07):
      // drawn by code, 72 ring cells, no raster image (the riders are the only SVG images).
      await expect(board.locator("img")).toHaveCount(0);
      await expect(board.locator("image:not([data-rider])")).toHaveCount(0);
      await expect(page.locator("[data-board-art] [data-cell]")).toHaveCount(72);

      // Twice as wide as tall, read on the page (not on a layout attribute).
      const box = await board.boundingBox();
      if (!box) throw new Error("the board has no bounding box");
      expect(Math.abs(box.height - 0.5 * box.width)).toBeLessThanOrEqual(1.5);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
      // The page never scrolls (FX-01), the deal banner over the board included.
      const overflow = await page.evaluate(() => {
        const root = document.scrollingElement ?? document.documentElement;
        return [root.scrollWidth - root.clientWidth, root.scrollHeight - root.clientHeight];
      });
      expect(overflow).toEqual([0, 0]);

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

    // Drawn on the landscape galet: each index on its drawn cell, the 16 stable and 16 home slots, the
    // four exits and carrés, the felt, the four seats' card slots, the talon and the défausse.
    // The cells' shapes may be turned (losanges), so their centre is read on the screen and brought
    // back to scene units (the svg's viewBox width, 3200); the labels' x, y are scene units.
    const off = await page.evaluate(() => {
      const svg = document.querySelector<SVGSVGElement>("[data-board] svg");
      if (!svg) return -1;
      const frame = svg.getBoundingClientRect();
      const unit = svg.viewBox.baseVal.width / frame.width;
      let worst = 0;
      for (let i = 0; i < 72; i++) {
        const label = document.querySelector(`[data-debug-geometry] text[data-ring="${i}"]`);
        const cell = document.querySelector(`[data-board-art] [data-cell="${i}"]`);
        if (!label || !cell) return -1;
        const box = cell.getBoundingClientRect();
        const dx = Number(label.getAttribute("x")) - (box.x + box.width / 2 - frame.x) * unit;
        const dy = Number(label.getAttribute("y")) - (box.y + box.height / 2 - frame.y) * unit;
        worst = Math.max(worst, Math.hypot(dx, dy));
      }
      return worst;
    });
    expect(off).toBeGreaterThanOrEqual(0);
    // Within a screen pixel or two of the drawn cell's centre.
    expect(off).toBeLessThanOrEqual(10);
    await expect(overlay.locator("[data-stable]")).toHaveCount(16);
    await expect(overlay.locator("[data-home]")).toHaveCount(16);
    await expect(overlay.locator("[data-debug-exit]")).toHaveCount(4);
    await expect(overlay.locator("[data-debug-entry]")).toHaveCount(4);
    await expect(overlay.locator("[data-debug-felt]")).toHaveCount(1);
    await expect(overlay.locator("[data-debug-card]")).toHaveCount(4);
    await expect(overlay.locator("[data-debug-pile]")).toHaveCount(2);
  });

  test("sans paramètre debug, aucun overlay", async ({ page }) => {
    await page.goto("/#/partie?debug=autre");
    await expect(page.locator("[data-board]")).toBeVisible();
    await expect(page.locator("[data-debug-geometry]")).toHaveCount(0);
  });
});
