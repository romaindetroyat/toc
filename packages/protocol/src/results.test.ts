// The answer of GET /api/me/results (plan 05-01): a valid page is read as is; an extra key anywhere, a
// fifth seat, a level out of 1..5 or a malformed cursor makes the whole answer unreadable.

import { describe, expect, it } from "vitest";
import { HISTORY_CURSOR_RE, type HistoryPage, parseHistoryPage } from "./index.ts";

const seat = (colour: string, kind: string, name: string, level: number | null = null) => ({
  colour,
  kind,
  name,
  level,
  handedOver: false,
  captured: 0,
  lost: 0,
  home: 0,
});

const HASH = "A".repeat(43);

function page(): HistoryPage {
  return {
    games: [
      {
        id: `${HASH}:1`,
        kind: "online",
        startedAt: 1_000,
        endedAt: 2_000,
        winner: "bleu-rouge",
        mine: "bleu",
        seats: [
          { ...seat("bleu", "me", "Anaïs"), home: 4, captured: 2 },
          seat("jaune", "account", "Bruno"),
          { ...seat("rouge", "guest", "Mamie"), home: 4 },
          seat("vert", "bot", "Ourasi", 4),
        ],
        deals: 3,
        creator: "Anaïs",
        ranked: true,
      },
    ],
    next: `2000:${HASH}:1`,
  } as HistoryPage;
}

describe("HistoryPage", () => {
  it("reads a valid page", () => {
    expect(parseHistoryPage(page())).toEqual(page());
    expect(parseHistoryPage({ games: [], next: null })).toEqual({ games: [], next: null });
  });

  it("refuses an extra key on the page, a game or a seat", () => {
    expect(parseHistoryPage({ ...page(), more: 1 })).toBeNull();
    const game = page();
    expect(parseHistoryPage({ ...game, games: [{ ...game.games[0], account: "x" }] })).toBeNull();
    const withId = page();
    (withId.games[0]?.seats[1] as Record<string, unknown>).account = "secret-id";
    expect(parseHistoryPage(withId)).toBeNull();
  });

  it("refuses a fifth seat, a level 9 and an unknown seat kind", () => {
    const five = page() as unknown as { games: { seats: unknown[] }[] };
    five.games[0]?.seats.push(seat("bleu", "bot", "Extra", 1));
    expect(parseHistoryPage(five)).toBeNull();
    const nine = page();
    (nine.games[0]?.seats[3] as { level: number }).level = 9;
    expect(parseHistoryPage(nine)).toBeNull();
    const kind = page();
    (kind.games[0]?.seats[2] as { kind: string }).kind = "invite";
    expect(parseHistoryPage(kind)).toBeNull();
  });

  it("refuses a malformed cursor and more than 20 games", () => {
    expect(parseHistoryPage({ ...page(), next: "soon" })).toBeNull();
    const many = page();
    const one = many.games[0];
    if (one === undefined) throw new Error("no game");
    expect(
      parseHistoryPage({ games: Array.from({ length: 21 }, () => one), next: null }),
    ).toBeNull();
  });

  it("the cursor: an end time, a colon, an online or a solo game id", () => {
    expect(HISTORY_CURSOR_RE.test(`1730000000000:${HASH}:12`)).toBe(true);
    expect(
      HISTORY_CURSOR_RE.test(
        "1730000000000:solo:AAAAAAAAAAAAAAAAAAAAAA:0c7e6f7a-1b2c-4d5e-8f90-1234567890ab",
      ),
    ).toBe(true);
    for (const bad of [
      "",
      "12",
      ":x:1",
      "12:x",
      "x:abc:1",
      "12:a b:1",
      "12:a:1:2:3",
      `12:${HASH};1`,
    ]) {
      expect(HISTORY_CURSOR_RE.test(bad)).toBe(false);
    }
  });
});
