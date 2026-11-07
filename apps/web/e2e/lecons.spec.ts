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

// --- The eight lessons, each with its declared wrong choice (plan 05-06 task 2) ---

/** One move of a lesson's script, as a person would make it. */
type Act =
  /** The band says this line (and, in the measure test, it is measured there). */
  | { say: string }
  | { next: true }
  | { card: string }
  | { pawn: string }
  | { chip: number }
  | { play: true }
  | { give: true }
  /** Anything to check on the way. */
  | { check: (page: Page) => Promise<void> };

/** The partner's 7 has Rouge's border once the cards have crossed (lesson 8). */
const receivedSeven = async (page: Page) => {
  await expect(card(page, "7H")).toHaveAttribute("data-received", "rouge");
};

const { sortir, avancer, manger, recule, valet, sept, maison, echange } = lecons;

/** Each lesson's right path, with one wrong choice (lesson 5: Jaune 40; 6: a split; 7: the 9, the Roi). */
const SCRIPTS: Record<number, Act[]> = {
  1: [
    { say: sortir.bienvenue },
    { next: true },
    { say: sortir.but },
    { next: true },
    { say: sortir.carte },
    { card: "8S" },
    { say: sortir.wrong.carte },
    { card: "1H" },
    { say: sortir.jouer },
    { play: true },
  ],
  2: [
    { say: avancer.intro },
    { next: true },
    { say: avancer.carte },
    { card: "12H" },
    { say: avancer.wrong.carte },
    {
      check: async (page) =>
        expect(page.locator('[data-pawn="bleu1"]')).toHaveAttribute("data-place", "ring:10"),
    },
    { card: "8C" },
    { say: avancer.jouer },
    { play: true },
    {
      check: async (page) =>
        expect(page.locator('[data-pawn="bleu1"]')).toHaveAttribute("data-place", "ring:18"),
    },
  ],
  3: [
    { say: manger.carte },
    { card: "3S" },
    { say: manger.wrong.carte },
    { card: "8D" },
    { say: manger.jouer },
    { play: true },
    {
      check: async (page) =>
        expect(page.locator('[data-pawn="jaune0"]')).toHaveAttribute("data-place", /^stable/),
    },
  ],
  4: [
    { say: recule.carte },
    { card: "9S" },
    { say: recule.wrong.carte },
    { card: "4H" },
    { say: recule.jouer },
    { play: true },
    {
      check: async (page) =>
        expect(page.locator('[data-pawn="vert0"]')).toHaveAttribute("data-place", /^stable/),
    },
  ],
  5: [
    { say: valet.carte },
    { card: "6D" },
    { say: valet.wrong.carte },
    { card: "11S" },
    { say: valet.cheval },
    {
      check: async (page) =>
        expect(page.locator('[data-guide-halo="pawn"]')).toHaveAttribute(
          "data-guide-pawn",
          "bleu0",
        ),
    },
    { pawn: "bleu0" },
    { say: valet.cible },
    { pawn: "jaune1" },
    { say: valet.wrong.cible },
    { check: async (page) => expect(page.locator("[data-swap-preview]")).toHaveCount(0) },
    { pawn: "jaune0" },
    { say: valet.jouer },
    { play: true },
    {
      check: async (page) =>
        expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:66"),
    },
  ],
  6: [
    { say: sept.intro },
    { next: true },
    { say: sept.carte },
    { card: "2H" },
    { say: sept.carte },
    { card: "7C" },
    { say: sept.premier },
    { pawn: "bleu0" },
    {
      check: async (page) =>
        expect(page.locator('[data-guide-halo="chip"]')).toHaveAttribute("data-step", "3"),
    },
    // A split that eats only Vert: refused on « Jouer », the split goes back to its start.
    { chip: 1 },
    { pawn: "bleu1" },
    { chip: 6 },
    { say: sept.jouer },
    { play: true },
    { say: sept.wrong.plan },
    {
      check: async (page) =>
        expect(page.locator("[data-remaining]").first()).toHaveAttribute("data-remaining", "7"),
    },
    { pawn: "bleu0" },
    { chip: 3 },
    { say: sept.second },
    { pawn: "bleu1" },
    { chip: 4 },
    { say: sept.jouer },
    { play: true },
    {
      check: async (page) =>
        expect(page.locator('[data-pawn="jaune0"]')).toHaveAttribute("data-place", /^stable/),
    },
    {
      check: async (page) =>
        expect(page.locator('[data-pawn="vert0"]')).toHaveAttribute("data-place", /^stable/),
    },
  ],
  7: [
    { say: maison.intro },
    { next: true },
    { say: maison.carte },
    { card: "9H" },
    { say: maison.wrong.neuf },
    { card: "13C" },
    { say: maison.wrong.roi },
    { card: "6S" },
    { say: maison.jouer },
    { play: true },
    {
      check: async (page) =>
        expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", /^home/),
    },
  ],
  8: [
    { say: echange.intro },
    { next: true },
    { say: echange.carte },
    { card: "9C" },
    { say: echange.wrong.carte },
    { card: "13S" },
    { say: echange.passer },
    { give: true },
    { say: echange.recu },
    { check: receivedSeven },
    { next: true },
  ],
};

/** Plays one move of a script; `measure` is called at each line the band says. */
async function act(page: Page, step: Act, measure?: (line: string) => Promise<void>) {
  if ("say" in step) {
    await says(page, step.say);
    await measure?.(step.say);
  } else if ("next" in step) await next(page).click();
  else if ("card" in step) await card(page, step.card).click();
  else if ("pawn" in step) await page.locator(`[data-hit="${step.pawn}"]`).click({ force: true });
  else if ("chip" in step)
    await page.locator(`[data-seven-chips] [data-step="${step.chip}"]`).click();
  else if ("play" in step) await play(page).click();
  else if ("give" in step) await page.getByRole("button", { name: /^Passer cette carte/ }).click();
  else await step.check(page);
}

for (const n of [2, 3, 4, 5, 6, 7, 8]) {
  test(`leçon ${n} : une erreur expliquée, puis « Bravo ! »`, async ({ page }) => {
    const writes = watchWrites(page);
    await openLesson(page, n);
    for (const step of SCRIPTS[n] ?? []) await act(page, step);
    const shown = await plankShown(page);
    const done = JSON.parse(
      (await page.evaluate(() => localStorage.getItem("toc.tutorial.v1"))) ?? "null",
    );
    expect(done?.done).toContain(n);
    expect(writes).toEqual([]);
    if (n < 8) {
      await expect(shown.getByRole("button", { name: lecons.plank.next })).toBeFocused();
      return;
    }
    // The last lesson: « Revoir les leçons » and « Jouer contre l’ordinateur » (#/ordinateur).
    await expect(shown).toContainText(echange.recap);
    await expect(shown.getByRole("button", { name: lecons.plank.lessons })).toBeVisible();
    await expect(shown.getByRole("button", { name: lecons.plank.computer })).toBeFocused();
    await shown.getByRole("button", { name: lecons.plank.computer }).click();
    await expect(page).toHaveURL(/#\/ordinateur$/);
  });
}

test.describe("au clavier", () => {
  test.skip(({ isMobile }) => isMobile, "the keyboard: desktop project only");

  test("Échap ramène l’étape de la carte, les chiffres et Entrée jouent", async ({ page }) => {
    await openLesson(page, 3);
    await says(page, manger.carte);
    // The hand reads 3, 8, 10: « 2 » is the 8, which has one move (its preview opens by itself).
    await page.keyboard.press("2");
    await says(page, manger.jouer);
    await page.keyboard.press("Escape");
    await says(page, manger.carte);
    await expect(page.locator('[data-hand] [aria-pressed="true"]')).toHaveCount(0);
    await page.keyboard.press("1");
    await says(page, manger.wrong.carte);
    await page.keyboard.press("2");
    await says(page, manger.jouer);
    await page.keyboard.press("Enter");
    await plankShown(page);
  });

  test("les lettres choisissent les chevaux, comme en partie", async ({ page }) => {
    await openLesson(page, 5);
    await says(page, valet.carte);
    // The hand reads 6, Valet: « 2 » is the Valet; « A » is Bleu's knight, then Jaune 66 (« B » is 40).
    await page.keyboard.press("2");
    await says(page, valet.cheval);
    await page.keyboard.press("a");
    await says(page, valet.cible);
    await page.keyboard.press("b");
    await says(page, valet.wrong.cible);
    // « A » is also Bleu's own knight, chosen already: as in a game, the tray tells the two apart.
    await page.keyboard.press("a");
    const chip = page.locator('[data-tray-option="jaune0"]');
    await expect(chip).toBeVisible();
    await page.keyboard.press((await chip.locator(".letter").textContent())?.trim() ?? "");
    await says(page, valet.jouer);
    await page.keyboard.press("Enter");
    await plankShown(page);
  });
});

// Every guide line, wrong line and narration line in the band (05-UI-SPEC « Text budget »): at most
// two lines on a 750 x 342 board and three on a 480 x 320 one, never clipped. Each lesson is played
// with each declared wrong choice, and the band is measured at every line it says.
const BAND_SIZES = [
  { width: 750, height: 342, lines: 2 },
  { width: 480, height: 320, lines: 3 },
] as const;

for (const size of BAND_SIZES) {
  test.describe(`chaque phrase du guide dans la bande à ${size.width} x ${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    test.skip(({ isMobile }) => isMobile, "explicit viewports: desktop project only");

    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      test(`leçon ${n}`, async ({ page }) => {
        const measured: string[] = [];
        await openLesson(page, n);
        for (const step of SCRIPTS[n] ?? []) {
          await act(page, step, async (line) => {
            // Measured once the band has settled: under the load of the full suite the line change
            // (a 150 ms fade and a 4 px rise) can still be running at the first look, which reads as
            // a clip for a moment (plan 05-09, deferred-items.md). A real clip stays and still fails.
            const measure = () =>
              band(page).evaluate(async (el) => {
                await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished));
                const text = el.querySelector("[data-guide-line]") as HTMLElement;
                const bubble = text.parentElement as HTMLElement;
                const box = text.getBoundingClientRect();
                const outer = el.getBoundingClientRect();
                const lineHeight = Number.parseFloat(getComputedStyle(text).lineHeight);
                return {
                  lines: Math.round(box.height / lineHeight),
                  clipped:
                    bubble.scrollHeight > bubble.clientHeight + 0.5 ||
                    text.scrollWidth > text.clientWidth + 0.5 ||
                    box.top < outer.top - 0.5 ||
                    box.bottom > outer.bottom + 0.5,
                };
              });
            await expect
              .poll(async () => (await measure()).clipped, { message: line, timeout: 2_000 })
              .toBe(false);
            const fit = await measure();
            expect(fit.lines, line).toBeLessThanOrEqual(size.lines);
            expect(fit.clipped, line).toBe(false);
            measured.push(line);
          });
        }
        expect(measured.length).toBeGreaterThan(0);
      });
    }
  });
}

test.describe("animations réduites", () => {
  test.use({ reducedMotion: "reduce" });

  test("le halo ne pulse pas et la planche apparaît en fondu", async ({ page }) => {
    await openLesson(page, 3);
    await says(page, manger.carte);
    const ring = page.locator('[data-guide-halo="card"]');
    await expect(ring).toHaveCount(1);
    expect(await ring.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    await card(page, "8D").click();
    const button = page.locator('[data-guide-halo="button"]');
    expect(await button.evaluate((el) => getComputedStyle(el, "::after").animationName)).toBe(
      "none",
    );
    await play(page).click();
    const shown = plank(page);
    await expect(shown).toBeVisible();
    const name = await shown.evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toMatch(/fade/);
    expect(name).not.toMatch(/plank-in/);
  });

  test("l’anneau du cheval ne pulse pas", async ({ page }) => {
    await openLesson(page, 5);
    await card(page, "11S").click();
    const ring = page.locator('[data-guide-halo="pawn"] .guide-pulse');
    await expect(ring).toHaveCount(1);
    expect(await ring.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });
});

test("sans animations réduites, le halo pulse", async ({ page }) => {
  await openLesson(page, 3);
  const ring = page.locator('[data-guide-halo="card"]');
  await expect(ring).toHaveCount(1);
  expect(await ring.evaluate((el) => getComputedStyle(el).animationName)).not.toBe("none");
  await card(page, "8D").click();
  expect(
    await page
      .locator('[data-guide-halo="button"]')
      .evaluate((el) => getComputedStyle(el, "::after").animationName),
  ).not.toBe("none");
});

// --- The lesson pill, « Les leçons », leaving, the rules (plan 05-06 task 3) ---

const pill = (page: Page) => page.getByRole("button", { name: /^Leçon \d sur 8 : / });
const lessonsSheet = (page: Page) => page.getByRole("dialog", { name: lecons.sheet.title });

/** Seeds the progress before the app starts (lessons 1 and 2 done). */
async function seedProgress(page: Page, done: number[]) {
  await page.goto("/");
  await page.evaluate((value) => localStorage.setItem("toc.tutorial.v1", JSON.stringify(value)), {
    offered: true,
    done,
  });
}

test.describe("la pastille de la leçon et « Les leçons »", () => {
  test("la pastille ouvre la liste, une leçon s’y choisit, « Recommencer », « Fermer »", async ({
    page,
  }) => {
    await seedProgress(page, [1, 2]);
    await openLesson(page, 3);
    await says(page, manger.carte);

    await expect(pill(page)).toHaveAccessibleName(
      `Leçon 3 sur 8 : ${manger.title}, voir les leçons`,
    );
    await expect(pill(page)).toContainText("Leçon 3 sur 8");
    await pill(page).click();
    const sheet = lessonsSheet(page);
    await expect(sheet).toBeVisible();

    // The eight titles, the done marks of toc.tutorial.v1.
    const rows = sheet.locator("[data-lesson]");
    await expect(rows).toHaveCount(8);
    const titles = [sortir, avancer, manger, recule, valet, sept, maison, echange].map(
      (lesson) => lesson.title,
    );
    for (const [i, title] of titles.entries()) {
      await expect(rows.nth(i)).toHaveAttribute("data-lesson", String(i + 1));
      await expect(rows.nth(i)).toContainText(title);
    }
    await expect(rows.nth(0)).toHaveAttribute("data-done", "true");
    await expect(rows.nth(1)).toHaveAttribute("data-done", "true");
    await expect(rows.nth(2)).toHaveAttribute("data-done", "false");
    await expect(rows.nth(0)).toHaveAccessibleName(`Leçon 1, ${sortir.title}, faite`);
    await expect(rows.nth(2)).toHaveAccessibleName(`Leçon 3, ${manger.title}`);

    // « Fermer » closes; the lesson is as it was.
    await sheet.getByRole("button", { name: "Fermer" }).click();
    await expect(sheet).toHaveCount(0);
    await says(page, manger.carte);

    // « Recommencer cette leçon »: the position and the first line again.
    await card(page, "8D").click();
    await says(page, manger.jouer);
    await pill(page).click();
    await lessonsSheet(page).getByRole("button", { name: lecons.sheet.restart }).click();
    await expect(lessonsSheet(page)).toHaveCount(0);
    await says(page, manger.carte);
    await expect(page.locator('[data-hand] [aria-pressed="true"]')).toHaveCount(0);
    await expect(page.locator('[data-pawn="jaune0"]')).toHaveAttribute("data-place", "ring:20");

    // A row starts its lesson.
    await pill(page).click();
    await lessonsSheet(page).locator('[data-lesson="5"]').click();
    await expect(page).toHaveURL(/#\/apprendre\/5$/);
    await says(page, valet.carte);
    await expect(pill(page)).toHaveAccessibleName(
      `Leçon 5 sur 8 : ${valet.title}, voir les leçons`,
    );
  });
});

test.describe("« Réglages » dans une leçon", () => {
  test("« Quitter les leçons » sans question, les leçons faites restent cochées", async ({
    page,
  }) => {
    await seedProgress(page, [1]);
    await openLesson(page, 4);
    await says(page, recule.carte);
    await page.getByRole("button", { name: "Réglages", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "Réglages" });
    await expect(settings).toBeVisible();
    await expect(settings.getByRole("button", { name: "Abandonner la partie" })).toHaveCount(0);
    await settings.getByRole("button", { name: "Quitter les leçons" }).click();
    await expect(page).toHaveURL(/#\/apprendre$/);
    await expect(band(page)).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const stored = JSON.parse(
      (await page.evaluate(() => localStorage.getItem("toc.tutorial.v1"))) ?? "null",
    );
    expect(stored?.done).toEqual([1]);
  });
});

test.describe("les règles dans une leçon", () => {
  test("le livre ouvre « Règles » sur « Les cartes », la leçon attend derrière", async ({
    page,
  }) => {
    await openLesson(page, 2);
    await says(page, avancer.intro);
    await page.getByRole("button", { name: "Règles du jeu" }).first().click();
    const rules = page.locator("[data-rules-sheet]");
    await expect(rules).toBeVisible();
    await expect(page.locator('[data-rules-tab="cartes"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(rules).toHaveCount(0);
    await says(page, avancer.intro);
    await expect(page.locator("[data-lesson]")).toHaveAttribute("data-lesson-step", "0");
  });

  test("« R » aussi, sur ordinateur", async ({ page, isMobile }) => {
    test.skip(isMobile, "the keyboard: desktop project only");
    await openLesson(page, 2);
    await says(page, avancer.intro);
    await page.keyboard.press("r");
    await expect(page.locator("[data-rules-sheet]")).toBeVisible();
    await expect(page.locator('[data-rules-tab="cartes"]')).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("r");
    await expect(page.locator("[data-rules-sheet]")).toHaveCount(0);
    await says(page, avancer.intro);
  });
});
