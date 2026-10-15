import { expect, type Page, test } from "@playwright/test";

// The bench page « Banc d’essai de l’ordinateur » (#/banc, 03-UI-SPEC « Bench page », BOT-05): it
// times the computer on this device over the fixed bench positions, with a verdict, a stop, an
// interruption when the page goes to the background, and « Copier les résultats ». Linked from
// nowhere, its own chunk.

const NNBSP = " ";
const MS_VALUE = new RegExp(`^\\d+(${NNBSP}\\d{3})*${NNBSP}ms$`);

const desktopOnly = () =>
  test.skip(({ isMobile }) => isMobile, "the bench runs are measured in the desktop project");

async function open(page: Page): Promise<void> {
  await page.goto("/#/banc");
  await expect(page.getByRole("heading", { name: "Banc d’essai de l’ordinateur" })).toBeVisible();
}

const progress = (page: Page) => page.locator("[data-bench-progress]");

/** Starts a run and waits until at least `n` decisions are measured. */
async function startAndWait(page: Page, n: number): Promise<void> {
  await page.getByRole("button", { name: "Lancer la mesure" }).click();
  await expect(page.getByRole("progressbar", { name: "Avancement de la mesure" })).toHaveAttribute(
    "aria-valuenow",
    /^\d+$/,
  );
  await expect
    .poll(
      async () =>
        Number(
          await page
            .getByRole("progressbar", { name: "Avancement de la mesure" })
            .getAttribute("aria-valuenow"),
        ),
      { timeout: 60_000 },
    )
    .toBeGreaterThanOrEqual(n);
}

test.describe("banc : la mesure sur cet appareil", () => {
  desktopOnly();

  test("banc : le titre, l’introduction, l’état vide et « Champion » par défaut", async ({
    page,
  }) => {
    await open(page);
    await expect(page.getByText("Mesure le temps que met l’ordinateur")).toBeVisible();
    await expect(page.getByText("Aucune mesure pour l’instant")).toBeVisible();
    await expect(
      page.getByText(`Touche «${NNBSP}Lancer la mesure${NNBSP}» pour commencer.`, { exact: false }),
    ).toBeVisible();
    const group = page.getByRole("radiogroup", { name: "Force mesurée" });
    await expect(group.getByRole("radio", { name: "Champion" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("link", { name: "Retour" })).toHaveAttribute("href", "#/");
  });

  test("banc : le Champion mesuré du premier au dernier coup, le verdict, la copie", async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page);
    await page.getByRole("button", { name: "Lancer la mesure" }).click();

    // While running: the progress, « Arrêter la mesure », the picker disabled.
    await expect(progress(page)).toContainText(/Coup \d+ sur 40/);
    await expect(page.getByRole("button", { name: "Arrêter la mesure" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Champion" })).toBeDisabled();

    await expect(page.getByRole("heading", { name: "Résultats" })).toBeVisible({
      timeout: 150_000,
    });
    await expect(progress(page)).toHaveCount(0);
    const rows = page.locator("[data-bench-results] dl > div");
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(0).locator("dt")).toHaveText("Coups mesurés");
    await expect(rows.nth(0).locator("dd")).toHaveText("40");
    for (const [i, label] of [
      "Temps médian",
      `95${NNBSP}% des coups en moins de`,
      "Le plus long",
      "Plus longue image figée",
    ].entries()) {
      await expect(rows.nth(i + 1).locator("dt")).toHaveText(label);
      await expect(rows.nth(i + 1).locator("dd")).toHaveText(MS_VALUE);
    }
    await expect(page.locator("[data-verdict]")).toHaveText(
      /^\s*(Assez rapide sur cet appareil\.|Trop lent sur cet appareil\. Envoie ces résultats\.)$/,
    );

    await page.getByRole("button", { name: "Copier les résultats" }).click();
    await expect(page.getByText("Résultats copiés.")).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const lines = copied.split("\n");
    expect(lines[0]).toBe("Banc d’essai TOC · Champion");
    expect(lines[1]).toBe("Coups mesurés : 40");
    expect(lines[6]).toMatch(/^Navigateur : .+/);
    expect(lines[7]).toMatch(/^Date : \d{4}-\d{2}-\d{2}$/);
  });

  test("banc : « Arrêter la mesure » garde les coups déjà mesurés", async ({ page }) => {
    test.setTimeout(90_000);
    await open(page);
    await startAndWait(page, 2);
    await page.getByRole("button", { name: "Arrêter la mesure" }).click();
    const note = page.locator("[data-bench-note]");
    await expect(note).toHaveText(/^Mesure arrêtée après \d+ coups\.$/);
    const count = Number(/(\d+)/.exec((await note.textContent()) ?? "")?.[1]);
    expect(count).toBeGreaterThanOrEqual(2);
    await expect(page.locator("[data-bench-results] dl > div").nth(0).locator("dd")).toHaveText(
      String(count),
    );
    await expect(page.getByRole("button", { name: "Lancer la mesure" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Champion" })).toBeEnabled();
  });

  test("banc : la page passée en arrière-plan interrompt la mesure, sans verdict", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await open(page);
    await startAndWait(page, 1);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator("[data-bench-note]")).toHaveText(
      "Mesure interrompue : l’app est passée en arrière-plan. Relance la mesure, écran allumé.",
    );
    await expect(page.locator("[data-verdict]")).toHaveCount(0);
    await expect(progress(page)).toHaveCount(0);
  });

  test("banc : la copie refusée montre le message et le texte à sélectionner", async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("refusé")) },
      });
    });
    await open(page);
    // The Poulain is quick: the whole bench in a moment.
    await page
      .getByRole("radiogroup", { name: "Force mesurée" })
      .getByRole("radio", {
        name: "Poulain",
      })
      .click();
    await page.getByRole("button", { name: "Lancer la mesure" }).click();
    await expect(page.getByRole("heading", { name: "Résultats" })).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Copier les résultats" }).click();
    await expect(
      page.getByText("Impossible de copier. Sélectionne le texte ci-dessous."),
    ).toBeVisible();
    const box = page.getByRole("textbox", { name: "Mes résultats" });
    await expect(box).toHaveAttribute("readonly", "");
    await expect(box).toHaveValue(/^Banc d’essai TOC · Poulain\n/);
  });

  test("banc : l’écran de lancement ne charge pas le banc, #/banc le charge à part", async ({
    page,
  }) => {
    const urls: string[] = [];
    page.on("request", (request) => urls.push(request.url()));
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Jouer la partie/ })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(urls.filter((url) => url.includes("Bench"))).toEqual([]);

    await page.goto("/#/banc");
    await expect(page.getByRole("heading", { name: "Banc d’essai de l’ordinateur" })).toBeVisible();
    expect(urls.some((url) => /\/assets\/Bench-[^/]*\.js$/.test(url))).toBe(true);
  });
});

test("banc : sur le téléphone, l’état vide tient dans la largeur", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the phone project's smoke test");
  await open(page);
  await expect(page.getByText("Aucune mesure pour l’instant")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lancer la mesure" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
