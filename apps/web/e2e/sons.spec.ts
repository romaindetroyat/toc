import { expect, type Page, test } from "@playwright/test";
import { etatParam } from "./position.ts";

type TocWindow = Window & { __tocDebug?: { audio: { scheduled: number[] } } };

const NBSP = " ";

type Played = { id: string; variant: string; take: number; at: number };
/** Every buffer the engine started (debug builds), with its version. */
const played = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __tocDebug?: { audio: { played?: Played[] } } }).__tocDebug?.audio
        .played ?? [],
  );

const INTRO = "Écoute les versions de chaque son et choisis ta préférée.";
/** Only the hooves are heard since 2026-10-15 (Romain: « Oui, que les sabots »; plan 03-08). */
const MUTED_NOTE = `Les hennissements et les sons des cartes sont coupés pour l’instant${NBSP}: dans la partie, on n’entend que les sabots.`;
const scheduledOf = (page: Page) =>
  page.evaluate(() => (window as TocWindow).__tocDebug?.audio.scheduled);
const sabots = (page: Page) => page.getByRole("radiogroup", { name: "Mon choix pour Sabots" });

test.describe("page de test des sons à choix", () => {
  // Since 2026-10-15 only the hooves are heard: the « Hennissements » and « Cartes » sections are
  // hidden (they were listed here with their 9 rows, one version each) and one line says so.
  test("sons: la page liste les sabots seuls, leurs versions et leur choix, boutons d’au moins 44 x 44", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await expect(page.getByRole("heading", { name: "Test des sons", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sabots", level: 2 })).toBeVisible();
    for (const section of ["Hennissements", "Cartes"]) {
      await expect(page.getByRole("heading", { name: section, level: 2 })).toHaveCount(0);
    }
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(1);
    await expect(page.getByText(MUTED_NOTE)).toBeVisible();
    await expect(
      page.getByText(
        "Écoute les versions de chaque son et choisis ta préférée. Ton choix compte tout de suite dans tes parties, sur cet appareil. Pour qu’il compte pour tout le monde, touche «\u202fCopier mes choix\u202f» et envoie-les.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Le son joue aussi quand l’iPhone est en mode silencieux. Pas de son\u202f? Monte le volume avec les boutons sur le côté.",
      ),
    ).toBeVisible();

    // The hooves + their cadence and distance rows (no ambience since 2026-10-14; no neigh and no
    // card sound since 2026-10-15).
    await expect(page.locator("li.row")).toHaveCount(3);
    await expect(page.locator("li.row[data-sound]")).toHaveCount(1);
    // One choice, the hooves', with their four versions.
    await expect(page.getByRole("radiogroup")).toHaveCount(1);
    await expect(page.getByRole("radiogroup", { name: /^Mon choix pour / })).toHaveCount(1);
    await expect(sabots(page).getByRole("radio")).toHaveText(["A", "B", "C", "D"]);
    for (const letter of ["A", "B", "C", "D"]) {
      await expect(
        page.getByRole("button", { name: `Écouter Sabots, version ${letter}`, exact: true }),
      ).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /, version [A-D]$/ })).toHaveCount(4);
    await expect(page.getByText("Mon choix", { exact: true })).toHaveCount(1);

    const buttons = page.locator("button.play");
    const count = await buttons.count();
    expect(count).toBe(9); // 4 versions + 4 cadences + the distance
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box?.width, `play button ${i} width`).toBeGreaterThanOrEqual(44);
      expect(box?.height, `play button ${i} height`).toBeGreaterThanOrEqual(44);
    }
    const radios = page.getByRole("radio");
    for (let i = 0; i < (await radios.count()); i++) {
      const box = await radios.nth(i).boundingBox();
      expect(box?.width, `radio ${i} width`).toBeGreaterThanOrEqual(44);
      expect(box?.height, `radio ${i} height`).toBeGreaterThanOrEqual(44);
    }
  });

  test("sons: toucher la page débloque le son, 4 cases planifient 4 sabots", async ({ page }) => {
    await page.goto("/#/sons");
    await expect(page.getByText(`Son en attente${NBSP}: touche l’écran`)).toBeVisible();

    await page.getByText(INTRO).click();
    await expect(page.getByText("Son prêt")).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute("data-audio", "running");

    await page.getByRole("button", { name: "Écouter 4 cases", exact: true }).click();
    expect(await scheduledOf(page)).toHaveLength(4);

    await page.getByRole("button", { name: "Écouter 13 cases", exact: true }).click();
    expect((await scheduledOf(page))?.length).toBeGreaterThan(13); // two clops per hop at the gallop

    // The slider plays the same cadence as the fixed buttons.
    await page.getByRole("slider", { name: "Distance en cases" }).fill("1");
    await page.getByRole("button", { name: "Écouter la distance choisie" }).click();
    expect(await scheduledOf(page)).toHaveLength(1);

    // The cadences play the chosen version.
    await sabots(page).getByRole("radio", { name: "D" }).click();
    await page.evaluate(() => {
      const w = window as unknown as { __tocDebug?: { audio: { played?: unknown[] } } };
      if (w.__tocDebug) w.__tocDebug.audio.played = [];
    });
    await page.getByRole("button", { name: "Écouter 7 cases", exact: true }).click();
    await expect
      .poll(async () => (await played(page)).filter((p) => p.id === "sabot").length)
      .toBeGreaterThan(0);
    expect((await played(page)).every((p) => p.variant === "d")).toBe(true);
  });

  test("sons: un premier appui sur un bouton de version débloque le son puis la joue", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await page.getByRole("button", { name: "Écouter Sabots, version C", exact: true }).click();
    await expect(page.getByText("Son prêt")).toBeVisible();
    await expect
      .poll(async () => (await played(page)).filter((p) => p.variant === "c").length)
      .toBe(4); // the 4-cell cadence, in version C
    // Listening does not choose.
    await expect(sabots(page).getByRole("radio", { name: "A" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("sons: les quatre versions des sabots sonnent différemment, et leurs trois prises aussi", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await page.getByText(INTRO).click();
    await expect(page.getByText("Son prêt")).toBeVisible();
    for (const letter of ["B", "C", "D"]) {
      await page.getByRole("button", { name: `Écouter Sabots, version ${letter}` }).click();
    }
    type Rendered = Record<string, { duration: number; peak: number; brightness?: number }>;
    await expect
      .poll(async () =>
        Object.keys(
          await page.evaluate(
            () =>
              (window as unknown as { __tocDebug?: { audio: { sounds?: Rendered } } }).__tocDebug
                ?.audio.sounds ?? {},
          ),
        ).filter((key) => key.startsWith("hoof")),
      )
      .toHaveLength(12);
    const sounds = await page.evaluate(
      () =>
        (window as unknown as { __tocDebug?: { audio: { sounds?: Rendered } } }).__tocDebug?.audio
          .sounds ?? {},
    );
    const bright = (recipe: string) =>
      [0, 1, 2].map((take) => sounds[`${recipe}#${take}`]?.brightness ?? 0);
    const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    const [a, terre, paves, bois] = ["hoof", "hoof-terre", "hoof-paves", "hoof-bois"].map((r) =>
      mean(bright(r)),
    ) as [number, number, number, number];
    // Earth is duller than today's clop, the cobblestones brighter, the wood in between and apart.
    expect(terre).toBeLessThan(a * 0.8);
    expect(paves).toBeGreaterThan(a * 1.2);
    expect(bois).toBeLessThan(paves * 0.8);
    expect(Math.abs(bois - terre)).toBeGreaterThan(terre * 0.1);
    for (const recipe of ["hoof-terre", "hoof-paves", "hoof-bois"]) {
      const takes = bright(recipe);
      expect(new Set(takes.map((b) => Math.round(b))).size, recipe).toBe(3);
      for (let take = 0; take < 3; take++) {
        const sound = sounds[`${recipe}#${take}`];
        expect(sound?.peak, `${recipe}#${take}`).toBeGreaterThan(0.5);
        expect(sound?.peak, `${recipe}#${take}`).toBeLessThanOrEqual(1);
        expect(sound?.duration, `${recipe}#${take}`).toBeLessThan(0.3);
      }
    }
  });

  test("sons: un choix est gardé après rechargement, et lui seul est enregistré", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await expect(sabots(page).getByRole("radio", { name: "A" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await sabots(page).getByRole("radio", { name: "D" }).click();
    await expect(sabots(page).getByRole("radio", { name: "D" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // The chosen version's button is marked too.
    await expect(
      page.getByRole("button", { name: "Écouter Sabots, version D", exact: true }),
    ).toHaveClass(/chosen/);

    await page.reload();
    await expect(sabots(page).getByRole("radio", { name: "D" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // The card sounds have no row since 2026-10-15 (only the hooves are heard).
    await expect(
      page.getByRole("radiogroup", { name: "Mon choix pour Poser une carte" }),
    ).toHaveCount(0);

    const stored = await page.evaluate(() => localStorage.getItem("toc.soundchoices.v1"));
    expect(JSON.parse(stored ?? "{}")).toEqual({ sabot: "d" });
  });

  test("sons: les flèches changent le choix, un seul est coché par son", async ({ page }) => {
    await page.goto("/#/sons");
    const group = sabots(page);
    await group.getByRole("radio", { name: "A" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "B" })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "C" })).toHaveAttribute("aria-checked", "true");
    await expect(group.locator('[aria-checked="true"]')).toHaveCount(1);
    await page.keyboard.press("ArrowLeft");
    await expect(group.getByRole("radio", { name: "B" })).toHaveAttribute("aria-checked", "true");
    const stored = await page.evaluate(() => localStorage.getItem("toc.soundchoices.v1"));
    expect(JSON.parse(stored ?? "{}")).toEqual({ sabot: "b" });
  });

  test("sons: un stockage abîmé ou piraté donne les choix par défaut, sans erreur, et les anciennes notes sont ignorées", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem(
        "toc.soundchoices.v1",
        JSON.stringify({
          sabot: "z",
          pirate: "b",
          ambiance: "a",
          "carte-pose": "d",
          "hennissement-sortie": "<b>",
          "carte-donne": "a",
        }),
      );
      localStorage.setItem("toc.soundnotes.v1", JSON.stringify({ "sabot-4": "bon" }));
    });
    await page.goto("/#/sons");
    await expect(sabots(page).getByRole("radio", { name: "A" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // The stored card choice is ignored; the card sounds have no row since 2026-10-15.
    await expect(
      page.getByRole("radiogroup", { name: "Mon choix pour Poser une carte" }),
    ).toHaveCount(0);
    // The old ratings have no control left.
    await expect(page.getByRole("radio", { name: /À écouter|Bon|À changer/ })).toHaveCount(0);
    // Unreadable JSON: the defaults too.
    await page.evaluate(() => localStorage.setItem("toc.soundchoices.v1", "{oops"));
    await page.reload();
    await expect(sabots(page).getByRole("radio", { name: "A" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(errors).toEqual([]);
  });

  test("sons: il n’y a plus d’ambiance, ni ligne, ni bouton, ni volume", async ({ page }) => {
    await page.goto("/#/sons");
    await page.getByText(INTRO).click();
    await expect(page.getByText("Son prêt")).toBeVisible();
    await expect(page.getByText(/ambiance/i)).toHaveCount(0);
    await expect(page.locator('[data-sound="ambiance"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Ambiance/ })).toHaveCount(0);
    // The only slider left is the hoof distance.
    await expect(page.getByRole("slider")).toHaveCount(1);
    await expect(page.getByRole("slider", { name: "Distance en cases" })).toBeVisible();
    const rendered = await page.evaluate(() =>
      Object.keys(
        (window as unknown as { __tocDebug?: { audio: { sounds?: object } } }).__tocDebug?.audio
          .sounds ?? {},
      ),
    );
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.filter((id) => id.startsWith("ambience"))).toEqual([]);
  });

  test("sons: chaque version dit sa source, ici des sons générés par le code, et ce qu’elle est", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await page.getByText(INTRO).click();
    await expect(page.getByText("Son prêt")).toBeVisible();
    // The four hoof versions (the 9 single-version neigh and card rows are hidden since 2026-10-15).
    await expect(page.locator(".version .source")).toHaveCount(4);
    await expect(page.getByText("Généré par le code", { exact: true })).toHaveCount(4);
    await expect(page.getByText("Son indisponible")).toHaveCount(0);
    const hooves = page.locator('li.row[data-sound="sabot"] .version .what');
    await expect(hooves).toHaveText(["actuel", "sur la terre", "sur les pavés", "sur le bois"]);
  });

  test("sons: chaque son montre l’auteur et la licence du registre", async ({ page }) => {
    await page.goto("/#/sons");
    // The hooves' row (the neigh and card rows are hidden since 2026-10-15).
    await expect(page.locator("li.row[data-sound] > .licence")).toHaveCount(1);
    await expect(page.getByText("Jeu TOC (synthèse Web Audio) · Aucune œuvre tierce")).toHaveCount(
      1,
    );
    await expect(page.getByText("Licence non renseignée")).toHaveCount(0);
  });

  test("sons: les hennissements et les sons des cartes sont coupés pour l’instant, rien d’eux n’est rendu", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await expect(page.getByText(MUTED_NOTE)).toBeVisible();
    await expect(page.locator('li.row[data-sound^="hennissement-"]')).toHaveCount(0);
    await expect(page.locator('li.row[data-sound^="carte-"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Écouter Sortie de l’écurie/ })).toHaveCount(0);
    await page.getByText(INTRO).click();
    await expect(page.getByText("Son prêt")).toBeVisible();
    const rendered = await page.evaluate(() =>
      Object.keys(
        (window as unknown as { __tocDebug?: { audio: { sounds?: object } } }).__tocDebug?.audio
          .sounds ?? {},
      ),
    );
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.filter((key) => !key.startsWith("hoof"))).toEqual([]);
    // A hoof version still plays; nothing else does.
    await page.getByRole("button", { name: "Écouter Sabots, version A", exact: true }).click();
    await expect
      .poll(async () => (await played(page)).filter((p) => p.id === "sabot").length)
      .toBeGreaterThan(0);
    expect((await played(page)).filter((p) => p.id !== "sabot")).toEqual([]);
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

test.describe("copier mes choix", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("sons: Copier mes choix met la liste française dans le presse-papiers et le dit", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await sabots(page).getByRole("radio", { name: "B" }).click();

    await page.getByRole("button", { name: "Copier mes choix" }).click();
    const toast = page.locator("[data-toast]");
    await expect(toast).toHaveText("Choix copiés.");
    await expect(page.getByRole("textbox", { name: "Mes choix" })).toHaveCount(0);

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    // The sounds the page shows: the hooves alone since 2026-10-15 (the list had the 9 neigh and
    // card lines too, « Sortie de l’écurie : A », « Donne : A »…).
    expect(clipboard).toBe(`Sabots${NBSP}: B`);
    expect(clipboard).not.toContain("Sortie de l’écurie");
    expect(clipboard).not.toContain("Donne");
    expect(clipboard).not.toContain("Ambiance");
  });

  test("sons: un seul message à la fois, le nouveau remplace l’ancien, il disparaît après 4 s", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await page.getByRole("button", { name: "Copier mes choix" }).click();
    await expect(page.locator("[data-toast]")).toHaveText("Choix copiés.");

    // The clipboard now refuses: the second message replaces the first, never stacks.
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("refusé")) },
      });
    });
    await page.getByRole("button", { name: "Copier mes choix" }).click();
    const toast = page.locator("[data-toast]");
    await expect(toast).toHaveCount(1);
    await expect(toast).toHaveText("Impossible de copier. Sélectionne le texte ci-dessous.");

    // Lifetime: gone after 4 s (and not before 3 s).
    const shown = Date.now();
    await expect(toast).toBeHidden({ timeout: 6000 });
    expect(Date.now() - shown).toBeGreaterThan(2000);
  });

  test("sons: si la copie échoue, la liste est affichée, sélectionnable, sans balisage", async ({
    page,
  }) => {
    await page.goto("/#/sons");
    await sabots(page).getByRole("radio", { name: "C" }).click();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
    });
    await page.getByRole("button", { name: "Copier mes choix" }).click();
    await expect(page.locator("[data-toast]")).toHaveText(
      "Impossible de copier. Sélectionne le texte ci-dessous.",
    );
    const box = page.getByRole("textbox", { name: "Mes choix" });
    await expect(box).toBeVisible();
    await expect(box).toHaveAttribute("readonly", "");
    // The hooves alone since 2026-10-15 (the card line « Poser une carte : A » is gone with its row).
    await expect(box).toHaveValue(`Sabots${NBSP}: C`);
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
    for (const title of ["Sons", "Polices", "Icônes", "Plateau", "Cavaliers", "Cartes"]) {
      await expect(dialog.getByRole("heading", { name: title, level: 3 })).toHaveCount(1);
    }
    // The court figures name their author and their licence.
    await expect(dialog.getByText("Figures des cartes (Valet, Dame, Roi)")).toBeVisible();
    await expect(dialog.getByText(/David Bellot.*LGPL-2\.1/)).toBeVisible();
    // Romain's board and his riders of the galet plateaus share the « Plateau » group.
    const plateau = dialog.locator('[data-credits-group="Plateau"] li[data-credit]');
    await expect(plateau).toHaveCount(2);
    await expect(plateau.nth(1)).toHaveAttribute("data-credit", "plateau-cavaliers");
    await expect(plateau.nth(1).getByText("Cavaliers du plateau", { exact: true })).toBeVisible();
    await expect(
      plateau.nth(1).getByText(/Romain · Utilisés avec l’accord de l’auteur/),
    ).toBeVisible();
    // One entry per row of the manifest, shown as text (the ambience row went with the ambience).
    await expect(dialog.locator("li[data-credit]")).toHaveCount(17);
    await expect(dialog.getByText("Ambiance", { exact: true })).toHaveCount(0);
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

// --- Le traceur de la page « à choix » (recette 3 de Romain, 2026-10-15, test 29) ---

test("sons : choisir la version B des sabots la fait entendre dans la partie", async ({ page }) => {
  await page.goto("/#/sons");
  // B is heard on the page first (rendered on demand), then chosen.
  await page.getByRole("button", { name: "Écouter Sabots, version B" }).click();
  await expect(page.getByText("Son prêt")).toBeVisible();
  await expect
    .poll(async () => (await played(page)).filter((p) => p.id === "sabot" && p.variant === "b"))
    .toHaveLength(4); // the 4-cell cadence
  const group = page.getByRole("radiogroup", { name: "Mon choix pour Sabots" });
  await expect(group.getByRole("radio", { name: "A" })).toHaveAttribute("aria-checked", "true");
  await group.getByRole("radio", { name: "B" }).click();
  await expect(group.getByRole("radio", { name: "B" })).toHaveAttribute("aria-checked", "true");
  expect(
    JSON.parse((await page.evaluate(() => localStorage.getItem("toc.soundchoices.v1"))) ?? "{}"),
  ).toEqual({ sabot: "b" });

  // A game on the same device: one move of the Dame, its clops in version B.
  await page.evaluate(() => {
    const w = window as unknown as { __tocDebug?: { audio: { played?: unknown[] } } };
    if (w.__tocDebug) w.__tocDebug.audio.played = [];
  });
  const etat = {
    turn: "bleu",
    pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
    hands: { bleu: ["12H"] },
  };
  await page.goto(`/#/partie?etat=${etatParam(etat)}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(page.locator("[data-action-zone]")).toHaveAttribute("data-state", "idle");
  await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
  await page.locator('[data-hit="bleu0"]').click({ force: true });
  await page.getByRole("button", { name: "Jouer", exact: true }).click();
  await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:22", {
    timeout: 10_000,
  });
  await expect
    .poll(async () => (await played(page)).filter((p) => p.id === "sabot").length)
    .toBeGreaterThan(0);
  const clops = (await played(page)).filter((p) => p.id === "sabot");
  expect(clops.every((p) => p.variant === "b")).toBe(true);

  // The pick is kept on this device.
  await page.goto("/#/sons");
  await page.reload();
  await expect(
    page
      .getByRole("radiogroup", { name: "Mon choix pour Sabots" })
      .getByRole("radio", { name: "B" }),
  ).toHaveAttribute("aria-checked", "true");
});
