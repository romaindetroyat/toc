import { expect, type Page, test } from "@playwright/test";

// « Accueil » at #/ (02-UI-SPEC « Home « Accueil » », D-09, plan 02-04): the two oak choices, the name
// line (since plan 04-09 the small tiles « Ton prénom » and « Se connecter », 04-UI-SPEC « Small
// tiles »), « Mes parties en cours »; the game against the computer one tap away at #/ordinateur. The fit
// table of the UI-SPEC: every size of FITS shows the whole home without scrolling; SCROLLS scroll in
// one column; nothing ever scrolls sideways.

const DEVICE = JSON.stringify({ token: "a".repeat(43), name: "Marie-Charlotte" });

const FITS = [
  { width: 1280, height: 800, layout: "computer" },
  { width: 1024, height: 640, layout: "computer" },
  { width: 844, height: 390, layout: "two" },
  { width: 750, height: 342, layout: "two" },
  { width: 667, height: 375, layout: "two" },
  { width: 640, height: 360, layout: "two" },
] as const;

const SCROLLS = [
  { width: 568, height: 320, layout: "one" },
  { width: 480, height: 320, layout: "one" },
] as const;

const home = (page: Page) => page.locator("main[data-home]");
const tile = (page: Page, choice: "ordinateur" | "table") =>
  page.locator(`[data-home-choice="${choice}"]`);

async function withName(page: Page) {
  await page.addInitScript((device) => {
    localStorage.setItem("toc.device.v1", device);
  }, DEVICE);
}

async function scroll(page: Page) {
  return page.evaluate(() => ({
    sideways: document.documentElement.scrollWidth - window.innerWidth,
    down: document.documentElement.scrollHeight - window.innerHeight,
  }));
}

for (const size of FITS) {
  test(`accueil : tout tient sans défiler (${size.width} × ${size.height})`, async ({ page }) => {
    await withName(page);
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/");
    await expect(home(page)).toHaveAttribute("data-layout", size.layout);
    // Plan 04-09: the name line is now the small tile « Ton prénom », beside « Se connecter ».
    await expect(page.locator('[data-small-tile="prenom"]')).toContainText("Marie-Charlotte");
    expect(await scroll(page)).toEqual({ sideways: 0, down: 0 });
    for (const target of [
      tile(page, "ordinateur"),
      tile(page, "table"),
      page.locator('[data-small-tile="prenom"]'),
      page.locator('[data-small-tile="connexion"]'),
      page.getByRole("heading", { name: "Mes parties en cours" }),
      page.getByRole("button", { name: "Réglages" }),
    ]) {
      await expect(target).toBeInViewport({ ratio: 1 });
    }
    // The two tiles: 96 high on a phone, 112 on the computer, at least 44 wide and high everywhere.
    for (const choice of ["ordinateur", "table"] as const) {
      const box = await tile(page, choice).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(size.layout === "computer" ? 112 : 96);
      expect(box?.width).toBeGreaterThanOrEqual(size.layout === "computer" ? 320 : 280);
    }
  });
}

for (const size of SCROLLS) {
  test(`accueil : une colonne qui défile, jamais de côté (${size.width} × ${size.height})`, async ({
    page,
  }) => {
    await withName(page);
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/");
    await expect(home(page)).toHaveAttribute("data-layout", size.layout);
    expect((await scroll(page)).sideways).toBe(0);
    await expect(tile(page, "ordinateur")).toBeInViewport({ ratio: 1 });
    await expect(tile(page, "table")).toBeInViewport({ ratio: 1 });
    // The gear never covers a tile.
    const gear = await page.getByRole("button", { name: "Réglages" }).boundingBox();
    const right = await tile(page, "table").boundingBox();
    expect((gear?.y ?? 0) + (gear?.height ?? 0)).toBeLessThanOrEqual(right?.y ?? 0);
  });
}

test("accueil : en portrait la page défile, sans « Tourne ton téléphone »", async ({ page }) => {
  await withName(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(home(page)).toHaveAttribute("data-layout", "portrait");
  await expect(page.getByText("Tourne ton téléphone")).toHaveCount(0);
  expect((await scroll(page)).sideways).toBe(0);
  await expect(page.getByText("Le jeu de petits chevaux à cartes")).toBeVisible();
  await expect(tile(page, "ordinateur")).toBeVisible();
  await expect(tile(page, "table")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 500 });
  expect((await scroll(page)).down).toBeGreaterThan(0);
  expect((await scroll(page)).sideways).toBe(0);
});

test("accueil : aucune touche d’ambre, les deux choix sont en chêne", async ({ page }) => {
  await page.goto("/");
  await expect(tile(page, "table")).toBeVisible();
  for (const choice of ["ordinateur", "table"] as const) {
    await expect(tile(page, choice)).toHaveCSS("background-color", "rgb(216, 198, 176)");
  }
  const amber = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main[data-home] *")]
      .filter((el) => {
        const style = getComputedStyle(el);
        return [style.backgroundColor, style.color, style.borderTopColor].includes(
          "rgb(255, 176, 46)",
        );
      })
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  expect(amber).toEqual([]);
  // Without a stored first name there is no name tile (plan 04-09: « Se connecter » alone).
  await expect(page.locator('[data-small-tile="prenom"]')).toHaveCount(0);
  await expect(page.locator('[data-small-tile="connexion"]')).toHaveCount(1);
  await expect(page.locator('[data-small-tile="connexion"]')).toHaveCSS(
    "background-color",
    "rgb(74, 47, 26)",
  );
});

test("accueil : « Jouer contre l’ordinateur » ouvre #/ordinateur, « Accueil » y ramène", async ({
  page,
}) => {
  await page.goto("/");
  await expect(tile(page, "ordinateur")).toContainText("Jouer contre l’ordinateur");
  await expect(tile(page, "ordinateur")).toContainText("Sur cet appareil, même sans réseau");
  await expect(tile(page, "table")).toContainText("Créer une table en ligne");
  await expect(tile(page, "table")).toContainText("Invite tes proches avec un lien");
  await tile(page, "ordinateur").click();
  await expect(page).toHaveURL(/#\/ordinateur$/);
  await expect(page.getByRole("button", { name: "Jouer la partie" })).toBeVisible();

  // [Accueil] 16 [Réglages] 16 [Jouer la partie], in this order on one row.
  const back = page.getByRole("link", { name: "Accueil" });
  const settings = page.getByRole("button", { name: "Réglages" });
  const play = page.getByRole("button", { name: "Jouer la partie" });
  const [a, s, p] = [
    await back.boundingBox(),
    await settings.boundingBox(),
    await play.boundingBox(),
  ];
  expect((a?.x ?? 0) + (a?.width ?? 0) + 16).toBeCloseTo(s?.x ?? 0, 0);
  expect((s?.x ?? 0) + (s?.width ?? 0) + 16).toBeCloseTo(p?.x ?? 0, 0);

  await back.click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(tile(page, "ordinateur")).toBeVisible();
});

test("accueil : au clavier, la roue puis les deux choix", async ({ page }) => {
  await withName(page);
  await page.goto("/");
  await expect(tile(page, "table")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Réglages" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(tile(page, "ordinateur")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(tile(page, "table")).toBeFocused();
  await page.keyboard.press("Tab");
  // Plan 04-09: « Changer » is now the small tile « Ton prénom », then « Se connecter ».
  await expect(
    page.getByRole("button", { name: "Changer de prénom (Marie-Charlotte)" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Se connecter ou créer un compte" })).toBeFocused();
  // Entrée on the solo tile opens the solo setup.
  await tile(page, "ordinateur").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/ordinateur$/);
});

test("accueil : vingt parties, la liste défile dans sa colonne, jamais la page", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const colours = ["bleu", "jaune", "rouge", "vert"];
    localStorage.setItem(
      "toc.tables.v1",
      JSON.stringify(
        Array.from({ length: 20 }, (_, n) => ({
          id: `table${String(n).padStart(17, "0")}`,
          seat: colours[n % 4],
          joinedAt: 1_792_000_000_000 - n,
        })),
      ),
    );
  });
  await page.route("**/api/tables/*", (route) => route.fulfill({ status: 503, body: "" }));
  for (const size of [
    { width: 1280, height: 800 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/");
    // The server cannot answer (503): every row stays in the list, its state unknown.
    await expect(page.locator("[data-table-row]")).toHaveCount(20);
    await expect(page.locator("[data-table-row]").first()).toHaveCSS("height", "64px");
    expect(await scroll(page)).toEqual({ sideways: 0, down: 0 });
    const list = await page.locator("[data-home] .list").evaluate((el) => ({
      overflow: el.scrollHeight - el.clientHeight,
      bottom: el.getBoundingClientRect().bottom,
    }));
    expect(list.overflow).toBeGreaterThan(0);
    expect(list.bottom).toBeLessThanOrEqual(size.height);
    await expect(tile(page, "table")).toBeInViewport({ ratio: 1 });
  }
});

test("accueil : un invité voit « Ton prénom » et « Se connecter », sans bandeau ni erreur (plan 04-09)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await withName(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  const prenom = page.locator('[data-small-tile="prenom"]');
  await expect(prenom).toContainText("Ton prénom");
  await expect(prenom).toContainText("Marie-Charlotte");
  await expect(prenom).toHaveAttribute("aria-haspopup", "dialog");
  await expect(page.locator('[data-small-tile="connexion"]')).toContainText("Se connecter");
  await expect(page.locator('[data-small-tile="compte"]')).toHaveCount(0);
  await expect(page.locator('[data-small-tile="amis"]')).toHaveCount(0);
  // The 02 name line has become the tile; under the preview (no Worker) no strip shows.
  await expect(page.locator("[data-name-line]")).toHaveCount(0);
  await expect(page.locator('[data-home-strip="offline"]')).toHaveCount(0);
  // « Ton prénom » opens « Changer de prénom », prefilled; the focus comes back to the tile.
  await prenom.click();
  const sheet = page.getByRole("dialog", { name: "Changer de prénom" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("textbox")).toHaveValue("Marie-Charlotte");
  await sheet.getByRole("button", { name: "Fermer" }).click();
  await expect(prenom).toBeFocused();
  // « Se connecter » opens the sign-in sheet.
  await page.locator('[data-small-tile="connexion"]').click();
  await expect(page.locator("[data-signin-sheet]")).toBeVisible();
  expect(errors).toEqual([]);
});

// --- Plan 05-08 (D-05, D-08; 05-UI-SPEC « The links row »): « Règles », « Apprendre » and, signed in,
// « Mes résultats », at the bottom of the right column (right after the account tiles in one column).

const links = (page: Page) => page.locator("[data-home-links]");
const linkTile = (page: Page, kind: string) => links(page).locator(`[data-small-tile="${kind}"]`);

async function withProgress(page: Page, done: number[]) {
  await page.addInitScript(
    (value) => {
      localStorage.setItem("toc.tutorial.v1", value);
    },
    JSON.stringify({ offered: true, done }),
  );
}

async function withTables(page: Page, count: number) {
  await page.addInitScript((n) => {
    const colours = ["bleu", "jaune", "rouge", "vert"];
    localStorage.setItem(
      "toc.tables.v1",
      JSON.stringify(
        Array.from({ length: n }, (_, i) => ({
          id: `table${String(i).padStart(17, "0")}`,
          seat: colours[i % 4],
          joinedAt: 1_792_000_000_000 - i,
        })),
      ),
    );
  }, count);
  await page.route("**/api/tables/*", (route) => route.fulfill({ status: 503, body: "" }));
}

test("accueil : « Règles » et « Apprendre » pour un invité, sans « Mes résultats »", async ({
  page,
}) => {
  await withName(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await expect(links(page).locator("[data-small-tile]")).toHaveCount(2);
  await expect(linkTile(page, "resultats")).toHaveCount(0);
  await expect(page.locator('[data-small-tile="resultats"]')).toHaveCount(0);

  const rules = linkTile(page, "regles");
  await expect(rules).toContainText("Règles");
  await expect(rules).toContainText("Les cartes, le 7, la maison");
  await expect(rules).toHaveAccessibleName("Règles du jeu");
  await expect(rules).toHaveAttribute("aria-haspopup", "dialog");
  const learn = linkTile(page, "apprendre");
  await expect(learn).toContainText("Apprendre");
  await expect(learn).toContainText("En 10 minutes");
  await expect(learn).toHaveAccessibleName("Apprendre à jouer (En 10 minutes)");
  await expect(learn).toHaveAttribute("href", "#/apprendre");

  // Left-aligned at the width of the three-tile row: 152 each, 8 apart, from the column's left edge.
  const row = await links(page).boundingBox();
  const [a, b] = [await rules.boundingBox(), await learn.boundingBox()];
  expect(a?.width).toBeCloseTo(152, 0);
  expect(b?.width).toBeCloseTo(152, 0);
  expect(a?.height).toBeCloseTo(48, 0);
  expect(a?.x).toBeCloseTo(row?.x ?? 0, 0);
  expect((a?.x ?? 0) + (a?.width ?? 0) + 8).toBeCloseTo(b?.x ?? 0, 0);
  expect(a?.y).toBeCloseTo(b?.y ?? 0, 0);

  // « Règles » opens the rules over the home, on « Le but »; the focus comes back to the tile.
  await rules.click();
  const sheet = page.getByRole("dialog", { name: "Règles du TOC" });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator("[data-rules-sheet]")).toHaveAttribute("data-rules-current", "but");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(rules).toBeFocused();

  // « Apprendre » opens « Apprendre à jouer ».
  await learn.click();
  await expect(page).toHaveURL(/#\/apprendre$/);
  await expect(page.getByRole("heading", { level: 1, name: "Apprendre à jouer" })).toBeVisible();
});

test("accueil : « Apprendre » dit où on en est", async ({ page }) => {
  await withProgress(page, [1, 2]);
  await page.goto("/");
  await expect(linkTile(page, "apprendre")).toContainText("Leçon 3 sur 8");
  await expect(linkTile(page, "apprendre")).toHaveAccessibleName(
    "Apprendre à jouer (Leçon 3 sur 8)",
  );
});

test("accueil : « Apprendre » dit « Leçons faites » quand les huit le sont", async ({ page }) => {
  await withProgress(page, [1, 2, 3, 4, 5, 6, 7, 8]);
  await page.goto("/");
  await expect(linkTile(page, "apprendre")).toContainText("Leçons faites");
  await expect(linkTile(page, "apprendre")).toHaveAccessibleName(
    "Apprendre à jouer (Leçons faites)",
  );
});

for (const size of [
  { width: 844, height: 390, perRow: 3 },
  { width: 1280, height: 800, perRow: 3 },
  { width: 750, height: 342, perRow: 3 },
  { width: 640, height: 360, perRow: 2 },
] as const) {
  test(`accueil : la rangée de liens en bas de la colonne de droite (${size.width} × ${size.height})`, async ({
    page,
  }, testInfo) => {
    // The computer's size is the desktop project's (an iPhone is never 1280 wide).
    test.skip(size.width === 1280 && testInfo.project.name === "phone");
    await withName(page);
    await withTables(page, 20);
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/");
    await expect(page.locator("[data-table-row]")).toHaveCount(20);
    expect(await scroll(page)).toEqual({ sideways: 0, down: 0 });
    const [rules, learn] = [linkTile(page, "regles"), linkTile(page, "apprendre")];
    for (const target of [rules, learn]) await expect(target).toBeInViewport({ ratio: 1 });
    const a = await rules.boundingBox();
    const b = await learn.boundingBox();
    // (W − 8 × (n − 1)) / n, at most 152, with W the right column's width.
    const column = (await links(page).boundingBox())?.width ?? 0;
    const tile = Math.min(152, (column - 8 * (size.perRow - 1)) / size.perRow);
    expect(a?.width).toBeCloseTo(tile, 0);
    expect(b?.width).toBeCloseTo(tile, 0);
    expect(a?.y).toBeCloseTo(b?.y ?? 0, 0);
    // Under the list, which shrinks and is never covered: three 64 px rows in sight without a strip
    // (the phone project's iPhone gets the two-row install strip under the row: one and a half).
    const list = await page.locator("[data-home] .list").evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, height: box.height };
    });
    const strip = await page.locator("[data-home-strip]").count();
    expect(list.height).toBeGreaterThanOrEqual(strip === 0 ? 192 : 96);
    expect(list.bottom).toBeLessThanOrEqual((a?.y ?? 0) - 8 + 0.5);
    const heading = await page.getByRole("heading", { name: "Mes parties en cours" }).boundingBox();
    expect(a?.x).toBeCloseTo(heading?.x ?? 0, 0);
  });
}

for (const size of [
  { width: 568, height: 320 },
  { width: 480, height: 320 },
  { width: 390, height: 844 },
] as const) {
  test(`accueil : en une colonne, la rangée suit les petites tuiles du compte (${size.width} × ${size.height})`, async ({
    page,
  }) => {
    await withName(page);
    await withTables(page, 3);
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/");
    expect((await scroll(page)).sideways).toBe(0);
    const account = await page.locator('[data-small-tile="connexion"]').boundingBox();
    const rules = await linkTile(page, "regles").boundingBox();
    const learn = await linkTile(page, "apprendre").boundingBox();
    const heading = await page.getByRole("heading", { name: "Mes parties en cours" }).boundingBox();
    // Full-width rows of two, after the account tiles and before the list's heading.
    expect(rules?.y).toBeGreaterThanOrEqual((account?.y ?? 0) + (account?.height ?? 0) + 7.5);
    expect((rules?.y ?? 0) + (rules?.height ?? 0)).toBeLessThanOrEqual(heading?.y ?? 0);
    expect(rules?.width).toBeCloseTo(account?.width ?? 0, 0);
    expect(learn?.y).toBeCloseTo(rules?.y ?? 0, 0);
  });
}

test("accueil : au clavier, la rangée de liens après la liste en deux colonnes, avant elle en une", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "phone", "keyboard: the desktop project");
  await withName(page);
  await withTables(page, 1);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await expect(page.locator("[data-table-row]")).toHaveCount(1);
  await page.locator('[data-small-tile="connexion"]').focus();
  // The list's row: its link, then its « Retirer » button.
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-table-row]").getByRole("link")).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(linkTile(page, "regles")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(linkTile(page, "apprendre")).toBeFocused();

  await page.setViewportSize({ width: 568, height: 320 });
  // The row moves once the layout has changed.
  await expect(home(page)).toHaveAttribute("data-layout", "one");
  await page.locator('[data-small-tile="connexion"]').focus();
  await page.keyboard.press("Tab");
  await expect(linkTile(page, "regles")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(linkTile(page, "apprendre")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-table-row]").getByRole("link")).toBeFocused();
});
