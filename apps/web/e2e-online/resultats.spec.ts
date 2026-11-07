import { type Browser, expect, type Page, type TestInfo, test } from "@playwright/test";
import {
  BASE_URL,
  befriend,
  mintInvitation,
  passkeyContext,
  signUp,
  uniquePseudo,
} from "./comptes.ts";
import { createTable, deviceOptions, join, NEAR_END, playOneMove, seatTile } from "./online.ts";

// « Mes résultats » end to end (plan 05-01, HIST-02, D-01 to D-04, D-12), against `wrangler dev` with
// the local D1 (0003_results.sql applied --local by the config). Two family members with an account
// (A and B, each on their own device), a guest « Mamie » and a computer play a near-end table: A's 5
// wins for bleu-rouge. When the game ends, each account opens #/resultats and finds the game: A won
// 8 – 0, B lost 0 – 8. Task 3: line 2 names the partner and the opponents (« Mamie (sans compte) »,
// the computer by its level), B's 20-character pseudo ellipsizes at 844 × 390 while the row's
// accessible name keeps the whole sentence, and the page never scrolls sideways.

const rows = (page: Page) => page.locator("[data-game-row]");
const line = (page: Page, n: 1 | 2) => rows(page).first().locator(`[data-row-line="${n}"]`);

async function accountDevice(
  browser: Browser,
  testInfo: TestInfo,
  request: Parameters<typeof mintInvitation>[0],
  prefix: string,
) {
  const context = await passkeyContext(browser, testInfo);
  const page = await context.newPage();
  const pseudo = uniquePseudo(prefix);
  await signUp(page, await mintInvitation(request), pseudo);
  return { context, page, pseudo };
}

/** An account opens the table link: no first-name prompt, the waiting room. */
async function openTable(page: Page, id: string): Promise<void> {
  await page.goto(`/#/table/${id}?vitesse=test`);
  await expect(seatTile(page, "bleu")).toBeVisible();
}

async function sitAt(page: Page, couleur: string): Promise<void> {
  await seatTile(page, couleur).click();
  await expect(seatTile(page, couleur)).toHaveAttribute("data-seat-state", "you");
}

/** #/resultats until the game is there (the record is written just after the winning step). */
async function openResults(page: Page, count: number): Promise<void> {
  await expect(async () => {
    await page.goto("/");
    await page.goto("/#/resultats");
    await expect(rows(page)).toHaveCount(count, { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

// --- Plan 05-09 Task 1: the navigation, the months, the paging and the detail sheet ---

/** The first stroke of Lucide's « bot », the icon of a game against the computer. */
const BOT_ICON = 'svg path[d="M12 8V4H8"]';

const tab = (page: Page, name: "historique" | "chiffres" | "classement") =>
  page.locator(`[data-results-tab="${name}"]`);

/**
 * A solo game reported for the signed-in account of `page` (POST /api/me/results/solo, the session
 * cookie and our Origin), the way the browser sends it at the end plank (plan 05-07); answers its
 * report id. The player is bleu, the three computers have a level, the game took 40 minutes.
 */
async function reportSolo(page: Page, endedAt: number, won: boolean): Promise<string> {
  const id = crypto.randomUUID();
  const report = {
    id,
    startedAt: endedAt - 40 * 60_000,
    endedAt,
    human: "bleu",
    winner: won ? "bleu-rouge" : "jaune-vert",
    deals: 5,
    levels: { jaune: 3, rouge: 2, vert: 4 },
    seats: {
      bleu: { captured: 2, lost: 1, home: won ? 4 : 2 },
      jaune: { captured: 0, lost: 2, home: won ? 1 : 4 },
      rouge: { captured: 1, lost: 0, home: won ? 4 : 3 },
      vert: { captured: 1, lost: 1, home: won ? 3 : 4 },
    },
  };
  const response = await page.request.post("/api/me/results/solo", {
    data: report,
    headers: { Origin: BASE_URL },
  });
  expect(response.status()).toBe(201);
  return id;
}

test("l’historique par mois, 20 parties à la fois, la fiche d’une partie et les trois onglets", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const a = await accountDevice(browser, testInfo, request, "Pagination");
  const page = a.page;
  // 25 games, one every two days from today back (under the 30 a day and the 60 days of the server).
  const now = Date.now();
  const ids: string[] = [];
  for (let i = 0; i < 25; i++)
    ids.push(await reportSolo(page, now - i * 2 * 86_400_000, i % 3 !== 0));

  await page.goto("/");
  await page.goto("/#/resultats");
  const nav = page.getByRole("navigation", { name: "Mes résultats" });
  await expect(nav).toBeVisible();
  await expect(tab(page, "historique")).toHaveAttribute("aria-current", "page");
  await expect(tab(page, "chiffres")).not.toHaveAttribute("aria-current", "page");
  await expect(rows(page)).toHaveCount(20);
  // Month headings over the rows, newest month first, with a capital letter.
  const months = page.locator("[data-month]");
  expect(await months.count()).toBeGreaterThanOrEqual(2);
  await expect(months.first()).toHaveText(/^\p{Lu}\p{Ll}+ \d{4}$/u);

  // Loading more fails once: the toast, and the button stays.
  const more = page.getByRole("button", { name: "Voir les parties plus anciennes" });
  await page.route("**/api/me/results?before=*", (route) =>
    route.fulfill({ status: 503, body: "" }),
  );
  await more.click();
  await expect(
    page.getByText("Impossible de charger la suite. Réessaie dans un instant."),
  ).toBeVisible();
  await expect(more).toBeVisible();
  await expect(rows(page)).toHaveCount(20);
  await page.unroute("**/api/me/results?before=*");

  // Loading more: busy, then the 5 older games and the end line; no game twice, none skipped.
  await page.route("**/api/me/results?before=*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await more.click();
  const busy = page.locator('[data-history-more][aria-busy="true"]');
  await expect(busy).toHaveText("Chargement…");
  await expect(rows(page)).toHaveCount(25);
  await expect(page.locator("[data-history-more]")).toHaveCount(0);
  await expect(
    page.getByText("C’est tout : les parties comptent depuis novembre 2026."),
  ).toBeVisible();
  await expect(page.locator("[data-results-live]")).toHaveText("25 parties");
  const shown = await rows(page).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-game-row") ?? ""),
  );
  expect(shown).toEqual(ids);
  await page.unroute("**/api/me/results?before=*");

  // No account id in the DOM (the solo game ids carry it on the server only).
  const me = await page.evaluate(async () => {
    const response = await fetch("/api/me", { headers: { accept: "application/json" } });
    return ((await response.json()) as { id: string }).id;
  });
  expect(await page.content()).not.toContain(me);

  // A row opens its sheet; « Fermer » gives the focus back to the row.
  const first = rows(page).first();
  await first.click();
  const sheet = page.locator("[data-game-sheet]");
  await expect(sheet).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveAccessibleName(/^Partie du \p{L}+ \d{1,2} \p{L}+$/u);
  await expect(sheet).toContainText("Contre l’ordinateur");
  await expect(sheet).toContainText("Défaite de ton équipe");
  await expect(sheet).toContainText("Ton équipe");
  await expect(sheet).toContainText("L’équipe adverse");
  await expect(sheet).toContainText("toi");
  await expect(sheet).toContainText("Galopeur");
  await expect(sheet).toContainText("(ordinateur)");
  await expect(sheet).toContainText(/De \d{1,2}\sh\s\d{2} à \d{1,2}\sh\s\d{2} \(40\smin\)/);
  await expect(sheet).toContainText("Donnes jouées : 5");
  await expect(sheet).toContainText(
    "Partie contre l’ordinateur : elle compte dans tes chiffres, pas au classement.",
  );
  await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(first).toBeFocused();

  // The tabs: each its route, the focus on the panel's heading, the back button walks them.
  await tab(page, "chiffres").click();
  await expect(page).toHaveURL(/#\/resultats\/chiffres$/);
  await expect(tab(page, "chiffres")).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 2, name: "Mes chiffres" })).toBeFocused();
  await tab(page, "classement").click();
  await expect(page).toHaveURL(/#\/resultats\/classement$/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Classement entre amis" }),
  ).toBeFocused();
  await page.goBack();
  await expect(tab(page, "chiffres")).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(tab(page, "historique")).toHaveAttribute("aria-current", "page");
  await expect(rows(page).first()).toBeVisible();
  await a.context.close();
});

// --- Plan 05-09 Task 2: « Mes chiffres », the answer of GET /api/me/stats served by the test ---

type Partner = {
  kind: string;
  name: string | null;
  level: number | null;
  games: number;
  wins: number;
};

const statsBlock = (
  games: number,
  wins: number,
  partners: Partner[] = [],
  levels: { level: number; games: number; wins: number }[] = [],
) => ({ games, wins, captured: 9, lost: 7, home: 30, partners, levels });

const tile = (page: Page, name: string) => page.locator(`[data-number-tile="${name}"] dd`);

async function openStats(page: Page, answer: unknown): Promise<void> {
  await page.unroute("**/api/me/stats");
  await page.route("**/api/me/stats", (route) => route.fulfill({ json: answer }));
  await page.goto("/");
  await page.goto("/#/resultats/chiffres");
}

test("« Mes chiffres » : le filtre, les trois nombres, les chevaux, les partenaires et les forces", async ({
  page,
}) => {
  const pseudos = ["Marie", "Paul", "Lucie", "Hugo", "Inès", "Jules", "Léa", "Noé"];
  const partners: Partner[] = [
    ...pseudos.map((name, i) => ({
      kind: "account",
      name,
      level: null,
      games: 9 - i,
      wins: i % 2 === 0 ? 2 : 1,
    })),
    { kind: "guests", name: null, level: null, games: 1, wins: 1 },
  ];
  const answer = {
    all: statsBlock(12, 8, partners, [
      { level: 1, games: 2, wins: 1 },
      { level: 4, games: 3, wins: 2 },
    ]),
    online: statsBlock(7, 4, [{ kind: "account", name: "Marie", level: null, games: 7, wins: 4 }]),
    solo: statsBlock(
      5,
      4,
      [{ kind: "bot", name: null, level: 4, games: 5, wins: 4 }],
      [{ level: 4, games: 5, wins: 4 }],
    ),
  };
  await openStats(page, answer);
  await expect(tab(page, "chiffres")).toHaveAttribute("aria-current", "page");
  const filter = page.getByRole("radiogroup", { name: "Parties comptées" });
  await expect(filter.getByRole("radio", { name: "Toutes" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // The three tiles, a definition list read label then number.
  await expect(page.locator("dl[data-number-tiles] [data-number-tile]")).toHaveCount(3);
  await expect(tile(page, "parties")).toHaveText("12");
  await expect(tile(page, "victoires")).toHaveText("8");
  await expect(tile(page, "reussite")).toHaveText(/^67\s%$/);
  await expect(page.locator('[data-number-tile="parties"] dt')).toHaveText("Parties");
  // « Chevaux ».
  await expect(page.getByRole("heading", { level: 3, name: "Chevaux" })).toBeVisible();
  await expect(page.locator('[data-knights="captured"]')).toHaveText(/Mangés par toi\s*9/);
  await expect(page.locator('[data-knights="lost"]')).toHaveText(/Mangés à toi\s*7/);
  await expect(page.locator('[data-knights="home"]')).toHaveText(/Rentrés par toi\s*30/);
  // Eight partners, then all nine.
  const partnerRows = page.locator("[data-partner-row]");
  await expect(partnerRows).toHaveCount(8);
  await expect(partnerRows.first()).toHaveText(/Marie\s*9 parties · 2 victoires · 22\s%/);
  await page.getByRole("button", { name: "Voir tous mes partenaires" }).click();
  await expect(partnerRows).toHaveCount(9);
  await expect(partnerRows.last()).toHaveText(
    /Joueurs sans compte\s*1 partie · 1 victoire · 100\s%/,
  );
  await expect(page.getByRole("button", { name: "Voir tous mes partenaires" })).toHaveCount(0);
  // The levels, in level order, with the intro.
  await expect(page.getByText("Classé par la force de l’adversaire le plus fort.")).toBeVisible();
  await expect(page.locator("[data-level-row]")).toHaveText([
    /Poulain\s*2 parties · 1 victoire · 50\s%/,
    /Pur-sang\s*3 parties · 2 victoires · 67\s%/,
  ]);

  // « En ligne »: the figures at once, announced; no levels section.
  await filter.getByRole("radio", { name: "En ligne" }).click();
  await expect(tile(page, "parties")).toHaveText("7");
  await expect(tile(page, "reussite")).toHaveText(/^57\s%$/);
  await expect(page.locator("[data-results-live]")).toHaveText(/En ligne\s*:\s*7 parties/);
  await expect(page.locator("[data-level-row]")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 3, name: "Contre l’ordinateur, par force" }),
  ).toHaveCount(0);
  await expect(partnerRows).toHaveCount(1);
  // « Contre l’ordinateur ».
  await filter.getByRole("radio", { name: "Contre l’ordinateur" }).click();
  await expect(tile(page, "parties")).toHaveText("5");
  await expect(partnerRows).toHaveText([
    /Pur-sang \(ordinateur\)\s*5 parties · 4 victoires · 80\s%/,
  ]);
  await expect(page.locator("[data-level-row]")).toHaveCount(1);

  // No game at all.
  await openStats(page, {
    all: statsBlock(0, 0),
    online: statsBlock(0, 0),
    solo: statsBlock(0, 0),
  });
  await expect(page.getByText("Pas encore de chiffres")).toBeVisible();
  await expect(
    page.getByText(
      "Termine une partie, en ligne ou contre l’ordinateur, pour voir tes chiffres ici.",
    ),
  ).toBeVisible();
  // None for a filter.
  const one = [{ kind: "bot", name: null, level: 2, games: 1, wins: 1 }];
  await openStats(page, {
    all: statsBlock(1, 1, one, [{ level: 2, games: 1, wins: 1 }]),
    online: statsBlock(0, 0),
    solo: statsBlock(1, 1, one, [{ level: 2, games: 1, wins: 1 }]),
  });
  await expect(tile(page, "reussite")).toHaveText(/^100\s%$/);
  await expect(page.locator("[data-partner-row]")).toHaveText([
    /Trotteur \(ordinateur\)\s*1 partie · 1 victoire · 100\s%/,
  ]);
  await page.getByRole("radio", { name: "En ligne" }).click();
  await expect(page.getByText("Aucune partie de ce genre pour l’instant.")).toBeVisible();
  await expect(page.locator("[data-number-tile]")).toHaveCount(0);

  // At 640 x 360 the tiles hold « 100 % » without overflow, and nothing scrolls sideways.
  await page.getByRole("radio", { name: "Toutes" }).click();
  await page.setViewportSize({ width: 640, height: 360 });
  // The two-column layout follows the resize: measure once it is there.
  await expect(page.locator('main[data-layout="two"]')).toBeVisible();
  await expect(tile(page, "reussite")).toHaveText(/^100\s%$/);
  const fit = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll("[data-number-tile]")];
    return {
      overflow: tiles.some(
        (element) =>
          element instanceof HTMLElement &&
          [...element.querySelectorAll("dd, dt")].some(
            (part) => part instanceof HTMLElement && part.scrollWidth > part.clientWidth,
          ),
      ),
      heights: tiles.map((element) => Math.round(element.getBoundingClientRect().height)),
      sideways: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(fit).toEqual({ overflow: false, heights: [72, 72, 72], sideways: false });
});

test("une partie à deux comptes, un invité et un ordinateur, dans « Mes résultats »", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(240_000);
  const id = await createTable(request, { pace: "zero", before: NEAR_END, levels: { vert: 4 } });
  const a = await accountDevice(browser, testInfo, request, "Anaïs");
  // A 20-character pseudo (« Long names »).
  const b = await accountDevice(browser, testInfo, request, "Marie-Christine");
  expect([...b.pseudo]).toHaveLength(20);
  // Plan 05-09: A and B are friends.
  await befriend(a.page, b.page);
  // A opens the link first: A creates the table and starts it.
  await openTable(a.page, id);
  await sitAt(a.page, "bleu");
  await openTable(b.page, id);
  await sitAt(b.page, "jaune");
  const guest = await browser.newContext(deviceOptions(testInfo));
  const mamie = await guest.newPage();
  await join(mamie, id, "Mamie");
  await sitAt(mamie, "rouge");

  await a.page.getByRole("button", { name: "Lancer la partie" }).click();
  await expect(a.page.locator("[data-hand] [data-card]")).toHaveCount(1);
  await playOneMove(a.page);
  await expect(a.page.locator("[data-end-plank]")).toBeVisible();
  await expect(b.page.locator("[data-end-plank]")).toBeVisible();

  await openResults(a.page, 1);
  await expect(a.page.getByRole("heading", { level: 1 })).toHaveText("Mes résultats");
  await expect(line(a.page, 1)).toHaveText(/^Victoire\s·\s8\s–\s0$/);

  await expect(line(a.page, 2)).toHaveText(
    `Avec Mamie (sans compte) · contre ${b.pseudo} et Pur-sang`,
  );
  await expect(rows(a.page).first()).toHaveAttribute(
    "aria-label",
    new RegExp(
      `^Victoire · 8 – 0, Avec Mamie \\(sans compte\\) · contre ${b.pseudo} et Pur-sang, \\d{1,2} \\p{L}+\\.?, \\d{1,2}\\s?h\\s?\\d{2}, en ligne$`,
      "u",
    ),
  );
  await expect(rows(a.page).first()).not.toContainText(/invit/i);

  // At 844 × 390 the long pseudo ellipsizes in line 2 (its title keeps it), the row stays 64 high and
  // the page does not scroll sideways.
  await a.page.setViewportSize({ width: 844, height: 390 });
  await expect(line(a.page, 2)).toHaveAttribute("title", /Marie-Christine/);
  const fit = await a.page.evaluate(() => {
    const row = document.querySelector("[data-game-row]");
    const second = row?.querySelector('[data-row-line="2"]');
    if (!(row instanceof HTMLElement) || !(second instanceof HTMLElement)) return null;
    return {
      height: Math.round(row.getBoundingClientRect().height),
      ellipsis: second.scrollWidth > second.clientWidth,
      sideways: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  expect(fit).toEqual({ height: 64, ellipsis: true, sideways: false });

  await openResults(b.page, 1);
  await expect(line(b.page, 1)).toHaveText(/^Défaite\s·\s0\s–\s8$/);
  await expect(line(b.page, 2)).toHaveText(
    `Avec Pur-sang · contre ${a.pseudo} et Mamie (sans compte)`,
  );

  // Plan 05-09, the whole path: A adds a solo game; A's history has both, B's only the online one.
  await a.page.setViewportSize(
    testInfo.project.name === "desktop"
      ? { width: 1280, height: 800 }
      : { width: 844, height: 390 },
  );
  await reportSolo(a.page, Date.now(), true);
  await openResults(a.page, 2);
  await expect(rows(a.page).first().locator(BOT_ICON)).toHaveCount(1);
  await expect(rows(a.page).nth(1).locator(BOT_ICON)).toHaveCount(0);
  await openResults(b.page, 1);

  // The detail sheets say what each game counts for.
  const counting = a.page.locator("[data-sheet-counting]");
  await rows(a.page).nth(1).click();
  await expect(a.page.locator("[data-game-sheet]")).toContainText(
    `En ligne, à la table de ${a.pseudo}`,
  );
  await expect(a.page.locator("[data-game-sheet]")).toContainText("Mamie");
  await expect(a.page.locator("[data-game-sheet]")).toContainText("(sans compte)");
  await expect(counting).toHaveText("Cette partie compte pour le classement entre amis.");
  await a.page.keyboard.press("Escape");
  await expect(a.page.locator("[data-game-sheet]")).toHaveCount(0);
  await expect(rows(a.page).nth(1)).toBeFocused();
  await rows(a.page).first().click();
  await expect(counting).toHaveText(
    "Partie contre l’ordinateur : elle compte dans tes chiffres, pas au classement.",
  );
  await a.page.keyboard.press("Escape");

  // « Mes chiffres »: 2 under « Toutes », 1 « En ligne », 1 « Contre l’ordinateur ».
  await tab(a.page, "chiffres").click();
  await expect(tile(a.page, "parties")).toHaveText("2");
  await expect(tile(a.page, "victoires")).toHaveText("2");
  await expect(tile(a.page, "reussite")).toHaveText(/^100\s%$/);
  await a.page.getByRole("radio", { name: "En ligne" }).click();
  await expect(tile(a.page, "parties")).toHaveText("1");
  await a.page.getByRole("radio", { name: "Contre l’ordinateur" }).click();
  await expect(tile(a.page, "parties")).toHaveText("1");

  // « Classement »: only the two-account game counts; both friends are not ranked yet, 1 of 5.
  await tab(a.page, "classement").click();
  await expect(a.page.getByText("Personne n’est encore au classement")).toBeVisible();
  await expect(a.page.locator("[data-rank-row][data-rank]")).toHaveCount(0);
  const mine = a.page.locator(`[data-rank-row="${a.pseudo}"]`);
  const friend = a.page.locator(`[data-rank-row="${b.pseudo}"]`);
  await expect(mine).toContainText("toi");
  await expect(mine).toContainText("1 partie sur 5");
  await expect(friend).toContainText("1 partie sur 5");
  await expect(friend).not.toContainText("toi");
  const bId = await b.page.evaluate(async () => {
    const response = await fetch("/api/me", { headers: { accept: "application/json" } });
    return ((await response.json()) as { id: string }).id;
  });
  expect(await a.page.content()).not.toContain(bId);
  await a.page.getByRole("button", { name: "Comment ça marche ?" }).click();
  const how = a.page.getByRole("dialog", { name: "Le classement" });
  await expect(how).toBeVisible();
  await expect(how).toContainText(
    "Le classement compte les parties en ligne terminées où au moins deux joueurs ont un compte, partenaires ou adversaires.",
  );
  await expect(how).toContainText("On entre au classement après 5 parties.");
  await expect(how).toContainText(
    "À égalité, le plus de victoires passe devant, puis le plus de parties.",
  );
  await how.getByRole("button", { name: "Fermer" }).click();
  await expect(how).toHaveCount(0);
  await expect(a.page.getByRole("button", { name: "Comment ça marche ?" })).toBeFocused();

  // A third account without friends.
  const c = await accountDevice(browser, testInfo, request, "Céleste");
  await c.page.goto("/#/resultats/classement");
  await expect(c.page.getByText("Pas encore d’amis sur TOC")).toBeVisible();
  await expect(c.page.getByText("Invite un proche pour vous mesurer entre amis.")).toBeVisible();
  await expect(c.page.getByRole("link", { name: "Mes amis" })).toHaveAttribute("href", "#/amis");
  await c.context.close();

  await guest.close();
  await a.context.close();
  await b.context.close();
});

// --- Plan 05-09 Task 3: « Classement » with a served answer: ties, one's own row, the states ---

const RANKED = {
  friends: 5,
  ranked: [
    { rank: 1, pseudo: "Marie", games: 12, wins: 8, me: false },
    { rank: 2, pseudo: "Romain", games: 9, wins: 5, me: true },
    { rank: 2, pseudo: "Paul", games: 9, wins: 5, me: false },
    { rank: 4, pseudo: "Marie-Christine Abcd", games: 7, wins: 2, me: false },
  ],
  unranked: [
    { pseudo: "Lucie", games: 3, me: false },
    { pseudo: "Hugo", games: 0, me: false },
  ],
};

async function openRanking(page: Page, answer: unknown): Promise<void> {
  await page.unroute("**/api/me/ranking");
  await page.route("**/api/me/ranking", (route) => route.fulfill({ json: answer }));
  await page.goto("/");
  await page.goto("/#/resultats/classement");
}

test("« Classement » : les rangs partagés, sa propre ligne, ceux qui n’y sont pas encore", async ({
  page,
}) => {
  await openRanking(page, RANKED);
  await expect(
    page.getByText(
      "Entre toi et tes amis, sur les parties en ligne jouées avec au moins un autre joueur qui a un compte.",
    ),
  ).toBeVisible();
  const ranked = page.locator("[data-rank-row][data-rank]");
  await expect(ranked).toHaveCount(4);
  expect(
    await ranked.evaluateAll((all) => all.map((row) => row.getAttribute("data-rank"))),
  ).toEqual(["1", "2", "2", "4"]);
  await expect(ranked.first()).toHaveAccessibleName(/^1er, Marie, 67\s%, 12 parties, 8 victoires$/);
  await expect(page.locator('[data-rank-row="Romain"]')).toHaveAccessibleName(
    /^2e, toi, 56\s%, 9 parties, 5 victoires$/,
  );
  await expect(page.locator('[data-rank-row="Romain"]')).toContainText("toi");
  await expect(page.locator('[data-rank-row="Romain"]')).toContainText("9 parties · 5 victoires");
  // One's own row: a 2 px cream outline, never amber.
  const outline = await page.locator('[data-rank-row="Romain"]').evaluate((row) => {
    const style = getComputedStyle(row);
    return {
      color: style.outlineColor,
      width: style.outlineWidth,
      background: style.backgroundColor,
    };
  });
  expect(outline).toEqual({
    color: "rgb(255, 248, 225)",
    width: "2px",
    background: "rgb(74, 47, 26)",
  });
  const amber = await page.evaluate(() =>
    [...document.querySelectorAll("[data-results] *")].some((element) => {
      const style = getComputedStyle(element);
      return (
        [style.color, style.backgroundColor, style.borderTopColor, style.outlineColor].includes(
          "rgb(255, 176, 46)",
        ) && !element.matches(".btn-primary")
      );
    }),
  );
  expect(amber).toBe(false);
  await expect(
    page.getByRole("heading", { level: 3, name: "Pas encore au classement" }),
  ).toBeVisible();
  await expect(page.getByText("Il faut 5 parties pour entrer au classement.")).toBeVisible();
  await expect(page.locator('[data-rank-row="Lucie"]')).toContainText("3 parties sur 5");
  await expect(page.locator('[data-rank-row="Hugo"]')).toContainText("0 partie sur 5");
  await expect(page.locator('[data-rank-row="Hugo"]')).toHaveAccessibleName("Hugo, 0 partie sur 5");

  // Friends, nobody ranked: the heading, the line, « Créer une table en ligne », then everyone.
  await openRanking(page, {
    friends: 1,
    ranked: [],
    unranked: [
      { pseudo: "Romain", games: 2, me: true },
      { pseudo: "Marie", games: 1, me: false },
    ],
  });
  await expect(page.getByText("Personne n’est encore au classement")).toBeVisible();
  await expect(
    page.getByText("Jouez ensemble en ligne : chacun y entre après 5 parties."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer une table en ligne" })).toBeVisible();
  await expect(page.locator("[data-rank-row]")).toHaveCount(2);

  // A failing answer: the error and « Réessayer », which loads again.
  await page.unroute("**/api/me/ranking");
  let calls = 0;
  await page.route("**/api/me/ranking", (route) => {
    calls += 1;
    return calls === 1 ? route.fulfill({ status: 503, body: "" }) : route.fulfill({ json: RANKED });
  });
  await page.goto("/");
  await page.goto("/#/resultats/classement");
  await expect(page.getByText("Impossible de charger le classement.")).toBeVisible();
  await page.getByRole("button", { name: "Réessayer" }).click();
  await expect(page.locator("[data-rank-row][data-rank]")).toHaveCount(4);
});

/** The three answers of the page with something in each, for the fit and the screenshots. */
async function serveAll(page: Page): Promise<void> {
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
  const hash = "Q".repeat(43);
  const games = [
    {
      id: `${hash}:3`,
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
    {
      id: `${hash}:1`,
      kind: "online",
      startedAt: at(9, 24, 20, 31),
      endedAt: at(9, 24, 21, 2),
      winner: "jaune-vert",
      mine: "vert",
      seats: [
        seat("bleu", "account", "Marie-Christine Abcd", 2),
        seat("jaune", "guest", "Bon-Papa", 4),
        seat("rouge", "bot", "Ténor", 1, 3),
        seat("vert", "me", "Romain", 4),
      ],
      deals: 7,
      creator: "Marie-Christine Abcd",
      ranked: false,
    },
  ];
  await page.route("**/api/me/results", (route) => route.fulfill({ json: { games, next: null } }));
  const partners = [
    { kind: "account", name: "Marie", level: null, games: 6, wins: 4 },
    { kind: "account", name: "Paul", level: null, games: 3, wins: 1 },
    { kind: "guests", name: null, level: null, games: 2, wins: 1 },
    { kind: "bot", name: null, level: 4, games: 1, wins: 1 },
  ];
  const levels = [
    { level: 3, games: 4, wins: 3 },
    { level: 4, games: 2, wins: 1 },
  ];
  await page.route("**/api/me/stats", (route) =>
    route.fulfill({
      json: {
        all: { ...statsBlock(12, 8, partners, levels), captured: 14, lost: 9, home: 38 },
        online: statsBlock(6, 4, partners.slice(0, 3)),
        solo: statsBlock(6, 4, partners.slice(3), levels),
      },
    }),
  );
  await page.route("**/api/me/ranking", (route) => route.fulfill({ json: RANKED }));
}

test("« Mes résultats » tient à chaque taille, sans défilement de côté, cibles de 44", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the sizes are set by the test, once");
  await serveAll(page);
  const sizes = [
    { width: 844, height: 390 },
    { width: 750, height: 342 },
    { width: 640, height: 360 },
    { width: 480, height: 320 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const name of ["historique", "chiffres", "classement"] as const) {
      await page.goto("/");
      await page.goto(`/#/resultats${name === "historique" ? "" : `/${name}`}`);
      await expect(page.locator(`[data-results-panel="${name}"]`)).toBeVisible();
      await expect(
        page.locator("[data-game-row], [data-number-tile], [data-rank-row]").first(),
      ).toBeVisible();
      const report = await page.evaluate(() => {
        const small = [
          ...document.querySelectorAll<HTMLElement>("main a[href], main button, main [role=radio]"),
        ]
          .filter((element) => element.offsetParent !== null)
          .map((element) => {
            const box = element.getBoundingClientRect();
            return { text: element.textContent?.trim() ?? "", w: box.width, h: box.height };
          })
          .filter((box) => box.w < 44 || box.h < 44);
        return {
          sideways: document.documentElement.scrollWidth > window.innerWidth,
          small,
          bar: document.querySelector("[data-results-nav]")?.getAttribute("data-results-nav"),
        };
      });
      expect(report.sideways, `${name} ${size.width}x${size.height}`).toBe(false);
      expect(report.small, `${name} ${size.width}x${size.height}`).toEqual([]);
      expect(report.bar).toBe(size.width < 640 || size.height > size.width ? "bar" : "column");
      // Upright, the page is not behind « Tourne ton téléphone ».
      await expect(page.getByRole("heading", { level: 1, name: "Mes résultats" })).toBeVisible();
    }
  }
});

// Plan 05-09 screenshots (TOC_SHOTS): the three panels and the two sheets at 844 x 390 and 1280 x 800.
test("captures des trois onglets et des deux feuilles", async ({ page }, testInfo) => {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?.env;
  const dir = env?.TOC_SHOTS;
  test.skip(!dir || testInfo.project.name !== "desktop", "TOC_SHOTS only, once");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await serveAll(page);
  for (const size of [
    { width: 844, height: 390 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    const suffix = `${size.width}x${size.height}`;
    await page.goto("/");
    await page.goto("/#/resultats");
    await expect(rows(page)).toHaveCount(3);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dir}/05-09-historique-${suffix}.png` });
    await rows(page).first().click();
    await expect(page.locator("[data-game-sheet]")).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/05-09-fiche-${suffix}.png` });
    await page.keyboard.press("Escape");
    await tab(page, "chiffres").click();
    await expect(page.locator("[data-number-tile]")).toHaveCount(3);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dir}/05-09-chiffres-${suffix}.png` });
    await tab(page, "classement").click();
    await expect(page.locator("[data-rank-row]")).toHaveCount(6);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dir}/05-09-classement-${suffix}.png` });
    await page.getByRole("button", { name: "Comment ça marche ?" }).click();
    await expect(page.getByRole("dialog", { name: "Le classement" })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/05-09-le-classement-${suffix}.png` });
    await page.keyboard.press("Escape");
  }
});

// Screenshots for the review (TOC_SHOTS names a directory; skipped otherwise): « Mes résultats » with
// three games (online won, online lost with a guest, a 20-character pseudo) at 844 x 390 and 1280 x 800.
// The answer of GET /api/me/results is served by the test (the same shape as the Worker's).
test("captures de « Mes résultats »", async ({ browser }, testInfo) => {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?.env;
  const dir = env?.TOC_SHOTS;
  test.skip(!dir || testInfo.project.name !== "desktop", "TOC_SHOTS only, once");
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
    captured: 0,
    lost: 0,
    home,
  });
  const hash = "Q".repeat(43);
  const at = (day: number, hour: number, minute: number) =>
    new Date(2026, 10, day, hour, minute).getTime();
  const page = {
    games: [
      {
        id: `${hash}:3`,
        kind: "online",
        startedAt: at(6, 20, 31),
        endedAt: at(6, 21, 14),
        winner: "bleu-rouge",
        mine: "bleu",
        seats: [
          seat("bleu", "me", "Romain", 4),
          seat("jaune", "account", "Paul", 3),
          seat("rouge", "account", "Marie", 4),
          seat("vert", "bot", "Ourasi", 2, 4),
        ],
        deals: 6,
        creator: "Romain",
        ranked: true,
      },
      {
        id: `${hash}:2`,
        kind: "online",
        startedAt: at(5, 18, 2),
        endedAt: at(5, 18, 50),
        winner: "bleu-rouge",
        mine: "jaune",
        seats: [
          seat("bleu", "account", "Marie", 4),
          seat("jaune", "me", "Romain", 3),
          seat("rouge", "account", "Paul", 4),
          seat("vert", "guest", "Mamie", 3),
        ],
        deals: 5,
        creator: "Marie",
        ranked: true,
      },
      {
        id: `${hash}:1`,
        kind: "online",
        startedAt: at(2, 9, 0),
        endedAt: at(2, 9, 41),
        winner: "jaune-vert",
        mine: "vert",
        seats: [
          seat("bleu", "account", "Marie-Christine Abcd", 2),
          seat("jaune", "guest", "Bon-Papa", 4),
          seat("rouge", "bot", "Ténor", 1, 3),
          seat("vert", "me", "Romain", 4),
        ],
        deals: 7,
        creator: "Marie-Christine Abcd",
        ranked: false,
      },
    ],
    next: null,
  };
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const tab = await context.newPage();
  await tab.route("**/api/me/results", (route) => route.fulfill({ json: page }));
  await tab.goto("/");
  await tab.goto("/#/resultats");
  await expect(rows(tab)).toHaveCount(3);
  for (const size of [
    { width: 844, height: 390 },
    { width: 1280, height: 800 },
  ]) {
    await tab.setViewportSize(size);
    await tab.waitForTimeout(300);
    await tab.screenshot({ path: `${dir}/05-01-resultats-${size.width}x${size.height}.png` });
  }
  // The empty history.
  await tab.unroute("**/api/me/results");
  await tab.route("**/api/me/results", (route) =>
    route.fulfill({ json: { games: [], next: null } }),
  );
  await tab.goto("/");
  await tab.goto("/#/resultats");
  await expect(tab.locator("[data-history-empty]")).toBeVisible();
  for (const size of [
    { width: 844, height: 390 },
    { width: 1280, height: 800 },
  ]) {
    await tab.setViewportSize(size);
    await tab.waitForTimeout(300);
    await tab.screenshot({ path: `${dir}/05-01-vide-${size.width}x${size.height}.png` });
  }
  await context.close();
});
