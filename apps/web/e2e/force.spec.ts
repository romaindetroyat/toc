import { expect, type Page, test } from "@playwright/test";
import { exchange, playSimpleMove, untilOwnTurn } from "./jouer.ts";

// The computer's strength on the launch screen (phase 3, D-01 to D-03): one row per computer seat, the
// five horse names, Galopeur on a first visit, the choice remembered per role, and a game played at
// the chosen levels.

const KEY = "toc.settings.v1";
const SEED = "1234567890abcdef1234567890abcdef";

const row = (page: Page, role: "partner" | "left" | "right") =>
  page.locator(`[data-strength-row="${role}"]`);
const level = (page: Page, role: "partner" | "left" | "right", name: string) =>
  row(page, role).getByRole("radio", { name, exact: true });
const radioOf = (page: Page, name: string) =>
  page
    .getByRole("radiogroup", { name: "Choisis ta couleur" })
    .getByRole("radio", { name, exact: true });

async function stored(page: Page): Promise<Record<string, unknown>> {
  const text = await page.evaluate((key) => localStorage.getItem(key), KEY);
  return JSON.parse(text ?? "{}") as Record<string, unknown>;
}

test("force: une rangée par place de l’ordinateur, Galopeur la première fois", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Force de l’ordinateur" })).toBeVisible();
  const rows = page.locator("[data-strength-row]");
  await expect(rows).toHaveCount(3);
  // The partner, then the opponent on the left (next seat clockwise), then the one on the right.
  expect(
    await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-strength-row"))),
  ).toEqual(["partner", "left", "right"]);
  await expect(row(page, "partner").getByRole("radiogroup")).toHaveAccessibleName(
    "Force de Rouge, ton partenaire",
  );
  await expect(row(page, "left").getByRole("radiogroup")).toHaveAccessibleName(
    "Force de Jaune, adversaire",
  );
  await expect(row(page, "right").getByRole("radiogroup")).toHaveAccessibleName(
    "Force de Vert, adversaire",
  );
  await expect(row(page, "partner")).toContainText("Partenaire");
  await expect(row(page, "left")).toContainText("Adversaire");
  for (const role of ["partner", "left", "right"] as const) {
    await expect(row(page, role).getByRole("radio")).toHaveText([
      "Poulain",
      "Trotteur",
      "Galopeur",
      "Pur-sang",
      "Champion",
    ]);
    await expect(level(page, role, "Galopeur")).toHaveAttribute("aria-checked", "true");
    await expect(row(page, role).locator('[aria-checked="true"]')).toHaveCount(1);
  }
});

test("force: « Trotteur » pour le partenaire est retenu, aussi quand la couleur change", async ({
  page,
}) => {
  await page.goto("/");
  await level(page, "partner", "Trotteur").click();
  await expect(level(page, "partner", "Trotteur")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "partner", "Galopeur")).toHaveAttribute("aria-checked", "false");
  expect((await stored(page)).botLevels).toEqual({ partner: 2, left: 3, right: 3 });

  await page.reload();
  await expect(level(page, "partner", "Trotteur")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "left", "Galopeur")).toHaveAttribute("aria-checked", "true");

  // Another colour: the partner is now Vert, and it keeps the partner's level.
  await page.getByRole("radio", { name: "Jaune", exact: true }).click();
  await expect(row(page, "partner").getByRole("radiogroup")).toHaveAccessibleName(
    "Force de Vert, ton partenaire",
  );
  await expect(level(page, "partner", "Trotteur")).toHaveAttribute("aria-checked", "true");
  await expect(row(page, "left").getByRole("radiogroup")).toHaveAccessibleName(
    "Force de Rouge, adversaire",
  );
  expect((await stored(page)).botLevels).toEqual({ partner: 2, left: 3, right: 3 });
});

test("force: des niveaux abîmés en mémoire donnent Galopeur, sans erreur", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    KEY,
    JSON.stringify({ botLevels: { partner: "5", left: 99, right: 4 } }),
  ] as const);
  await page.goto("/");
  await expect(level(page, "partner", "Galopeur")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "left", "Galopeur")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "right", "Pur-sang")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("force: une partie avec trois Trotteurs se joue sans erreur", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    KEY,
    JSON.stringify({ botLevels: { partner: 2, left: 2, right: 2 } }),
  ] as const);
  await page.goto("/");
  await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await exchange(page);
  for (let turn = 0; turn < 2; turn++) {
    await untilOwnTurn(page);
    await playSimpleMove(page);
  }
  await expect(page.locator("[data-error-screen]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("force: « Jouer la partie » avec un Champion ouvre la partie sans erreur", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await level(page, "right", "Champion").click();
  await expect(level(page, "right", "Champion")).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Jouer la partie" }).click();
  await expect(page).toHaveURL(/#\/partie$/);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(page.locator("[data-action-zone]")).toHaveAttribute("data-state", "exchange");
  await expect(page.locator("[data-error-screen]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

// --- The launch screen on every target screen (03-UI-SPEC « Launch screen layouts », « Fit at the
// target sizes »). Each size is set on the page itself, so both projects check every size. ---

type Fit = { scrollWidth: number; scrollHeight: number; innerWidth: number; innerHeight: number };

const fit = (page: Page): Promise<Fit> =>
  page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));

const forms = (page: Page) =>
  page
    .locator("[data-strength-row]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-form")));

async function openAt(page: Page, size: { width: number; height: number }) {
  await page.setViewportSize(size);
  await page.goto("/");
  await expect(page.locator("[data-strength-row]")).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
}

for (const size of [
  { width: 1280, height: 800 },
  { width: 1024, height: 640 },
]) {
  test(`force: sur l’ordinateur (${size.width} × ${size.height}), deux colonnes sans défilement`, async ({
    page,
  }) => {
    await openAt(page, size);
    await expect(page.locator("main.launch")).toHaveAttribute("data-layout", "computer");
    // The strength column is to the right of the tiles.
    const tiles = await page.getByRole("radiogroup", { name: "Choisis ta couleur" }).boundingBox();
    const strength = await page
      .getByRole("heading", { name: "Force de l’ordinateur" })
      .boundingBox();
    if (!tiles || !strength) throw new Error("no tiles or no strength heading");
    expect(strength.x).toBeGreaterThanOrEqual(tiles.x + tiles.width);
    // Three inline rows, 48 high.
    await expect.poll(() => forms(page)).toEqual(["inline", "inline", "inline"]);
    for (const role of ["partner", "left", "right"] as const) {
      const box = await row(page, role).boundingBox();
      expect(box?.height).toBeCloseTo(48, 0);
    }
    // « Réglages » 16 px left of « Jouer la partie », on the same row.
    const settings = await page.getByRole("button", { name: "Réglages" }).boundingBox();
    const play = await page.getByRole("button", { name: "Jouer la partie" }).boundingBox();
    if (!settings || !play) throw new Error("no button row");
    expect(play.x - (settings.x + settings.width)).toBeCloseTo(16, 0);
    expect(Math.abs(settings.y + settings.height / 2 - (play.y + play.height / 2))).toBeLessThan(1);
    // Nothing scrolls.
    const now = await fit(page);
    expect(now.scrollHeight).toBeLessThanOrEqual(now.innerHeight);
    expect(now.scrollWidth).toBeLessThanOrEqual(now.innerWidth);
  });
}

// The phone held sideways: two columns from 640 wide, without any scroll.
for (const { width, height, rows } of [
  { width: 844, height: 390, rows: "inline" },
  { width: 750, height: 342, rows: "inline" },
  { width: 667, height: 375, rows: "stacked" },
  { width: 640, height: 360, rows: "stacked" },
]) {
  test(`force: le téléphone en largeur (${width} × ${height}), deux colonnes sans défilement`, async ({
    page,
  }) => {
    await openAt(page, { width, height });
    await expect(page.locator("main.launch")).toHaveAttribute("data-layout", "two");
    await expect.poll(() => forms(page)).toEqual([rows, rows, rows]);
    const tiles = await page.getByRole("radiogroup", { name: "Choisis ta couleur" }).boundingBox();
    const strength = await page
      .getByRole("heading", { name: "Force de l’ordinateur" })
      .boundingBox();
    if (!tiles || !strength) throw new Error("no tiles or no strength heading");
    expect(strength.x).toBeGreaterThanOrEqual(tiles.x + tiles.width);
    // No tagline, no note on the phone.
    await expect(page.getByText("Le jeu de petits chevaux à cartes")).toBeHidden();
    await expect(page.getByText(/^Tu joues avec un partenaire/)).toBeHidden();
    await expect(page.getByRole("button", { name: "Jouer la partie" })).toBeInViewport({
      ratio: 1,
    });
    const now = await fit(page);
    expect(now.scrollHeight).toBeLessThanOrEqual(now.innerHeight);
    expect(now.scrollWidth).toBeLessThanOrEqual(now.innerWidth);
  });
}

/** « Jouer la partie » lies wholly inside the screen. */
async function playInView(page: Page) {
  const box = await page.getByRole("button", { name: "Jouer la partie" }).boundingBox();
  const { innerWidth, innerHeight } = await fit(page);
  if (!box) throw new Error("no « Jouer la partie »");
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(innerHeight);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(innerWidth);
}

// The smallest phones held sideways: one column that scrolls, the button always in its sticky band.
for (const { width, height, rows } of [
  { width: 568, height: 320, rows: "inline" },
  { width: 480, height: 320, rows: "stacked" },
]) {
  test(`force: le petit téléphone (${width} × ${height}), une colonne, le bouton toujours à l’écran`, async ({
    page,
  }) => {
    await openAt(page, { width, height });
    await expect(page.locator("main.launch")).toHaveAttribute("data-layout", "one");
    await expect.poll(() => forms(page)).toEqual([rows, rows, rows]);
    // The four tiles in one row, 88 high.
    const boxes = await Promise.all(
      (
        await page.getByRole("radiogroup", { name: "Choisis ta couleur" }).getByRole("radio").all()
      ).map((tile) => tile.boundingBox()),
    );
    for (const box of boxes) {
      expect(box?.y).toBeCloseTo(boxes[0]?.y ?? Number.NaN, 0);
      expect(box?.height).toBeCloseTo(88, 0);
    }
    const now = await fit(page);
    expect(now.scrollWidth).toBeLessThanOrEqual(now.innerWidth);
    expect(now.scrollHeight).toBeGreaterThan(now.innerHeight);
    await playInView(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await playInView(page);
    // At the bottom, the last row is above the band, not under it.
    const last = await row(page, "right").boundingBox();
    const band = await page.getByRole("button", { name: "Réglages" }).boundingBox();
    if (!last || !band) throw new Error("no last row or no band");
    expect(last.y + last.height).toBeLessThanOrEqual(band.y);
  });
}

test("force: tenu debout (390 × 844), les forces sur deux lignes, le bouton toujours à l’écran", async ({
  page,
}) => {
  await openAt(page, { width: 390, height: 844 });
  await expect(page.locator("main.launch")).toHaveAttribute("data-layout", "portrait");
  await expect.poll(() => forms(page)).toEqual(["narrow", "narrow", "narrow"]);
  for (const role of ["partner", "left", "right"] as const) {
    const top = async (name: string) =>
      (await level(page, role, name).boundingBox())?.y ?? Number.NaN;
    // « Poulain Trotteur Galopeur » then « Pur-sang Champion ».
    expect(await top("Trotteur")).toBeCloseTo(await top("Poulain"), 0);
    expect(await top("Galopeur")).toBeCloseTo(await top("Poulain"), 0);
    expect(await top("Pur-sang")).toBeGreaterThan(await top("Poulain"));
    expect(await top("Champion")).toBeCloseTo(await top("Pur-sang"), 0);
  }
  const now = await fit(page);
  expect(now.scrollWidth).toBeLessThanOrEqual(now.innerWidth);
  await playInView(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await playInView(page);
});

test("force: en largeur sur le téléphone (750 × 342), des niveaux abîmés donnent Galopeur partout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    KEY,
    JSON.stringify({ botLevels: { partner: "5", left: 99, right: 2.5 } }),
  ] as const);
  await openAt(page, { width: 750, height: 342 });
  await expect(page.locator("main.launch")).toHaveAttribute("data-layout", "two");
  for (const role of ["partner", "left", "right"] as const) {
    await expect(level(page, role, "Galopeur")).toHaveAttribute("aria-checked", "true");
    await expect(row(page, role).locator('[aria-checked="true"]')).toHaveCount(1);
  }
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("force: l’ordre de tabulation, puis les flèches dans une force avec retour au début", async ({
  page,
}) => {
  await openAt(page, { width: 1280, height: 800 });
  const order = [
    radioOf(page, "Bleu"),
    level(page, "partner", "Galopeur"),
    level(page, "left", "Galopeur"),
    level(page, "right", "Galopeur"),
    page.getByRole("button", { name: "Réglages" }),
    page.getByRole("button", { name: "Jouer la partie" }),
  ];
  for (const target of order) {
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
  }
  // Inside a picker, the arrows move and select, and wrap around.
  await level(page, "left", "Galopeur").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(level(page, "left", "Champion")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "left", "Champion")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(level(page, "left", "Poulain")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "left", "Poulain")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(level(page, "left", "Champion")).toHaveAttribute("aria-checked", "true");
  expect((await stored(page)).botLevels).toEqual({ partner: 3, left: 5, right: 3 });
});

test("force: le titre « Force 5 sur 5 », et l’option cochée en crème, jamais en ambre", async ({
  page,
}) => {
  await page.goto("/");
  await expect(level(page, "partner", "Champion")).toHaveAttribute("title", "Force 5 sur 5");
  await expect(level(page, "partner", "Poulain")).toHaveAttribute("title", "Force 1 sur 5");
  const checked = await level(page, "partner", "Galopeur").evaluate((el) => {
    const style = getComputedStyle(el);
    return { background: style.backgroundColor, color: style.color, weight: style.fontWeight };
  });
  expect(checked).toEqual({
    background: "rgb(255, 248, 225)",
    color: "rgb(43, 29, 18)",
    weight: "700",
  });
});
