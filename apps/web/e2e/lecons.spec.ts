import { expect, type Locator, type Page, test } from "@playwright/test";
import { lecons } from "../src/i18n/fr/lecons.ts";

// The lessons on the game screen (plan 05-06; 05-UI-SPEC « The lesson screen », « The guide band »,
// « The guide halo », « Wrong choices », « The lesson plank »; APP-04, D-07, D-09). A lesson is the
// game screen in lesson mode: the guide talks in a band above the board, what to touch is ringed in
// cream, a wrong choice is explained and changes nothing, and « Bravo ! » ends the lesson. The guide's
// lines are read from the catalogue (lecons.ts), so the spec follows Romain's review of them.

const band = (page: Page) => page.locator("[data-guide-band]");
const plank = (page: Page) => page.locator("[data-lesson-plank]");
const card = (page: Page, id: string) => page.locator(`[data-hand] [data-card="${id}"]`);
const next = (page: Page) => page.getByRole("button", { name: /^Suivant/ });
const play = (page: Page) => page.getByRole("button", { name: /^Jouer/ });

/** The lesson at test speed (no motion), from the home so that the app starts as a person's would. */
async function openLesson(page: Page, n: number) {
  await page.goto("/");
  await page.goto(`/#/apprendre/${n}?vitesse=test`);
  await expect(page.locator(`[data-lesson="${n}"]`)).toHaveCount(1);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

/** The band shows `line` (the bubble's text, whatever its bold words). */
async function says(page: Page, line: string, timeout?: number) {
  await expect(band(page)).toHaveText(line, { timeout });
}

/** The requests that would write anything: a lesson sends none. */
function watchWrites(page: Page): string[] {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      writes.push(`${request.method()} ${request.url()}`);
    }
  });
  return writes;
}

/** The plank, once its entrance is over. */
async function plankShown(page: Page): Promise<Locator> {
  const shown = plank(page);
  await expect(shown).toBeVisible();
  await shown.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
  return shown;
}

test.describe("leçon 1 « Sortir un cheval »", () => {
  test("le guide parle, l’As est entouré, une erreur est expliquée, puis « Bravo ! »", async ({
    page,
  }) => {
    const writes = watchWrites(page);
    await openLesson(page, 1);

    // Bleu at the bottom, the guide's first line, « Suivant » with the focus.
    await expect(page.locator("[data-board]")).toHaveAttribute("data-bottom", "bleu");
    await says(page, lecons.sortir.bienvenue);
    await expect(band(page)).toHaveAttribute("aria-live", "polite");
    await expect(next(page)).toBeFocused();
    await expect(page.locator("[data-lesson]")).toHaveAttribute("data-lesson-step", "0");

    // Entrée presses « Suivant ».
    await page.keyboard.press("Enter");
    await says(page, lecons.sortir.but);
    await page.keyboard.press("Enter");
    await says(page, lecons.sortir.carte);
    await expect(next(page)).toHaveCount(0);

    // The As is ringed in cream and named « …, à toucher »; nothing else is.
    const halo = page.locator('[data-guide-halo="card"]');
    await expect(halo).toHaveCount(1);
    await expect(halo).toHaveAttribute("data-guide-card", "1H");
    await expect(page.getByRole("button", { name: /^As de cœur, .*, à toucher$/ })).toHaveCount(1);
    await expect(page.getByRole("button", { name: /, à toucher$/ })).toHaveCount(1);
    const ring = await halo.evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(ring, "the guide halo is cream, never amber").toBe("rgb(255, 248, 225)");

    // A wrong card: nothing is selected, the wrong line, the halo stays; 4 s later, the step's line.
    await card(page, "8S").click();
    await says(page, lecons.sortir.wrong.carte);
    await expect(page.locator('[data-hand] [aria-pressed="true"]')).toHaveCount(0);
    await expect(halo).toHaveCount(1);
    await says(page, lecons.sortir.carte, 6000);

    // The As, then « Jouer » (ringed): the knight goes out and the plank says « Bravo ! ».
    await card(page, "1H").click();
    await says(page, lecons.sortir.jouer);
    await expect(page.locator('[data-guide-halo="button"]')).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Jouer.*, à toucher$/ })).toHaveCount(1);
    await play(page).click();
    await expect(page.locator('[data-pawn^="bleu"][data-place="ring:0"]')).toHaveCount(1);

    const shown = await plankShown(page);
    await expect(shown).toHaveAttribute("role", "dialog");
    await expect(shown.getByRole("heading", { name: lecons.bravo })).toBeVisible();
    await expect(shown).toContainText(lecons.sortir.recap);
    await expect(shown.getByRole("button", { name: lecons.plank.next })).toBeFocused();
    await expect(shown.getByRole("button", { name: lecons.plank.again })).toBeVisible();

    // The lesson is marked done; nothing else was written, nothing was sent.
    const stored = await page.evaluate(() => localStorage.getItem("toc.tutorial.v1"));
    expect(JSON.parse(stored ?? "null")?.done).toContain(1);
    expect(await page.evaluate(() => localStorage.getItem("toc.tables.v1"))).toBeNull();
    expect(writes).toEqual([]);

    // « Leçon suivante » opens lesson 2.
    await shown.getByRole("button", { name: lecons.plank.next }).click();
    await expect(page).toHaveURL(/#\/apprendre\/2/);
    await expect(page.locator('[data-lesson="2"]')).toHaveCount(1);
    await says(page, lecons.avancer.intro);
  });

  test("ce qui n’a pas sa place dans une leçon est caché", async ({ page }) => {
    await openLesson(page, 1);
    await says(page, lecons.sortir.bienvenue);
    await expect(page.locator("[data-deal-banner]")).toHaveCount(0);
    await expect(page.locator("[data-dealer]")).toHaveCount(0);
    await expect(page.locator("[data-starter]")).toHaveCount(0);
    await expect(page.locator("[data-team-us], [data-team-them]")).toHaveCount(0);
    await expect(page.locator("[data-fast]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Avance rapide" })).toHaveCount(0);
    await expect(page.locator("[data-messages-button]")).toHaveCount(0);
  });

  test("une leçon n’envoie rien et n’enregistre aucune table", async ({ page }) => {
    const writes = watchWrites(page);
    await openLesson(page, 1);
    await next(page).click();
    await next(page).click();
    await card(page, "1H").click();
    await play(page).click();
    await plankShown(page);
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem("toc.tables.v1"))).toBeNull();
  });
});

// The board in a lesson (05-UI-SPEC « Board width in a lesson »): the band takes the prompt row's
// place, so the board formula reads its height. Explicit viewports: the desktop project only.
const WIDTHS = [
  { width: 844, height: 390, board: 668, band: 56 },
  { width: 750, height: 342, board: 572, band: 56 },
  { width: 667, height: 375, board: 526, band: 56 },
  { width: 480, height: 320, board: 351, band: 80 },
  { width: 1280, height: 800, board: 1119.5, band: 56 },
] as const;

for (const size of WIDTHS) {
  test.describe(`le plateau d’une leçon à ${size.width} x ${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test.skip(({ isMobile }) => isMobile, "explicit viewports: desktop project only");

    test("la largeur du tableau, la bande au-dessus, sans défilement", async ({ page }) => {
      await openLesson(page, 1);
      await says(page, lecons.sortir.bienvenue);
      const board = await page.locator("[data-board]").boundingBox();
      const guide = await band(page).boundingBox();
      expect(board).not.toBeNull();
      expect(guide).not.toBeNull();
      if (board === null || guide === null) return;
      expect(Math.abs(board.width - size.board), `board ${board.width}`).toBeLessThanOrEqual(2);
      expect(Math.abs(guide.height - size.band), `band ${guide.height}`).toBeLessThanOrEqual(0.5);
      expect(guide.y + guide.height, "the band stands above the board").toBeLessThanOrEqual(
        board.y + 0.5,
      );
      // The band is as wide as the board, centred on it.
      expect(Math.abs(guide.width - board.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(guide.x - board.x)).toBeLessThanOrEqual(1);
      const scroll = await page.evaluate(() => {
        const root = document.scrollingElement ?? document.documentElement;
        return {
          x: root.scrollWidth - root.clientWidth,
          y: root.scrollHeight - root.clientHeight,
        };
      });
      expect(scroll).toEqual({ x: 0, y: 0 });
    });
  });
}
