import {
  type APIRequestContext,
  type BrowserContextOptions,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { type GameStats, newStats, playSimpleMove, playStep, snapshot } from "../e2e/jouer.ts";

// Shared helpers of the online specs: a table created through the Worker, a browser that opens its link
// and types a first name, the seat tiles of the waiting room.

/** The test options of a new table: the computers' pace, and their levels by colour (Champion 5). */
export type TableTest = {
  pace: "zero" | "normal";
  levels?: Partial<Record<"bleu" | "jaune" | "rouge" | "vert", 1 | 2 | 3 | 4 | 5>>;
  /** The pause's minute, shortened (plan 02-06). */
  pauseMs?: number;
  /** The first game starts from this position instead of a deal (plan 02-09, a scenario's before). */
  before?: unknown;
};

/**
 * A near-end table (plan 02-09): bleu's 5 brings the eighth knight of bleu-rouge home (R-16.1 seen
 * from bleu's side); the dealer is vert, so the rematch's dealer is bleu.
 */
export const NEAR_END = {
  pawns: {
    bleu: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 66 }],
    rouge: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
  },
  hands: { bleu: ["5S"] },
  turn: "bleu",
};

/** POST /api/tables; `test` is honoured because `wrangler dev` runs with TOC_TEST_MODE=1. */
export async function createTable(
  request: APIRequestContext,
  test: TableTest = { pace: "zero" },
): Promise<string> {
  const response = await request.post("/api/tables", { data: { test } });
  expect(response.status()).toBe(201);
  const { id } = (await response.json()) as { id: string };
  expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  return id;
}

/** The project's device settings, for a new browser context (its own storage, so its own device). */
export function deviceOptions(testInfo: TestInfo): BrowserContextOptions {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } =
    testInfo.project.use;
  return { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL };
}

export const seatTile = (page: Page, couleur: string) =>
  page.locator(`[data-seat-tile="${couleur}"]`);

/** Opens the table's link (test pace), types the first name once, and waits for the waiting room. */
export async function join(page: Page, id: string, name: string): Promise<void> {
  await page.goto("/");
  await page.goto(`/#/table/${id}?vitesse=test`);
  const prompt = page.locator("[data-name-prompt]");
  await expect(prompt).toBeVisible();
  await prompt.getByRole("textbox").fill(name);
  await prompt.getByRole("button", { name: "Continuer" }).click();
  await expect(seatTile(page, "bleu")).toBeVisible();
}

/**
 * Where every knight stands, by its logical place (the same on every screen, whatever its turn), in
 * knight order: each board draws its knights in its own front-to-back order.
 */
export function knightPlaces(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll("[data-pawn]")]
        .map((knight) => [
          knight.getAttribute("data-pawn") ?? "",
          knight.getAttribute("data-place") ?? "",
        ])
        .sort(([a], [b]) => (a as string).localeCompare(b as string)),
    ),
  );
}

/** What the felt shows: the face-up cards (played, posed) and the size of the discard pile. */
export function feltCards(page: Page): Promise<{ cards: string[]; discard: string | null }> {
  return page.evaluate(() => ({
    cards: [...document.querySelectorAll("[data-felt-card]")]
      .map((card) => card.getAttribute("data-felt-card") ?? "")
      .sort(),
    discard: document.querySelector("[data-discard]")?.getAttribute("data-discard") ?? null,
  }));
}

/** The whole table as one comparable text: the knights and the felt. */
export async function tablePicture(page: Page): Promise<string> {
  return JSON.stringify({ knights: await knightPlaces(page), felt: await feltCards(page) });
}

/** Plays one move of the page whose turn it is: a simple card, else the first playable thing. */
export async function playOneMove(page: Page): Promise<void> {
  const s = await snapshot(page);
  if (s.state === "deadHand") {
    await page.getByRole("button", { name: "Poser mes cartes" }).click();
    return;
  }
  const simple = page.locator(
    '[data-hand] [data-state="playable"]:not([data-card^="7"]):not([data-card^="11"])',
  );
  if ((await simple.count()) > 0) {
    await playSimpleMove(page);
    return;
  }
  // Only a 7 or a Valet: take it through to « Jouer », the first knight and the largest step each time.
  await page.locator(`[data-hand] [data-card="${s.playable[0]}"]`).click();
  for (let i = 0; i < 200; i++) {
    const now = await snapshot(page);
    if (now.state !== "sevenBuilding" && now.state !== "cardSelected" && !now.seven) {
      if (now.state === "preview") {
        await page.getByRole("button", { name: /^Jouer/ }).click();
        return;
      }
      if (now.state === "modeChoice") await page.locator("button[data-mode]").first().click();
      else if (now.state === "tray") await page.locator("[data-tray-option]").first().click();
      else if (now.halos.length > 0)
        await page.locator(`[data-hit="${now.halos[0]}"]`).click({ force: true });
      else await page.waitForTimeout(20);
      continue;
    }
    if (now.done) {
      await page.getByRole("button", { name: "Jouer", exact: true }).click();
      return;
    }
    if (now.tray.length > 0) await page.locator("[data-tray-option]").first().click();
    else if (now.chips.length > 0)
      await page.locator(`[data-seven-chips] [data-step="${Math.max(...now.chips)}"]`).click();
    else if (now.halos.length > 0)
      await page.locator(`[data-hit="${now.halos[0]}"]`).click({ force: true });
    else await page.waitForTimeout(20);
  }
  throw new Error("the move never finished");
}

export type Seat = "bleu" | "jaune" | "rouge" | "vert";
export type Frame = { [key: string]: unknown; t: string };
/** A frame a page received, with the seat that page held when it came. */
export type Received = { seat: Seat | null; text: string; frame: Frame };

/** Every frame the page receives on its table socket, with the seat the page holds at that time. */
export function listenFrames(page: Page, seat: () => Seat | null): Received[] {
  const received: Received[] = [];
  page.on("websocket", (ws) => {
    if (!ws.url().includes("/ws/table/")) return;
    ws.on("framereceived", ({ payload }) => {
      const text = typeof payload === "string" ? payload : payload.toString("utf8");
      // The heartbeat answer of the runtime (setWebSocketAutoResponse) is not a frame.
      if (text === "pong") return;
      received.push({ seat: seat(), text, frame: JSON.parse(text) as Frame });
    });
  });
  return received;
}

/**
 * Four people at one table (plan 02-10): every page passes its card at each deal, and whichever page
 * has something to tap taps it (jouer.ts's plainest player: the first card, the first knight, the
 * most steps of a 7, a dead hand posed), until every page shows the end plank. The server deals and
 * judges every move. Throws after `capMs`.
 */
export async function playTogether(
  pages: Page[],
  capMs = 15 * 60_000,
): Promise<{ stats: GameStats[]; taps: number; ms: number }> {
  const stats = pages.map(() => newStats());
  const started = Date.now();
  let taps = 0;
  for (;;) {
    if (Date.now() - started > capMs) throw new Error(`the game did not end within ${capMs} ms`);
    let ended = 0;
    let acted = false;
    for (const [i, page] of pages.entries()) {
      const s = await snapshot(page);
      if (s.end) {
        ended += 1;
        continue;
      }
      if (await playStep(page, s, stats[i] as GameStats)) {
        taps += 1;
        acted = true;
      }
    }
    if (ended === pages.length) return { stats, taps, ms: Date.now() - started };
    if (!acted) await (pages[0] as Page).waitForTimeout(20);
  }
}
