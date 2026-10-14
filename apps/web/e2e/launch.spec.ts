import { expect, type Page, test } from "@playwright/test";

const KEY = "toc.settings.v1";

const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });

test("lancement: Bleu préselectionné, partenaire et adversaires affichés", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("radiogroup", { name: "Choisis ta couleur" })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(4);
  await expect(radio(page, "Bleu")).toHaveAttribute("aria-checked", "true");

  // The partner tile (RULE-01: bleu + rouge) is tagged, and the summary names the pairs.
  await expect(radio(page, "Rouge")).toHaveAccessibleDescription("Partenaire");
  await expect(page.locator(".sr-only", { hasText: "Ton équipe : Bleu + Rouge" })).toBeAttached();
  await expect(page.locator(".sr-only", { hasText: "Adversaires : Jaune + Vert" })).toBeAttached();

  // Every tile is at least 128 x 128.
  for (const tile of await page.getByRole("radio").all()) {
    const box = await tile.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(128);
    expect(box?.height).toBeGreaterThanOrEqual(128);
  }
  const play = await page.getByRole("button", { name: "Jouer la partie" }).boundingBox();
  expect(play?.height).toBeGreaterThanOrEqual(48);
});

test("lancement: le choix est retenu, les flèches déplacent la sélection", async ({ page }) => {
  await page.goto("/");
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
    await page.goto("http://localhost:4173/");
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
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  expect([...origins]).toEqual(["http://localhost:4173"]);
});

test("lancement: « Jouer la partie » ouvre la partie avec le son débloqué", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer la partie" }).click();
  await expect(page).toHaveURL(/#\/partie$/);
  await expect(page.locator("body")).toHaveAttribute("data-audio", "running");
});
