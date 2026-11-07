import { type Browser, expect, type Page, type TestInfo, test } from "@playwright/test";
import { playToEnd } from "../e2e/jouer.ts";
import { mintInvitation, passkeyContext, signUp, uniquePseudo } from "./comptes.ts";

// A game against the computer in « Mes résultats » (plan 05-07, D-01, HIST-02, HIST-03; 05-UI-SPEC
// « What counts »), against `wrangler dev` with the local D1. A signed-in player finishes a seeded game
// at test speed (the same deal as e2e/partie-complete.spec.ts, through the screen alone): the end plank
// says « Partie ajoutée à tes résultats. », the game is first in the history with the computer's icon,
// it counts in « Mes chiffres » (all and solo) and never in the ranking. Without network the plank says
// so, the game waits in toc.pending.v1 tagged with the account, and is sent at the next start. A guest
// gets no line and sends nothing. One long game each: desktop only, like partie-complete.

const SEED = "00c0ffee00c0ffee1234567890abcdef";
const ADDED = "Partie ajoutée à tes résultats.";
const OFFLINE = "Pas de connexion : la partie sera ajoutée à tes résultats au retour du réseau.";
const SOLO = "**/api/me/results/solo";
/** The first stroke of Lucide's « bot », the icon of a game against the computer. */
const BOT_ICON = 'svg path[d="M12 8V4H8"]';

test.skip(({ isMobile }) => isMobile, "one long game per test, on the desktop project only");

async function signedIn(
  browser: Browser,
  testInfo: TestInfo,
  request: Parameters<typeof mintInvitation>[0],
) {
  const context = await passkeyContext(browser, testInfo);
  const page = await context.newPage();
  await signUp(page, await mintInvitation(request), uniquePseudo("Solène"));
  const me = await page.evaluate(async () => {
    const response = await fetch("/api/me", { headers: { accept: "application/json" } });
    return (await response.json()) as { id: string };
  });
  return { context, page, id: me.id };
}

/** The seeded game, played to the end plank; answers how long it took, in seconds. */
async function playSeededGame(page: Page): Promise<number> {
  const start = Date.now();
  await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await playToEnd(page);
  await expect(page.locator("[data-end-plank]")).toBeVisible();
  return Math.round((Date.now() - start) / 1000);
}

async function api<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(path, { headers: { accept: "application/json" } });
  expect(response.status(), path).toBe(200);
  return (await response.json()) as T;
}

type Block = { games: number; wins: number };
type Stats = { all: Block; online: Block; solo: Block };

const pending = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("toc.pending.v1") ?? "[]") as unknown[]);

/** #/resultats, reloaded until `count` games are listed. */
async function openResults(page: Page, count: number): Promise<void> {
  const rows = page.locator("[data-game-row]");
  await expect(async () => {
    await page.goto("/");
    await page.goto("/#/resultats");
    await expect(rows).toHaveCount(count, { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

test("une partie contre l’ordinateur finie connecté arrive dans « Mes résultats », jamais au classement", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(10 * 60_000);
  const a = await signedIn(browser, testInfo, request);
  const rankingBefore = await api<unknown>(a.page, "/api/me/ranking");
  const posts: number[] = [];
  a.page.on("response", (response) => {
    if (response.url().endsWith("/api/me/results/solo")) posts.push(response.status());
  });

  const seconds = await playSeededGame(a.page);
  testInfo.annotations.push({ type: "durée de la partie", description: `${seconds} s` });
  const line = a.page.locator("[data-solo-report]");
  await expect(line).toHaveText(ADDED);
  await expect(line).toHaveAttribute("data-solo-report", "added");
  expect(posts).toEqual([201]);
  expect(await pending(a.page)).toEqual([]);

  await openResults(a.page, 1);
  const row = a.page.locator("[data-game-row]").first();
  await expect(row).toHaveAttribute("aria-label", /, contre l’ordinateur, /);
  await expect(row.locator(BOT_ICON)).toHaveCount(1);

  const stats = await api<Stats>(a.page, "/api/me/stats");
  expect(stats.all.games).toBe(1);
  expect(stats.solo.games).toBe(1);
  expect(stats.online.games).toBe(0);
  expect(stats.solo.wins).toBe(stats.all.wins);
  expect(await api<unknown>(a.page, "/api/me/ranking")).toEqual(rankingBefore);
  await a.context.close();
});

test("sans réseau, la planche le dit, la partie attend sur l’appareil et part au retour", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(10 * 60_000);
  const a = await signedIn(browser, testInfo, request);
  await a.page.route(SOLO, (route) => route.abort("internetdisconnected"));

  await playSeededGame(a.page);
  const line = a.page.locator("[data-solo-report]");
  await expect(line).toHaveText(OFFLINE);
  await expect(line).toHaveAttribute("data-solo-report", "offline");
  const queued = (await pending(a.page)) as { account: string; report: { id: string } }[];
  expect(queued).toHaveLength(1);
  expect(queued[0]?.account).toBe(a.id);
  expect(Object.keys(queued[0] ?? {}).sort()).toEqual(["account", "report"]);

  // Back on the network, the next start sends it.
  await a.page.unroute(SOLO);
  await a.page.goto("/");
  await expect(a.page.locator('[data-small-tile="compte"]')).toBeVisible();
  await expect.poll(() => pending(a.page), { timeout: 20_000 }).toEqual([]);
  await openResults(a.page, 1);
  await expect(a.page.locator("[data-game-row]").first()).toHaveAttribute(
    "aria-label",
    /, contre l’ordinateur, /,
  );
  const stats = await api<Stats>(a.page, "/api/me/stats");
  expect(stats.solo.games).toBe(1);
  await a.context.close();
});

test("un joueur sans compte finit sa partie : aucune ligne, rien n’est envoyé", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  const posts: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/me/results")) posts.push(req.url());
  });
  await page.goto("/");
  await playSeededGame(page);
  await expect(page.locator("[data-end-plank]")).toBeVisible();
  await expect(page.locator("[data-solo-report]")).toHaveCount(0);
  expect(posts).toEqual([]);
  expect(await pending(page)).toEqual([]);
});
