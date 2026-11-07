import { expect, type Page, test } from "@playwright/test";
import { audit } from "../e2e/audit.ts";
import { mintInvitation, passkeyContext, uniquePseudo } from "./comptes.ts";
import { createTable, deviceOptions, join, seatTile } from "./online.ts";

// The accessibility audit of every surface that needs the Worker (plan 05-10, UI-SPEC « The audit »,
// APP-05, SC5), with the same audit() as the local suite (e2e/audit.ts): the invitation (fresh and
// used), the backup code and its question, the home signed in, « Mon compte », « Mes amis » and its
// sheets, « Mes résultats » × 3 with the detail sheet and « Le classement », the first-name prompt, the
// waiting room with « Inviter à la table », « Réglages » and « Messages rapides », and the online game
// with « Messages rapides », at 844 x 390, 750 x 342, 480 x 320 and 1280 x 800. The panels of « Mes
// résultats » are filled by answers served by the test (a new account has no game yet), as in
// resultats.spec.ts; the account and the session are real.

const SIZES = [
  { width: 844, height: 390 },
  { width: 750, height: 342 },
  { width: 480, height: 320 },
  { width: 1280, height: 800 },
] as const;

const dialog = (page: Page, name: string | RegExp) =>
  page.getByRole("dialog", typeof name === "string" ? { name, exact: true } : { name });

/** The three answers of « Mes résultats » with something in each (resultats.spec.ts serveAll). */
async function serveResults(page: Page): Promise<void> {
  const seat = (
    colour: string,
    kind: string,
    name: string,
    home: number,
    level: number | null = null,
  ) => ({
    colour,
    kind,
    name,
    level,
    handedOver: false,
    captured: 1,
    lost: 1,
    home,
  });
  const at = (month: number, day: number, hour: number, minute: number) =>
    new Date(2026, month, day, hour, minute).getTime();
  const games = [
    {
      id: `${"Q".repeat(43)}:3`,
      kind: "online",
      startedAt: at(10, 6, 20, 31),
      endedAt: at(10, 6, 21, 14),
      winner: "bleu-rouge",
      mine: "bleu",
      seats: [
        seat("bleu", "me", "Romain", 4),
        seat("jaune", "account", "Paul", 3),
        { ...seat("rouge", "guest", "Mamie", 4), handedOver: true, level: 3 },
        seat("vert", "bot", "Ourasi", 2, 4),
      ],
      deals: 6,
      creator: "Romain",
      ranked: true,
    },
    {
      id: `solo:${"u".repeat(22)}:0f8e2c4a-1b2c-4d3e-8f90-123456789abc`,
      kind: "solo",
      startedAt: at(10, 2, 17, 0),
      endedAt: at(10, 2, 18, 5),
      winner: "jaune-vert",
      mine: "bleu",
      seats: [
        seat("bleu", "me", "Romain", 3),
        seat("jaune", "bot", "", 4, 4),
        seat("rouge", "bot", "", 2, 3),
        seat("vert", "bot", "", 4, 4),
      ],
      deals: 9,
      creator: null,
      ranked: false,
    },
  ];
  const partners = [
    { kind: "account", name: "Marie", level: null, games: 6, wins: 4 },
    { kind: "guests", name: null, level: null, games: 2, wins: 1 },
    { kind: "bot", name: null, level: 4, games: 1, wins: 1 },
  ];
  const levels = [
    { level: 3, games: 4, wins: 3 },
    { level: 4, games: 2, wins: 1 },
  ];
  const block = (games: number, wins: number, p = partners, l = levels) => ({
    games,
    wins,
    captured: 9,
    lost: 7,
    home: 30,
    partners: p,
    levels: l,
  });
  const ranking = {
    friends: 5,
    ranked: [
      { rank: 1, pseudo: "Marie", games: 12, wins: 8, me: false },
      { rank: 2, pseudo: "Romain", games: 9, wins: 5, me: true },
      { rank: 2, pseudo: "Paul", games: 9, wins: 5, me: false },
    ],
    unranked: [{ pseudo: "Lucie", games: 3, me: false }],
  };
  await page.route("**/api/me/results", (route) => route.fulfill({ json: { games, next: null } }));
  await page.route("**/api/me/stats", (route) =>
    route.fulfill({
      json: { all: block(12, 8), online: block(6, 4, partners.slice(0, 2), []), solo: block(6, 4) },
    }),
  );
  await page.route("**/api/me/ranking", (route) => route.fulfill({ json: ranking }));
}

for (const size of SIZES) {
  const at = `${size.width} x ${size.height}`;

  test.describe(`l’audit d’accessibilité en ligne à ${at}`, () => {
    test.skip(({ isMobile }) => isMobile, "explicit viewports: desktop project only");

    test(`un compte, de l’invitation à « Mes résultats » (${at})`, async ({
      browser,
      request,
    }, testInfo) => {
      test.setTimeout(240_000);
      const context = await passkeyContext(browser, testInfo);
      const page = await context.newPage();
      await page.setViewportSize(size);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const findings: string[] = [];
      const check = async (surface: string) => findings.push(...(await audit(page, surface)));

      // A used invitation, then a fresh one: the pseudo form.
      await page.goto(`/#/invitation/${await mintInvitation(request, { used: true })}`);
      await expect(page.locator("main h1")).toBeVisible();
      await check("invitation déjà utilisée");
      await page.goto(`/#/invitation/${await mintInvitation(request)}`);
      const form = page.locator("[data-pseudo-form]");
      await expect(form).toBeVisible();
      await check("invitation : le pseudo");

      // The backup code and its question.
      await form.getByRole("textbox").fill(uniquePseudo("Audit"));
      await form.getByRole("button", { name: "Créer mon compte" }).click();
      const screen = page.locator("[data-backup-code]");
      await expect(screen).toBeVisible();
      await check("code de secours");
      await screen.getByRole("button", { name: "J’ai gardé mon code" }).click();
      const confirm = dialog(page, /^Tu as bien gardé ton code\s\?$/);
      await expect(confirm).toBeVisible();
      await check("code de secours : la question");
      await confirm.getByRole("button", { name: "Oui, je l’ai gardé" }).click();

      // The home, signed in.
      await expect(page.locator('[data-small-tile="compte"]')).toBeVisible();
      await check("accueil (compte)");

      // « Mon compte ».
      await page.goto("/#/compte");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await check("Mon compte");

      // « Mes amis », « Inviter un proche » and « Ajouter avec un code » (both ways).
      await page.goto("/#/amis");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await check("Mes amis");
      await page.getByRole("button", { name: "Inviter un proche" }).click();
      await expect(dialog(page, "Inviter un proche")).toBeVisible();
      await check("Inviter un proche");
      await page.keyboard.press("Escape");
      await expect(dialog(page, "Inviter un proche")).toHaveCount(0);
      await page.getByRole("button", { name: "Ajouter avec un code" }).click();
      const codeSheet = page.locator("[data-friend-code-sheet]");
      await expect(codeSheet).toBeVisible();
      await check("Ajouter avec un code");
      await codeSheet.getByRole("radio", { name: "Donner mon code" }).click();
      await expect(codeSheet.locator("[data-friend-code]")).toHaveText(/^TOC-/);
      await check("Donner mon code");
      await page.keyboard.press("Escape");
      await expect(codeSheet).toHaveCount(0);

      // « Mes résultats », a new account: the empty history.
      await page.goto("/#/resultats");
      await expect(page.locator('[data-results-panel="historique"]')).toBeVisible();
      await expect(page.getByText("Aucune partie pour l’instant")).toBeVisible();
      await check("Mes résultats : historique vide");

      // The three panels with something in each, and their sheets.
      await serveResults(page);
      await page.goto("/");
      await page.goto("/#/resultats");
      await expect(page.locator("[data-game-row]").first()).toBeVisible();
      await check("Mes résultats : historique");
      await page.locator("[data-game-row]").first().click();
      await expect(page.locator("[data-game-sheet]")).toBeVisible();
      await check("Mes résultats : la fiche d’une partie");
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-game-sheet]")).toHaveCount(0);
      await page.goto("/#/resultats/chiffres");
      await expect(page.locator("[data-number-tile]").first()).toBeVisible();
      await check("Mes résultats : mes chiffres");
      await page.goto("/#/resultats/classement");
      await expect(page.locator("[data-rank-row]").first()).toBeVisible();
      await check("Mes résultats : classement");
      await page.getByRole("button", { name: "Comment ça marche ?" }).click();
      await expect(dialog(page, "Le classement")).toBeVisible();
      await check("Le classement");

      await context.close();
      expect(findings).toEqual([]);
    });

    test(`la salle d’attente et la partie en ligne (${at})`, async ({
      browser,
      request,
    }, testInfo) => {
      test.setTimeout(240_000);
      const id = await createTable(request, { pace: "zero" });
      const context = await browser.newContext({ ...deviceOptions(testInfo), viewport: size });
      const page = await context.newPage();
      await page.emulateMedia({ reducedMotion: "reduce" });
      const findings: string[] = [];
      const check = async (surface: string) => findings.push(...(await audit(page, surface)));

      // The first-name prompt of a guest.
      await page.goto("/");
      await page.goto(`/#/table/${id}?vitesse=test`);
      await expect(page.locator("[data-name-prompt]")).toBeVisible();
      await check("le prénom d’un invité");
      await page.goto("/");
      await join(page, id, "Ana");
      await seatTile(page, "bleu").click();
      await expect(seatTile(page, "bleu")).toHaveAttribute("data-seat-state", "you");
      await check("salle d’attente");

      await page.getByRole("button", { name: "Inviter", exact: true }).click();
      await expect(dialog(page, "Inviter à la table")).toBeVisible();
      await check("Inviter à la table");
      await page.keyboard.press("Escape");
      await expect(dialog(page, "Inviter à la table")).toHaveCount(0);

      await page.getByRole("button", { name: "Réglages", exact: true }).click();
      await expect(dialog(page, "Réglages")).toBeVisible();
      await check("Réglages (salle d’attente)");
      await page.keyboard.press("Escape");
      await expect(dialog(page, "Réglages")).toHaveCount(0);

      await page.getByRole("button", { name: "Messages", exact: true }).click();
      await expect(dialog(page, "Messages rapides")).toBeVisible();
      await check("Messages rapides (salle d’attente)");
      await page.keyboard.press("Escape");
      await expect(dialog(page, "Messages rapides")).toHaveCount(0);

      // The game.
      await page.getByRole("button", { name: "Lancer la partie" }).click();
      await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
      await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
      await check("partie en ligne");
      await page.getByRole("button", { name: "Messages", exact: true }).click();
      await expect(dialog(page, "Messages rapides")).toBeVisible();
      await check("Messages rapides (partie)");
      await page.keyboard.press("Escape");

      await context.close();
      expect(findings).toEqual([]);
    });
  });
}
