import { expect, type Page, test } from "@playwright/test";

const KEY = "toc.settings.v1";

const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });

test("lancement: Bleu préselectionné, partenaire et adversaires affichés", async ({
  page,
  isMobile,
}) => {
  await page.goto("/#/ordinateur");
  const colours = page.getByRole("radiogroup", { name: "Choisis ta couleur" });
  await expect(colours).toBeVisible();
  // The four colour tiles (the strength pickers of phase 3 are radio groups of their own).
  await expect(colours.getByRole("radio")).toHaveCount(4);
  await expect(radio(page, "Bleu")).toHaveAttribute("aria-checked", "true");

  // The partner tile (RULE-01: bleu + rouge) is tagged, and the summary names the pairs.
  await expect(radio(page, "Rouge")).toHaveAccessibleDescription("Partenaire");
  await expect(page.locator(".sr-only", { hasText: "Ton équipe : Bleu + Rouge" })).toBeAttached();
  await expect(page.locator(".sr-only", { hasText: "Adversaires : Jaune + Vert" })).toBeAttached();

  // Every tile is at least 128 x 128 on the computer; on the phone held sideways the compact tiles
  // are 96 x 88 (03-UI-SPEC), still at least 44 x 44, and the partner tag is out of sight while it
  // stays the partner tile's description.
  for (const tile of await colours.getByRole("radio").all()) {
    const box = await tile.boundingBox();
    if (isMobile) {
      expect(box?.width).toBeCloseTo(96, 0);
      expect(box?.height).toBeCloseTo(88, 0);
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    } else {
      expect(box?.width).toBeGreaterThanOrEqual(128);
      expect(box?.height).toBeGreaterThanOrEqual(128);
    }
  }
  if (isMobile) {
    const tag = await radio(page, "Rouge").locator(".tag").boundingBox();
    expect(tag?.width ?? 0).toBeLessThanOrEqual(1);
  }
  const play = await page.getByRole("button", { name: "Jouer la partie" }).boundingBox();
  expect(play?.height).toBeGreaterThanOrEqual(48);

  // Held upright: the phase-1 tiles, at least 128 x 128, the tag in sight.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("main.launch")).toHaveAttribute("data-layout", "portrait");
  for (const tile of await colours.getByRole("radio").all()) {
    const box = await tile.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(128);
    expect(box?.height).toBeGreaterThanOrEqual(128);
  }
  await expect(radio(page, "Rouge")).toHaveAccessibleDescription("Partenaire");
  const tag = await radio(page, "Rouge").locator(".tag").boundingBox();
  expect(tag?.width).toBeGreaterThan(40);
});

test("lancement: le choix est retenu, les flèches déplacent la sélection", async ({ page }) => {
  await page.goto("/#/ordinateur");
  await radio(page, "Jaune").click();
  await expect(radio(page, "Jaune")).toHaveAttribute("aria-checked", "true");
  await expect(radio(page, "Vert")).toHaveAccessibleDescription("Partenaire");
  await expect(page.locator(".sr-only", { hasText: "Ton équipe : Jaune + Vert" })).toBeAttached();
  await expect(page.locator(".sr-only", { hasText: "Adversaires : Bleu + Rouge" })).toBeAttached();

  const stored = await page.evaluate((key) => localStorage.getItem(key), KEY);
  expect(JSON.parse(stored ?? "{}").lastColor).toBe("jaune");

  await page.reload();
  await expect(radio(page, "Jaune")).toHaveAttribute("aria-checked", "true");

  // Roving tabindex: only the selected tile is in the tab order, arrows move the selection.
  await expect(radio(page, "Jaune")).toHaveAttribute("tabindex", "0");
  await expect(radio(page, "Bleu")).toHaveAttribute("tabindex", "-1");
  await radio(page, "Jaune").focus();
  await page.keyboard.press("ArrowRight");
  await expect(radio(page, "Rouge")).toHaveAttribute("aria-checked", "true");
  await expect(radio(page, "Rouge")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(radio(page, "Bleu")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(radio(page, "Vert")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowUp");
  await expect(radio(page, "Jaune")).toHaveAttribute("aria-checked", "true");
});

test("lancement: JSON abîmé, valeurs hors limites ou stockage qui lève, aucune erreur visible", async ({
  browser,
}) => {
  for (const init of [
    `localStorage.setItem(${JSON.stringify(KEY)}, "{pas du json");`,
    // Out-of-range values, and the keys of the ambience removed on 2026-10-14 (ignored).
    `localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify({ lastColor: "pourpre", sound: 3, ambience: "oui", ambienceVolume: 999 }))});`,
    `Storage.prototype.getItem = () => { throw new Error("SecurityError"); };
     Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); };`,
  ]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(init);
    await page.goto("http://localhost:4173/#/ordinateur");
    await expect(radio(page, "Bleu")).toHaveAttribute("aria-checked", "true");
    // Choosing still works in memory, silently.
    await radio(page, "Vert").click();
    await expect(radio(page, "Vert")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  }
});

test("lancement: aucune requête vers un hôte tiers, polices et icônes servies par l’application", async ({
  page,
}) => {
  const origins = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "http:" || url.protocol === "https:") origins.add(url.origin);
  });
  await page.goto("/#/ordinateur");
  await page.evaluate(() => document.fonts.ready);
  expect([...origins]).toEqual(["http://localhost:4173"]);
});

test("lancement: « Jouer la partie » ouvre la partie avec le son débloqué", async ({ page }) => {
  await page.goto("/#/ordinateur");
  await page.getByRole("button", { name: "Jouer la partie" }).click();
  await expect(page).toHaveURL(/#\/partie$/);
  await expect(page.locator("body")).toHaveAttribute("data-audio", "running");
});
