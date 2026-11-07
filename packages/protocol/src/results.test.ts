// The answer of GET /api/me/results (plan 05-01): a valid page is read as is; an extra key anywhere, a
// fifth seat, a level out of 1..5 or a malformed cursor makes the whole answer unreadable. Plan 05-05:
// the answers of GET /api/me/stats and GET /api/me/ranking, and the body of POST /api/me/results/solo.

import { describe, expect, it } from "vitest";
import {
  HISTORY_CURSOR_RE,
  type HistoryPage,
  parseHistoryPage,
  parseRankingAnswer,
  parseSoloReport,
  parseStatsAnswer,
  type StatsBlock,
} from "./index.ts";

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

// --- Plan 05-05: « Mes chiffres » (GET /api/me/stats) ---

const block = (): StatsBlock => ({
  games: 3,
  wins: 2,
  captured: 5,
  lost: 4,
  home: 9,
  partners: [
    { kind: "account", name: "Bruno", level: null, games: 1, wins: 1 },
    { kind: "guests", name: null, level: null, games: 1, wins: 0 },
    { kind: "bot", name: null, level: 3, games: 1, wins: 1 },
  ],
  levels: [
    { level: 4, games: 1, wins: 0 },
    { level: 5, games: 1, wins: 1 },
  ],
});

const empty = (): StatsBlock => ({
  games: 0,
  wins: 0,
  captured: 0,
  lost: 0,
  home: 0,
  partners: [],
  levels: [],
});

describe("StatsAnswer", () => {
  it("reads the three filters at once", () => {
    const answer = { all: block(), online: empty(), solo: block() };
    expect(parseStatsAnswer(answer)).toEqual(answer);
  });

  it("refuses a missing filter, an extra key anywhere and an account id on a partner", () => {
    expect(parseStatsAnswer({ all: block(), online: empty() })).toBeNull();
    expect(parseStatsAnswer({ all: block(), online: empty(), solo: empty(), more: 1 })).toBeNull();
    expect(
      parseStatsAnswer({ all: { ...block(), rate: 0.6 }, online: empty(), solo: empty() }),
    ).toBeNull();
    const withId = block();
    (withId.partners[0] as Record<string, unknown>).account = "secret-id";
    expect(parseStatsAnswer({ all: withId, online: empty(), solo: empty() })).toBeNull();
  });

  it("refuses a level 6, an unknown partner kind and more wins than games", () => {
    const six = block();
    (six.levels[0] as { level: number }).level = 6;
    expect(parseStatsAnswer({ all: six, online: empty(), solo: empty() })).toBeNull();
    const kind = block();
    (kind.partners[1] as { kind: string }).kind = "guest";
    expect(parseStatsAnswer({ all: kind, online: empty(), solo: empty() })).toBeNull();
    expect(
      parseStatsAnswer({ all: { ...block(), wins: 4 }, online: empty(), solo: empty() }),
    ).toBeNull();
  });
});

// --- Plan 05-05: the friends ranking (GET /api/me/ranking) ---

const ranking = () => ({
  friends: 4,
  ranked: [
    { rank: 1, pseudo: "Chloé", games: 9, wins: 6, me: false },
    { rank: 2, pseudo: "Anaïs", games: 6, wins: 4, me: true },
  ],
  unranked: [{ pseudo: "Bruno", games: 3, me: false }],
});

describe("RankingAnswer", () => {
  it("reads a ranking, and an empty one", () => {
    expect(parseRankingAnswer(ranking())).toEqual(ranking());
    const none = { friends: 0, ranked: [], unranked: [{ pseudo: "Anaïs", games: 0, me: true }] };
    expect(parseRankingAnswer(none)).toEqual(none);
  });

  it("refuses an id on a row, an extra key, a rank 0 and a ranked row under 5 games", () => {
    const withId = ranking();
    (withId.ranked[0] as Record<string, unknown>).id = "secret-id";
    expect(parseRankingAnswer(withId)).toBeNull();
    expect(parseRankingAnswer({ ...ranking(), more: 1 })).toBeNull();
    const zero = ranking();
    (zero.ranked[0] as { rank: number }).rank = 0;
    expect(parseRankingAnswer(zero)).toBeNull();
    const few = ranking();
    (few.ranked[1] as { games: number }).games = 4;
    expect(parseRankingAnswer(few)).toBeNull();
    const many = ranking();
    (many.unranked[0] as { games: number }).games = 5;
    expect(parseRankingAnswer(many)).toBeNull();
  });
});

// --- Plan 05-05: the solo report (POST /api/me/results/solo) ---

const report = () => ({
  id: "0c7e6f7a-1b2c-4d5e-8f90-1234567890ab",
  startedAt: 1_800_000_000_000,
  endedAt: 1_800_000_900_000,
  human: "bleu",
  winner: "bleu-rouge",
  deals: 6,
  levels: { jaune: 3, rouge: 2, vert: 5 },
  seats: {
    bleu: { captured: 3, lost: 2, home: 4 },
    jaune: { captured: 1, lost: 2, home: 1 },
    rouge: { captured: 2, lost: 1, home: 4 },
    vert: { captured: 1, lost: 2, home: 3 },
  },
});

describe("SoloReport", () => {
  it("reads a report: the three computers by level, the four seats' counts", () => {
    expect(parseSoloReport(report())).toEqual(report());
  });

  it("refuses an extra key, a name anywhere, a fourth level, the human's own level, a level 6", () => {
    expect(parseSoloReport({ ...report(), more: 1 })).toBeNull();
    expect(parseSoloReport({ ...report(), name: "Anaïs" })).toBeNull();
    const named = report() as Record<string, unknown> & ReturnType<typeof report>;
    (named.seats.jaune as Record<string, unknown>).name = "Ourasi";
    expect(parseSoloReport(named)).toBeNull();
    expect(
      parseSoloReport({ ...report(), levels: { bleu: 1, jaune: 3, rouge: 2, vert: 5 } }),
    ).toBeNull();
    expect(parseSoloReport({ ...report(), levels: { bleu: 1, rouge: 2, vert: 5 } })).toBeNull();
    expect(parseSoloReport({ ...report(), levels: { jaune: 3, rouge: 2 } })).toBeNull();
    expect(parseSoloReport({ ...report(), levels: { jaune: 6, rouge: 2, vert: 5 } })).toBeNull();
    expect(
      parseSoloReport({ ...report(), levels: { jaune: 3, rouge: 2, vert: 5, mauve: 1 } }),
    ).toBeNull();
  });

  it("refuses an id that is not a UUID, a missing seat, a home of 5 and a fraction", () => {
    for (const id of [
      "",
      "solo",
      "0C7E6F7A-1B2C-4D5E-8F90-1234567890AB",
      "../x",
      `${report().id}:x`,
    ]) {
      expect(parseSoloReport({ ...report(), id })).toBeNull();
    }
    const three = report() as { seats: Record<string, unknown> };
    delete three.seats.vert;
    expect(parseSoloReport(three)).toBeNull();
    const five = report();
    five.seats.bleu.home = 5;
    expect(parseSoloReport(five)).toBeNull();
    expect(parseSoloReport({ ...report(), deals: 6.5 })).toBeNull();
    expect(parseSoloReport({ ...report(), human: "mauve" })).toBeNull();
    expect(parseSoloReport({ ...report(), winner: "bleu-jaune" })).toBeNull();
  });
});
