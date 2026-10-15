import { expect, type Page, test } from "@playwright/test";
import { exchange, untilOwnTurn, zone } from "./jouer.ts";
import { etatParam } from "./position.ts";

// « Tourne ton téléphone » (UI-SPEC addendum « Plateau galet », item 5, plan 01-38; the copy and the
// waiting computer players are derived, « à confirmer par Romain »). Romain asked for « paysage
// obligatoire » and Safari cannot lock the orientation: every screen taller than wide shows an
// invitation to turn it instead of the game, which waits behind it, hidden and inert, exactly as it
// was. The phone project is Playwright's iPhone 13 held sideways; turning it upright is a resize of
// its window to 390 x 664 (the window Playwright gives the iPhone 13 held upright).

/** R-07.1: Bleu holds only the Dame de cœur, bleu0 three cells from its exit; the Dame takes it to ring:15. */
const R071 = "/#/partie?scenario=R-07.1";
const PORTRAIT = { width: 390, height: 664 };
const PHONE_TITLE = "Tourne ton téléphone";
const WINDOW_TITLE = "Élargis la fenêtre";
const BODY = "La partie t’attend. Elle reprend dès que l’écran est en largeur.";
const SEED = "1234567890abcdef1234567890abcdef";

/** The window the project was configured with (the phone's: 750 x 342 with Playwright 1.64). */
function configured(): { width: number; height: number } {
  const viewport = test.info().project.use.viewport;
  if (!viewport) throw new Error("the project has no viewport");
  return viewport;
}

/**
 * How far a knight's anchor (its outer translate(x y)) is from the centre of the drawn cell, in scene
 * units: both are read in the scene's own coordinates (the attribute and getBBox()). The board must be
 * displayed (getBBox() of a node that is not rendered is empty).
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
      // An exit cell is a turned square: its box is in its own coordinates, mapped by its transform.
      const box = drawn.getBBox();
      let x = box.x + box.width / 2;
      let y = box.y + box.height / 2;
      const m = drawn.transform.baseVal.consolidate()?.matrix;
      if (m) [x, y] = [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
      return Math.hypot(Number(match[1]) - x, Number(match[2]) - y);
    },
    [pawn, cell] as const,
  );
}

const prompt = (page: Page) => page.locator("[data-rotate-prompt]");
const wrapperInert = (page: Page) =>
  page.locator("[data-game-play]").evaluate((node) => (node as HTMLElement).inert);

/** The Dame, then « Jouer » (bleu0, her lone knight, is chosen by itself): bleu0 lands on ring:15. */
async function playDame(page: Page) {
  await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
  await expect(page.locator('[data-selected="bleu0"]')).toBeVisible();
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
}

test.describe("le téléphone tenu debout", () => {
  test.skip(({ isMobile }) => !isMobile, "the phone project");

  test("traceur : l’invitation à tourner remplace le plateau, et la partie revient telle quelle", async ({
    page,
  }) => {
    const landscape = configured();
    expect(landscape.width, "the phone project is held sideways").toBeGreaterThan(landscape.height);
    await page.goto("/");
    await page.goto(`${R071}&vitesse=test`);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expect(page.locator("[data-board]")).toBeVisible();
    await expect(prompt(page)).toHaveCount(0);
    await expect(page.locator("main.game")).toHaveAttribute("data-chrome", "compact-bar");

    await playDame(page);
    await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:15");

    // Held upright: the invitation, its heading focused, and no game to be seen or reached.
    await page.setViewportSize(PORTRAIT);
    const heading = page.getByRole("heading", { name: PHONE_TITLE });
    await expect(heading).toBeVisible();
    await expect(page.getByText(BODY)).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText(WINDOW_TITLE)).toBeHidden();
    await expect(page.locator("main.game")).toHaveAttribute("data-chrome", "rotate");
    await expect(page.locator("[data-board]")).toBeHidden();
    await expect(page.locator("[data-hand]")).toBeHidden();
    await expect(page.locator("[data-action-zone]")).toBeHidden();
    expect(await wrapperInert(page), "the game's wrapper is inert").toBe(true);

    // Held sideways again: the same game, bleu0 still on the drawn cell 15.
    await page.setViewportSize(landscape);
    await expect(prompt(page)).toHaveCount(0);
    await expect(page.locator("[data-board]")).toBeVisible();
    expect(await wrapperInert(page)).toBe(false);
    await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:15");
    await expect.poll(() => offCell(page, "bleu0", 15)).toBeLessThanOrEqual(0.5);
  });
});

test.describe("la fenêtre d’ordinateur plus haute que large", () => {
  test.skip(({ isMobile }) => isMobile, "the desktop project");

  test("« Élargis la fenêtre », puis la partie revient", async ({ page }) => {
    await page.goto("/");
    await page.goto(`${R071}&vitesse=test`);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expect(prompt(page)).toHaveCount(0);

    await page.setViewportSize({ width: 800, height: 1000 });
    const heading = page.getByRole("heading", { name: WINDOW_TITLE });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByText(PHONE_TITLE)).toBeHidden();
    await expect(page.getByText(BODY)).toBeVisible();
    await expect(page.locator("[data-board]")).toBeHidden();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(prompt(page)).toHaveCount(0);
    await expect(page.locator("[data-board]")).toBeVisible();
    await expect(page.locator("main.game")).toHaveAttribute("data-chrome", "bar");
    await expect(page.getByRole("button", { name: "Dame de cœur, jouable" })).toBeVisible();
  });
});

// --- Behind the invitation the game is kept, nothing moves, the computer players wait (Task 2) ---

type Kept = {
  hand: string[];
  places: Record<string, string>;
  halos: string[];
  felt: Record<string, string>;
  state: string | null;
};

/**
 * The hand (each card with its state), every knight's place, the halos, the felt's last cards and the
 * action zone's state, read from the DOM, hidden or not.
 */
function readKept(page: Page): Promise<Kept> {
  return page.evaluate(() => ({
    hand: [...document.querySelectorAll("[data-hand] [data-card]")].map(
      (card) => `${card.getAttribute("data-card")}:${card.getAttribute("data-state")}`,
    ),
    places: Object.fromEntries(
      [...document.querySelectorAll("[data-pawn]")].map((pawn) => [
        pawn.getAttribute("data-pawn") ?? "",
        pawn.getAttribute("data-place") ?? "",
      ]),
    ),
    halos: [...document.querySelectorAll("[data-halo]")]
      .map((halo) => halo.getAttribute("data-halo") ?? "")
      .sort(),
    felt: Object.fromEntries(
      [...document.querySelectorAll("[data-felt-last]")].map((seat) => [
        seat.getAttribute("data-felt-last") ?? "",
        seat.querySelector("[data-felt-card]")?.getAttribute("data-felt-card") ?? "",
      ]),
    ),
    state: document.querySelector("[data-action-zone]")?.getAttribute("data-state") ?? null,
  }));
}

/** Every ring knight stands on its drawn cell. */
async function expectOnCells(page: Page, places: Record<string, string>, what: string) {
  for (const [pawn, place] of Object.entries(places)) {
    if (!place.startsWith("ring:")) continue;
    const cell = Number(place.slice("ring:".length));
    expect(await offCell(page, pawn, cell), `${what}: ${pawn} off its cell`).toBeLessThanOrEqual(
      0.5,
    );
  }
}

/** The running animations of the page (the Director's motions, the cards' flights, the fades). */
const runningAnimations = (page: Page) =>
  page.evaluate(
    () => document.getAnimations().filter((animation) => animation.playState === "running").length,
  );

test.describe("derrière l’invitation, la partie attend", () => {
  test("la partie est gardée telle quelle : la main, la carte choisie, les halos, les places", async ({
    page,
  }) => {
    const landscape = configured();
    await page.goto("/");
    await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await untilOwnTurn(page);
    const card = page
      .locator('[data-hand] [data-state="playable"]:not([data-card^="7"]):not([data-card^="11"])')
      .first();
    await card.click();
    await expect(page.locator("[data-halo]").first()).toBeVisible();
    const before = await readKept(page);
    expect(before.hand.some((each) => each.endsWith(":selected"))).toBe(true);
    expect(before.halos.length).toBeGreaterThan(0);
    expect(Object.keys(before.places)).toHaveLength(16);

    await page.setViewportSize(PORTRAIT);
    await expect(prompt(page)).toBeVisible();
    expect(await readKept(page), "behind the invitation").toEqual(before);

    await page.setViewportSize(landscape);
    await expect(prompt(page)).toHaveCount(0);
    await expect(page.locator("[data-board]")).toBeVisible();
    expect(await readKept(page), "back in landscape").toEqual(before);
    await expect(page.locator("[data-halo]").first()).toBeVisible();
    await expectOnCells(page, before.places, "back in landscape");
  });

  test("un mouvement en cours saute à sa fin quand l’écran se tourne", async ({ page }) => {
    const landscape = configured();
    await page.goto("/");
    await page.goto(R071);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
    await page.locator('[data-hit="bleu0"]').click();
    const rest = await page.locator('[data-pawn="bleu0"] [data-role="shadow"]').boundingBox();
    if (!rest) throw new Error("no shadow for bleu0");
    await page.getByRole("button", { name: "Jouer", exact: true }).click();

    // Once bleu0 has left its cell (the 12 hops take about 1.9 s), the screen turns upright.
    await expect
      .poll(async () => {
        const now = await page.locator('[data-pawn="bleu0"] [data-role="shadow"]').boundingBox();
        return now === null ? 0 : Math.hypot(now.x - rest.x, now.y - rest.y);
      })
      .toBeGreaterThan(4);
    expect(await page.locator('[data-pawn="bleu0"]').getAttribute("data-place")).not.toBe(
      "ring:15",
    );
    await page.setViewportSize(PORTRAIT);

    // Within 200 ms the move has jumped to its end, and no motion of the board runs any more: no
    // knight, no card flight, no particle (every Director-led motion lives in [data-board]).
    const elapsed = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const start = performance.now();
          const board = document.querySelector("[data-board]");
          const check = () => {
            const place = document.querySelector('[data-pawn="bleu0"]')?.getAttribute("data-place");
            const moving = document.getAnimations().filter((animation) => {
              const target = (animation.effect as KeyframeEffect | null)?.target;
              return animation.playState === "running" && target != null && board?.contains(target);
            }).length;
            const now = performance.now() - start;
            if ((place === "ring:15" && moving === 0) || now > 2000) resolve(now);
            else setTimeout(check, 10);
          };
          check();
        }),
    );
    expect(await page.locator('[data-pawn="bleu0"]').getAttribute("data-place")).toBe("ring:15");
    expect(elapsed, "the move jumped to its end within 200 ms").toBeLessThanOrEqual(200);
    // R-07.1's Dame is the deal's last card: the next deal is applied at once, and the only motions
    // it starts are the deal banner's and the action zone's own fades (at most 200 ms, in the hidden
    // DOM). Past them, nothing runs at all.
    await page.waitForTimeout(400);
    expect(await runningAnimations(page), "no animation runs behind the invitation").toBe(0);
    expect(await page.locator("[data-flight]").count(), "no card flies").toBe(0);

    await page.setViewportSize(landscape);
    await expect(page.locator("[data-board]")).toBeVisible();
    await expect.poll(() => offCell(page, "bleu0", 15)).toBeLessThanOrEqual(0.5);
  });

  test("les joueurs de l’ordinateur attendent que l’écran revienne en largeur", async ({
    page,
  }) => {
    const landscape = configured();
    // After Bleu's Dame, Jaune holds one 3 and one knight on the ring; normal speed, so it thinks.
    await page.goto("/");
    await page.goto(
      `/#/partie?etat=${etatParam({
        turn: "bleu",
        pawns: { bleu: [{ p: 3 }, "S", "S", "S"], jaune: [{ p: 5 }, "S", "S", "S"] },
        hands: { bleu: ["12H", "2S"], jaune: ["3S"] },
      })}`,
    );
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
    await page.locator('[data-hit="bleu0"]').click();
    await page.getByRole("button", { name: "Jouer", exact: true }).click();
    await expect(zone(page)).toContainText("réfléchit…", { timeout: 15_000 });

    await page.setViewportSize(PORTRAIT);
    await expect(prompt(page)).toBeVisible();
    const held = await readKept(page);
    expect(held.places.bleu0).toBe("ring:15");
    // For 3 s nothing is played behind the invitation.
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(500);
      const now = await readKept(page);
      expect(now.places, "no knight moves behind the invitation").toEqual(held.places);
      expect(now.felt, "no card is played behind the invitation").toEqual(held.felt);
    }

    await page.setViewportSize(landscape);
    await expect(prompt(page)).toHaveCount(0);
    // A computer player plays within 10 s: jaune's 3 moves its knight.
    await expect(page.locator('[data-pawn="jaune0"]')).not.toHaveAttribute(
      "data-place",
      held.places.jaune0 ?? "",
      { timeout: 10_000 },
    );
    await expect
      .poll(async () => (await readKept(page)).felt.jaune, { timeout: 10_000 })
      .toBe("3S");
  });

  test("ouverte en portrait : rien n’est donné à l’écran, la partie commence une fois tournée", async ({
    page,
  }) => {
    const landscape = configured();
    await page.goto("/");
    await page.setViewportSize(PORTRAIT);
    await page.goto(`/#/partie?graine=${SEED}`);
    await expect(prompt(page)).toBeVisible();
    await expect(page.locator("[data-rotate-title]")).toBeFocused();
    await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
    // Nothing flies, nothing runs, and no computer player gives a card while the screen is upright.
    expect(await page.locator("[data-flight]").count()).toBe(0);
    await page.waitForTimeout(2500);
    expect(await page.locator("[data-flight]").count()).toBe(0);
    expect(await runningAnimations(page)).toBe(0);

    await page.setViewportSize(landscape);
    await expect(prompt(page)).toHaveCount(0);
    await expect(page.locator("[data-board]")).toBeVisible();
    await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
    await expect(zone(page)).toHaveAttribute("data-state", "exchange");
    // The game starts. The human passes his card at once. The computer players gave none while the
    // screen was upright: each now thinks 700 to 1300 ms before giving, so the exchange is still
    // waiting 1.2 s later. (Had they given behind the invitation, his card would have completed the
    // exchange at once, leaving only its card flights to watch.)
    await exchange(page);
    await expect(zone(page)).toHaveAttribute("data-state", "exchangeWaiting");
    await page.waitForTimeout(1200);
    await expect(zone(page)).toHaveAttribute("data-state", "exchangeWaiting");
    // Then they give theirs, one after the other, and the first deal is played.
    await expect(zone(page)).not.toHaveAttribute("data-state", "exchangeWaiting", {
      timeout: 15_000,
    });
  });
});

test.describe("le focus et les touches derrière l’invitation", () => {
  test.skip(({ isMobile }) => isMobile, "the keyboard is the computer's");

  test("le focus va au titre puis revient, et aucune touche n’agit sur la partie cachée", async ({
    page,
  }) => {
    await page.goto("/");
    await page.goto(`${R071}&vitesse=test`);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    const dame = page.getByRole("button", { name: "Dame de cœur, jouable" });
    for (let i = 0; i < 20; i++) {
      if (await dame.evaluate((node) => node === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(dame).toBeFocused();
    const before = await readKept(page);

    await page.setViewportSize({ width: 800, height: 1000 });
    const heading = page.getByRole("heading", { name: WINDOW_TITLE });
    await expect(heading).toBeFocused();
    for (const key of ["1", "Enter", "Escape"]) await page.keyboard.press(key);
    expect(await readKept(page), "no key acted behind the invitation").toEqual(before);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(prompt(page)).toHaveCount(0);
    await expect(dame).toBeFocused();
    expect(await readKept(page), "nothing was selected").toEqual(before);
    await expect(page.locator('[data-hand] [data-state="selected"]')).toHaveCount(0);
  });

  test("une feuille ouverte reste ouverte derrière l’invitation, Échap ne la ferme pas", async ({
    page,
  }) => {
    await page.goto("/");
    await page.goto(`${R071}&vitesse=test`);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await page.getByRole("button", { name: "Réglages" }).click();
    const sheet = page.getByRole("dialog", { name: "Réglages" });
    await expect(sheet).toBeVisible();

    await page.setViewportSize({ width: 800, height: 1000 });
    await expect(page.getByRole("heading", { name: WINDOW_TITLE })).toBeFocused();
    await expect(sheet).toBeHidden();
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(prompt(page)).toHaveCount(0);
    await expect(sheet).toBeVisible();
    // The focus went back into the sheet.
    expect(await sheet.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  });
});
