import type { HistoryPage } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import type { ApiDeps } from "../net/api.ts";
import { history } from "./api.ts";

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
