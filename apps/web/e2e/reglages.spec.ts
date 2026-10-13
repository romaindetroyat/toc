import { expect, type Page, test } from "@playwright/test";

// « Réglages » (plan 01-23): opened from the launch screen and from the gear of the game, switches
// for « Son », « Bruitages », « Ambiance » (with its volume) and « Réduire les animations », all applied
// at once and kept in toc.settings.v1. The bus gains and the ambience request are read through
// window.__tocDebug.audio (debug builds only).

type Gains = { master: number; sfx: number; ambience: number };
type TocWindow = Window & {
  __tocDebug?: { audio: { gains?: Gains } };
};

const KEY = "toc.settings.v1";
const NBSP = " ";

const dialog = (page: Page, name: string) => page.getByRole("dialog", { name });
const sw = (page: Page, name: string) => page.getByRole("switch", { name, exact: true });
const gains = (page: Page) =>
  page.evaluate(() => (window as unknown as TocWindow).__tocDebug?.audio.gains);
const stored = async (page: Page) =>
  JSON.parse((await page.evaluate((key) => localStorage.getItem(key), KEY)) ?? "{}");

async function openFromLaunch(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  await expect(dialog(page, "Réglages")).toBeVisible();
}

test.describe("depuis l’écran de lancement", () => {
  test("réglages: la feuille propose les cinq réglages, aux valeurs par défaut", async ({
    page,
  }) => {
    await openFromLaunch(page);
    const sheet = dialog(page, "Réglages");
    for (const name of ["Son", "Bruitages", "Ambiance"]) {
      await expect(sw(page, name)).toHaveAttribute("aria-checked", "true");
    }
    await expect(sw(page, "Réduire les animations")).toHaveAttribute("aria-checked", "false");
    const volume = page.getByRole("slider", { name: "Volume de l’ambiance" });
    await expect(volume).toHaveValue("30");
    await expect(volume).toHaveAttribute("aria-valuetext", `30${NBSP}%`);
    await expect(sheet.getByText("Pas de son sur iPhone")).toBeVisible();
    await expect(
      sheet.getByText("Les déplacements sont instantanés, sans bonds, ruades ni effets."),
    ).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Tester les sons" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Crédits et licences" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Fermer" })).toBeVisible();

    // Every control is a touch target of at least 44 px (a hundredth of slack for the slide-in transform).
    for (const target of [
      sw(page, "Son"),
      sw(page, "Bruitages"),
      sw(page, "Ambiance"),
      sw(page, "Réduire les animations"),
      volume,
    ]) {
      const box = await target.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(43.99);
      expect(box?.width).toBeGreaterThanOrEqual(43.99);
    }
  });

  test("réglages: chaque réglage change aussitôt, est gardé et revient après rechargement", async ({
    page,
  }) => {
    await openFromLaunch(page);
    await sw(page, "Son").click();
    await sw(page, "Bruitages").click();
    await sw(page, "Ambiance").click();
    await sw(page, "Réduire les animations").click();
    await expect(sw(page, "Son")).toHaveAttribute("aria-checked", "false");
    await expect(sw(page, "Bruitages")).toHaveAttribute("aria-checked", "false");
    await expect(sw(page, "Ambiance")).toHaveAttribute("aria-checked", "false");
    await expect(sw(page, "Réduire les animations")).toHaveAttribute("aria-checked", "true");
    // « Ambiance » off: the volume is disabled but still there.
    const volume = page.getByRole("slider", { name: "Volume de l’ambiance" });
    await expect(volume).toBeDisabled();
    await expect(volume).toBeVisible();

    await sw(page, "Ambiance").click();
    await expect(volume).toBeEnabled();
    await volume.fill("65");
    await expect(volume).toHaveAttribute("aria-valuetext", `65${NBSP}%`);

    expect(await stored(page)).toMatchObject({
      sound: false,
      sfx: false,
      ambience: true,
      ambienceVolume: 65,
      reduceMotion: true,
    });

    await page.reload();
    await page.getByRole("button", { name: "Réglages", exact: true }).click();
    await expect(sw(page, "Son")).toHaveAttribute("aria-checked", "false");
    await expect(sw(page, "Bruitages")).toHaveAttribute("aria-checked", "false");
    await expect(sw(page, "Ambiance")).toHaveAttribute("aria-checked", "true");
    await expect(sw(page, "Réduire les animations")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("slider", { name: "Volume de l’ambiance" })).toHaveValue("65");
  });

  test("réglages: « Son » coupe tout, « Bruitages » les effets, « Ambiance » et son volume l’ambiance", async ({
    page,
  }) => {
    await openFromLaunch(page);
    await expect.poll(() => gains(page)).toEqual({ master: 1, sfx: 1, ambience: 0.3 });

    await sw(page, "Son").click();
    await expect.poll(() => gains(page)).toEqual({ master: 0, sfx: 1, ambience: 0.3 });
    // « Son » off dims the other two switches and the volume, which stay usable.
    await expect(page.locator("[data-settings] .row.dimmed")).toHaveCount(2);
    await expect(page.locator("[data-settings] .slider.dimmed")).toHaveCount(1);
    await sw(page, "Son").click();
    await expect(page.locator("[data-settings] .dimmed")).toHaveCount(0);

    await sw(page, "Bruitages").click();
    await expect.poll(() => gains(page)).toEqual({ master: 1, sfx: 0, ambience: 0.3 });
    await sw(page, "Bruitages").click();

    await page.getByRole("slider", { name: "Volume de l’ambiance" }).fill("80");
    await expect.poll(() => gains(page)).toEqual({ master: 1, sfx: 1, ambience: 0.8 });

    await sw(page, "Ambiance").click();
    await expect.poll(() => gains(page)).toEqual({ master: 1, sfx: 1, ambience: 0 });
    await expect(page.getByRole("slider", { name: "Volume de l’ambiance" })).toBeDisabled();
    await expect(page.locator("[data-settings] .slider.dimmed")).toHaveCount(1);
  });

  test("réglages: « Tester les sons » ouvre la page de test des sons", async ({ page }) => {
    await openFromLaunch(page);
    await dialog(page, "Réglages").getByRole("link", { name: "Tester les sons" }).click();
    await expect(page).toHaveURL(/#\/sons$/);
    await expect(page.getByRole("heading", { name: "Test des sons", level: 1 })).toBeVisible();
  });

  test("réglages: « Crédits et licences » ouvre les crédits, Échap les ferme un par un", async ({
    page,
  }) => {
    await openFromLaunch(page);
    const credits = page.getByRole("button", { name: "Crédits et licences" });
    await credits.click();
    await expect(dialog(page, "Crédits et licences")).toBeVisible();

    // The first Échap closes the credits only; the focus goes back to the button that opened them.
    await page.keyboard.press("Escape");
    await expect(dialog(page, "Crédits et licences")).toHaveCount(0);
    await expect(dialog(page, "Réglages")).toBeVisible();
    await expect(credits).toBeFocused();

    // The second one closes « Réglages » and the focus goes back to the launch button.
    await page.keyboard.press("Escape");
    await expect(dialog(page, "Réglages")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Réglages", exact: true })).toBeFocused();
  });

  test("réglages: « Fermer » ferme la feuille", async ({ page }) => {
    await openFromLaunch(page);
    await dialog(page, "Réglages").getByRole("button", { name: "Fermer" }).click();
    await expect(dialog(page, "Réglages")).toHaveCount(0);
  });
});

test.describe("« Réduire les animations » suit la préférence du système, puis le choix du joueur", () => {
  test.use({ reducedMotion: "reduce" });

  test("réglages: allumé au départ, et le choix du joueur l’emporte ensuite", async ({ page }) => {
    await openFromLaunch(page);
    await expect(sw(page, "Réduire les animations")).toHaveAttribute("aria-checked", "true");
    await sw(page, "Réduire les animations").click();
    await expect(sw(page, "Réduire les animations")).toHaveAttribute("aria-checked", "false");
    await page.reload();
    await page.getByRole("button", { name: "Réglages", exact: true }).click();
    await expect(sw(page, "Réduire les animations")).toHaveAttribute("aria-checked", "false");
  });
});
