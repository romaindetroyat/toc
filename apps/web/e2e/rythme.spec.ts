import { expect, type Page, test } from "@playwright/test";
import { exchange, playSimpleMove, untilOwnTurn, zone } from "./jouer.ts";

// The natural pace of the computer players (D-11, D-13, BOT-05; 03-UI-SPEC « Bot pacing »): a think
// fits its move, the search's time counts inside it, « Avance rapide » shortens it, and it never lasts
// more than a few seconds. Measured in the browser: the time the action zone says « … réfléchit… ».

const KEY = "toc.settings.v1";
const SEED = "1234567890abcdef1234567890abcdef";

type Think = { name: string; start: number; end: number | null };

/** Records every interval during which the action zone says that a computer player is thinking. */
function thinkRecorder(): void {
  const thinks: { name: string; start: number; end: number | null }[] = [];
  (window as unknown as { __thinks: typeof thinks }).__thinks = thinks;
  let current: string | null = null;
  const look = () => {
    const text = document.querySelector("[data-action-zone]")?.textContent ?? "";
    const found = /(\S+) réfléchit/.exec(text)?.[1] ?? null;
    if (found === current) return;
    const now = performance.now();
    const open = thinks.at(-1);
    if (current !== null && open !== undefined && open.end === null) open.end = now;
    if (found !== null) thinks.push({ name: found, start: now, end: null });
    current = found;
  };
  const start = () => {
    new MutationObserver(look).observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    look();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
}

async function thinks(page: Page): Promise<Think[]> {
  return page.evaluate(() => (window as unknown as { __thinks: Think[] }).__thinks);
}

/** Opens the seeded game at its natural pace, with the stored settings given. */
async function open(page: Page, stored: Record<string, unknown>): Promise<void> {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    KEY,
    JSON.stringify(stored),
  ] as const);
  await page.addInitScript(thinkRecorder);
  await page.goto("/");
  await page.goto(`/#/partie?graine=${SEED}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

/** Passes a card, then reaches the player's turn twice, playing one simple move in between. */
async function playTwoTurns(page: Page): Promise<void> {
  await exchange(page);
  await untilOwnTurn(page);
  await playSimpleMove(page);
  await untilOwnTurn(page);
  await expect(zone(page)).toHaveAttribute("data-state", /^(idle|finishedPrompt)$/);
}

function closed(all: Think[]): { name: string; ms: number }[] {
  return all.flatMap((t) => (t.end === null ? [] : [{ name: t.name, ms: t.end - t.start }]));
}

test("rythme : à vitesse normale, l’ordinateur réfléchit selon le coup, jamais plus de 2,6 s", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await open(page, {});
  await playTwoTurns(page);
  const measured = closed(await thinks(page));
  // The zone words the thinking in the play phase: at least the three bots between the two turns.
  expect(measured.length).toBeGreaterThanOrEqual(3);
  for (const think of measured) expect(think.ms, think.name).toBeLessThanOrEqual(2600);
  expect(Math.max(...measured.map((t) => t.ms))).toBeGreaterThanOrEqual(300);
});

test("rythme : en « Avance rapide », l’ordinateur réfléchit presque aussitôt, jamais plus de 0,7 s", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await open(page, { fast: true });
  await playTwoTurns(page);
  const measured = closed(await thinks(page));
  expect(measured.length).toBeGreaterThanOrEqual(3);
  for (const think of measured) expect(think.ms, think.name).toBeLessThanOrEqual(700);
});
