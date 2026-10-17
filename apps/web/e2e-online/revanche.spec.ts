import { type Browser, expect, type Page, type TestInfo, test } from "@playwright/test";
import { createTable, deviceOptions, join, NEAR_END, playOneMove, seatTile } from "./online.ts";

// The end of an online game and « Revanche » (plan 02-09, PLAY-07, D-08; 02-UI-SPEC « End plank (D-08,
// PLAY-07) »). Ana (bleu) and Bruno (jaune) with two computers start from a near-end position where
// Ana's 5 wins for bleu-rouge. Both see the plank at once, each from their side, with « Revanche » and
// « Quitter la table »; the four discs say who agrees; when both agree « Tout le monde est d’accord :
// nouvelle partie ! » shows, the plank closes and a new deal starts at the same seats. Someone offline
// at that moment has their seat played by the computer until they come back. « Quitter la table » on
// the plank leaves the table and « Mes parties en cours ». The plank never scrolls, even on a very low
// phone.

const plank = (page: Page) => page.locator("[data-end-plank]");
const disc = (page: Page, couleur: string) => page.locator(`[data-rematch-vote="${couleur}"]`);
const line = (page: Page) => page.locator("[data-vote-line]");
const rematch = (page: Page) => plank(page).getByRole("button", { name: "Revanche" });
const quit = (page: Page) => plank(page).getByRole("button", { name: "Quitter la table" });
const badge = (page: Page, couleur: string) => page.locator(`[data-seat-badge="${couleur}"]`);

/** « Tout le monde est d’accord : nouvelle partie ! » with the French spaces. */
const ALL_AGREE = /^Tout le monde est d’accord\s:\snouvelle partie\s!$/;

async function device(browser: Browser, testInfo: TestInfo) {
  const context = await browser.newContext(deviceOptions(testInfo));
  return { context, page: await context.newPage() };
}

/**
 * Saves a screenshot when TOC_SHOTS names a directory: the computer's page at its 1280 x 800, a
 * phone's page at 844 x 390 (then back to its own size).
 */
async function shot(page: Page, name: string): Promise<void> {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?.env;
  const dir = env?.TOC_SHOTS;
  if (!dir) return;
  const own = page.viewportSize();
  const size = own !== null && own.width >= 1000 ? own : { width: 844, height: 390 };
  if (own !== size) await page.setViewportSize(size);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/02-09-${name}-${size.width}x${size.height}.png` });
  if (own !== null && own !== size) {
    await page.setViewportSize(own);
    await page.waitForTimeout(200);
  }
}

/** A near-end table: Ana on bleu (creator), Bruno on jaune, started; both on the game screen. */
async function nearEnd(
  browser: Browser,
  request: Parameters<typeof createTable>[0],
  testInfo: TestInfo,
) {
  const id = await createTable(request, { pace: "zero", before: NEAR_END });
  const ana = await device(browser, testInfo);
  const bruno = await device(browser, testInfo);
  await join(ana.page, id, "Ana");
  await seatTile(ana.page, "bleu").click();
  await expect(seatTile(ana.page, "bleu")).toHaveAttribute("data-seat-state", "you");
  await join(bruno.page, id, "Bruno");
  await seatTile(bruno.page, "jaune").click();
  await expect(seatTile(bruno.page, "jaune")).toHaveAttribute("data-seat-state", "you");
  await ana.page.getByRole("button", { name: "Lancer la partie" }).click();
  await expect(ana.page.locator("[data-hand] [data-card]")).toHaveCount(1);
  await expect(bruno.page.locator("[data-board]")).toBeVisible();
  return { id, ana, bruno };
}

/** Ana plays her 5: both see the plank, Ana « Victoire ! », Bruno « Défaite ». */
async function win(ana: Page, bruno: Page): Promise<void> {
  await playOneMove(ana);
  await expect(plank(ana)).toBeVisible();
  await expect(plank(bruno)).toBeVisible();
  await expect(plank(ana).getByRole("heading")).toHaveText(/^Victoire\s!$/);
  await expect(plank(bruno).getByRole("heading")).toHaveText("Défaite");
  await expect(ana.locator("[data-end-screen]")).toHaveAttribute("data-result", "win");
  await expect(bruno.locator("[data-end-screen]")).toHaveAttribute("data-result", "loss");
}

/** The plank fits the screen: nothing scrolls, nothing is cut. */
async function expectPlankFits(page: Page): Promise<void> {
  const fit = await page.evaluate(() => {
    const scrim = document.querySelector("[data-end-screen]");
    const panel = document.querySelector("[data-end-plank]");
    if (!(scrim instanceof HTMLElement) || !(panel instanceof HTMLElement)) return null;
    const r = panel.getBoundingClientRect();
    return {
      scrolls:
        panel.scrollHeight > panel.clientHeight + 1 || scrim.scrollHeight > scrim.clientHeight + 1,
      inside:
        r.top >= -0.5 &&
        r.bottom <= innerHeight + 0.5 &&
        r.left >= -0.5 &&
        r.right <= innerWidth + 0.5,
      buttons: [...panel.querySelectorAll("button")].every((button) => {
        const b = button.getBoundingClientRect();
        return b.top >= r.top && b.bottom <= r.bottom && b.height >= 44;
      }),
    };
  });
  expect(fit).toEqual({ scrolls: false, inside: true, buttons: true });
}

test("the end for both, « Revanche » agreed by both, a new deal at the same seats", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const { ana, bruno } = await nearEnd(browser, request, testInfo);
  const turnOf = async (page: Page) => page.locator("[data-board]").getAttribute("data-k");
  const anaTurn = await turnOf(ana.page);
  const brunoTurn = await turnOf(bruno.page);

  await win(ana.page, bruno.page);
  for (const page of [ana.page, bruno.page]) {
    // « Revanche » and « Quitter la table » replace « Rejouer » and « Changer de couleur ».
    await expect(rematch(page)).toBeVisible();
    await expect(rematch(page)).toHaveAttribute("aria-pressed", "false");
    await expect(quit(page)).toBeVisible();
    await expect(plank(page).getByRole("button", { name: "Rejouer" })).toHaveCount(0);
    await expect(plank(page).getByRole("button", { name: "Changer de couleur" })).toHaveCount(0);
    await expect(rematch(page)).toBeFocused();
    // The four discs, in COLORS order; the computers always agree.
    await expect(page.getByRole("list", { name: "Accord pour la revanche" })).toBeVisible();
    await expect(disc(page, "rouge")).toHaveAttribute("data-vote", "bot");
    await expect(disc(page, "vert")).toHaveAttribute("data-vote", "bot");
    await expect(disc(page, "bleu")).toHaveAttribute("data-vote", "no");
    await expect(disc(page, "jaune")).toHaveAttribute("data-vote", "no");
    await expect(line(page)).toHaveText(/^Revanche\s:\sil faut l’accord de tout le monde\.$/);
    // No quick messages on the plank: its two buttons only, the game behind it inert.
    await expect(plank(page).getByRole("button")).toHaveCount(2);
    await expect(page.locator("[data-layout]")).toHaveAttribute("inert", "");
  }
  await expect(disc(bruno.page, "bleu")).toContainText("Ana, pas encore");
  await expect(disc(bruno.page, "jaune")).toContainText("Toi, pas encore");
  await shot(bruno.page, "annonce");

  // The plank never scrolls, down to a very low phone.
  const own = ana.page.viewportSize();
  for (const size of [
    { width: 750, height: 342 },
    { width: 480, height: 320 },
    { width: 1280, height: 800 },
  ]) {
    await ana.page.setViewportSize(size);
    await ana.page.waitForTimeout(150);
    await expectPlankFits(ana.page);
  }
  if (own !== null) await ana.page.setViewportSize(own);

  // Ana agrees: a check on her button and her disc; Bruno reads « Ana veut une revanche. ».
  await rematch(ana.page).click();
  await expect(rematch(ana.page)).toHaveAttribute("aria-pressed", "true");
  await expect(disc(ana.page, "bleu")).toHaveAttribute("data-vote", "yes");
  await expect(line(ana.page)).toHaveText("Tu es d’accord. En attente de Bruno…");
  await expect(line(bruno.page)).toHaveText("Ana veut une revanche.");
  await expect(disc(bruno.page, "bleu")).toHaveAttribute("data-vote", "yes");
  await shot(ana.page, "accord");
  // A second tap withdraws, a third agrees again.
  await rematch(ana.page).click();
  await expect(line(bruno.page)).toHaveText(/^Revanche\s:\sil faut/);
  await rematch(ana.page).click();
  await expect(line(bruno.page)).toHaveText("Ana veut une revanche.");

  // Bruno agrees: the line for 1 s, the plank closes, a new deal starts at the same seats.
  await rematch(bruno.page).click();
  for (const page of [ana.page, bruno.page]) {
    await expect(line(page)).toHaveText(ALL_AGREE);
  }
  for (const page of [ana.page, bruno.page]) {
    await expect(plank(page)).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5, { timeout: 10_000 });
  }
  await shot(ana.page, "revanche");
  expect(await turnOf(ana.page)).toBe(anaTurn);
  expect(await turnOf(bruno.page)).toBe(brunoTurn);
  for (const page of [ana.page, bruno.page]) {
    await expect(badge(page, "bleu")).toHaveCount(0);
    await expect(badge(page, "jaune")).toHaveCount(0);
  }
  // The new game is played: both exchange a card, the computers too.
  await expect(ana.page.locator("[data-action-zone]")).toHaveAttribute("data-state", "exchange");
  await expect(bruno.page.locator("[data-action-zone]")).toHaveAttribute("data-state", "exchange");
  await ana.context.close();
  await bruno.context.close();
});

test("someone offline at the vote: the rematch starts without them, their seat comes back", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const { id, ana, bruno } = await nearEnd(browser, request, testInfo);
  await win(ana.page, bruno.page);
  // Bruno's page closes (a phone put away): his disc turns to « hors ligne ».
  await bruno.page.close();
  await expect(disc(ana.page, "jaune")).toHaveAttribute("data-vote", "offline");
  await expect(disc(ana.page, "jaune")).toContainText("Bruno, hors ligne");
  // Ana's vote alone starts the rematch; the computer plays Bruno's seat.
  await rematch(ana.page).click();
  await expect(line(ana.page)).toHaveText(ALL_AGREE);
  await expect(plank(ana.page)).toHaveCount(0, { timeout: 10_000 });
  await expect(ana.page.locator("[data-hand] [data-card]")).toHaveCount(5, { timeout: 10_000 });
  await expect(badge(ana.page, "jaune")).toHaveAttribute("data-kind", "bot");
  // Bruno opens the link again on the same device: the seat is his.
  const back = await bruno.context.newPage();
  await back.goto("/");
  await back.goto(`/#/table/${id}?vitesse=test`);
  await expect(back.locator("[data-board]")).toBeVisible();
  await expect(back.locator("[data-toast]")).toContainText("Tu reprends ta place");
  await expect(plank(back)).toHaveCount(0);
  await expect(badge(ana.page, "jaune")).toHaveCount(0);
  await ana.context.close();
  await bruno.context.close();
});

test("« Quitter la table » on the plank: home, off the list, offline for the others", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const { id, ana, bruno } = await nearEnd(browser, request, testInfo);
  await win(ana.page, bruno.page);
  await quit(bruno.page).click();
  await expect(bruno.page).toHaveURL(/#\/$/);
  await expect(bruno.page.locator('[data-home-choice="table"]')).toBeVisible();
  await expect(bruno.page.locator(`[data-table-row="${id}"]`)).toHaveCount(0);
  await expect(disc(ana.page, "jaune")).toHaveAttribute("data-vote", "offline");
  await expect(ana.page.locator(`[data-table-row="${id}"]`)).toHaveCount(0);
  await ana.context.close();
  await bruno.context.close();
});
