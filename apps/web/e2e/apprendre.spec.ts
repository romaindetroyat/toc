import { expect, type Page, test } from "@playwright/test";

// « Apprendre à jouer » and the first time on a device (plan 05-08, D-07, D-08; 05-UI-SPEC « First-launch
// sheet », « « Apprendre à jouer » #/apprendre »). The suites start every device with toc.tutorial.v1
// already offered (playwright.config.ts), so the first-launch cases below start from an empty storage.

const NEW_DEVICE = { cookies: [], origins: [] };
const FIRST_TIME = "Première fois ?";
const DEVICE = JSON.stringify({ token: "a".repeat(43), name: "Mamie" });

const firstTime = (page: Page) => page.getByRole("dialog", { name: FIRST_TIME });
const lessonsPage = (page: Page) => page.locator("main[data-lessons-page]");
const rows = (page: Page) => lessonsPage(page).locator("[data-lesson]");
const stored = async (page: Page) =>
  JSON.parse((await page.evaluate(() => localStorage.getItem("toc.tutorial.v1"))) ?? "null");

/** The progress before the app starts. */
async function seed(page: Page, value: string) {
  await page.addInitScript((raw) => {
    localStorage.setItem("toc.tutorial.v1", raw);
  }, value);
}

async function openLessons(page: Page) {
  await page.goto("/#/apprendre");
  await expect(lessonsPage(page)).toBeVisible();
}

test.describe("la première fois sur un appareil neuf", () => {
  test.use({ storageState: NEW_DEVICE });

  test("« Première fois ? » s’ouvre une fois, « Apprendre en 10 minutes » mène à la leçon 1", async ({
    page,
  }) => {
    await page.goto("/");
    const sheet = firstTime(page);
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText(
      "Apprends à jouer en jouant : huit petites leçons, avec un guide qui te montre quoi toucher.",
    );
    await expect(sheet).toContainText(
      "Tu retrouveras les leçons sur l’accueil, dans « Apprendre ».",
    );
    const primary = sheet.getByRole("link", { name: "Apprendre en 10 minutes" });
    await expect(primary).toBeFocused();
    await expect(sheet.getByRole("button", { name: "Plus tard" })).toBeVisible();
    // Written at once: whatever the answer, it never comes back on this device.
    expect(await stored(page)).toEqual({ offered: true, done: [] });
    for (const target of [primary, sheet.getByRole("button", { name: "Plus tard" })]) {
      await expect(target).toBeInViewport({ ratio: 1 });
      const box = await target.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await primary.click();
    await expect(page).toHaveURL(/#\/apprendre\/1$/);
    await expect(page.locator("[data-guide-band]")).toBeVisible();
    await page.goto("/");
    await expect(page.locator("main[data-home]")).toBeVisible();
    await page.waitForTimeout(400);
    await expect(firstTime(page)).toHaveCount(0);
  });

  test("« Plus tard » la ferme, et elle ne revient jamais, même après un rechargement", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(firstTime(page)).toBeVisible();
    await firstTime(page).getByRole("button", { name: "Plus tard" }).click();
    await expect(firstTime(page)).toHaveCount(0);
    await expect(page).toHaveURL(/#?\/?$/);
    await page.reload();
    await expect(page.locator("main[data-home]")).toBeVisible();
    await page.waitForTimeout(400);
    await expect(firstTime(page)).toHaveCount(0);
  });

  test("Échap la ferme comme « Plus tard »", async ({ page }) => {
    await page.goto("/");
    await expect(firstTime(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(firstTime(page)).toHaveCount(0);
    expect(await stored(page)).toEqual({ offered: true, done: [] });
    await page.reload();
    await page.waitForTimeout(400);
    await expect(firstTime(page)).toHaveCount(0);
  });

  test("un appareil qui a déjà un prénom ne la voit jamais", async ({ page }) => {
    await page.addInitScript((device) => {
      localStorage.setItem("toc.device.v1", device);
    }, DEVICE);
    await page.goto("/");
    await expect(page.locator('[data-small-tile="prenom"]')).toContainText("Mamie");
    await page.waitForTimeout(400);
    await expect(firstTime(page)).toHaveCount(0);
    // The key is written silently: the device has played.
    expect(await stored(page)).toEqual({ offered: false, done: [] });
  });

  test("un lien de table ou d’invitation ne la montre jamais", async ({ page }) => {
    for (const route of ["/#/table/Zz_unknown-apprendre-01", "/#/invitation/ABCD-EFGH-JKLM"]) {
      await page.goto(route);
      await page.waitForTimeout(600);
      await expect(firstTime(page)).toHaveCount(0);
      expect(await stored(page)).toBeNull();
    }
  });
});

test.describe("« Apprendre à jouer » (#/apprendre)", () => {
  test("aucune leçon faite : « Commencer », les huit leçons d’environ une minute", async ({
    page,
  }) => {
    await openLessons(page);
    await expect(page.getByRole("heading", { level: 1, name: "Apprendre à jouer" })).toBeFocused();
    await expect(lessonsPage(page)).toContainText(
      "Huit petites leçons d’environ une minute. Un guide te montre quoi toucher. Si tu te trompes, il t’explique et tu réessaies.",
    );
    await expect(lessonsPage(page).getByRole("link", { name: "Accueil" })).toHaveAttribute(
      "href",
      "#/",
    );
    await expect(rows(page)).toHaveCount(8);
    const titles = [
      "Sortir un cheval",
      "Avancer",
      "Manger",
      "Le 4 recule",
      "Le Valet échange",
      "Le 7 se partage",
      "Rentrer à la maison",
      "L’échange de carte",
    ];
    for (const [i, title] of titles.entries()) {
      const row = rows(page).nth(i);
      await expect(row).toHaveAttribute("href", `#/apprendre/${i + 1}`);
      await expect(row).toHaveAccessibleName(`Leçon ${i + 1}, ${title}`);
      await expect(row).toContainText(title);
      await expect(row).toContainText("Environ 1 minute");
      await expect(row).toHaveCSS("height", "56px");
    }
    await expect(
      lessonsPage(page).getByRole("link", { name: "Revoir depuis le début" }),
    ).toHaveCount(0);
    const start = lessonsPage(page).getByRole("link", { name: "Commencer" });
    await expect(start).toHaveAttribute("href", "#/apprendre/1");
    await start.click();
    await expect(page).toHaveURL(/#\/apprendre\/1$/);
    await expect(page.locator("[data-guide-band]")).toBeVisible();
  });

  test("deux leçons faites : « Continuer : leçon 3 », les deux premières « Faite »", async ({
    page,
  }) => {
    await seed(page, JSON.stringify({ offered: true, done: [1, 2] }));
    await openLessons(page);
    const next = lessonsPage(page).getByRole("link", { name: "Continuer : leçon 3" });
    await expect(next).toHaveAttribute("href", "#/apprendre/3");
    for (const n of [1, 2]) {
      const row = rows(page).nth(n - 1);
      await expect(row).toHaveAttribute("data-done", "true");
      await expect(row).toContainText("Faite");
      await expect(row.locator("svg")).toHaveCount(1);
    }
    await expect(rows(page).nth(0)).toHaveAccessibleName("Leçon 1, Sortir un cheval, faite");
    await expect(rows(page).nth(2)).toHaveAttribute("data-done", "false");
    await expect(rows(page).nth(2)).toContainText("Environ 1 minute");
  });

  test("tout est fait : « Jouer contre l’ordinateur » et « Revoir depuis le début »", async ({
    page,
  }) => {
    await seed(page, JSON.stringify({ offered: true, done: [1, 2, 3, 4, 5, 6, 7, 8] }));
    await openLessons(page);
    await expect(
      lessonsPage(page).getByRole("link", { name: "Jouer contre l’ordinateur" }),
    ).toHaveAttribute("href", "#/ordinateur");
    const again = lessonsPage(page).getByRole("link", { name: "Revoir depuis le début" });
    await expect(again).toHaveAttribute("href", "#/apprendre/1");
    await again.click();
    await expect(page).toHaveURL(/#\/apprendre\/1$/);
    // The progress is kept.
    expect((await stored(page)).done).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("« Règles du jeu » ouvre les règles sur « Le but », la page reste derrière", async ({
    page,
  }) => {
    await openLessons(page);
    await expect(lessonsPage(page)).toContainText(
      "Les règles complètes sont dans « Règles », à tout moment de la partie.",
    );
    const rules = lessonsPage(page).getByRole("button", { name: "Règles du jeu" });
    await expect(rules).toHaveAttribute("aria-haspopup", "dialog");
    await rules.click();
    const sheet = page.getByRole("dialog", { name: "Règles du TOC" });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator("[data-rules-sheet]")).toHaveAttribute("data-rules-current", "but");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(rules).toBeFocused();
    await expect(page).toHaveURL(/#\/apprendre$/);
  });

  test("une progression illisible se lit vide, sans erreur", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await seed(page, '{"done":"<b>x</b>","offered":"oui"}');
    await openLessons(page);
    await expect(lessonsPage(page).getByRole("link", { name: "Commencer" })).toBeVisible();
    await expect(rows(page).locator('[data-done="true"]')).toHaveCount(0);
    await expect(lessonsPage(page).locator('[data-lesson][data-done="true"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("tenu debout, la page s’affiche sans « Tourne ton téléphone »", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLessons(page);
    await expect(page.getByText("Tourne ton téléphone")).toHaveCount(0);
    await expect(lessonsPage(page).getByRole("link", { name: "Commencer" })).toBeVisible();
    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(sideways).toBe(0);
  });

  for (const size of [
    { width: 844, height: 390, rows: 5 },
    { width: 1280, height: 800, rows: 8 },
    { width: 640, height: 360, rows: 4 },
    { width: 480, height: 320, rows: 0 },
  ]) {
    test(`tient en ${size.width} × ${size.height}, sans défiler de côté`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openLessons(page);
      const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(sideways).toBe(0);
      const start = lessonsPage(page).getByRole("link", { name: "Commencer" });
      await expect(start).toBeInViewport({ ratio: 1 });
      if (size.rows > 0) {
        await expect(
          lessonsPage(page).getByRole("button", { name: "Règles du jeu" }),
        ).toBeInViewport({ ratio: 1 });
      }
      for (let i = 0; i < size.rows; i++) await expect(rows(page).nth(i)).toBeInViewport();
      for (const target of [
        start,
        lessonsPage(page).getByRole("button", { name: "Règles du jeu" }),
        lessonsPage(page).getByRole("link", { name: "Accueil" }),
        ...(await rows(page).all()),
      ]) {
        const box = await target.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }
    });
  }
});
