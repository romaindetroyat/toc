import { expect, test } from "@playwright/test";

type TocWindow = Window & { __tocDebug?: { audio: { scheduled: number[] } } };

const NBSP = " ";

test.describe("page de test des sons", () => {
  test("sons: la page liste les quatre sections, chaque ligne a un bouton d’au moins 44 x 44", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await expect(page.getByRole("heading", { name: "Test des sons", level: 1 })).toBeVisible();
    for (const section of ["Sabots", "Hennissements", "Cartes", "Ambiance"]) {
      await expect(page.getByRole("heading", { name: section, level: 2 })).toBeVisible();
    }
    await expect(page.getByText("Écoute chaque son et note-le.")).toBeVisible();
    await expect(page.getByText("Pas de son sur iPhone")).toBeVisible();

    // 4 hoof rows + the distance row + 6 neighs + 3 cards + the ambience.
    await expect(page.locator("li.row")).toHaveCount(15);
    // 14 rated rows, each with the three ratings.
    await expect(page.getByRole("radiogroup")).toHaveCount(14);
    await expect(page.getByRole("radio", { name: "À écouter" })).toHaveCount(14);

    const buttons = page.locator("button.play");
    const count = await buttons.count();
    expect(count).toBe(15);
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box?.width, `play button ${i} width`).toBeGreaterThanOrEqual(44);
      expect(box?.height, `play button ${i} height`).toBeGreaterThanOrEqual(44);
    }
    // Every radio of the rating is a touch target too.
    const radios = page.getByRole("radio");
    for (let i = 0; i < (await radios.count()); i++) {
      const box = await radios.nth(i).boundingBox();
      expect(box?.height, `radio ${i} height`).toBeGreaterThanOrEqual(44);
    }
  });

  test("sons: toucher la page débloque le son, 4 cases planifient 4 sabots", async ({ page }) => {
    await page.goto("/#/sons");
    await expect(page.getByText(`Son en attente${NBSP}: touche l’écran`)).toBeVisible();

    await page.getByText("Écoute chaque son et note-le.").click();
    await expect(page.getByText("Son prêt")).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute("data-audio", "running");

    await page.getByRole("button", { name: "Écouter 4 cases", exact: true }).click();
    const scheduled = await page.evaluate(() => (window as TocWindow).__tocDebug?.audio.scheduled);
    expect(scheduled).toHaveLength(4);

    await page.getByRole("button", { name: "Écouter 13 cases", exact: true }).click();
    const gallop = await page.evaluate(() => (window as TocWindow).__tocDebug?.audio.scheduled);
    expect(gallop?.length).toBeGreaterThan(13); // two clops per hop at the gallop

    // The slider plays the same cadence as the fixed rows.
    await page.getByRole("slider", { name: "Distance en cases" }).fill("1");
    await page.getByRole("button", { name: "Écouter la distance choisie" }).click();
    const walk = await page.evaluate(() => (window as TocWindow).__tocDebug?.audio.scheduled);
    expect(walk).toHaveLength(1);
  });

  test("sons: un premier appui sur un bouton d’écoute débloque le son puis joue", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await page.getByRole("button", { name: "Écouter 4 cases", exact: true }).click();
    await expect(page.getByText("Son prêt")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as TocWindow).__tocDebug?.audio.scheduled.length))
      .toBe(4);
  });

  test("sons: une note choisie est gardée après rechargement", async ({ page }) => {
    await page.goto("/#/sons");
    const group = page.getByRole("radiogroup", { name: /Sortie de l’écurie/ });
    await expect(group.getByRole("radio", { name: "À écouter" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await group.getByRole("radio", { name: "Bon" }).click();
    await expect(group.getByRole("radio", { name: "Bon" })).toHaveAttribute("aria-checked", "true");

    await page.reload();
    const again = page.getByRole("radiogroup", { name: /Sortie de l’écurie/ });
    await expect(again.getByRole("radio", { name: "Bon" })).toHaveAttribute("aria-checked", "true");
    // The other rows stay on the default.
    const other = page.getByRole("radiogroup", { name: /Poser une carte/ });
    await expect(other.getByRole("radio", { name: "À écouter" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    const stored = await page.evaluate(() => localStorage.getItem("toc.soundnotes.v1"));
    expect(JSON.parse(stored ?? "{}")).toEqual({ "hennissement-sortie": "bon" });
  });

  test("sons: les flèches changent la note, une seule note est cochée par ligne", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    const group = page.getByRole("radiogroup", { name: /Donne/ });
    await group.getByRole("radio", { name: "À écouter" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Bon" })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "À changer" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(group.locator('[aria-checked="true"]')).toHaveCount(1);
  });

  test("sons: un stockage abîmé ou piraté donne des notes par défaut, sans erreur", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem(
        "toc.soundnotes.v1",
        JSON.stringify({ "carte-pose": "excellent", pirate: "bon", ambiance: "bon" }),
      );
    });
    await page.goto("/#/sons");
    await expect(
      page.getByRole("radiogroup", { name: /Poser une carte/ }).getByRole("radio", {
        name: "À écouter",
      }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("radiogroup", { name: /Ambiance \(boucle\)/ }).getByRole("radio", {
        name: "Bon",
      }),
    ).toHaveAttribute("aria-checked", "true");
    expect(errors).toEqual([]);
  });

  test("sons: l’ambiance se lance, s’arrête et son volume suit le curseur", async ({ page }) => {
    await page.goto("/#/sons");
    const play = page.getByRole("button", { name: "Écouter Ambiance (boucle)" });
    await play.click();
    await expect(page.getByText("Son prêt")).toBeVisible();
    const stop = page.getByRole("button", { name: "Arrêter Ambiance (boucle)" });
    await expect(stop).toBeVisible();
    await expect(stop).toHaveAttribute("aria-pressed", "true");

    const slider = page.getByRole("slider", { name: "Volume de l’ambiance" });
    await slider.fill("55");
    const stored = await page.evaluate(() => localStorage.getItem("toc.settings.v1"));
    expect(JSON.parse(stored ?? "{}").ambienceVolume).toBe(55);

    await stop.click();
    await expect(page.getByRole("button", { name: "Écouter Ambiance (boucle)" })).toBeVisible();
  });

  test("sons: chaque ligne dit sa source, ici des sons générés par le code", async ({ page }) => {
    await page.goto("/#/sons");
    await page.getByText("Écoute chaque son et note-le.").click();
    await expect(page.getByText("Son prêt")).toBeVisible();
    await expect(page.getByText("Généré par le code")).toHaveCount(14);
    await expect(page.getByText("Son indisponible")).toHaveCount(0);
  });

  test("sons: la page défile et le lien Retour ramène au lancement", async ({ page }) => {
    await page.goto("/#/sons");
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    expect(scrollable).toBe(true);
    await page.getByRole("link", { name: "Retour" }).click();
    await expect(page.getByRole("button", { name: "Jouer la partie" })).toBeVisible();
  });
});
