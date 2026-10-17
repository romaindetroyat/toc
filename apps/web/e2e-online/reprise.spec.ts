import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  expect,
  type Page,
  type TestInfo,
  test,
} from "@playwright/test";
import { exchange, snapshot, zone } from "../e2e/jouer.ts";
import { createTable, deviceOptions, join, knightPlaces, seatTile } from "./online.ts";

// Coming back to the table (plan 02-07, NET-02, HIST-01, SC3, SC4, D-06, D-12), in real browsers
// against `wrangler dev`: a reload and a lost network bring the exact game back (the welcome is the
// only resync); a second tab of the same device takes the seat and the first one reads « Partie
// ouverte ailleurs »; the chef de table stops the game, both devices are closed and reopened from
// their saved storage, the home lists the table « Sauvegardée », and the resumed game is exactly the
// one that was stopped; someone who began in another app gets their own seat back, with the chef de
// table's « Rendre sa place ».

const toast = (page: Page) => page.locator("[data-toast]");
const plate = (page: Page) => page.locator("[data-plate]");
const banner = (page: Page) => page.locator("[data-reconnect-banner]");
const notice = (page: Page) => page.locator("[data-notice]");

type Device = { context: BrowserContext; page: Page };

async function device(
  browser: Browser,
  testInfo: TestInfo,
  extra: BrowserContextOptions = {},
): Promise<Device> {
  const context = await browser.newContext({ ...deviceOptions(testInfo), ...extra });
  return { context, page: await context.newPage() };
}

/** The game as this page shows it: the knights, its own hand (card ids), whose turn it is. */
async function picture(page: Page): Promise<{
  knights: Record<string, string>;
  hand: string[];
  turn: string | null;
}> {
  const hand = await page.evaluate(() =>
    [...document.querySelectorAll("[data-hand] [data-card]")]
      .map((card) => card.getAttribute("data-card") ?? "")
      .sort(),
  );
  const turn = await page.locator("[data-turn]").first().getAttribute("data-turn");
  return { knights: await knightPlaces(page), hand, turn };
}

const stateOf = (page: Page) =>
  zone(page)
    .first()
    .getAttribute("data-state", { timeout: 1000 })
    .catch(() => null);

/**
 * Plays one move of this page, whatever the card: the first playable card, then the first choice of
 * each step (an exit or a move, a tray option, the first knight lit, the largest step of a 7), then
 * « Jouer »; a dead hand is posed.
 */
async function playAny(page: Page): Promise<void> {
  const start = await snapshot(page);
  if (start.state === "deadHand") {
    await page.getByRole("button", { name: "Poser mes cartes" }).click();
    return;
  }
  await page.locator(`[data-hand] [data-card="${start.playable[0]}"]`).click();
  for (let i = 0; i < 200; i++) {
    const now = await snapshot(page);
    if (now.state === "idle" && !now.seven) return;
    if (now.seven) {
      if (now.done) {
        await page.getByRole("button", { name: "Jouer", exact: true }).click();
        return;
      }
      if (now.tray.length > 0) await page.locator("[data-tray-option]").first().click();
      else if (now.chips.length > 0) {
        await page.locator(`[data-seven-chips] [data-step="${Math.max(...now.chips)}"]`).click();
      } else if (now.halos.length > 0) {
        await page.locator(`[data-hit="${now.halos[0]}"]`).click({ force: true });
      } else await page.waitForTimeout(20);
      continue;
    }
    if (now.state === "preview") {
      await page.getByRole("button", { name: /^Jouer/ }).click();
      return;
    }
    if (now.state === "modeChoice") await page.locator("button[data-mode]").first().click();
    else if (now.state === "tray") await page.locator("[data-tray-option]").first().click();
    else if (now.halos.length > 0) {
      await page.locator(`[data-hit="${now.halos[0]}"]`).click({ force: true });
    } else await page.waitForTimeout(20);
  }
  throw new Error("the move never finished");
}

/**
 * Plays forward until it is Ana's turn to play a card: both people give in the exchanges, Bruno plays
 * his turns (a dead hand is posed), the computers play by themselves. The table then waits for Ana.
 */
async function untilAnaTurn(ana: Page, bruno: Page): Promise<void> {
  for (let i = 0; i < 800; i++) {
    const mine = await stateOf(ana);
    if (mine === "idle") return;
    if (mine === "exchange") {
      await exchange(ana);
      continue;
    }
    if (mine === "deadHand") {
      await ana.getByRole("button", { name: "Poser mes cartes" }).click();
      continue;
    }
    const his = await stateOf(bruno);
    if (his === "exchange") await exchange(bruno);
    else if (his === "idle" || his === "deadHand") await playAny(bruno);
    else await ana.waitForTimeout(50);
  }
  throw new Error("Ana's turn never came");
}

/** The game screen is drawn and its action zone has settled. */
async function settled(page: Page): Promise<void> {
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(zone(page).first()).toHaveAttribute("data-state", /./);
  await page.waitForTimeout(600);
}

/**
 * Saves a screenshot when TOC_SHOTS names a directory: the computer's page at its 1280 x 800, a
 * phone's page at 844 x 390.
 */
async function shot(page: Page, name: string): Promise<void> {
  // The specs are typed without Node's types: the environment is read through globalThis.
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?.env;
  const dir = env?.TOC_SHOTS;
  if (!dir) return;
  const own = page.viewportSize();
  const size = own !== null && own.width >= 1000 ? own : { width: 844, height: 390 };
  if (own !== size) await page.setViewportSize(size);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${dir}/02-07-${name}-${size.width}x${size.height}.png` });
  if (own !== null && own !== size) {
    await page.setViewportSize(own);
    await page.waitForTimeout(200);
  }
}

/** Ana (bleu, chef de table) and Bruno (jaune) start a table; the computers play rouge and vert. */
async function startTwo(browser: Browser, testInfo: TestInfo) {
  const ana = await device(browser, testInfo);
  const bruno = await device(browser, testInfo);
  return { ...(await startWith(ana, bruno)), ana, bruno };
}

async function startWith(ana: Device, bruno: Device) {
  const request = ana.context.request;
  const id = await createTable(request, { pace: "zero", pauseMs: 2000 });
  await join(ana.page, id, "Ana");
  await seatTile(ana.page, "bleu").click();
  await expect(seatTile(ana.page, "bleu")).toHaveAttribute("data-seat-state", "you");
  await join(bruno.page, id, "Bruno");
  await seatTile(bruno.page, "jaune").click();
  await expect(seatTile(bruno.page, "jaune")).toHaveAttribute("data-seat-state", "you");
  await ana.page.getByRole("button", { name: "Lancer la partie" }).click();
  for (const page of [ana.page, bruno.page]) {
    await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
  }
  return { id };
}

/** Records, inside the page, every WebSocket close (time and code), before the app opens its socket. */
async function watchSockets(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const closes: { at: number; code: number }[] = [];
    (window as unknown as { __closes: typeof closes }).__closes = closes;
    const Native = window.WebSocket;
    class Watched extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        this.addEventListener("close", (event) =>
          closes.push({ at: Date.now(), code: event.code }),
        );
      }
    }
    window.WebSocket = Watched;
  });
}

test("a reload, a lost network and a second tab bring the exact game back", async ({
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  const ana = await device(browser, testInfo);
  await watchSockets(ana.context);
  const bruno = await device(browser, testInfo);
  const { id } = await startWith(ana, bruno);
  // Ana's turn: the table waits for her, nothing moves.
  await untilAnaTurn(ana.page, bruno.page);
  await settled(ana.page);
  const before = await picture(ana.page);
  expect(before.turn).toBe("bleu");

  // A reload: the welcome gives back the same hand, the same knights, the same turn.
  await ana.page.reload();
  await settled(ana.page);
  expect(await picture(ana.page)).toEqual(before);

  // The network goes: nothing for 2 s, then the banner, then after 10 s the connection plate.
  const offAt = Date.now();
  await ana.context.setOffline(true);
  await ana.page.waitForTimeout(1200);
  await expect(banner(ana.page)).toHaveCount(0);
  await expect(banner(ana.page)).toBeVisible({ timeout: 10_000 });
  const bannerAt = Date.now() - offAt;
  expect(bannerAt).toBeGreaterThanOrEqual(1900);
  await expect(banner(ana.page)).toHaveText("Connexion perdue. Reconnexion…");
  // Under the banner the board and the hand are inert.
  await expect(ana.page.locator(".stage[inert]")).toHaveCount(1);
  await expect(ana.page.locator(".hand[inert]")).toHaveCount(1);
  await shot(ana.page, "bandeau");
  await expect(plate(ana.page)).toHaveAttribute("data-plate", "connection", { timeout: 15_000 });
  const plateAt = Date.now() - offAt;
  expect(plateAt).toBeGreaterThanOrEqual(9_900);
  await expect(plate(ana.page).getByRole("heading")).toHaveText("Connexion perdue");
  await expect(ana.page.getByRole("button", { name: "Réessayer maintenant" })).toBeVisible();
  await expect(ana.page.getByRole("button", { name: "Retour à l’accueil" })).toBeVisible();
  await shot(ana.page, "connexion-perdue");
  // How the drop was found: a close soon after setOffline, or the ping's 5 s without a pong.
  const closes = await ana.page.evaluate(
    () => (window as unknown as { __closes: { at: number; code: number }[] }).__closes,
  );
  const first = closes.find((close) => close.at >= offAt);
  console.log(
    `setOffline: banner after ${bannerAt} ms, plate after ${plateAt} ms; first socket close ${
      first === undefined ? "none" : `after ${first.at - offAt} ms, code ${first.code}`
    }; Bruno sees the pause: ${await plate(bruno.page).count()}`,
  );

  // Back online: « De retour à la table. » and the same game.
  await ana.context.setOffline(false);
  await expect(toast(ana.page)).toHaveText("De retour à la table.", { timeout: 20_000 });
  await expect(plate(ana.page)).toHaveCount(0);
  await expect(banner(ana.page)).toHaveCount(0);
  await settled(ana.page);
  expect(await picture(ana.page)).toEqual(before);

  // A second tab of the same device takes the seat; the first reads « Partie ouverte ailleurs ».
  const second = await ana.context.newPage();
  await second.goto("/");
  await second.goto(`/#/table/${id}?vitesse=test`);
  await settled(second);
  expect(await picture(second)).toEqual(before);
  await expect(notice(ana.page)).toHaveAttribute("data-notice", "ailleurs");
  await expect(ana.page.getByRole("heading", { name: "Partie ouverte ailleurs" })).toBeVisible();
  await shot(ana.page, "ailleurs");
  // « Jouer ici » takes it back: the second tab reads the notice in turn.
  await ana.page.getByRole("button", { name: "Jouer ici" }).click();
  await settled(ana.page);
  expect(await picture(ana.page)).toEqual(before);
  await expect(notice(second)).toHaveAttribute("data-notice", "ailleurs");

  await ana.context.close();
  await bruno.context.close();
});

test("the chef de table stops the game; days later it comes back exactly", async ({
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  const { id, ana, bruno } = await startTwo(browser, testInfo);
  await untilAnaTurn(ana.page, bruno.page);
  await settled(ana.page);
  await settled(bruno.page);
  const anaBefore = await picture(ana.page);
  const brunoBefore = await picture(bruno.page);

  // Bruno is not chef de table: no « Arrêter la partie » in his « Réglages », only « Quitter la table ».
  await bruno.page.locator("[data-settings-slot] button").first().click();
  await expect(bruno.page.locator("[data-stop-game]")).toHaveCount(0);
  await expect(bruno.page.locator("[data-leave-table]")).toBeVisible();
  await expect(bruno.page.locator("[data-abandon]")).toHaveCount(0);
  await bruno.page.keyboard.press("Escape");

  // Ana: « Réglages » → « Arrêter la partie » → « Arrêter la partie ? » → « Arrêter la partie ».
  await ana.page.locator("[data-settings-slot] button").first().click();
  await expect(ana.page.locator("[data-abandon]")).toHaveCount(0);
  await ana.page.locator("[data-stop-game]").click();
  const confirm = ana.page.getByRole("dialog", { name: "Arrêter la partie ?" });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("La partie est sauvegardée pour tout le monde.");
  await expect(confirm.getByRole("button", { name: "Continuer à jouer" })).toBeFocused();
  await shot(ana.page, "arreter");
  await confirm.getByRole("button", { name: "Arrêter la partie" }).click();
  for (const page of [ana.page, bruno.page]) {
    await expect(plate(page)).toHaveAttribute("data-plate", "saved");
    await expect(plate(page).getByRole("heading")).toHaveText("Partie sauvegardée");
  }
  await shot(ana.page, "sauvegardee");

  // Both devices go away; their storage is kept, as a phone keeps it for days.
  const anaState = await ana.context.storageState();
  const brunoState = await bruno.context.storageState();
  await ana.context.close();
  await bruno.context.close();

  // Later: the home lists the table « Sauvegardée ».
  const anaBack = await device(browser, testInfo, { storageState: anaState });
  await anaBack.page.goto("/");
  const row = anaBack.page.locator(`[data-table-row="${id}"]`);
  await expect(row).toContainText("Sauvegardée");
  await expect(row).toContainText("Avec Bruno");
  await shot(anaBack.page, "mes-parties");
  await row.click();
  await expect(plate(anaBack.page)).toHaveAttribute("data-plate", "saved");
  await expect(plate(anaBack.page).locator("[data-saved-absent]")).toContainText("Bruno");

  // Bruno comes back with the same link; Ana resumes.
  const brunoBack = await device(browser, testInfo, { storageState: brunoState });
  await brunoBack.page.goto("/");
  await brunoBack.page.goto(`/#/table/${id}?vitesse=test`);
  await expect(plate(brunoBack.page)).toHaveAttribute("data-plate", "saved");
  await expect(plate(anaBack.page).locator("[data-saved-absent]")).toHaveCount(0);
  await anaBack.page.getByRole("button", { name: "Reprendre la partie" }).click();
  for (const page of [anaBack.page, brunoBack.page]) await expect(plate(page)).toHaveCount(0);
  await settled(anaBack.page);
  await settled(brunoBack.page);
  expect(await picture(anaBack.page)).toEqual(anaBefore);
  expect(await picture(brunoBack.page)).toEqual(brunoBefore);

  // « Quitter la table » in the game: confirmed, home; the game waits for Bruno.
  await brunoBack.page.locator("[data-settings-slot] button").first().click();
  await brunoBack.page.locator("[data-leave-table]").click();
  const leave = brunoBack.page.getByRole("dialog", { name: "Quitter la table ?" });
  await expect(leave).toContainText("La partie se met en pause pour les autres");
  await leave.getByRole("button", { name: "Quitter la table" }).click();
  await expect(brunoBack.page.locator(`[data-table-row="${id}"]`)).toBeVisible();
  await expect(plate(anaBack.page)).toHaveAttribute("data-plate", /pause|choices/);
  await expect(plate(anaBack.page).getByRole("heading")).toHaveText("En attente de Bruno…");

  await anaBack.context.close();
  await brunoBack.context.close();
});

test("« C’est moi, Bruno »: the chef de table gives the seat back to Bruno's other device", async ({
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  const { id, ana, bruno } = await startTwo(browser, testInfo);
  await untilAnaTurn(ana.page, bruno.page);
  await settled(ana.page);
  await settled(bruno.page);
  const brunoBefore = await picture(bruno.page);
  // Bruno's in-app browser goes away.
  await bruno.page.close();
  await expect(plate(ana.page)).toBeVisible();

  // Another app on Bruno's phone: no storage, he types « Bruno » and opens the link.
  const other = await device(browser, testInfo);
  await other.page.goto("/");
  await other.page.goto(`/#/table/${id}?vitesse=test`);
  const prompt = other.page.locator("[data-name-prompt]");
  await prompt.getByRole("textbox").fill("Bruno");
  await prompt.getByRole("button", { name: "Continuer" }).click();
  await expect(notice(other.page)).toHaveAttribute("data-notice", "commencee");
  await expect(
    other.page.getByRole("heading", { name: "La partie a déjà commencé" }),
  ).toBeVisible();
  await expect(other.page.getByRole("heading", { name: "C’est ta place ?" })).toBeVisible();
  const itsMe = other.page.getByRole("button", { name: "C’est moi, Bruno" });
  await expect(itsMe).toBeVisible();
  await expect(other.page.locator("[data-reclaim-seat]")).toHaveCount(1);
  await shot(other.page, "cest-moi");
  await itsMe.click();
  await expect(notice(other.page)).toHaveAttribute("data-notice", "demande");
  await expect(other.page.getByRole("heading", { name: "Demande envoyée" })).toBeVisible();

  // Ana's dialog: the typed first name quoted, « Refuser » focused. She refuses first.
  const dialog = ana.page.getByRole("dialog", { name: "Rendre sa place à Bruno ?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Quelqu’un qui s’appelle « Bruno » demande la place de Bruno");
  await expect(dialog.getByRole("button", { name: "Refuser" })).toBeFocused();
  await shot(ana.page, "rendre-sa-place");
  await dialog.getByRole("button", { name: "Refuser" }).click();
  await expect(notice(other.page)).toHaveAttribute("data-notice", "refusee");
  await expect(other.page.getByRole("heading", { name: "Demande refusée" })).toBeVisible();
  await shot(other.page, "refusee");

  // He asks again; Ana gives the seat back: the other app plays jaune with jaune's hand.
  await other.page.reload();
  await expect(other.page.getByRole("button", { name: "C’est moi, Bruno" })).toBeVisible();
  await other.page.getByRole("button", { name: "C’est moi, Bruno" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Rendre sa place" }).click();
  await expect(dialog).toHaveCount(0);
  await settled(other.page);
  await expect(other.page.locator("[data-board]")).toHaveAttribute("data-bottom", "jaune");
  expect(await picture(other.page)).toEqual(brunoBefore);
  await expect(plate(ana.page)).toHaveCount(0);

  // The first device's old token no longer holds the seat.
  const old = await bruno.context.newPage();
  await old.goto("/");
  await old.goto(`/#/table/${id}?vitesse=test`);
  await expect(notice(old)).toHaveAttribute("data-notice", "commencee");
  await expect(old.locator("[data-reclaim-seat]")).toHaveCount(0);

  await ana.context.close();
  await bruno.context.close();
  await other.context.close();
});
