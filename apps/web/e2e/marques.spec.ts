import { expect, type Page, test } from "@playwright/test";
import { etatParam } from "./position.ts";

// The seat shapes on the board (plan 05-02, APP-05, D-11, D-14): every knight carries on its base a
// cream disc with its seat's shape (Bleu a round, Jaune a triangle, Rouge a square, Vert a star),
// shown by default, hidden by the switch « Formes sur les chevaux » of « Réglages », kept across
// reloads. The card back and the colour tiles use the same knight picture and never show a mark.

const SHAPE = { bleu: "round", jaune: "triangle", rouge: "square", vert: "star" } as const;
const KEY = "toc.settings.v1";
const SWITCH = "Formes sur les chevaux";
const HELPER =
  "Un rond, un triangle, un carré ou une étoile sur chaque cheval, pour reconnaître les couleurs autrement.";

/** Knights of the four colours on the ring, in a home and in a stable. */
const ETAT = {
  turn: "bleu",
  pawns: {
    bleu: [{ p: 10 }, { h: 0 }, "S", "S"],
    jaune: [{ p: 20 }, { h: 1 }, "S", "S"],
    rouge: [{ p: 30 }, { h: 2 }, "S", "S"],
    vert: [{ p: 40 }, { h: 3 }, "S", "S"],
  },
  hands: { bleu: ["12H"] },
};

const knights = (page: Page) => page.locator("[data-board] [data-pawn]");
const marks = (page: Page) => page.locator("[data-board] [data-pawn] [data-knight-mark]");
const sw = (page: Page) => page.getByRole("switch", { name: SWITCH, exact: true });

async function openGame(page: Page) {
  await page.goto("/");
  await page.goto(`/#/partie?etat=${etatParam(ETAT)}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(page.locator("[data-action-zone]")).toHaveAttribute("data-state", "idle");
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Réglages" })).toBeVisible();
}

async function closeSettings(page: Page) {
  await page
    .getByRole("dialog", { name: "Réglages" })
    .getByRole("button", { name: "Fermer" })
    .click();
  await expect(page.getByRole("dialog", { name: "Réglages" })).toHaveCount(0);
}

/** Every board knight has exactly one mark, its seat's shape, drawn from its colour's own symbol. */
async function expectEveryKnightMarked(page: Page) {
  await expect(knights(page)).toHaveCount(16);
  await expect(marks(page)).toHaveCount(16);
  for (const [color, shape] of Object.entries(SHAPE)) {
    for (let i = 0; i < 4; i++) {
      const mark = page.locator(`[data-board] [data-pawn="${color}${i}"] [data-knight-mark]`);
      await expect(mark).toHaveCount(1);
      await expect(mark).toHaveAttribute("data-knight-mark", shape);
      await expect(mark).toHaveAttribute("href", `#knight-mark-${color}`);
    }
  }
}

test("marques: chaque cheval du plateau porte la forme de sa place, sur l’anneau, à la maison et à l’écurie", async ({
  page,
}) => {
  await openGame(page);
  await expectEveryKnightMarked(page);
  // The knights stand in the three zones.
  for (const color of Object.keys(SHAPE)) {
    await expect(page.locator(`[data-pawn="${color}0"]`)).toHaveAttribute("data-place", /^ring:/);
    await expect(page.locator(`[data-pawn="${color}1"]`)).toHaveAttribute("data-place", /^home:/);
    await expect(page.locator(`[data-pawn="${color}2"]`)).toHaveAttribute("data-place", /^stable:/);
  }
  // The mark is inside the rearing group, with the knight: it hops, squashes and rears with it.
  const inRear = await page
    .locator('[data-pawn="vert0"] [data-knight-mark]')
    .evaluate((node) => node.parentElement?.getAttribute("data-role"));
  expect(inRear).toBe("rear");
  // Each mark symbol exists once, apart from the plain knight symbols.
  for (const color of Object.keys(SHAPE)) {
    await expect(page.locator(`symbol#knight-mark-${color}`)).toHaveCount(1);
    await expect(page.locator(`symbol#knight-${color} [data-mark-disc]`)).toHaveCount(0);
  }
  // The talon's card back shows the knight without a mark.
  await expect(page.locator("[data-card-back]").first()).toBeVisible();
  await expect(page.locator('[data-card-back] use[href^="#knight-mark"]')).toHaveCount(0);
});

test("marques: les tuiles de couleur de l’écran de lancement n’en ont pas", async ({ page }) => {
  await page.goto("/#/ordinateur");
  await expect(page.locator("[data-color]").first()).toBeVisible();
  await expect(page.locator('[data-color] use[href^="#knight-"]').first()).toBeAttached();
  await expect(page.locator('use[href^="#knight-mark"]')).toHaveCount(0);
});

test("marques: « Formes sur les chevaux » les retire aussitôt, le choix est gardé et revient", async ({
  page,
}) => {
  await openGame(page);
  await openSettings(page);
  const sheet = page.getByRole("dialog", { name: "Réglages" });
  await expect(sw(page)).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByText(HELPER)).toBeVisible();
  const box = await sw(page).boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(43.99);

  await sw(page).click();
  await expect(sw(page)).toHaveAttribute("aria-checked", "false");
  await expect(marks(page)).toHaveCount(0);
  const kept = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), KEY)) ?? "{}");
  expect(kept).toMatchObject({ knightMarks: false });
  await closeSettings(page);
  await expect(marks(page)).toHaveCount(0);

  await page.reload();
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(knights(page)).toHaveCount(16);
  await expect(marks(page)).toHaveCount(0);

  await openSettings(page);
  await expect(sw(page)).toHaveAttribute("aria-checked", "false");
  await sw(page).click();
  await expect(sw(page)).toHaveAttribute("aria-checked", "true");
  await closeSettings(page);
  await expectEveryKnightMarked(page);
});

test("marques: une valeur gardée qui n’est pas un booléen les laisse allumées", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ knightMarks: "non" })),
    KEY,
  );
  await openGame(page);
  await expect(marks(page)).toHaveCount(16);
});
