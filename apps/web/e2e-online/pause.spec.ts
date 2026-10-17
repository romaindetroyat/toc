import {
  type Browser,
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from "@playwright/test";
import { exchange, zone } from "../e2e/jouer.ts";
import { createTable, deviceOptions, join, playOneMove, seatTile } from "./online.ts";

// A player drops out (plan 02-06, NET-03, NET-04, D-04, D-05): the game pauses for everyone with
// « En attente de … » and a countdown; after the minute (2 s under the test option) the chef de table
// chooses: hand the seat to the computer (it plays on, a bot badge on the rider), and the player gets
// the seat back on return; when the creator is the one missing, the next player is chef de table and
// may save the game; the creator comes back and resumes it. The plate fits the target sizes.

const toast = (page: Page) => page.locator("[data-toast]");
const plate = (page: Page) => page.locator("[data-plate]");
const badge = (page: Page, couleur: string) => page.locator(`[data-seat-badge="${couleur}"]`);

async function device(browser: Browser, testInfo: TestInfo) {
  const context = await browser.newContext(deviceOptions(testInfo));
  return { context, page: await context.newPage() };
}

/** Opens « À la table »: the computer's button, or the phone's info pill and its sheet. */
async function openPlayers(page: Page): Promise<Locator> {
  const button = page.locator("[data-players-button]");
  if ((await button.count()) > 0) {
    await button.click();
    return page.getByRole("dialog", { name: "À la table" });
  }
  await page.locator('[data-info-bar][data-form="pill"]').click();
  return page.getByRole("dialog", { name: "Infos de la partie" });
}

/** Plays forward until it is this page's turn (exchanges and dead hands on the way). */
async function untilTurn(page: Page): Promise<void> {
  for (let i = 0; i < 600; i++) {
    const state = await zone(page)
      .first()
      .getAttribute("data-state", { timeout: 1000 })
      .catch(() => null);
    if (state === "idle" || state === "finishedPrompt" || state === "deadHand") return;
    if (state === "exchange") await exchange(page);
    else await page.waitForTimeout(50);
  }
  throw new Error("the turn never came");
}

/**
 * Saves a screenshot when TOC_SHOTS names a directory (the plan's visual check): the computer's page
 * at its 1280 x 800, a phone's page at 844 x 390 (then back to its own size).
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
  await page.screenshot({ path: `${dir}/02-06-${name}-${size.width}x${size.height}.png` });
  if (own !== null && own !== size) {
    await page.setViewportSize(own);
    await page.waitForTimeout(200);
  }
}

/** The plate is never wider than the board and stays inside the viewport. */
async function expectPlateFits(page: Page): Promise<void> {
  await expect(plate(page)).toBeVisible();
  // The plate settles after its 200 ms entrance and the board's resize.
  await page.waitForTimeout(400);
  const fit = await page.evaluate(() => {
    const plateBox = document.querySelector("[data-plate]")?.getBoundingClientRect();
    const board = document.querySelector("[data-board]")?.getBoundingClientRect();
    if (!plateBox || !board) return null;
    return {
      plate: {
        left: plateBox.left,
        right: plateBox.right,
        top: plateBox.top,
        bottom: plateBox.bottom,
        width: plateBox.width,
      },
      board: board.width,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
  if (fit === null) throw new Error("no plate or no board");
  expect(fit.plate.width).toBeLessThanOrEqual(Math.min(440, fit.board - 16) + 0.5);
  expect(fit.plate.left).toBeGreaterThanOrEqual(0);
  expect(fit.plate.top).toBeGreaterThanOrEqual(0);
  expect(fit.plate.right).toBeLessThanOrEqual(fit.vw);
  expect(fit.plate.bottom).toBeLessThanOrEqual(fit.vh);
}

test("a player drops out: pause, hand-over, return, the chef de table passes, save and resume", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(240_000);
  const id = await createTable(request, { pace: "zero", pauseMs: 2000 });
  const anaDevice = await device(browser, testInfo);
  const brunoDevice = await device(browser, testInfo);
  let ana = anaDevice.page;
  let bruno = brunoDevice.page;

  await join(ana, id, "Ana");
  await seatTile(ana, "bleu").click();
  await expect(seatTile(ana, "bleu")).toHaveAttribute("data-seat-state", "you");
  await join(bruno, id, "Bruno");
  await seatTile(bruno, "jaune").click();
  await expect(seatTile(bruno, "jaune")).toHaveAttribute("data-seat-state", "you");
  await ana.getByRole("button", { name: "Lancer la partie" }).click();
  for (const page of [ana, bruno]) {
    await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
  }
  await exchange(ana);
  await exchange(bruno);

  // Bruno's page closes: Ana sees the pause, the countdown, the badge and « hors ligne ».
  await bruno.close();
  await expect(plate(ana)).toHaveAttribute("data-plate", "pause");
  await expect(plate(ana).getByRole("heading")).toHaveText("En attente de Bruno…");
  await expect(plate(ana)).toContainText("La partie est en pause jusqu’à son retour.");
  await expect(ana.locator("[data-countdown]")).toHaveText(
    /^Dans 0:0\d, tu pourras choisir la suite\.$/,
  );
  await expect(ana.locator("[data-paused-prompt]")).toHaveText("Partie en pause");
  await expect(badge(ana, "jaune")).toHaveAttribute("data-kind", "wifi-off");
  await expect(badge(ana, "bleu")).toHaveCount(0);
  await expect(badge(ana, "rouge")).toHaveCount(0);
  // Under the plate the board and the hand are inert.
  await expect(ana.locator(".stage[inert]")).toHaveCount(1);
  await expect(ana.locator(".hand[inert]")).toHaveCount(1);
  await shot(ana, "pause");

  // After the minute (2 s), Ana gets the three choices.
  await expect(plate(ana)).toHaveAttribute("data-plate", "choices", { timeout: 10_000 });
  await expect(plate(ana)).toContainText("Bruno n’est pas de retour. Que veux-tu faire");
  const wait = ana.getByRole("button", { name: "Attendre encore une minute" });
  await expect(wait).toBeFocused();
  await expect(ana.getByRole("button", { name: "Sauvegarder et arrêter" })).toBeVisible();
  await shot(ana, "choix");
  // « À la table » stays usable under the plate: Bruno is « hors ligne », Ana the chef de table.
  const players = await openPlayers(ana);
  await expect(players.locator('[data-player="jaune"]')).toContainText("hors ligne");
  await expect(players.locator('[data-player="bleu"]')).toContainText("toi");
  await expect(players.locator('[data-player="bleu"]')).toContainText("chef de table");
  await expect(players.locator('[data-player="rouge"]')).toContainText(/ordinateur · /);
  await ana.keyboard.press("Escape");
  await expect(players).toHaveCount(0);
  await ana.getByRole("button", { name: "Confier sa place à l’ordinateur" }).click();
  await expect(plate(ana)).toHaveAttribute("data-plate", "level");
  const strength = ana.getByRole("radiogroup", { name: /Quelle force pour l’ordinateur/ });
  await expect(strength.getByRole("radio", { name: "Galopeur" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await shot(ana, "force");
  await strength.getByRole("radio", { name: "Pur-sang" }).click();
  await ana.getByRole("button", { name: "Confier la place" }).click();
  await expect(plate(ana)).toHaveCount(0);
  await expect(toast(ana)).toHaveText("L’ordinateur joue pour Bruno jusqu’à son retour.");
  await expect(badge(ana, "jaune")).toHaveAttribute("data-kind", "bot");
  // The game goes on: Ana plays, then her turn comes back after the computers (Bruno's seat too).
  await untilTurn(ana);
  await playOneMove(ana);
  await untilTurn(ana);
  const handedList = await openPlayers(ana);
  await expect(handedList.locator('[data-player="jaune"]')).toContainText(
    "hors ligne · l’ordinateur joue à sa place (Pur-sang)",
  );
  await ana.keyboard.press("Escape");

  // Bruno opens the link again: his seat, his own hand, at once.
  bruno = await brunoDevice.context.newPage();
  await bruno.goto("/");
  await bruno.goto(`/#/table/${id}?vitesse=test`);
  await expect(bruno.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(toast(bruno)).toHaveText(
    "Tu reprends ta place. L’ordinateur a joué pour toi pendant ton absence.",
  );
  await expect(toast(ana)).toHaveText("Bruno reprend sa place.");
  await expect(badge(ana, "jaune")).toHaveCount(0);
  // His own seat at the bottom of his board, his own view (his hand may be empty when the computer
  // posed it: then the next deal brings it).
  await expect(bruno.locator("[data-board]")).toHaveAttribute("data-bottom", "jaune");
  await expect(bruno.locator("[data-hand]")).toBeVisible();

  // Ana's page closes: Bruno is chef de table until she returns, and gets the choices.
  await ana.close();
  await expect(plate(bruno)).toBeVisible();
  await expect(plate(bruno).getByRole("heading")).toHaveText("En attente d’Ana…");
  await expect(toast(bruno)).toHaveText("Tu es chef de table jusqu’au retour d’Ana.");
  await expect(plate(bruno)).toHaveAttribute("data-plate", "choices", { timeout: 10_000 });
  await bruno.getByRole("button", { name: "Sauvegarder et arrêter" }).click();
  await expect(plate(bruno)).toHaveAttribute("data-plate", "saved");
  await expect(plate(bruno).getByRole("heading")).toHaveText("Partie sauvegardée");
  await expect(plate(bruno).locator("[data-saved-present]")).toHaveText(/^À la table\s: Bruno\.$/);
  await expect(plate(bruno).locator("[data-saved-absent]")).toHaveText(/^Pas encore là\s: Ana\.$/);
  await shot(bruno, "sauvegardee");

  // The saved plate fits the target sizes (never wider than the board, inside the viewport).
  const original = bruno.viewportSize();
  for (const size of [
    { width: 480, height: 320 },
    { width: 750, height: 342 },
    { width: 1280, height: 800 },
  ]) {
    await bruno.setViewportSize(size);
    await expectPlateFits(bruno);
  }
  if (original !== null) await bruno.setViewportSize(original);

  // Ana comes back: « Reprendre la partie » is hers again; she resumes and the game goes on.
  ana = await anaDevice.context.newPage();
  await ana.goto("/");
  await ana.goto(`/#/table/${id}?vitesse=test`);
  await expect(plate(ana)).toHaveAttribute("data-plate", "saved");
  await expect(toast(bruno)).toHaveText("Ana est de retour et redevient chef de table.");
  await expect(plate(bruno)).toContainText("Ana peut reprendre la partie.");
  await expect(bruno.getByRole("button", { name: "Reprendre la partie" })).toHaveCount(0);
  await ana.getByRole("button", { name: "Reprendre la partie" }).click();
  await expect(plate(ana)).toHaveCount(0);
  await expect(plate(bruno)).toHaveCount(0);
  // The game runs again: the action zone is back on both screens.
  await expect(zone(ana)).not.toHaveCount(0);
  await expect(zone(bruno)).not.toHaveCount(0);

  await anaDevice.context.close();
  await brunoDevice.context.close();
});

test("the plates fit the target sizes and the computer's bar stays 160 px", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const id = await createTable(request, { pace: "zero", pauseMs: 60_000 });
  const anaDevice = await device(browser, testInfo);
  const brunoDevice = await device(browser, testInfo);
  const ana = anaDevice.page;
  const bruno = brunoDevice.page;
  await join(ana, id, "Ana");
  await seatTile(ana, "bleu").click();
  await join(bruno, id, "Bruno");
  await seatTile(bruno, "jaune").click();
  await expect(seatTile(bruno, "jaune")).toHaveAttribute("data-seat-state", "you");
  await ana.getByRole("button", { name: "Lancer la partie" }).click();
  await expect(ana.locator("[data-hand] [data-card]")).toHaveCount(5);
  await bruno.close();
  await expect(plate(ana)).toHaveAttribute("data-plate", "pause");
  // The 30 % walnut veil covers the board only.
  const veil = await ana.evaluate(() => {
    const element = document.querySelector("[data-plate-veil]");
    const board = document.querySelector("[data-board]")?.getBoundingClientRect();
    if (!element || !board) return null;
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      dx: Math.abs(box.left - board.left) + Math.abs(box.width - board.width),
      background: style.backgroundColor,
      opacity: style.opacity,
      z: style.zIndex,
    };
  });
  console.log(`veil: ${JSON.stringify(veil)}`);
  expect(veil?.dx).toBeLessThan(1);
  for (const size of [
    { width: 480, height: 320 },
    { width: 750, height: 342 },
    { width: 844, height: 390 },
    { width: 1280, height: 800 },
  ]) {
    await ana.setViewportSize(size);
    await expectPlateFits(ana);
  }
  // The computer's bar with its fourth row: at most 160 px, and the board keeps its width.
  for (const size of [
    { width: 1280, height: 800 },
    { width: 1024, height: 640 },
  ]) {
    await ana.setViewportSize(size);
    await expect(ana.locator("[data-players-button]")).toBeVisible();
    const measured = await ana.evaluate(() => ({
      info: document.querySelector('[data-info-bar][data-form="column"]')?.getBoundingClientRect()
        .height,
      board: document.querySelector("[data-board]")?.getBoundingClientRect().width,
    }));
    console.log(
      `bar at ${size.width} x ${size.height}: info column ${measured.info} px, board ${measured.board} px`,
    );
    expect(measured.info).toBeLessThanOrEqual(160);
    if (size.width === 1280) expect(Math.round(measured.board ?? 0)).toBe(1227);
  }
  await anaDevice.context.close();
  await brunoDevice.context.close();
});
