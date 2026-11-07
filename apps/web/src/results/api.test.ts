import type { HistoryPage } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import type { ApiDeps } from "../net/api.ts";
import { history, stats } from "./api.ts";

// « Mes résultats » from the page (plan 05-01): GET /api/me/results, read with the shared strict
// schema. fetch and the online flag are fakes.

const HASH = "B".repeat(43);

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

const PAGE = {
  games: [
    {
      id: `${HASH}:1`,
      kind: "online",
      startedAt: 1_000,
      endedAt: 2_000,
      winner: "bleu-rouge",
      mine: "bleu",
      seats: [
        { ...seat("bleu", "me", "Anaïs"), home: 4 },
        seat("jaune", "account", "Bruno"),
        { ...seat("rouge", "guest", "Mamie"), home: 4 },
        seat("vert", "bot", "Ourasi", 4),
      ],
      deals: 0,
      creator: "Anaïs",
      ranked: true,
    },
  ],
  next: null,
} as HistoryPage;

function fake(answer: () => Response | Promise<Response>, online = true) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const deps: ApiDeps = {
    online: () => online,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return answer();
    },
  };
  return { deps, calls };
}

describe("history", () => {
  it("answers the page as the server sent it, asked without a cache", async () => {
    const { deps, calls } = fake(() => Response.json(PAGE));
    expect(await history(null, deps)).toEqual(PAGE);
    expect(calls[0]?.url).toBe("/api/me/results");
    expect(calls[0]?.init?.cache).toBe("no-store");
  });

  it("asks the page after a cursor, encoded", async () => {
    const { deps, calls } = fake(() => Response.json({ games: [], next: null }));
    await history(`2000:${HASH}:1`, deps);
    expect(calls[0]?.url).toBe(`/api/me/results?before=2000%3A${HASH}%3A1`);
  });

  it("signed out, offline, failing or out of shape", async () => {
    expect(
      await history(null, fake(() => Response.json({ error: "signed-out" }, { status: 401 })).deps),
    ).toBe("signed-out");
    expect(await history(null, fake(() => Response.json(PAGE), false).deps)).toBe("offline");
    expect(
      await history(
        null,
        fake(() => {
          throw new TypeError("network");
        }).deps,
      ),
    ).toBe("offline");
    expect(await history(null, fake(() => new Response("oops", { status: 500 })).deps)).toBe(
      "error",
    );
    expect(await history(null, fake(() => new Response("<html>", { status: 200 })).deps)).toBe(
      "error",
    );
    expect(await history("not a cursor", fake(() => Response.json(PAGE)).deps)).toBe("error");
  });
});

describe("history refuses a hostile answer", () => {
  const hostile = (change: (page: Record<string, unknown>) => void) => {
    const page = JSON.parse(JSON.stringify(PAGE)) as Record<string, unknown>;
    change(page);
    return fake(() => Response.json(page)).deps;
  };
  const firstGame = (page: Record<string, unknown>) =>
    (page.games as Record<string, unknown>[])[0] as Record<string, unknown>;

  it("an extra key on the page, a game or a seat", async () => {
    expect(
      await history(
        null,
        hostile((page) => (page.debug = true)),
      ),
    ).toBe("error");
    expect(
      await history(
        null,
        hostile((page) => (firstGame(page).script = "x")),
      ),
    ).toBe("error");
    expect(
      await history(
        null,
        hostile((page) => {
          (
            (firstGame(page).seats as Record<string, unknown>[])[1] as Record<string, unknown>
          ).account = "u".repeat(22);
        }),
      ),
    ).toBe("error");
  });

  it("a fifth or sixth seat, a level 9", async () => {
    expect(
      await history(
        null,
        hostile((page) => {
          const seats = firstGame(page).seats as unknown[];
          seats.push(seats[0], seats[1]);
        }),
      ),
    ).toBe("error");
    expect(
      await history(
        null,
        hostile((page) => {
          (
            (firstGame(page).seats as Record<string, unknown>[])[3] as Record<string, unknown>
          ).level = 9;
        }),
      ),
    ).toBe("error");
  });
});

// --- Plan 05-09 Task 2: GET /api/me/stats, read with StatsAnswer (strict) ---

const block = (games: number, wins: number) => ({
  games,
  wins,
  captured: 3,
  lost: 2,
  home: 5,
  partners: [
    { kind: "account", name: "Marie", level: null, games, wins },
    { kind: "guests", name: null, level: null, games: 1, wins: 0 },
    { kind: "bot", name: null, level: 4, games: 1, wins: 1 },
  ],
  levels: [{ level: 4, games: 1, wins: 1 }],
});

const STATS = { all: block(3, 2), online: block(2, 1), solo: block(1, 1) };

describe("stats", () => {
  it("answers the three blocks as the server sent them, asked without a cache", async () => {
    const { deps, calls } = fake(() => Response.json(STATS));
    expect(await stats(deps)).toEqual(STATS);
    expect(calls[0]?.url).toBe("/api/me/stats");
    expect(calls[0]?.init?.cache).toBe("no-store");
  });

  it("signed out, offline, failing or out of shape", async () => {
    expect(await stats(fake(() => Response.json({}, { status: 401 })).deps)).toBe("signed-out");
    expect(await stats(fake(() => Response.json(STATS), false).deps)).toBe("offline");
    expect(
      await stats(
        fake(() => {
          throw new TypeError("network");
        }).deps,
      ),
    ).toBe("offline");
    expect(await stats(fake(() => new Response("oops", { status: 503 })).deps)).toBe("error");
    expect(await stats(fake(() => new Response("<html>", { status: 200 })).deps)).toBe("error");
  });

  it("refuses a hostile answer: an id, more wins than games, a level 9, an extra block", async () => {
    const hostile = (change: (answer: Record<string, Record<string, unknown>>) => void) => {
      const answer = JSON.parse(JSON.stringify(STATS)) as Record<string, Record<string, unknown>>;
      change(answer);
      return fake(() => Response.json(answer)).deps;
    };
    const partner = (answer: Record<string, Record<string, unknown>>) =>
      ((answer.all as Record<string, unknown>).partners as Record<string, unknown>[])[0] as Record<
        string,
        unknown
      >;
    expect(await stats(hostile((answer) => (partner(answer).id = "u".repeat(22))))).toBe("error");
    expect(
      await stats(hostile((answer) => ((answer.all as Record<string, unknown>).wins = 9))),
    ).toBe("error");
    expect(
      await stats(
        hostile((answer) => {
          (
            (
              (answer.solo as Record<string, unknown>).levels as Record<string, unknown>[]
            )[0] as Record<string, unknown>
          ).level = 9;
        }),
      ),
    ).toBe("error");
    expect(await stats(hostile((answer) => (answer.debug = {})))).toBe("error");
  });
});
