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

  test("sons: chaque ligne montre l’auteur et la licence du registre", async ({ page }) => {
    await page.goto("/#/sons");
    await expect(page.locator("li.row[data-sound] .licence")).toHaveCount(14);
    await expect(page.getByText("Jeu TOC (synthèse Web Audio) · Aucune œuvre tierce")).toHaveCount(
      14,
    );
    await expect(page.getByText("Licence non renseignée")).toHaveCount(0);
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

test.describe("copier mes notes", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("sons: Copier mes notes met le texte français dans le presse-papiers et le dit", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await page
      .getByRole("radiogroup", { name: /Sortie de l’écurie/ })
      .getByRole("radio", { name: "Bon" })
      .click();
    await page
      .getByRole("radiogroup", { name: /13 cases/ })
      .getByRole("radio", { name: "À changer" })
      .click();

    await page.getByRole("button", { name: "Copier mes notes" }).click();
    const toast = page.locator("[data-toast]");
    await expect(toast).toHaveText("Notes copiées.");
    await expect(page.getByRole("textbox", { name: "Tes notes" })).toHaveCount(0);

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    const lines = clipboard.split("\n");
    expect(lines).toHaveLength(14);
    expect(lines).toContain(`Sortie de l’écurie${NBSP}: Bon`);
    expect(lines).toContain(`Sabots, 13 cases${NBSP}: À changer`);
    expect(lines).toContain(`Donne${NBSP}: À écouter`);
  });

  test("sons: un seul message à la fois, le nouveau remplace l’ancien, il disparaît après 4 s", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await page.getByRole("button", { name: "Copier mes notes" }).click();
    await expect(page.locator("[data-toast]")).toHaveText("Notes copiées.");

    // The clipboard now refuses: the second message replaces the first, never stacks.
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("refusé")) },
      });
    });
    await page.getByRole("button", { name: "Copier mes notes" }).click();
    const toast = page.locator("[data-toast]");
    await expect(toast).toHaveCount(1);
    await expect(toast).toHaveText("Impossible de copier. Sélectionne le texte ci-dessous.");

    // Lifetime: gone after 4 s (and not before 3 s).
    const shown = Date.now();
    await expect(toast).toBeHidden({ timeout: 6000 });
    expect(Date.now() - shown).toBeGreaterThan(2000);
  });

  test("sons: si la copie échoue, le texte est affiché, sélectionnable, sans balisage", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await page
      .getByRole("radiogroup", { name: /Poser une carte/ })
      .getByRole("radio", { name: "Bon" })
      .click();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
    });
    await page.getByRole("button", { name: "Copier mes notes" }).click();
    await expect(page.locator("[data-toast]")).toHaveText(
      "Impossible de copier. Sélectionne le texte ci-dessous.",
    );
    const box = page.getByRole("textbox", { name: "Tes notes" });
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute("readonly", "");
    await expect(box).toHaveValue(new RegExp(`Poser une carte${NBSP}: Bon`));
    await expect(box).toHaveValue(/\n/);
  });
});

test.describe("crédits et licences", () => {
  const open = async (page: import("@playwright/test").Page) => {
    await page.goto("/#/sons");
    const button = page.getByRole("button", { name: "Crédits et licences" });
    await button.click();
    const dialog = page.getByRole("dialog", { name: "Crédits et licences" });
    await expect(dialog).toBeVisible();
    return { button, dialog };
  };

  test("crédits: la feuille liste les polices, les sons, les icônes et le plateau, groupés", async ({
    page,
  }) => {
    const { dialog } = await open(page);
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog.getByText("Nunito", { exact: true })).toBeVisible();
    await expect(dialog.getByText("The Nunito Project Authors · OFL-1.1")).toBeVisible();
    await expect(dialog.getByText("Généré par le code").first()).toBeVisible();
    for (const title of ["Sons", "Polices", "Icônes", "Plateau", "Cavaliers"]) {
      await expect(dialog.getByRole("heading", { name: title, level: 3 })).toHaveCount(1);
    }
    // No card art row yet: no « Cartes » group.
    await expect(dialog.getByRole("heading", { name: "Cartes", level: 3 })).toHaveCount(0);
    // One entry per row of the manifest, shown as text.
    await expect(dialog.locator("li[data-credit]")).toHaveCount(16);
    await expect(dialog.locator("a")).toHaveCount(0);
  });

  test("crédits: la liste défile verticalement", async ({ page }) => {
    const { dialog } = await open(page);
    const body = dialog.locator("[data-sheet-body]");
    const metrics = await body.evaluate((element) => ({
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }));
    expect(metrics.overflowY).toBe("auto");
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    await body.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    // The last row is reachable and the « Fermer » button stays in view.
    await expect(dialog.locator("li[data-credit]").last()).toBeInViewport();
    await expect(dialog.getByRole("button", { name: "Fermer" })).toBeInViewport();
  });

  test("crédits: Échap ferme la feuille et rend le focus au bouton", async ({ page }) => {
    const { button, dialog } = await open(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("crédits: Fermer ferme, le fond aussi, et le focus reste dans la feuille avec Tab", async ({
    page,
  }) => {
    const { button, dialog } = await open(page);
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () => document.activeElement?.closest("[role=dialog]") !== null,
      );
      expect(inside, `Tab ${i + 1}`).toBe(true);
    }
    await page.keyboard.press("Shift+Tab");
    expect(
      await page.evaluate(() => document.activeElement?.closest("[role=dialog]") !== null),
    ).toBe(true);

    await dialog.getByRole("button", { name: "Fermer" }).click();
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await expect(dialog).toBeVisible();
    // A tap on the backdrop (outside the sheet) closes it.
    await page.locator("[data-sheet-layer]").click({ position: { x: 4, y: 4 } });
    await expect(dialog).toBeHidden();
  });
});
