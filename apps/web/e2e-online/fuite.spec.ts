import { expect, type Page, test } from "@playwright/test";
import { cardIdsIn, structuralProblems } from "../../../packages/table/src/oracle.ts";
import { exchange, zone } from "../e2e/jouer.ts";
import { createTable, deviceOptions, join, playOneMove, seatTile } from "./online.ts";

// « En examinant les messages reçus par son appareil » (SC2, RULE-19): two browsers at one table play
// the exchange and three human turns, and every WebSocket frame each page receives (Playwright's
// framereceived) is checked with the structural part of the leak oracle (packages/table/src/oracle.ts,
// the @toc/table/oracle subpath of the server tests): handDealt shows only that page's cards,
// cardsExchanged only that page's card, no GameState key, codes-only errors. Then the two devices are
// compared: at the same seq, no card of one page's hand appears in the other page's frame unless a
// public event of that frame announces it (a card played, a dead hand laid down).

type Frame = { [key: string]: unknown; t: string };
type Received = { seat: "bleu" | "jaune" | null; text: string; frame: Frame };

/** Every frame the page receives on its table socket, with the seat the page holds at that time. */
function listen(page: Page, seat: () => "bleu" | "jaune" | null): Received[] {
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

/** The highest seq a page has received (events or welcome), 0 before the game. */
function lastSeq(frames: Received[]): number {
  let seq = 0;
  for (const { frame } of frames) {
    if ((frame.t === "events" || frame.t === "welcome") && typeof frame.seq === "number") {
      seq = Math.max(seq, frame.seq);
    }
  }
  return seq;
}

/** The hand a page held at `seq`, from its own frame for that seq. */
function handAt(frames: Received[], seq: number): string[] | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const { frame } = frames[i] as Received;
    const view = frame.view as { hand?: string[] } | null | undefined;
    if ((frame.t === "events" || frame.t === "welcome") && frame.seq === seq && view?.hand) {
      return view.hand;
    }
  }
  return null;
}

/** The cards a frame's own public events announce. */
function announced(frame: Frame): Set<string> {
  const cards = new Set<string>();
  if (frame.t !== "events" || !Array.isArray(frame.events)) return cards;
  for (const event of frame.events as { t: string; card?: string; cards?: string[] }[]) {
    if (event.t === "cardPlayed" && event.card) cards.add(event.card);
    if (event.t === "handDiscarded") for (const card of event.cards ?? []) cards.add(card);
  }
  return cards;
}

test("each device receives only its own cards, from the deal through three human turns", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const id = await createTable(request, { pace: "zero" });
  const anaDevice = await browser.newContext(deviceOptions(testInfo));
  const benDevice = await browser.newContext(deviceOptions(testInfo));
  const ana = await anaDevice.newPage();
  const ben = await benDevice.newPage();
  let anaSeat: "bleu" | null = null;
  let benSeat: "jaune" | null = null;
  const anaFrames = listen(ana, () => anaSeat);
  const benFrames = listen(ben, () => benSeat);

  await join(ana, id, "Ana");
  await join(ben, id, "Ben");
  anaSeat = "bleu";
  await seatTile(ana, "bleu").click();
  await expect(seatTile(ana, "bleu")).toHaveAttribute("data-seat-state", "you");
  benSeat = "jaune";
  await seatTile(ben, "jaune").click();
  await expect(seatTile(ben, "jaune")).toHaveAttribute("data-seat-state", "you");
  await ana.getByRole("button", { name: "Lancer la partie" }).click();
  for (const page of [ana, ben]) {
    await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
  }

  await exchange(ana);
  await exchange(ben);

  // Three human turns, whoever's they are; the computers play by themselves in between.
  // A new deal on the way is handled too (its exchange is passed, not counted as a turn).
  const pages: [Page, Received[]][] = [
    [ana, anaFrames],
    [ben, benFrames],
  ];
  let turns = 0;
  for (let i = 0; i < 1200 && turns < 3; i++) {
    let moved = false;
    for (const [page, frames] of pages) {
      const state = await zone(page).getAttribute("data-state");
      if (state === "exchange") {
        // A new deal (dead hands can end one in a few turns): pass a card again.
        await exchange(page);
        moved = true;
        break;
      }
      if (state !== "idle" && state !== "finishedPrompt" && state !== "deadHand") continue;
      const before = lastSeq(frames);
      await playOneMove(page);
      await expect.poll(() => lastSeq(frames), { timeout: 20_000 }).toBeGreaterThan(before);
      turns += 1;
      moved = true;
      break;
    }
    if (!moved) await ana.waitForTimeout(50);
  }
  expect(turns).toBe(3);
  // Both pages have caught up with the same table.
  await expect.poll(() => lastSeq(anaFrames) === lastSeq(benFrames)).toBe(true);

  // 1. Every frame passes the structural checks for its reader.
  for (const [name, frames] of [
    ["ana", anaFrames],
    ["ben", benFrames],
  ] as const) {
    expect(frames.length, name).toBeGreaterThan(5);
    for (const [index, { seat, frame }] of frames.entries()) {
      expect(structuralProblems(frame, seat), `${name} frame ${index}`).toEqual([]);
    }
  }

  // 2. The deal: each page saw its own five cards and three hidden hands.
  for (const [frames, seat] of [
    [anaFrames, "bleu"],
    [benFrames, "jaune"],
  ] as const) {
    const deal = frames.find(({ frame }) => frame.t === "events" && frame.seq === 1);
    const dealt = (
      (deal?.frame.events ?? []) as { t: string; seat: string; cards: unknown }[]
    ).filter((event) => event.t === "handDealt");
    expect(dealt).toHaveLength(4);
    for (const event of dealt) {
      if (event.seat === seat) expect(event.cards).toHaveLength(5);
      else expect(event.cards).toBeNull();
    }
  }

  // 3. Across the two devices: at the same seq, the other page's hand never shows up.
  let compared = 0;
  for (const [readerFrames, otherFrames] of [
    [anaFrames, benFrames],
    [benFrames, anaFrames],
  ] as const) {
    for (const { text, frame } of readerFrames) {
      if ((frame.t !== "events" && frame.t !== "welcome") || typeof frame.seq !== "number")
        continue;
      const otherHand = handAt(otherFrames, frame.seq);
      if (otherHand === null) continue;
      const open = announced(frame);
      const seen = cardIdsIn(text).filter((card) => otherHand.includes(card) && !open.has(card));
      expect(seen, `seq ${frame.seq}`).toEqual([]);
      compared += 1;
    }
  }
  expect(compared).toBeGreaterThan(5);

  await anaDevice.close();
  await benDevice.close();
});
