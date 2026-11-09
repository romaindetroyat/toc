import { expect, type Page, test } from "@playwright/test";
import { audit } from "./audit.ts";
import { zone } from "./jouer.ts";
import { etatParam } from "./position.ts";

// The accessibility audit of every local surface (plan 05-10, UI-SPEC « The audit », APP-05, SC5): the
// home and its sheets, « Première fois ? », the recovery page, « Apprendre à jouer » and a lesson, the
// solo setup, the game in each turn state of compact.spec.ts with its sheets, and the end plank, at
// 844 x 390, 750 x 342, 480 x 320 and 1280 x 800. Each surface goes through audit() (axe, 44 px,
// names, the deny-list, one main and one h1); the surfaces that need the Worker (signed in, the
// waiting room, the invite sheets, « Messages rapides ») are in e2e-online/accessibilite.spec.ts.

const SIZES = [
  { width: 844, height: 390 },
  { width: 750, height: 342 },
  { width: 480, height: 320 },
  { width: 1280, height: 800 },
] as const;

const SEED = "1234567890abcdef1234567890abcdef";
/** Four hands, so the computer players have cards once the human has played (compact.spec.ts). */
const HANDS = {
  jaune: ["2H", "3H", "5H", "6H", "8H"],
  rouge: ["2C", "3C", "4C", "5C", "6C"],
  vert: ["7C", "8C", "9C", "10C", "12C"],
};
/** The turn states of compact.spec.ts. */
const POSITIONS = {
  as: {
    turn: "bleu",
    pawns: { bleu: [{ p: 10 }, { p: 30 }, "S", "S"] },
    hands: { bleu: ["1S", "13H"] },
  },
  jack: {
    turn: "bleu",
    pawns: {
      bleu: [{ p: 5 }, "S", "S", "S"],
      vert: [{ p: 40 }, "S", "S", "S"],
      jaune: [{ p: 46 }, "S", "S", "S"],
    },
    hands: { bleu: ["11H"] },
  },
  tray: { turn: "bleu", pawns: { bleu: [{ p: 5 }, { p: 6 }, "S", "S"] }, hands: { bleu: ["3S"] } },
  sevenTray: {
    turn: "bleu",
    pawns: { bleu: [{ p: 5 }, { p: 6 }, "S", "S"] },
    hands: { bleu: ["7H"] },
  },
  dead: {
    turn: "bleu",
    dealer: "vert",
    hands: { bleu: ["2S", "4S", "11S", "5D", "6D"], ...HANDS },
  },
  seven: {
    turn: "bleu",
    pawns: { bleu: [{ p: 5 }, { p: 40 }, "S", "S"] },
    hands: { bleu: ["7H", "12H"] },
  },
  lone: {
    turn: "bleu",
    pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
    hands: { bleu: ["12H", "4S"], ...HANDS },
  },
};

const NEW_DEVICE = { cookies: [], origins: [] };
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const dialog = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true });

async function openPosition(page: Page, etat: unknown, extra = "&vitesse=test") {
  await page.goto("/");
  await page.goto(`/#/partie?etat=${etatParam(etat)}${extra}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

/** Opens a sheet by its button, audits it, closes it with Échap. */
async function sheet(
  page: Page,
  findings: string[],
  open: () => Promise<void>,
  name: string,
  surface = name,
) {
  await open();
  await expect(dialog(page, name)).toBeVisible();
  findings.push(...(await audit(page, surface)));
  await page.keyboard.press("Escape");
  await expect(dialog(page, name)).toHaveCount(0);
}

/** « Réglages », then a sheet opened from it, then back. */
async function fromSettings(page: Page, findings: string[], button: string, name: string) {
  await page.getByRole("button", { name: "Réglages", exact: true }).first().click();
  const settings = dialog(page, "Réglages");
  await expect(settings).toBeVisible();
  await settings.getByRole("button", { name: button, exact: true }).click();
  await expect(dialog(page, name)).toBeVisible();
  findings.push(...(await audit(page, `${name} (depuis Réglages)`)));
  await page.keyboard.press("Escape");
  await expect(dialog(page, name)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(settings).toHaveCount(0);
}

for (const size of SIZES) {
  const at = `${size.width} x ${size.height}`;

  test.describe(`l’audit d’accessibilité à ${at}`, () => {
    test.use({ viewport: size });
    test.skip(({ isMobile }) => isMobile, "explicit viewports: desktop project only");
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
    });

    test(`l’accueil d’un invité et ses feuilles (${at})`, async ({ page }) => {
      test.setTimeout(120_000);
      const findings: string[] = [];
      await page.goto("/");
      await expect(page.locator("main[data-home]")).toBeVisible();
      findings.push(...(await audit(page, "accueil (invité)")));

      await sheet(
        page,
        findings,
        () => page.getByRole("button", { name: "Réglages", exact: true }).click(),
        "Réglages",
      );
      await fromSettings(page, findings, "Crédits et licences", "Crédits et licences");
      await fromSettings(page, findings, "Règles du jeu", "Règles du TOC");
      await sheet(
        page,
        findings,
        () => page.locator('[data-small-tile="regles"]').click(),
        "Règles du TOC",
        "Règles (tuile de l’accueil)",
      );
      await sheet(
        page,
        findings,
        () =>
          page
            .getByRole("button", { name: /^Se connecter/ })
            .first()
            .click(),
        "Se connecter",
      );
      expect(findings).toEqual([]);
    });

    test(`l’accueil avec un prénom et des parties en cours (${at})`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem(
          "toc.device.v1",
          JSON.stringify({ token: "a".repeat(43), name: "Marie-Charlotte" }),
        );
        const colours = ["bleu", "jaune", "rouge", "vert"];
        localStorage.setItem(
          "toc.tables.v1",
          JSON.stringify(
            Array.from({ length: 3 }, (_, i) => ({
              id: `table${String(i).padStart(17, "0")}`,
              seat: colours[i % 4],
              joinedAt: 1_792_000_000_000 - i,
            })),
          ),
        );
        localStorage.setItem("toc.tutorial.v1", JSON.stringify({ offered: true, done: [1, 2] }));
      });
      // The tables' states cannot be read here (no Worker): each row says so.
      await page.route("**/api/tables/*", (route) => route.fulfill({ status: 503, body: "" }));
      await page.goto("/");
      await expect(page.locator("main[data-home]")).toBeVisible();
      await expect(page.locator('[data-small-tile="prenom"]')).toBeVisible();
      expect(await audit(page, "accueil (prénom, parties en cours)")).toEqual([]);
    });

    test(`« Raccourcis clavier » (${at})`, async ({ page }) => {
      const findings: string[] = [];
      await openPosition(page, POSITIONS.as);
      await page.keyboard.press("?");
      await expect(dialog(page, "Raccourcis clavier")).toBeVisible();
      findings.push(...(await audit(page, "Raccourcis clavier")));
      expect(findings).toEqual([]);
    });

    test.describe("un appareil neuf", () => {
      test.use({ storageState: NEW_DEVICE });
      test(`« Première fois ? » (${at})`, async ({ page }) => {
        await page.goto("/");
        await expect(dialog(page, "Première fois ?")).toBeVisible();
        expect(await audit(page, "Première fois ?")).toEqual([]);
      });
    });

    test.describe("un iPhone qui peut installer TOC", () => {
      test.use({ userAgent: IPHONE_SAFARI, hasTouch: true });
      test(`« Installer TOC » (${at})`, async ({ page }) => {
        const findings: string[] = [];
        await page.goto("/");
        await expect(page.locator("main[data-home]")).toBeVisible();
        const howTo = page.getByRole("button", { name: "Comment faire" });
        await expect(howTo).toBeVisible();
        findings.push(...(await audit(page, "accueil avec le bandeau d’installation")));
        await howTo.click();
        await expect(page.getByRole("dialog").last()).toBeVisible();
        findings.push(...(await audit(page, "Installer TOC")));
        expect(findings).toEqual([]);
      });
    });

    test(`« Retrouver mon compte » (${at})`, async ({ page }) => {
      await page.goto("/#/secours");
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("h1")).toBeVisible();
      expect(await audit(page, "secours")).toEqual([]);
    });

    test(`« Apprendre à jouer », une leçon, « Les leçons » et « Bravo ! » (${at})`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const findings: string[] = [];
      await page.goto("/#/apprendre");
      await expect(page.locator("main[data-lessons-page]")).toBeVisible();
      findings.push(...(await audit(page, "Apprendre à jouer")));

      await page.goto("/#/apprendre/1?vitesse=test");
      await expect(page.locator('[data-lesson="1"]')).toHaveCount(1);
      await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
      findings.push(...(await audit(page, "leçon 1, le guide")));
      await sheet(
        page,
        findings,
        () => page.getByRole("button", { name: /^Leçon \d sur 8 : / }).click(),
        "Les leçons",
      );
      await page.getByRole("button", { name: /^Suivant/ }).click();
      await page.getByRole("button", { name: /^Suivant/ }).click();
      findings.push(...(await audit(page, "leçon 1, l’As entouré")));
      await page.locator('[data-hand] [data-card="1H"]').click();
      await page.getByRole("button", { name: /^Jouer/ }).click();
      await expect(page.locator("[data-lesson-plank]")).toBeVisible();
      findings.push(...(await audit(page, "Bravo !")));
      expect(findings).toEqual([]);
    });

    test(`le lancement contre l’ordinateur (${at})`, async ({ page }) => {
      const findings: string[] = [];
      await page.goto("/#/ordinateur");
      await expect(page.locator("main")).toBeVisible();
      findings.push(...(await audit(page, "lancement contre l’ordinateur")));
      await sheet(
        page,
        findings,
        () => page.getByRole("button", { name: "Réglages", exact: true }).click(),
        "Réglages",
        "Réglages (lancement)",
      );
      expect(findings).toEqual([]);
    });

    test(`la partie, chaque état du tour (${at})`, async ({ page }) => {
      test.setTimeout(180_000);
      const findings: string[] = [];
      const check = async (what: string) => findings.push(...(await audit(page, what)));

      await openPosition(page, POSITIONS.as);
      await expect(zone(page)).toHaveAttribute("data-state", "idle");
      await check("partie : à toi de jouer");
      await page.getByRole("button", { name: "As de pique, jouable" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
      await check("partie : la question de l’As");
      await page.getByRole("button", { name: "Avancer de 1" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
      await check("partie : deux chevaux éclairés");
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(zone(page)).toHaveAttribute("data-state", "preview");
      await check("partie : l’aperçu");

      await openPosition(page, POSITIONS.jack);
      await page.getByRole("button", { name: "Valet de cœur, jouable" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "jackPick");
      await check("partie : le Valet, son cheval");
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(zone(page)).toHaveAttribute("data-state", "jackTarget");
      await check("partie : le Valet, le cheval à échanger");

      await openPosition(page, POSITIONS.tray);
      await page.getByRole("button", { name: "3 de pique, jouable" }).click();
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(zone(page)).toHaveAttribute("data-state", "tray");
      await check("partie : « Lequel ? »");

      await openPosition(page, POSITIONS.seven);
      await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
      await expect(page.locator("[data-seven-panel]")).toBeVisible();
      await check("partie : le 7, rien de réparti");
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(page.locator("[data-seven-chips] [data-step]")).toHaveCount(7);
      await check("partie : le 7, sept pastilles");
      await page.getByRole("button", { name: "4 pas" }).click();
      await page.locator('[data-hit="bleu1"]').click({ force: true });
      await page.getByRole("button", { name: "3 pas" }).click();
      await expect(page.locator("[data-remaining]")).toHaveText("Tout est réparti.");
      await check("partie : le 7, tout réparti");

      await openPosition(page, POSITIONS.dead, "");
      await expect(zone(page)).toHaveAttribute("data-state", "deadHand");
      await check("partie : la main morte");
      await page.getByRole("button", { name: "Poser mes cartes" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "posed");
      await check("partie : la main posée");

      await openPosition(page, POSITIONS.lone, "");
      await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "preview");
      await page.getByRole("button", { name: "Jouer", exact: true }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "waiting");
      await check("partie : l’attente des ordinateurs");

      await page.goto("/");
      await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
      await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
      await expect(zone(page)).toHaveAttribute("data-state", "exchange");
      await check("partie : l’échange");
      await page.locator("[data-hand] [data-card]").first().click();
      await check("partie : l’échange, carte choisie");
      expect(findings).toEqual([]);
    });

    test(`les feuilles de la partie (${at})`, async ({ page }) => {
      test.setTimeout(120_000);
      const findings: string[] = [];
      await openPosition(page, POSITIONS.as);
      await expect(zone(page)).toHaveAttribute("data-state", "idle");
      await sheet(
        page,
        findings,
        () => page.getByRole("button", { name: "Réglages", exact: true }).click(),
        "Réglages",
        "Réglages (partie)",
      );
      await sheet(
        page,
        findings,
        () => page.getByRole("button", { name: "Règles du jeu" }).first().click(),
        "Règles du TOC",
        "Règles (partie)",
      );
      await sheet(
        page,
        findings,
        () => page.getByRole("button", { name: "Sur le tapis" }).click({ force: true }),
        "Sur le tapis",
      );
      const pill = page.locator('[data-info-bar][data-form="pill"]');
      if ((await pill.count()) > 0) {
        await sheet(page, findings, () => pill.click(), "Infos de la partie");
      }
      expect(findings).toEqual([]);
    });

    test(`la fin de partie (${at})`, async ({ page }) => {
      await page.goto("/");
      await page.goto("/#/partie?scenario=R-16.1&vitesse=test");
      await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
      await expect(zone(page)).toHaveAttribute("data-state", "idle");
      await page.keyboard.press("1");
      await page.keyboard.press("d");
      await expect(zone(page)).toHaveAttribute("data-state", "preview");
      await page.keyboard.press("Enter");
      await expect(page.locator("[data-end-plank]")).toBeVisible();
      expect(await audit(page, "fin de partie")).toEqual([]);
    });
  });
}

// Knight names (05-UI-SPEC « Knight names »): every knight, lit or not, says its colour, its letter,
// whose it is and where it stands; a lit one adds « , jouable ».
test.describe("le nom de chaque cheval", () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test.skip(({ isMobile }) => isMobile, "explicit viewport: desktop project only");

  test("couleur, lettre, à qui et où, et « jouable » quand il est éclairé", async ({ page }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: {
        bleu: [{ p: 10 }, { p: 30 }, "S", "S"],
        rouge: [{ p: 0 }, "S", "S", "S"],
        jaune: ["S", { p: 5 }, "S", "S"],
      },
      hands: { bleu: ["1S", "13H"] },
    });
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    const name = (pawn: string) => page.locator(`[data-board] [data-pawn="${pawn}"]`);
    await expect(name("bleu0")).toHaveAttribute(
      "aria-label",
      "Cheval bleu A, à toi, à 10 cases de sa sortie",
    );
    await expect(name("bleu2")).toHaveAttribute("aria-label", "Cheval bleu C, à toi, à l’écurie");
    await expect(name("rouge0")).toHaveAttribute(
      "aria-label",
      /^Cheval rouge A, à ton partenaire \S.*, sur sa case de sortie$/,
    );
    await expect(name("jaune1")).toHaveAttribute(
      "aria-label",
      "Cheval jaune B, adversaire, à 5 cases de sa sortie",
    );
    await expect(name("vert3")).toHaveAttribute(
      "aria-label",
      "Cheval vert D, adversaire, à l’écurie",
    );

    // Lit: the knight and its hit circle both end « , jouable ».
    await page.getByRole("button", { name: "As de pique, jouable" }).click();
    await page.getByRole("button", { name: "Avancer de 1" }).click();
    await expect(name("bleu0")).toHaveAttribute(
      "aria-label",
      "Cheval bleu A, à toi, à 10 cases de sa sortie, jouable",
    );
    await expect(
      page.getByRole("button", { name: "Cheval bleu B, à toi, à 30 cases de sa sortie, jouable" }),
    ).toHaveCount(1);
  });
});
