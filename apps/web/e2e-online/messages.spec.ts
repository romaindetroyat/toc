import { type Browser, expect, type Page, type TestInfo, test } from "@playwright/test";
import { createTable, deviceOptions, join, seatTile } from "./online.ts";

// The quick messages (plan 02-08, NET-05 as Romain narrowed it, D-07, D-13): « Messages » opens
// « Messages rapides »; one tap sends and closes. The others see a cream bubble for about 4 s above the
// sender's tile in the waiting room, beside the sender's rider in the game, with the sender's first
// name; taps pass through it; the live region reads « Ana : cœur »; a fourth message within 5 s is
// refused with « Doucement : … »; « M » opens the sheet on a computer; « Derniers messages » lists
// « Toi : Aïe ! ». Four bubbles at once never cover a control at the four target sizes.

const toast = (page: Page) => page.locator("[data-toast]");
const bubble = (page: Page, couleur: string) => page.locator(`[data-chat-bubble="${couleur}"]`);
const sheet = (page: Page) => page.getByRole("dialog", { name: "Messages rapides" });
const messagesButton = (page: Page) => page.getByRole("button", { name: "Messages", exact: true });

async function device(browser: Browser, testInfo: TestInfo) {
  const context = await browser.newContext(deviceOptions(testInfo));
  return { context, page: await context.newPage() };
}

/** Opens « Messages rapides » with the button and taps the chip named « Envoyer : {name} ». */
async function send(page: Page, name: RegExp): Promise<void> {
  await messagesButton(page).click();
  await expect(sheet(page)).toBeVisible();
  await sheet(page).getByRole("button", { name }).click();
  await expect(sheet(page)).toHaveCount(0);
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
  await page.screenshot({ path: `${dir}/02-08-${name}-${size.width}x${size.height}.png` });
  if (own !== null && own !== size) {
    await page.setViewportSize(own);
    await page.waitForTimeout(200);
  }
}

/** The controls a bubble must never cover (the same list as the game screen's). */
const CONTROLS = [
  "[data-hand] [data-card]",
  "[data-info-bar]",
  "[data-settings-slot] button",
  "[data-messages-button]",
  "[data-players-button]",
  "[data-action-zone]",
  "[data-action-buttons] button",
  "[data-plate]",
].join(", ");

/** Every visible bubble: inside the board and clear of every control. Returns how many were seen. */
async function expectBubblesClear(page: Page): Promise<number> {
  const result = await page.evaluate((controls) => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    type Box = ReturnType<typeof box>;
    const overlap = (a: Box, b: Box) =>
      a.x < b.x + b.w - 0.5 &&
      b.x < a.x + a.w - 0.5 &&
      a.y < b.y + b.h - 0.5 &&
      b.y < a.y + a.h - 0.5;
    const board = document.querySelector("[data-board]");
    if (board === null) return { count: 0, problems: ["no board"] };
    const b = box(board);
    const problems: string[] = [];
    const bubbles = [...document.querySelectorAll("[data-chat-bubble]")];
    const others = [...document.querySelectorAll(controls)]
      .map((el) => ({ el, r: box(el) }))
      .filter(({ r }) => r.w > 0 && r.h > 0);
    for (const el of bubbles) {
      const r = box(el);
      const name = el.getAttribute("data-chat-bubble");
      if (r.x < b.x - 0.5 || r.y < b.y - 0.5 || r.x + r.w > b.x + b.w + 0.5) {
        problems.push(`${name} outside the board`);
      }
      if (r.y + r.h > b.y + b.h + 0.5) problems.push(`${name} below the board`);
      if (r.w > 160.5) problems.push(`${name} wider than 160`);
      for (const { el: other, r: o } of others) {
        if (overlap(r, o)) problems.push(`${name} over ${other.outerHTML.slice(0, 60)}`);
      }
    }
    return { count: bubbles.length, problems };
  }, CONTROLS);
  expect(result.problems).toEqual([]);
  return result.count;
}

test("quick messages: the room, the game, the bubble, the live region, the pace, « M », the history", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const id = await createTable(request, { pace: "zero" });
  const ana = (await device(browser, testInfo)).page;
  const bruno = (await device(browser, testInfo)).page;

  await join(ana, id, "Ana");
  await seatTile(ana, "bleu").click();
  await expect(seatTile(ana, "bleu")).toHaveAttribute("data-seat-state", "you");
  await join(bruno, id, "Bruno");
  await seatTile(bruno, "jaune").click();
  await expect(seatTile(bruno, "jaune")).toHaveAttribute("data-seat-state", "you");

  // The waiting room: « Messages » after « Réglages »; Bruno sees the bubble above Ana's tile.
  await send(ana, /^Envoyer\s:\sBien joué\s!$/);
  await expect(messagesButton(ana)).toBeFocused();
  await expect(bubble(bruno, "bleu")).toBeVisible();
  await expect(bubble(bruno, "bleu")).toContainText("Ana");
  await expect(bubble(bruno, "bleu")).toContainText(/Bien joué\s!/);
  await expect(bubble(bruno, "bleu")).toHaveAttribute("data-tail", "down");
  const roomFit = await bruno.evaluate(() => {
    const b = document.querySelector('[data-chat-bubble="bleu"]')?.getBoundingClientRect();
    const t = document.querySelector('[data-seat-tile="bleu"]')?.getBoundingClientRect();
    if (!b || !t) return null;
    return { dx: b.left + b.width / 2 - (t.left + t.width / 2), above: b.top < t.top };
  });
  expect(roomFit).not.toBeNull();
  expect(Math.abs(roomFit?.dx ?? 99)).toBeLessThan(2);
  expect(roomFit?.above).toBe(true);
  // Your own bubble carries no name.
  await expect(bubble(ana, "bleu")).toBeVisible();
  await expect(bubble(ana, "bleu")).not.toContainText("Ana");

  // The game. « Avance rapide » never shows online; « Messages » is there instead.
  await ana.getByRole("button", { name: "Lancer la partie" }).click();
  for (const page of [ana, bruno]) {
    await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
    await expect(page.getByRole("button", { name: "Avance rapide" })).toHaveCount(0);
    await expect(messagesButton(page)).toBeVisible();
  }

  await send(ana, /^Envoyer\s:\sAïe\s!$/);
  const sentAt = Date.now();
  await expect(bubble(bruno, "bleu")).toContainText(/Aïe\s!/);
  await expect(bubble(bruno, "bleu")).toContainText("Ana");
  await expect(bubble(bruno, "bleu")).not.toHaveAttribute("data-tail", "down");
  expect(await expectBubblesClear(bruno)).toBeGreaterThanOrEqual(1);
  // A tap at the bubble's centre reaches what is under it.
  const through = await bruno.evaluate(() => {
    const el = document.querySelector('[data-chat-bubble="bleu"]');
    if (el === null) return null;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && !el.contains(hit) && hit.closest("[data-chat-bubble]") === null;
  });
  expect(through).toBe(true);
  await shot(bruno, "bulle");
  // Gone after about 4 s.
  await expect(bubble(bruno, "bleu")).toHaveCount(0, { timeout: 8000 });
  const life = Date.now() - sentAt;
  expect(life).toBeGreaterThan(3500);
  expect(life).toBeLessThan(6500);

  // An emoji: the live region reads it by its name.
  await send(ana, /^Envoyer\s:\scœur$/);
  await expect(bubble(bruno, "bleu")).toContainText("❤️");
  await expect(bruno.locator("[data-chat-live]")).toHaveText(/^\s*Ana\s:\scœur\s*$/);

  // The pace: wait for the window to pass, then four in a row; the fourth is refused.
  await ana.waitForTimeout(5200);
  await send(ana, /^Envoyer\s:\sBravo\s!$/);
  await send(ana, /^Envoyer\s:\sÀ toi\s!$/);
  await send(ana, /^Envoyer\s:\scheval$/);
  await send(ana, /^Envoyer\s:\sPardon…$/);
  await expect(toast(ana)).toHaveText(/Doucement\s:\sattends un peu avant le prochain message\./);
  await expect(bubble(bruno, "bleu")).toContainText("🐴");
  // The toast goes after its 4 s (it would stand over the sheet in the screenshot).
  await expect(toast(ana)).toHaveCount(0, { timeout: 8000 });

  // « M » on a computer; the button on a phone. « Derniers messages »: the newest five, yours « Toi ».
  if (testInfo.project.name === "desktop") {
    await ana.locator("body").click({ position: { x: 2, y: 2 } });
    await ana.keyboard.press("m");
  } else {
    await messagesButton(ana).click();
  }
  await expect(sheet(ana)).toBeVisible();
  const rows = sheet(ana).locator("[data-history-row]");
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText("🐴");
  await expect(rows.nth(4)).toHaveText(/Toi\s:\sAïe\s!/);
  await shot(ana, "feuille");
  await ana.keyboard.press("Escape");
  await expect(sheet(ana)).toHaveCount(0);

  // Bruno's history names Ana.
  await messagesButton(bruno).click();
  await expect(sheet(bruno).locator("[data-history-row]").first()).toHaveText(/Ana\s:\s🐴/);
  await bruno.keyboard.press("Escape");
});

test("four bubbles at once stay clear of every control at the target sizes", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const id = await createTable(request, { pace: "zero" });
  const players = [
    { name: "Ana", couleur: "bleu", emoji: /^Envoyer\s:\srire$/ },
    { name: "Bruno", couleur: "jaune", emoji: /^Envoyer\s:\sMerci partenaire$/ },
    { name: "Céline", couleur: "rouge", emoji: /^Envoyer\s:\sOn y est presque$/ },
    { name: "Dédé", couleur: "vert", emoji: /^Envoyer\s:\ssurprise$/ },
  ];
  const pages: Page[] = [];
  for (const player of players) {
    const page = (await device(browser, testInfo)).page;
    await join(page, id, player.name);
    await seatTile(page, player.couleur).click();
    await expect(seatTile(page, player.couleur)).toHaveAttribute("data-seat-state", "you");
    pages.push(page);
  }
  const [ana] = pages as [Page, ...Page[]];
  await ana.getByRole("button", { name: "Lancer la partie" }).click();
  for (const page of pages) await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);

  for (const size of [
    { width: 844, height: 390 },
    { width: 750, height: 342 },
    { width: 480, height: 320 },
    { width: 1280, height: 800 },
  ]) {
    await ana.setViewportSize(size);
    await ana.waitForTimeout(300);
    for (const [i, player] of players.entries()) await send(pages[i] as Page, player.emoji);
    for (const player of players) await expect(bubble(ana, player.couleur)).toBeVisible();
    // Past the entrance and the measured size.
    await ana.waitForTimeout(250);
    expect(await expectBubblesClear(ana), `${size.width} × ${size.height}`).toBe(4);
    // Let them go before the next size (and the pace window pass).
    await expect(ana.locator("[data-chat-bubble]")).toHaveCount(0, { timeout: 8000 });
    await ana.waitForTimeout(1200);
  }
});
