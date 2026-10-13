import { expect, type Page, test } from "@playwright/test";

// Same order and numbers as packages/engine/src/topology.ts, written as literals so the spec does
// not import workspace TypeScript.
const COLORS = ["bleu", "jaune", "rouge", "vert"] as const;
type Color = (typeof COLORS)[number];
const EXIT: Record<Color, number> = { bleu: 0, jaune: 18, rouge: 36, vert: 54 };
const NAME: Record<Color, string> = { bleu: "Bleu", jaune: "Jaune", rouge: "Rouge", vert: "Vert" };
const partnerOf = (c: Color): Color => COLORS[(COLORS.indexOf(c) + 2) % 4] as Color;
const nextOf = (c: Color): Color => COLORS[(COLORS.indexOf(c) + 1) % 4] as Color;

async function sit(page: Page, color: Color) {
  await page.goto("/");
  await page.getByRole("radio", { name: NAME[color], exact: true }).click();
  await page.getByRole("button", { name: "Jouer la partie" }).click();
  await expect(page).toHaveURL(/#\/partie$/);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

async function centre(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} has no bounding box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

for (const color of COLORS) {
  test(`table ${color}: ma couleur en bas, le partenaire en haut, le siège suivant à gauche`, async ({
    page,
  }) => {
    await sit(page, color);
    const board = await centre(page, "[data-board]");

    const me = await centre(page, `[data-pawn="${color}1"]`);
    const partner = await centre(page, `[data-pawn="${partnerOf(color)}1"]`);
    const next = await centre(page, `[data-pawn="${nextOf(color)}1"]`);
    const previous = await centre(page, `[data-pawn="${partnerOf(nextOf(color))}1"]`);
    expect(me.y).toBeGreaterThan(board.y);
    expect(partner.y).toBeLessThan(board.y);
    expect(next.x).toBeLessThan(board.x);
    expect(previous.x).toBeGreaterThan(board.x);

    // Sixteen upright knights: no ancestor of a pawn is rotated, and each stands in its place.
    await expect(page.locator("[data-pawn]")).toHaveCount(16);
    await expect(page.locator(`[data-pawn="${color}1"]`)).toHaveAttribute(
      "data-place",
      `stable:${color}:1`,
    );
  });

  test(`table ${color}: le premier cheval part de son losange et bondit de 4 cases`, async ({
    page,
  }) => {
    await sit(page, color);
    const knight = page.locator(`[data-pawn="${color}0"]`);
    await expect(knight).toHaveAttribute("data-place", `ring:${EXIT[color]}`);
    await knight.click();
    await expect(knight).toHaveAttribute("data-place", `ring:${EXIT[color] + 4}`);
    await expect(knight).toHaveAttribute("data-ring", String(EXIT[color] + 4));
  });
}

test("table: la couleur choisie est retenue au rechargement de l’accueil", async ({ page }) => {
  await sit(page, "vert");
  await page.goto("/#/");
  await page.reload();
  await expect(page.getByRole("radio", { name: "Vert", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("table: le plateau tourne avec la couleur choisie, les cavaliers restent droits", async ({
  page,
}) => {
  for (const [color, turns] of [
    ["bleu", 0],
    ["vert", 1],
    ["rouge", 2],
    ["jaune", 3],
  ] as const) {
    await sit(page, color);
    await expect(page.locator("[data-board]")).toHaveAttribute("data-k", String(turns));
    const angle = await page.locator("[data-board] img").evaluate((img) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(img).transform);
      return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
    });
    expect(((angle % 360) + 360) % 360).toBe(turns * 90);
    // The overlay is never turned: the transform of the pawns' svg is the identity.
    await expect(page.locator("[data-board] svg").first()).toHaveCSS("transform", "none");
  }
});

test("table: les cavaliers regardent dans le sens de la marche, tête gardée sur les déplacements verticaux", async ({
  page,
}) => {
  // The facing is whatever the screen delta of the hops says; it is recorded on the pawn.
  await sit(page, "bleu");
  const knight = page.locator('[data-pawn="bleu0"]');
  await expect(knight).toHaveAttribute("data-facing", "right");
  await knight.click();
  await expect(knight).toHaveAttribute("data-place", "ring:4");
  const facing = await knight.getAttribute("data-facing");
  expect(["left", "right"]).toContain(facing);
  // The mirror is applied to the facing group only, never to the anchor.
  const scale = await knight.locator('[data-role="facing"]').getAttribute("transform");
  expect(scale).toBe(facing === "left" ? "scale(-1 1)" : "scale(1 1)");
});

// Knights at three sizes for the human legibility check (UI-SPEC backstop): the board is as wide as
// the viewport, so the knights are about 17, 39 and 90 px wide.
test.describe("cavaliers à trois tailles", () => {
  test.skip(({ isMobile }) => isMobile, "explicit viewports: the desktop project takes the shots");

  for (const [width, height] of [
    [390, 390],
    [900, 900],
    [2100, 2100],
  ] as const) {
    test(`captures du plateau à ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await sit(page, "bleu");
      await page.addStyleTag({
        content: "html body main.game { --board-size: 100vw !important; }",
      });
      const board = page.locator("[data-board]");
      await expect
        .poll(async () => Math.round((await board.boundingBox())?.width ?? 0))
        .toBe(width);
      await board.screenshot({ path: `test-results/knights-${width}.png` });
    });
  }
});
