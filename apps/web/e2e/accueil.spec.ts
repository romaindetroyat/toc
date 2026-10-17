import { expect, type Page, test } from "@playwright/test";

// « Accueil » at #/ (02-UI-SPEC « Home « Accueil » », D-09, plan 02-04): the two oak choices, the name
// line, « Mes parties en cours »; the game against the computer one tap away at #/ordinateur. The fit
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
    await expect(page.locator("[data-name-line]")).toContainText("Marie-Charlotte");
    expect(await scroll(page)).toEqual({ sideways: 0, down: 0 });
    for (const target of [
      tile(page, "ordinateur"),
      tile(page, "table"),
      page.locator("[data-name-line]"),
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
  // Without a stored first name there is no name line.
  await expect(page.locator("[data-name-line]")).toHaveCount(0);
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
  await expect(page.getByRole("button", { name: "Changer de prénom" })).toBeFocused();
  // Entrée on the solo tile opens the solo setup.
  await tile(page, "ordinateur").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#\/ordinateur$/);
});
