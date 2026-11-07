import { type Browser, expect, type Page, type TestInfo, test } from "@playwright/test";
import { mintInvitation, passkeyContext, signUp, uniquePseudo } from "./comptes.ts";
import { createTable, deviceOptions, join, NEAR_END, playOneMove, seatTile } from "./online.ts";

// « Mes résultats » end to end (plan 05-01, HIST-02, D-01 to D-04, D-12), against `wrangler dev` with
// the local D1 (0003_results.sql applied --local by the config). Two family members with an account
// (A and B, each on their own device), a guest « Mamie » and a computer play a near-end table: A's 5
// wins for bleu-rouge. When the game ends, each account opens #/resultats and finds the game: A won
// 8 – 0, B lost 0 – 8.

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
  const id = await createTable(request, { pace: "zero", before: NEAR_END });
  const a = await accountDevice(browser, testInfo, request, "Anaïs");
  const b = await accountDevice(browser, testInfo, request, "Bruno");
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

  await openResults(b.page, 1);
  await expect(line(b.page, 1)).toHaveText(/^Défaite\s·\s0\s–\s8$/);

  await guest.close();
  await a.context.close();
  await b.context.close();
});
