import { expect, type Page, test } from "@playwright/test";
import { etatParam } from "./position.ts";

type TocWindow = Window & { __tocDebug?: { audio: { scheduled: number[] } } };

// R-07.1 (packages/engine/scenarios/cartes.ts): Bleu holds only the Dame de cœur and has one knight
// on the ring, three cells from its exit: the Dame moves it 12 cells. The hop timeline of 12 cells
// (hopTimeline(12) in packages/board) is written as literals so the spec does not import workspace
// TypeScript: 400 + 133 x 11 = 1863 ms and 24 clops (two per hop, the gallop).
const SCENARIO = "/#/partie?scenario=R-07.1";
const TOTAL_MS = 1863;
const CLOPS = [
  0, 77.625, 155.25, 232.875, 310.5, 388.125, 465.75, 543.375, 621, 698.625, 776.25, 853.875, 931.5,
  1009.125, 1086.75, 1164.375, 1242, 1319.625, 1397.25, 1474.875, 1552.5, 1630.125, 1707.75,
  1785.375,
];
const NBSP = "\u00a0";

/** Opens the game screen on a hand-made position (the `etat` debug parameter: base64url JSON). */
/**
 * How far a knight's anchor (its outer translate(x y)) is from the centre of the drawn cell, in scene
 * units: both are read in the scene's own coordinates (the attribute and getBBox()).
 */
async function offCell(page: Page, pawn: string, cell: number): Promise<number> {
  return page.evaluate(
    ([id, index]) => {
      const knight = document.querySelector(`[data-pawn="${id}"]`);
      const drawn = document.querySelector<SVGGraphicsElement>(
        `[data-board-art] [data-cell="${index}"]`,
      );
      if (!knight || !drawn) throw new Error(`no knight ${id} or no cell ${index}`);
      const match = /translate\(\s*([-\d.e]+)[\s,]+([-\d.e]+)\s*\)/.exec(
        knight.getAttribute("transform") ?? "",
      );
      if (!match) throw new Error(`knight ${id} has no translate()`);
      const box = drawn.getBBox();
      return Math.hypot(
        Number(match[1]) - (box.x + box.width / 2),
        Number(match[2]) - (box.y + box.height / 2),
      );
    },
    [pawn, cell] as const,
  );
}

/** Whether the centre of one element's box lies inside another element's box (screen pixels). */
async function centredIn(page: Page, inner: string, outer: string): Promise<boolean> {
  const a = await page.locator(inner).boundingBox();
  const b = await page.locator(outer).boundingBox();
  if (!a || !b) throw new Error(`no box for ${a ? outer : inner}`);
  const x = a.x + a.width / 2;
  const y = a.y + a.height / 2;
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
}

/**
 * How far the feet of the preview's ghost (the centre of its ring on the ground) are from the centre
 * of a drawn cell, in steps: the step is measured on the page, as the distance between the centres
 * of the drawn cells 3 and 4 of the landscape galet.
 */
async function ghostOffCell(page: Page, cell: number): Promise<number> {
  return page.evaluate((index) => {
    const centre = (el: Element) => {
      const r = el.getBoundingClientRect();
      return [r.x + r.width / 2, r.y + r.height / 2] as const;
    };
    const feet = document.querySelector("[data-ghost] [data-ghost-feet] ellipse");
    const drawn = document.querySelector(`[data-board-art] [data-cell="${index}"]`);
    const c3 = document.querySelector('[data-board-art] [data-cell="3"]');
    const c4 = document.querySelector('[data-board-art] [data-cell="4"]');
    if (!feet || !drawn || !c3 || !c4) throw new Error(`no ghost, no cell ${index} or no board`);
    const a = centre(c3);
    const b = centre(c4);
    const step = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const f = centre(feet);
    const d = centre(drawn);
    return Math.hypot(f[0] - d[0], f[1] - d[1]) / step;
  }, cell);
}

type HopRecord = { step: number; best: number; samples: number };

/**
 * Starts a recorder, one sample per animation frame until bleu0 reads ring:15: the closest the
 * knight's ground point (the centre of its shadow) comes to the drawn cell 9. The feet stand
 * KNIGHT.feet x size below the cell centre (the mock-up's top is y − h + 0.28 w) and the shadow lies
 * a little further, so the ground point is compared with the centre of cell 9 moved by the offset it
 * has from the centre of cell 3 at rest. The step is the distance between the centres of cells 3
 * and 4. Read the result with hopRecord().
 */
async function recordHop(page: Page): Promise<void> {
  await page.evaluate(() => {
    const centre = (el: Element) => {
      const r = el.getBoundingClientRect();
      return [r.x + r.width / 2, r.y + r.height / 2] as const;
    };
    const shadow = document.querySelector('[data-pawn="bleu0"] [data-role="shadow"]');
    const c3 = document.querySelector('[data-board-art] [data-cell="3"]');
    const c4 = document.querySelector('[data-board-art] [data-cell="4"]');
    const c9 = document.querySelector('[data-board-art] [data-cell="9"]');
    if (!shadow || !c3 || !c4 || !c9) throw new Error("no knight, shadow or cell");
    const rest = centre(shadow);
    const a = centre(c3);
    const b = centre(c4);
    const nine = centre(c9);
    const offset = [rest[0] - a[0], rest[1] - a[1]] as const;
    const record = { step: Math.hypot(b[0] - a[0], b[1] - a[1]), best: Infinity, samples: 0 };
    (window as unknown as { hopRecord: typeof record }).hopRecord = record;
    // Queried again every frame: a knight the player can act on is drawn as a button, so the node
    // is replaced when « Jouer » turns it back into a plain picture.
    const sample = () => {
      const now = document.querySelector('[data-pawn="bleu0"] [data-role="shadow"]');
      if (now) {
        const p = centre(now);
        const d = Math.hypot(p[0] - offset[0] - nine[0], p[1] - offset[1] - nine[1]);
        record.best = Math.min(record.best, d);
        record.samples++;
      }
      const place = document.querySelector('[data-pawn="bleu0"]')?.getAttribute("data-place");
      if (place !== "ring:15") requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function hopRecord(page: Page): Promise<HopRecord> {
  return page.evaluate(() => (window as unknown as { hopRecord: HopRecord }).hopRecord);
}

/** The landscape galet, the game's only board: twice as wide as tall (± 1.5 px), 72 drawn cells. */
async function expectLandscapeGalet(page: Page): Promise<void> {
  const board = page.locator("[data-board]");
  const box = await board.boundingBox();
  if (!box) throw new Error("the board has no bounding box");
  expect(Math.abs(box.height - box.width / 2)).toBeLessThanOrEqual(1.5);
  await expect(page.locator("[data-board-art] [data-cell]")).toHaveCount(72);
}

async function openPosition(page: Page, etat: unknown, extra = "") {
  const encoded = etatParam(etat);
  await page.goto("/");
  await page.goto(`/#/partie?etat=${encoded}${extra}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

test("tracer: Jouer la partie -> plateau -> la main du joueur et l’échange", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer la partie" }).click();
  await expect(page).toHaveURL(/#\/partie$/);

  // The board is the galet drawing: drawn by code, 72 ring cells, no raster image.
  await expect(page.locator("[data-board-art]")).toBeVisible();
  await expect(page.locator("[data-board-art] [data-cell]")).toHaveCount(72);
  await expect(page.locator("[data-board] img")).toHaveCount(0);

  // Audio was unlocked inside the tap.
  await expect(page.locator("body")).toHaveAttribute("data-audio", "running");

  // A real game: five cards in the hand, every knight in its stable, the exchange comes first.
  await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
  await expect(page.locator("[data-pawn]")).toHaveCount(16);
  await expect(page.locator("[data-action-zone]")).toContainText("Choisis la carte à passer à");

  // « Passer cette carte » waits for a chosen card, then the others are awaited.
  const pass = page.getByRole("button", { name: "Passer cette carte" });
  await expect(pass).toBeDisabled();
  await page.locator("[data-hand] [data-card]").first().click();
  await expect(pass).toBeEnabled();
  await pass.click();
  await expect(page.locator("[data-action-zone]")).toContainText("En attente de");
});

test("tracer: carte -> cheval -> aperçu -> « Jouer », et rien n’est joué à sa place", async ({
  page,
}) => {
  await page.goto("/");
  await page.goto(SCENARIO);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);

  // No parameter: the board is the landscape galet (Romain's « paysage obligatoire »).
  await expectLandscapeGalet(page);

  const knight = page.locator('[data-pawn="bleu0"]');
  await expect(knight).toHaveAttribute("data-place", "ring:3");
  // The knight stands on the drawn cell of its index.
  expect(await offCell(page, "bleu0", 3)).toBeLessThanOrEqual(0.5);

  // His turn: the one card is raised, with its amber outline.
  const card = page.getByRole("button", { name: "Dame de cœur, jouable" });
  await expect(card).toBeVisible();
  await expect(page.locator("[data-action-zone]")).toContainText(
    "À toi de jouer. Choisis une carte.",
  );

  // Tapping the card lights the knight and, with a single possibility, only says so (D-19).
  await card.click();
  await expect(page.locator('[data-halo="bleu0"]')).toBeVisible();
  await expect(page.locator("[data-action-zone]")).toContainText(
    `Un seul cheval peut jouer cette carte${NBSP}: touche-le.`,
  );
  await expect(page.getByRole("button", { name: "Changer de carte" })).toBeVisible();
  // The halo and the hit target are centred on the knight's body at its size (D-16).
  expect(await centredIn(page, '[data-halo="bleu0"]', '[data-pawn="bleu0"]')).toBe(true);
  expect(await centredIn(page, '[data-hit="bleu0"]', '[data-pawn="bleu0"]')).toBe(true);

  // Tapping the knight shows the path, the ghost, the badge and « Jouer ».
  await page.locator('[data-hit="bleu0"]').click();
  await expect(page.locator("[data-path]")).toBeVisible();
  await expect(page.locator("[data-ghost]")).toBeVisible();
  // The ghost stands on the drawn cell 15, its feet within half a step of the cell's centre (D-17).
  expect(await ghostOffCell(page, 15)).toBeLessThanOrEqual(0.5);
  await expect(page.locator("[data-badge]")).toContainText("+12");
  await expect(page.locator("[data-action-zone]")).toContainText(
    `Dame de cœur${NBSP}: avance de 12 cases.`,
  );
  const play = page.getByRole("button", { name: "Jouer", exact: true });
  await expect(play).toBeVisible();
  await expect(page.getByRole("button", { name: "Annuler ce coup" })).toBeVisible();

  // Two seconds later nothing has moved: the game never plays for the player (D-19).
  await page.waitForTimeout(2000);
  await expect(knight).toHaveAttribute("data-place", "ring:3");
  await expect(play).toBeVisible();

  // From before « Jouer », every animation frame: the knight hops through the landscape cells.
  await recordHop(page);
  await play.click();

  // One animation lasts 400 + 133 x (n - 1) ms.
  await page.waitForFunction(
    (total) =>
      document
        .getAnimations()
        .some((a) => Math.abs(Number(a.effect?.getTiming().duration) - total) <= 1),
    TOTAL_MS,
  );
  await expect(knight).toHaveAttribute("data-place", "ring:15");
  // It hopped along the galet ring, its ground point within a quarter step of cell 9 on the way,
  // and landed on the drawn cell 15.
  const record = await hopRecord(page);
  expect(record.samples).toBeGreaterThan(10);
  expect(record.best).toBeLessThan(record.step / 4);
  await expect.poll(() => offCell(page, "bleu0", 15)).toBeLessThanOrEqual(0.5);

  // The Dame lies on the felt in front of the human's seat: the centre of the card is inside the
  // « Sur le tapis » button, below its centre (the human sits at the bottom).
  const played = page.locator('[data-felt-last="bleu"] [data-felt-card]');
  await expect(played).toBeVisible();
  expect(
    await centredIn(page, '[data-felt-last="bleu"] [data-felt-card]', "[data-felt-button]"),
  ).toBe(true);
  const cardBox = await played.boundingBox();
  const feltBox = await page.getByRole("button", { name: "Sur le tapis" }).boundingBox();
  if (!cardBox || !feltBox) throw new Error("no box for the played card or the felt");
  expect(cardBox.y + cardBox.height / 2).toBeGreaterThan(feltBox.y + feltBox.height / 2);

  const scheduled = await page.evaluate(() => (window as TocWindow).__tocDebug?.audio.scheduled);
  expect(scheduled).toEqual(CLOPS);
});

test.describe("traceur : le galet en largeur à 1280 × 800, au clavier", () => {
  test.skip(({ isMobile }) => isMobile, "the keyboard shortcuts are the computer's");
  test.use({ viewport: { width: 1280, height: 800 } });

  test("la Dame fait bondir le cavalier de case en case jusqu’à la case 15", async ({ page }) => {
    await page.goto("/");
    await page.goto(SCENARIO);
    const board = page.locator("[data-board]");
    await expect(board).toHaveClass(/loaded/);

    // The landscape galet, the game's only board (Romain's « paysage obligatoire »): 2:1, by code.
    await expectLandscapeGalet(page);
    // No raster image but Romain's four riders.
    await expect(board.locator("img")).toHaveCount(0);
    await expect(board.locator("image:not([data-rider])")).toHaveCount(0);
    await expect(board.locator("image[data-rider]")).toHaveCount(4);

    const knight = page.locator('[data-pawn="bleu0"]');
    await expect(knight).toHaveAttribute("data-place", "ring:3");
    expect(await offCell(page, "bleu0", 3)).toBeLessThanOrEqual(0.5);

    // From before the keys until the knight reads ring:15.
    await recordHop(page);

    // « 1 » picks the Dame, « a » the lit knight, « Entrée » plays it.
    await page.keyboard.press("1");
    await page.keyboard.press("a");
    await expect(page.locator("[data-ghost]")).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(knight).toHaveAttribute("data-place", "ring:15");
    const record = await hopRecord(page);
    expect(record.samples).toBeGreaterThan(10);
    expect(record.best).toBeLessThan(record.step / 4);
    await expect.poll(() => offCell(page, "bleu0", 15)).toBeLessThanOrEqual(0.5);
  });
});

test("tracer: « Annuler ce coup » et « Changer de carte » reviennent en arrière", async ({
  page,
}) => {
  await page.goto("/");
  await page.goto(SCENARIO);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);

  const card = page.getByRole("button", { name: "Dame de cœur, jouable" });
  await card.click();
  await page.locator('[data-hit="bleu0"]').click();
  await expect(page.locator("[data-path]")).toBeVisible();

  await page.getByRole("button", { name: "Annuler ce coup" }).click();
  await expect(page.locator("[data-path]")).toHaveCount(0);
  await expect(page.locator("[data-action-zone]")).toContainText(
    "À toi de jouer. Choisis une carte.",
  );

  await card.click();
  await page.getByRole("button", { name: "Changer de carte" }).click();
  await expect(page.locator('[data-halo="bleu0"]')).toHaveCount(0);
  await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:3");
});

test("une carte grisée dit pourquoi, un As montre la sortie de l’écurie", async ({ page }) => {
  await openPosition(page, { turn: "bleu", hands: { bleu: ["1H", "3S"] } });

  // The 3 has no knight to move: tapping it gives the reason and selects nothing.
  await page.getByRole("button", { name: "3 de pique, pas jouable" }).click();
  await expect(page.locator("[data-action-zone]")).toContainText(
    "Aucun de tes chevaux ne peut jouer cette carte.",
  );
  await expect(page.locator("[data-halo]")).toHaveCount(0);

  // The As exits a knight: every stable knight is lit, and the preview ends on the exit diamond.
  await page.getByRole("button", { name: "As de cœur, jouable" }).click();
  await expect(page.locator("[data-halo]")).toHaveCount(4);
  await page.locator('[data-hit="bleu2"]').click({ force: true });
  await expect(page.locator("[data-ghost]")).toBeVisible();
  await expect(page.locator("[data-action-zone]")).toContainText("Sort de l’écurie.");
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
  await expect(page.locator('[data-place="ring:0"]')).toHaveCount(1);
});

test("manger un adversaire est annoncé, manger son partenaire demande « Jouer quand même »", async ({
  page,
}) => {
  // Bleu is three cells from its exit; the 3 lands on cell 6, where one knight stands.
  const position = (pawns: Record<string, unknown>) => ({
    turn: "bleu",
    pawns: { bleu: [{ p: 3 }, "S", "S", "S"], ...pawns },
    hands: { bleu: ["3S"] },
  });

  // A Jaune knight (an opponent) on cell 6: Jaune's exit is cell 18, so progress 60.
  await openPosition(page, position({ jaune: [{ p: 60 }, "S", "S", "S"] }));
  await page.getByRole("button", { name: "3 de pique, jouable" }).click();
  await page.locator('[data-hit="bleu0"]').click();
  await expect(page.locator('[data-capture="jaune0"]')).toBeVisible();
  await expect(page.locator("[data-action-zone]")).toContainText("Tu manges un cheval jaune.");
  await expect(page.getByRole("button", { name: "Jouer", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Jouer quand même" })).toHaveCount(0);

  // A Rouge knight (the partner) on cell 6: Rouge's exit is cell 36, so progress 42.
  await openPosition(page, position({ rouge: [{ p: 42 }, "S", "S", "S"] }));
  await page.getByRole("button", { name: "3 de pique, jouable" }).click();
  await page.locator('[data-hit="bleu0"]').click();
  await expect(page.locator('[data-capture="rouge0"]')).toBeVisible();
  await expect(page.locator("[data-action-zone]")).toContainText(
    `Attention${NBSP}: tu vas manger un cheval de ton équipe.`,
  );
  await page.getByRole("button", { name: "Jouer quand même" }).click();
  await expect(page.locator('[data-pawn="rouge0"]')).toHaveAttribute(
    "data-place",
    /^stable:rouge:/,
  );
});

test("les joueurs de l’ordinateur réfléchissent puis disent ce qu’ils ont joué", async ({
  page,
}) => {
  // After Bleu's Dame, Jaune holds one 3 and one knight on the ring.
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 3 }, "S", "S", "S"], jaune: [{ p: 5 }, "S", "S", "S"] },
    hands: { bleu: ["12H", "2S"], jaune: ["3S"] },
  });

  // Every text the action zone shows from now on is recorded: a line may be replaced within a second.
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { zoneLog: string[] }).zoneLog = log;
    const zone = document.querySelector("[data-action-zone]");
    if (!zone) throw new Error("no action zone");
    new MutationObserver(() => log.push(zone.textContent ?? "")).observe(zone, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });

  await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
  await page.locator('[data-hit="bleu0"]').click();
  await page.getByRole("button", { name: "Jouer", exact: true }).click();

  const seen = () =>
    page.evaluate(() => (window as unknown as { zoneLog: string[] }).zoneLog.join("\n"));
  await expect.poll(seen, { timeout: 15_000 }).toContain("réfléchit…");
  await expect
    .poll(seen, { timeout: 15_000 })
    .toMatch(new RegExp(`a joué le 3 de pique${NBSP}: avance de 3 cases\\.`));
});

test("« Avance rapide » est une bascule, retenue sur l’appareil", async ({ page }) => {
  await openPosition(page, {
    turn: "bleu",
    pawns: { bleu: [{ p: 3 }, "S", "S", "S"] },
    hands: { bleu: ["12H", "2S"] },
  });
  await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
  await page.locator('[data-hit="bleu0"]').click();
  await page.getByRole("button", { name: "Jouer", exact: true }).click();

  // While the bots play, the switch is at the right of the action zone.
  const fast = page.getByRole("button", { name: "Avance rapide" });
  await expect(fast).toHaveAttribute("aria-pressed", "false");
  await fast.click();
  await expect(fast).toHaveAttribute("aria-pressed", "true");
  const stored = await page.evaluate(() => localStorage.getItem("toc.settings.v1"));
  expect(JSON.parse(stored ?? "{}")).toMatchObject({ fast: true });
  await fast.click();
  await expect(fast).toHaveAttribute("aria-pressed", "false");
});
