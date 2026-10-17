import { expect, type Page, test } from "@playwright/test";
import { etatParam } from "./position.ts";

// Same order and numbers as packages/engine/src/topology.ts, written as literals so the spec does
// not import workspace TypeScript.
const COLORS = ["bleu", "jaune", "rouge", "vert"] as const;
type Color = (typeof COLORS)[number];
const EXIT: Record<Color, number> = { bleu: 0, jaune: 18, rouge: 36, vert: 54 };
const NAME: Record<Color, string> = { bleu: "Bleu", jaune: "Jaune", rouge: "Rouge", vert: "Vert" };
const partnerOf = (c: Color): Color => COLORS[(COLORS.indexOf(c) + 2) % 4] as Color;
const nextOf = (c: Color): Color => COLORS[(COLORS.indexOf(c) + 1) % 4] as Color;

async function sit(page: Page, color: Color) {
  await page.goto("/#/ordinateur");
  await page.getByRole("radio", { name: NAME[color], exact: true }).click();
  await page.getByRole("button", { name: "Jouer la partie" }).click();
  await expect(page).toHaveURL(/#\/partie$/);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

/**
 * Plays one move through the real flow (card, knight, preview, « Jouer ») from a hand-made position:
 * `color` to play, one knight three cells from its exit and only the Dame de cœur in hand, which
 * moves it 12 cells. The `etat` debug parameter is base64url JSON (debug builds only).
 */
async function playScenarioMove(page: Page, color: Color) {
  const etat = etatParam({
    turn: color,
    pawns: { [color]: [{ p: 3 }, "S", "S", "S"] },
    hands: { [color]: ["12H"] },
  });
  await page.goto("/");
  await page.goto(`/#/partie?etat=${etat}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  const knight = page.locator(`[data-pawn="${color}0"]`);
  await expect(knight).toHaveAttribute("data-place", `ring:${EXIT[color] + 3}`);
  await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
  await page.locator(`[data-hit="${color}0"]`).click();
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
  return knight;
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

  test(`table ${color}: la Dame fait bondir le cheval de 12 cases (carte, cheval, « Jouer »)`, async ({
    page,
  }) => {
    const knight = await playScenarioMove(page, color);
    await expect(knight).toHaveAttribute("data-place", `ring:${EXIT[color] + 15}`);
    await expect(knight).toHaveAttribute("data-ring", String(EXIT[color] + 15));
  });
}

test("table: la couleur choisie est retenue au rechargement de l’accueil", async ({ page }) => {
  await sit(page, "vert");
  await page.goto("/#/ordinateur");
  await page.reload();
  await expect(page.getByRole("radio", { name: "Vert", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("table: les couleurs prennent leur côté, rien ne tourne", async ({ page }) => {
  // The landscape galet never turns (D-05): the seat k of the chosen colour (bleu 0, vert 1, rouge 2, jaune 3)
  // puts that colour's camp at the bottom and the partner's at the top.
  for (const [color, seat] of [
    ["bleu", 0],
    ["vert", 1],
    ["rouge", 2],
    ["jaune", 3],
  ] as const) {
    await sit(page, color);
    const board = page.locator("[data-board]");
    await expect(board).toHaveAttribute("data-k", String(seat));
    await expect(board).toHaveAttribute("data-bottom", color);
    const box = await board.boundingBox();
    if (!box) throw new Error("the board has no bounding box");
    const middle = box.y + box.height / 2;
    const mine = await centre(page, `[data-board-art] [data-exit="${color}"]`);
    const partner = await centre(page, `[data-board-art] [data-exit="${partnerOf(color)}"]`);
    expect(mine.y).toBeGreaterThan(middle);
    expect(partner.y).toBeLessThan(middle);
    // Neither the drawing nor the knights' svg is turned.
    await expect(page.locator("[data-board] svg").first()).toHaveCSS("transform", "none");
    await expect(page.locator("[data-board-art]")).toHaveCSS("transform", "none");
  }
});

test("table: les cavaliers du galet tournés vers leur camp, sabots vers chaque bord", async ({
  page,
}) => {
  // Romain, 2026-10-15: « Quart de tour (Recommandé) ». The seats go clockwise from the bottom:
  // the next colour on the left, the partner at the top, the colour after it on the right.
  for (const bottom of ["bleu", "vert"] as const) {
    await sit(page, bottom);
    const left = nextOf(bottom);
    const top = partnerOf(bottom);
    const right = nextOf(top);
    for (const [color, angle] of [
      [bottom, 0],
      [left, 90],
      [top, 180],
      [right, 270],
    ] as const) {
      const rider = page.locator(`[data-board-art] image[data-rider="${color}"]`);
      await expect(rider).toHaveCount(1);
      await expect(rider, `${color} rider`).toHaveAttribute("data-rider-angle", String(angle));
      const transform = await rider.getAttribute("transform");
      if (angle === 0) expect(transform ?? "").not.toContain("rotate");
      else expect(transform ?? "").toContain(`rotate(${angle})`);
    }
  }
});

test("table: les cavaliers regardent dans le sens de la marche, tête gardée sur les déplacements verticaux", async ({
  page,
}) => {
  // The facing is whatever the screen delta of the hops says; it is recorded on the pawn.
  const knight = await playScenarioMove(page, "bleu");
  await expect(knight).toHaveAttribute("data-place", "ring:15");
  const facing = await knight.getAttribute("data-facing");
  expect(["left", "right"]).toContain(facing);
  // The mirror is applied to the facing group only, never to the anchor.
  const scale = await knight.locator('[data-role="facing"]').getAttribute("transform");
  expect(scale).toBe(facing === "left" ? "scale(-1 1)" : "scale(1 1)");
});

// Knights at three sizes for the human legibility check (UI-SPEC backstop), on landscape screens
// only (« paysage obligatoire »; a screen taller than wide shows « Tourne ton téléphone »). A ring
// knight is 0.95 step, about 0.0318 x the board width:
// - 844 x 390, the phone held sideways (compact mode, the board on the full height, plan 01-47, a
//   left strip as wide as the hand's 79 x 110 cards need, plan 02-06c):
//   min(844 − 83.1 − 60, (390 − 24) / 0.5) = 700.9 px, a knight about 22 px wide;
// - 1440 x 900, a computer (bar): min(1440 − 32, (900 − 160) / 0.52166, 1600) = 1408 px, about 45 px;
// - 3200 x 1900 with the board forced to 3200 px, past the 1600 px cap: about 102 px.
// The shots keep their names by board width (knights-701.png, knights-1408.png, knights-3200.png).
const HEIGHT_PER_WIDTH = 0.5 + 0.02166;

test.describe("cavaliers à trois tailles", () => {
  test.skip(({ isMobile }) => isMobile, "explicit viewports: the desktop project takes the shots");

  for (const { width, height, board: expected, forced } of [
    { width: 844, height: 390, board: Math.min(844 - 83.12 - 60, (390 - 24) / 0.5) },
    { width: 1440, height: 900, board: Math.min(1440 - 32, (900 - 160) / HEIGHT_PER_WIDTH, 1600) },
    { width: 3200, height: 1900, board: 3200, forced: true },
  ]) {
    test(`captures du plateau à ${Math.round(expected)} px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await sit(page, "bleu");
      if (forced) {
        await page.addStyleTag({
          content: `html body main.game { --board-size: ${expected}px !important; }`,
        });
      }
      const board = page.locator("[data-board]");
      await expect
        .poll(async () => Math.abs(((await board.boundingBox())?.width ?? 0) - expected))
        .toBeLessThanOrEqual(2);
      await board.screenshot({ path: `test-results/knights-${Math.round(expected)}.png` });
    });
  }
});
