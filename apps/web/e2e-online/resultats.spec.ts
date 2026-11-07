import { type Browser, expect, type Page, type TestInfo, test } from "@playwright/test";
import { mintInvitation, passkeyContext, signUp, uniquePseudo } from "./comptes.ts";
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

test("une partie à deux comptes, un invité et un ordinateur, dans « Mes résultats »", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const id = await createTable(request, { pace: "zero", before: NEAR_END, levels: { vert: 4 } });
  const a = await accountDevice(browser, testInfo, request, "Anaïs");
  // A 20-character pseudo (« Long names »).
  const b = await accountDevice(browser, testInfo, request, "Marie-Christine");
  expect([...b.pseudo]).toHaveLength(20);
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
      `^Victoire, 8 à 0, le \\d{1,2} \\p{L}+ à \\d{1,2}\\s?h\\s?\\d{2}, en ligne, avec Mamie \\(sans compte\\), contre ${b.pseudo} et Pur-sang$`,
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

  await guest.close();
  await a.context.close();
  await b.context.close();
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
