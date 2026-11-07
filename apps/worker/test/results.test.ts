// « Mes résultats » on the server (plan 05-01, HIST-02, D-01 to D-04, D-12, D-13; 05-RESEARCH Patterns
// 1, 3 and 4), in workerd with real sockets and the tests' D1 (0003_results.sql applied). A finished
// online game with accounts at the table writes, in the record's one batch, the unchanged legacy games
// row, one played row and one game_seats row per account seat; GET /api/me/results answers the
// signed-in player's games with every seat as me, account, guest or bot, never another account's id.

import { env, evictDurableObject, runInDurableObject, SELF } from "cloudflare:test";
import { type Scenario, scenarioState } from "@toc/engine";
import type { Table } from "@toc/table";
import { beforeEach, describe, expect, it } from "vitest";
import { tableHash } from "../src/record.ts";
import { commit, load } from "../src/storage.ts";
import {
  accountDb,
  type Client,
  connect,
  connectAs,
  createTable,
  get,
  type Jar,
  NEAR_END,
  newJar,
  ORIGIN,
  type Person,
  resetAccounts,
  rows,
  signUpPerson,
  token,
  untilRows,
} from "./helpers.ts";

beforeEach(resetAccounts);

const stubOf = (id: string) => env.GAME_ROOM.getByName(id);

/** The pseudo of a test account: unique enough, at most 20 characters. */
const pseudo = (base: string) => `${base}${Math.floor(Math.random() * 1e6)}`;

type Seated = {
  id: string;
  a: { person: Person; jar: Jar; client: Client };
  b: { person: Person; jar: Jar; client: Client };
  guest: Client;
};

/** A socket's hello and seat, waiting for the welcome that shows it seated. */
async function sit(client: Client, letter: string, name: string, seat: string): Promise<void> {
  client.send({ t: "hello", v: 6, token: token(letter), name });
  await client.next("welcome");
  client.send({ t: "sit", seat });
  await client.next("welcome", (frame) => frame.you.seat === seat);
}

/**
 * A (an account, creator) bleu, B (an account) jaune, the guest « Mamie » rouge, vert a computer
 * (Pur-sang), at a near-end table where A's 5 wins for bleu-rouge; started.
 */
async function twoAccounts(): Promise<Seated> {
  const id = await createTable({ pace: "zero", before: NEAR_END, levels: { vert: 4 } });
  const aJar = newJar();
  const aPerson = await signUpPerson(pseudo("Anaïs"), aJar);
  const bJar = newJar();
  const bPerson = await signUpPerson(pseudo("Bruno"), bJar);
  const aClient = await connectAs(id, { jar: aJar });
  await sit(aClient, "a", "Anaïs", "bleu");
  const bClient = await connectAs(id, { jar: bJar });
  await sit(bClient, "b", "Bruno", "jaune");
  const guest = await connect(id);
  await sit(guest, "m", "Mamie", "rouge");
  aClient.send({ t: "start" });
  await aClient.next("events");
  return {
    id,
    a: { person: aPerson, jar: aJar, client: aClient },
    b: { person: bPerson, jar: bJar, client: bClient },
    guest,
  };
}

async function win(a: Client): Promise<void> {
  a.send({ t: "act", base: a.seq(), action: { t: "move", card: "5S", pawn: "bleu3" } });
  await a.next("table", (frame) => frame.table.status === "finished");
}

function closeAll(seated: Seated): void {
  for (const client of [seated.a.client, seated.b.client, seated.guest])
    client.ws.close(1000, "bye");
}

type HistorySeatAnswer = {
  colour: string;
  kind: string;
  name: string;
  level: number | null;
  handedOver: boolean;
  captured: number;
  lost: number;
  home: number;
};

type HistoryAnswer = {
  games: {
    id: string;
    kind: string;
    endedAt: number;
    winner: string;
    mine: string;
    seats: HistorySeatAnswer[];
    ranked: boolean;
    creator: string | null;
  }[];
  next: string | null;
};

describe("a finished online game with two accounts in D1", () => {
  it("writes played and one game_seats row per account seat, beside the unchanged games row", async () => {
    const seated = await twoAccounts();
    const { id, a, b } = seated;
    await win(a.client);
    const hash = await tableHash(id);
    const gameId = `${hash}:1`;
    const [played] = await untilRows(1, "SELECT * FROM played WHERE id = ?", gameId);
    expect(played?.kind).toBe("online");
    expect(played?.accounts).toBe(2);
    expect(played?.winner).toBe("bleu-rouge");
    expect(played?.creator).toBe(a.person.pseudo);
    const playedSeats = JSON.parse(String(played?.seats)) as { colour: string; kind: string }[];
    expect(playedSeats.map((seat) => [seat.colour, seat.kind])).toEqual([
      ["bleu", "account"],
      ["jaune", "account"],
      ["rouge", "guest"],
      ["vert", "bot"],
    ]);

    const seats = await untilRows(
      2,
      "SELECT * FROM game_seats WHERE game_id = ? ORDER BY colour",
      gameId,
    );
    const bleu = seats.find((seat) => seat.colour === "bleu");
    const jaune = seats.find((seat) => seat.colour === "jaune");
    expect(bleu).toMatchObject({ user_id: a.person.id, won: 1, ranked: 1, solo: 0, home: 4 });
    expect(jaune).toMatchObject({ user_id: b.person.id, won: 0, ranked: 1, solo: 0, home: 0 });
    expect(bleu?.ended_at).toBe(played?.ended_at);
    // The guest and the computer have no row of their own.
    expect(seats.map((seat) => seat.colour).sort()).toEqual(["bleu", "jaune"]);

    // The legacy games row: the 02-09 columns and seat fields only, no account id.
    const [game] = await rows("SELECT * FROM games WHERE game_id = ?", gameId);
    expect(Object.keys(game ?? {}).sort()).toEqual(
      [
        "captures",
        "deals",
        "ended_at",
        "game_id",
        "game_no",
        "seats",
        "started_at",
        "table_hash",
        "winner",
      ].sort(),
    );
    const legacy = JSON.parse(String(game?.seats)) as Record<string, unknown>[];
    for (const seat of legacy) {
      expect(Object.keys(seat).sort()).toEqual(["colour", "handedOver", "kind", "level", "name"]);
    }
    const text = JSON.stringify(game);
    expect(text).not.toContain(a.person.id);
    expect(text).not.toContain(b.person.id);
    closeAll(seated);
  }, 60_000);

  it("GET /api/me/results answers the game to A as A sees it, without B's id; 401 signed out", async () => {
    const seated = await twoAccounts();
    const { id, a, b } = seated;
    await win(a.client);
    const gameId = `${await tableHash(id)}:1`;
    await untilRows(2, "SELECT * FROM game_seats WHERE game_id = ?", gameId);

    const answer = await get("/api/me/results", a.jar);
    expect(answer.status).toBe(200);
    expect(answer.headers.get("cache-control")).toBe("no-store");
    const text = await answer.text();
    expect(text).not.toContain(b.person.id);
    expect(text).not.toContain(a.person.id);
    const page = JSON.parse(text) as HistoryAnswer;
    expect(page.next).toBeNull();
    expect(page.games).toHaveLength(1);
    const [game] = page.games;
    expect(game?.id).toBe(gameId);
    expect(game?.kind).toBe("online");
    expect(game?.mine).toBe("bleu");
    expect(game?.winner).toBe("bleu-rouge");
    expect(game?.ranked).toBe(true);
    expect(game?.creator).toBe(a.person.pseudo);
    expect(game?.seats.map((seat) => [seat.colour, seat.kind])).toEqual([
      ["bleu", "me"],
      ["jaune", "account"],
      ["rouge", "guest"],
      ["vert", "bot"],
    ]);
    expect(game?.seats[0]).toMatchObject({ name: a.person.pseudo, home: 4, level: null });
    expect(game?.seats[1]).toMatchObject({ name: b.person.pseudo, home: 0 });
    expect(game?.seats[2]).toMatchObject({ name: "Mamie", home: 4 });
    expect(game?.seats[3]).toMatchObject({ level: 4, home: 0 });

    // B sees it from jaune.
    const forB = (await (await get("/api/me/results", b.jar)).json()) as HistoryAnswer;
    expect(forB.games[0]?.mine).toBe("jaune");
    expect(forB.games[0]?.seats[0]?.kind).toBe("account");
    expect(forB.games[0]?.seats[1]?.kind).toBe("me");

    // Signed out: 401, and only GET or HEAD.
    const out = await get("/api/me/results");
    expect(out.status).toBe(401);
    expect(await out.json()).toEqual({ error: "signed-out" });
    const posted = await SELF.fetch(`${ORIGIN}/api/me/results`, { method: "POST" });
    expect(posted.status).toBe(405);
    closeAll(seated);
  }, 60_000);
});

// --- Plan 05-01 Task 2: the rematch, the pages of 20, the cursor ---

/** A played row and A's game_seats row, written straight into the tests' D1. */
async function insertGame(userId: string, gameId: string, endedAt: number): Promise<void> {
  const seats = JSON.stringify(
    ["bleu", "jaune", "rouge", "vert"].map((colour) => ({
      colour,
      kind: colour === "bleu" ? "account" : "bot",
      account: colour === "bleu" ? userId : null,
      name: colour === "bleu" ? "Anaïs" : "Ourasi",
      level: colour === "bleu" ? null : 3,
      handedOver: false,
      captured: 0,
      lost: 0,
      home: colour === "bleu" || colour === "rouge" ? 4 : 0,
    })),
  );
  await accountDb().batch([
    accountDb()
      .prepare(
        `INSERT INTO played (id, kind, started_at, ended_at, winner, seats, deals, creator, accounts)
         VALUES (?, 'online', ?, ?, 'bleu-rouge', ?, 1, 'Anaïs', 1)`,
      )
      .bind(gameId, endedAt - 600_000, endedAt, seats),
    accountDb()
      .prepare(
        `INSERT INTO game_seats (user_id, ended_at, game_id, colour, won, ranked, solo, captured, lost, home)
         VALUES (?, ?, ?, 'bleu', 1, 0, 0, 0, 0, 4)`,
      )
      .bind(userId, endedAt, gameId),
  ]);
}

const HASH = "H".repeat(43);

describe("the history of a player, page by page", () => {
  it("the rematch starts at zero and both games are in A's history, newest first", async () => {
    const seated = await twoAccounts();
    const { id, a, b, guest } = seated;
    await win(a.client);
    const hash = await tableHash(id);
    await untilRows(2, "SELECT * FROM game_seats WHERE game_id = ?", `${hash}:1`);
    for (const client of [a.client, b.client, guest]) client.send({ t: "rematch", agree: true });
    await a.client.next("table", (frame) => frame.table.gameNo === 2);
    // The second game: its tally is zero; it is brought to the same end (A's 5 wins again).
    await evictDurableObject(stubOf(id));
    const base = await runInDurableObject(stubOf(id), async (_room, state) => {
      const table = load(state.storage.sql) as Table;
      expect(table.tally.bleu).toEqual({ captured: 0, lost: 0 });
      table.game = scenarioState(NEAR_END as Scenario["before"], [1, 2, 3, 4]);
      table.thinking = null;
      delete table.deadlines.bot;
      commit(state.storage.sql, table, [], Date.now());
      return table.seq;
    });
    a.client.send({ t: "act", base, action: { t: "move", card: "5S", pawn: "bleu3" } });
    await a.client.next(
      "table",
      (frame) => frame.table.status === "finished" && frame.table.gameNo === 2,
    );
    await untilRows(2, "SELECT * FROM game_seats WHERE game_id = ?", `${hash}:2`);
    const page = (await (await get("/api/me/results", a.jar)).json()) as HistoryAnswer;
    expect(page.games.map((game) => game.id)).toEqual([`${hash}:2`, `${hash}:1`]);
    expect(page.games[0]?.endedAt).toBeGreaterThanOrEqual(page.games[1]?.endedAt ?? 0);
    closeAll(seated);
  }, 90_000);

  it("25 games: 20 then 5, none skipped or repeated, ties on the end time ordered by id", async () => {
    const jar = newJar();
    const a = await signUpPerson(pseudo("Anaïs"), jar);
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      // Games 10 and 11 end at the same time: the id decides, and the page edge falls between ties.
      const endedAt = 1_800_000_000_000 + (i === 11 ? 10 : i) * 1000;
      const gameId = `${HASH}:${String(i).padStart(2, "0")}`;
      ids.push(gameId);
      await insertGame(a.id, gameId, endedAt);
    }
    const first = await get("/api/me/results", jar);
    expect(first.headers.get("x-toc-d1")).toMatch(/^w=\d+;r=\d+$/);
    console.log(`GET /api/me/results, first page of 20: ${first.headers.get("x-toc-d1")}`);
    const one = (await first.json()) as HistoryAnswer;
    expect(one.games).toHaveLength(20);
    expect(one.next).not.toBeNull();
    const second = await get(`/api/me/results?before=${encodeURIComponent(one.next ?? "")}`, jar);
    expect(second.status).toBe(200);
    console.log(`GET /api/me/results, second page of 5: ${second.headers.get("x-toc-d1")}`);
    const two = (await second.json()) as HistoryAnswer;
    expect(two.games).toHaveLength(5);
    expect(two.next).toBeNull();
    const seen = [...one.games, ...two.games].map((game) => game.id);
    expect(new Set(seen).size).toBe(25);
    expect([...seen].sort()).toEqual([...ids].sort());
    // Newest first, then the greater id first among equal end times.
    const key = (game: HistoryAnswer["games"][number]) => [game.endedAt, game.id] as const;
    const all = [...one.games, ...two.games].map(key);
    for (let i = 1; i < all.length; i++) {
      const [t0, id0] = all[i - 1] as readonly [number, string];
      const [t1, id1] = all[i] as readonly [number, string];
      expect(t0 > t1 || (t0 === t1 && id0 > id1)).toBe(true);
    }
    expect(seen.indexOf(`${HASH}:11`)).toBe(seen.indexOf(`${HASH}:10`) - 1);
  });

  it("a page edge between two games of the same end time skips neither", async () => {
    const jar = newJar();
    const a = await signUpPerson(pseudo("Anaïs"), jar);
    for (let i = 0; i < 22; i++) {
      // Games 0, 1 and 2 share the oldest end time; the 20th row of the first page is one of them.
      const endedAt = 1_800_000_000_000 + Math.max(i, 2) * 1000;
      await insertGame(a.id, `${HASH}:${String(i).padStart(2, "0")}`, endedAt);
    }
    const one = (await (await get("/api/me/results", jar)).json()) as HistoryAnswer;
    const two = (await (
      await get(`/api/me/results?before=${encodeURIComponent(one.next ?? "")}`, jar)
    ).json()) as HistoryAnswer;
    const seen = [...one.games, ...two.games].map((game) => game.id);
    expect(seen).toHaveLength(22);
    expect(new Set(seen).size).toBe(22);
  });

  it("a malformed cursor is refused with 400 cursor", async () => {
    const jar = newJar();
    await signUpPerson(pseudo("Anaïs"), jar);
    for (const bad of ["soon", "12", "12:x", "x:abc:1", "12:a b:1", "1' OR 1=1 --:a:1"]) {
      const answer = await get(`/api/me/results?before=${encodeURIComponent(bad)}`, jar);
      expect(answer.status).toBe(400);
      expect(await answer.json()).toEqual({ error: "cursor" });
      expect(answer.headers.get("x-toc-d1")).toMatch(/^w=\d+;r=\d+$/);
    }
  });
});
