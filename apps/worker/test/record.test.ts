// The record of each finished game in D1 (plan 02-09 Task 2, HIST-01 support, D-14; 02-RESEARCH
// Pattern 12): miniflare's D1 with the migration applied (test/apply-migrations.ts). A game won writes
// one row; the same record written again (an alarm at least once, a lost acknowledgement) is still one
// row; the row holds no table id, device token, person id or card; a write that throws arms the retry
// deadline and a later alarm writes it; without a DB binding the game ends normally and nothing is
// written.

import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import type { GameRecord, RecordSeat, Table } from "@toc/table";
import { beforeEach, describe, expect, it } from "vitest";
import type { GameRoom } from "../src/GameRoom.ts";
import { tableHash, writeGame } from "../src/record.ts";
import { commit, load } from "../src/storage.ts";
import {
  rows as accountRows,
  type Client,
  connect,
  connectAs,
  createTable,
  NEAR_END,
  newJar,
  resetAccounts,
  signUpPerson,
  token,
} from "./helpers.ts";

const stubOf = (id: string) => env.GAME_ROOM.getByName(id);
const db = () => {
  if (env.DB === undefined) throw new Error("no D1 binding in the tests");
  return env.DB;
};

type Row = Record<string, unknown>;

async function rowsOf(id: string): Promise<Row[]> {
  const hash = await tableHash(id);
  const result = await db()
    .prepare("SELECT * FROM games WHERE table_hash = ? ORDER BY game_no")
    .bind(hash)
    .all<Row>();
  return result.results;
}

async function readTable(id: string): Promise<Table> {
  const table = await runInDurableObject(stubOf(id), (_room, state) => load(state.storage.sql));
  if (table === null) throw new Error("no table");
  return table;
}

/** Replaces the object's D1 binding until its next eviction (a broken one, or none at all). */
async function bindDatabase(id: string, database: unknown): Promise<void> {
  await runInDurableObject(stubOf(id), (room: GameRoom) => {
    const real = (room as unknown as { env: Env }).env;
    (room as unknown as { env: Env }).env = new Proxy(real, {
      get: (target, key) => (key === "DB" ? database : Reflect.get(target, key)),
    });
  });
}

/** Ana (bleu) and Ben (jaune) seated at a near-end table, the game started; Ana's 5 wins. */
async function nearEnd(): Promise<{ id: string; ana: Client; ben: Client }> {
  const id = await createTable({ pace: "zero", before: NEAR_END });
  const ana = await connect(id);
  ana.send({ t: "hello", v: 6, token: token("a"), name: "Ana" });
  await ana.next("welcome");
  ana.send({ t: "sit", seat: "bleu" });
  await ana.next("welcome", (frame) => frame.you.seat === "bleu");
  const ben = await connect(id);
  ben.send({ t: "hello", v: 6, token: token("b"), name: "Ben" });
  await ben.next("welcome");
  ben.send({ t: "sit", seat: "jaune" });
  await ben.next("welcome", (frame) => frame.you.seat === "jaune");
  ana.send({ t: "start" });
  await ana.next("events");
  return { id, ana, ben };
}

async function win(ana: Client): Promise<void> {
  ana.send({ t: "act", base: ana.seq(), action: { t: "move", card: "5S", pawn: "bleu3" } });
  await ana.next("table", (frame) => frame.table.status === "finished");
}

/** Waits until `ready` resolves true (the write runs after the frames are sent). */
async function until(ready: () => Promise<boolean>, what: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Makes the table's d1Retry deadline due and fires the alarm. */
async function retryNow(id: string): Promise<void> {
  await evictDurableObject(stubOf(id));
  await runInDurableObject(stubOf(id), async (_room, state) => {
    const table = load(state.storage.sql);
    if (table === null) throw new Error("no table");
    table.deadlines.d1Retry = { at: 0, attempt: table.deadlines.d1Retry?.attempt ?? 1 };
    commit(state.storage.sql, table, [], Date.now());
    // Far ahead, so the runtime does not fire it by itself first; runDurableObjectAlarm runs it now.
    await state.storage.setAlarm(Date.now() + 3_600_000);
  });
  expect(await runDurableObjectAlarm(stubOf(id))).toBe(true);
}

describe("the record of a finished game in D1", () => {
  it("writes one row per game with the expected fields, once, without any secret", async () => {
    const { id, ana, ben } = await nearEnd();
    const startedAt = (await readTable(id)).startedAt;
    await win(ana);
    await until(async () => (await rowsOf(id)).length === 1, "the row");
    const [row] = await rowsOf(id);
    const hash = await tableHash(id);
    expect(hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(row?.game_id).toBe(`${hash}:1`);
    expect(row?.table_hash).toBe(hash);
    expect(row?.game_no).toBe(1);
    expect(row?.started_at).toBe(startedAt);
    expect(Number(row?.ended_at)).toBeGreaterThanOrEqual(Number(startedAt));
    expect(row?.winner).toBe("bleu-rouge");
    expect(row?.deals).toBe(0);
    expect(JSON.parse(String(row?.captures))).toEqual({ "bleu-rouge": 0, "jaune-vert": 0 });
    const seats = JSON.parse(String(row?.seats)) as {
      colour: string;
      kind: string;
      name: string;
    }[];
    expect(seats.map((seat) => [seat.colour, seat.kind])).toEqual([
      ["bleu", "human"],
      ["jaune", "human"],
      ["rouge", "bot"],
      ["vert", "bot"],
    ]);
    expect(seats[0]?.name).toBe("Ana");
    expect(seats[1]?.name).toBe("Ben");

    // Recorded: nothing pending, no retry deadline.
    await until(async () => (await readTable(id)).records.length === 0, "the recorded step");
    const table = await readTable(id);
    expect(table.deadlines.d1Retry).toBeUndefined();

    // No table id, device token, person id or card in the row.
    const text = JSON.stringify(row);
    expect(text).not.toContain(id);
    expect(text).not.toContain(token("a"));
    expect(text).not.toContain(token("b"));
    for (const person of table.people) expect(text).not.toContain(person.who);
    expect(text).not.toMatch(/"(1[0-3]|[1-9])[SHDC]"/);

    // The same record written again, and an extra retry alarm with it pending: still one row.
    const replayed = {
      gameNo: 1,
      startedAt: Number(row?.started_at),
      endedAt: Number(row?.ended_at),
      winner: "bleu-rouge" as const,
      seats: [],
      deals: 0,
      captures: { "bleu-rouge": 0, "jaune-vert": 0 },
    };
    expect(await writeGame(db(), id, replayed)).toBe("written");
    await runInDurableObject(stubOf(id), (_room, state) => {
      const again = load(state.storage.sql) as Table;
      // The shape of a record pending from before plan 05-01 (no account, tally or creator).
      again.records = [replayed as unknown as Table["records"][number]];
      commit(state.storage.sql, again, [], Date.now());
    });
    await retryNow(id);
    await until(async () => (await readTable(id)).records.length === 0, "the replay recorded");
    expect(await rowsOf(id)).toHaveLength(1);
    expect((await rowsOf(id))[0]?.seats).toBe(row?.seats);
    ana.ws.close(1000, "bye");
    ben.ws.close(1000, "bye");
  }, 60_000);

  it("a write that throws arms the retry deadline, and a later alarm writes the row", async () => {
    const { id, ana, ben } = await nearEnd();
    await bindDatabase(id, {
      prepare() {
        throw new Error("D1 is down");
      },
    });
    await win(ana);
    await until(async () => (await readTable(id)).status === "finished", "the end");
    const table = await readTable(id);
    expect(table.records.map((record) => record.gameNo)).toEqual([1]);
    expect(table.deadlines.d1Retry?.at).toBeGreaterThan(Date.now());
    expect(await rowsOf(id)).toHaveLength(0);
    // The binding works again (a new instance after the eviction): the retry writes it.
    await retryNow(id);
    await until(async () => (await rowsOf(id)).length === 1, "the retried row");
    await until(async () => (await readTable(id)).records.length === 0, "the recorded step");
    expect((await readTable(id)).deadlines.d1Retry).toBeUndefined();
    ana.ws.close(1000, "bye");
    ben.ws.close(1000, "bye");
  }, 60_000);

  it("without a DB binding the game ends normally and nothing is written", async () => {
    const { id, ana, ben } = await nearEnd();
    await bindDatabase(id, undefined);
    await win(ana);
    await ben.next("table", (frame) => frame.table.status === "finished");
    await until(async () => (await readTable(id)).records.length === 0, "the skipped record");
    const table = await readTable(id);
    expect(table.status).toBe("finished");
    expect(table.deadlines.d1Retry).toBeUndefined();
    expect(await rowsOf(id)).toHaveLength(0);
    expect(await writeGame(undefined, id, table.records[0] ?? ({} as never))).toBe("skipped");
    // The rematch still starts.
    ana.send({ t: "rematch", agree: true });
    ben.send({ t: "rematch", agree: true });
    await ana.next("table", (frame) => frame.table.gameNo === 2);
    ana.ws.close(1000, "bye");
    ben.ws.close(1000, "bye");
  }, 60_000);
});

// --- Plan 05-01: who sat where (played, game_seats), written once and only once ---

/** A phase-5 record of game `gameNo`: A bleu and B jaune by default, a guest rouge, a computer vert. */
function phase5Record(
  accounts: { bleu?: string | null; jaune?: string | null; rouge?: string | null } = {},
  gameNo = 1,
): GameRecord {
  const human = (colour: "bleu" | "jaune" | "rouge", name: string, home: number): RecordSeat => ({
    colour,
    kind: "human",
    name,
    level: null,
    handedOver: false,
    account: accounts[colour] ?? null,
    captured: colour === "bleu" ? 2 : 0,
    lost: colour === "jaune" ? 2 : 0,
    home,
  });
  return {
    gameNo,
    startedAt: 1_000,
    endedAt: 50_000 + gameNo,
    winner: "bleu-rouge",
    seats: [
      human("bleu", "Anaïs", 4),
      human("jaune", "Bruno", 1),
      human("rouge", "Mamie", 4),
      {
        colour: "vert",
        kind: "bot",
        name: "Ourasi",
        level: 4,
        handedOver: false,
        account: null,
        captured: 0,
        lost: 0,
        home: 0,
      },
    ],
    deals: 2,
    captures: { "bleu-rouge": 2, "jaune-vert": 0 },
    creatorName: "Anaïs",
  };
}

/** A D1 binding that adds up the rows each batch wrote (D1Result meta). */
function metered(): { db: D1Database; written: () => number } {
  let written = 0;
  const real = db();
  const wrapped = {
    prepare: (sql: string) => real.prepare(sql),
    batch: async (statements: D1PreparedStatement[]) => {
      const results = await real.batch(statements);
      for (const result of results) written += result.meta?.rows_written ?? 0;
      return results;
    },
  } as unknown as D1Database;
  return { db: wrapped, written: () => written };
}

const tableId = () => `t${Math.floor(Math.random() * 1e9)}`.padEnd(22, "x");

describe("the results of a finished game in D1 (plan 05-01)", () => {
  beforeEach(resetAccounts);

  it("written twice, or retried after a failed batch, still one played row and one row per account", async () => {
    const a = await signUpPerson(`Anaïs${Math.floor(Math.random() * 1e6)}`);
    const b = await signUpPerson(`Bruno${Math.floor(Math.random() * 1e6)}`);
    const id = tableId();
    const record = phase5Record({ bleu: a.id, jaune: b.id });
    const first = metered();
    expect(await writeGame(first.db, id, record)).toBe("written");
    // The rows one finished two-account game writes: legacy 3, played 2, one per account seat.
    console.log(`D1 rows written by one finished two-account game: ${first.written()}`);
    expect(first.written()).toBeLessThanOrEqual(7);
    const again = metered();
    expect(await writeGame(again.db, id, record)).toBe("written");
    expect(again.written()).toBe(0);
    // A batch that throws writes nothing; the retry writes nothing new either.
    const broken = {
      prepare: (sql: string) => db().prepare(sql),
      batch: async () => {
        throw new Error("D1 is down");
      },
    } as unknown as D1Database;
    expect(await writeGame(broken, id, record)).toBe("failed");
    expect(await writeGame(db(), id, record)).toBe("written");
    const gameId = `${await tableHash(id)}:1`;
    expect(await accountRows("SELECT id FROM played WHERE id = ?", gameId)).toHaveLength(1);
    const seats = await accountRows(
      "SELECT user_id, colour, won, ranked, captured, lost, home FROM game_seats WHERE game_id = ? ORDER BY colour",
      gameId,
    );
    expect(seats).toEqual([
      { user_id: a.id, colour: "bleu", won: 1, ranked: 1, captured: 2, lost: 0, home: 4 },
      { user_id: b.id, colour: "jaune", won: 0, ranked: 1, captured: 0, lost: 2, home: 1 },
    ]);
  });

  it("an alarm retry after a thrown batch writes the rows once", async () => {
    const jar = newJar();
    const a = await signUpPerson(`Anaïs${Math.floor(Math.random() * 1e6)}`, jar);
    const id = await createTable({ pace: "zero", before: NEAR_END });
    const ana = await connectAs(id, { jar });
    ana.send({ t: "hello", v: 6, token: token("a"), name: "Anaïs" });
    await ana.next("welcome");
    ana.send({ t: "sit", seat: "bleu" });
    await ana.next("welcome", (frame) => frame.you.seat === "bleu");
    ana.send({ t: "start" });
    await ana.next("events");
    await bindDatabase(id, {
      prepare: (sql: string) => db().prepare(sql),
      batch: async () => {
        throw new Error("D1 is down");
      },
    });
    await win(ana);
    await until(async () => (await readTable(id)).status === "finished", "the end");
    const [pending] = (await readTable(id)).records;
    expect(pending?.seats[0]?.account).toBe(a.id);
    expect(await accountRows("SELECT * FROM game_seats WHERE user_id = ?", a.id)).toHaveLength(0);
    await retryNow(id);
    await until(async () => (await readTable(id)).records.length === 0, "the recorded step");
    // The answer was lost: the same record pending again and retried, nothing more is written.
    await runInDurableObject(stubOf(id), (_room, state) => {
      const table = load(state.storage.sql) as Table;
      if (pending !== undefined) table.records = [pending];
      commit(state.storage.sql, table, [], Date.now());
    });
    await retryNow(id);
    await until(async () => (await readTable(id)).records.length === 0, "the second retry");
    const gameId = `${await tableHash(id)}:1`;
    expect(await accountRows("SELECT id, accounts FROM played WHERE id = ?", gameId)).toEqual([
      { id: gameId, accounts: 1 },
    ]);
    const seats = await accountRows(
      "SELECT colour, ranked FROM game_seats WHERE user_id = ?",
      a.id,
    );
    expect(seats).toEqual([{ colour: "bleu", ranked: 0 }]);
    ana.ws.close(1000, "bye");
  }, 60_000);

  it("a seat whose account no longer exists is skipped, and the write is still written", async () => {
    const a = await signUpPerson(`Anaïs${Math.floor(Math.random() * 1e6)}`);
    const b = await signUpPerson(`Bruno${Math.floor(Math.random() * 1e6)}`);
    await db().prepare("DELETE FROM users WHERE id = ?").bind(b.id).run();
    const id = tableId();
    expect(await writeGame(db(), id, phase5Record({ bleu: a.id, jaune: b.id }))).toBe("written");
    const gameId = `${await tableHash(id)}:1`;
    expect(await accountRows("SELECT accounts FROM played WHERE id = ?", gameId)).toEqual([
      { accounts: 2 },
    ]);
    const seats = await accountRows("SELECT user_id FROM game_seats WHERE game_id = ?", gameId);
    expect(seats).toEqual([{ user_id: a.id }]);
  });

  it("a record from before plan 05-01 writes the games row only", async () => {
    const a = await signUpPerson(`Anaïs${Math.floor(Math.random() * 1e6)}`);
    const id = tableId();
    const record = phase5Record({ bleu: a.id });
    // The 02-09 shape: no account, tally or creator.
    const old = {
      ...record,
      creatorName: undefined,
      seats: record.seats.map(({ colour, kind, name, level, handedOver }) => ({
        colour,
        kind,
        name,
        level,
        handedOver,
      })),
    };
    expect(await writeGame(db(), id, old)).toBe("written");
    const gameId = `${await tableHash(id)}:1`;
    expect(await accountRows("SELECT game_id FROM games WHERE game_id = ?", gameId)).toHaveLength(
      1,
    );
    expect(await accountRows("SELECT id FROM played WHERE id = ?", gameId)).toHaveLength(0);
  });

  it("ranked: two accounts as opponents 1, one account with two guests 0, one account twice 0", async () => {
    const a = await signUpPerson(`Anaïs${Math.floor(Math.random() * 1e6)}`);
    const b = await signUpPerson(`Bruno${Math.floor(Math.random() * 1e6)}`);
    const cases: [Parameters<typeof phase5Record>[0], number, number][] = [
      [{ bleu: a.id, jaune: b.id }, 1, 2],
      [{ bleu: a.id }, 0, 1],
      [{ bleu: a.id, rouge: a.id }, 0, 1],
    ];
    for (const [accounts, ranked, count] of cases) {
      const id = tableId();
      expect(await writeGame(db(), id, phase5Record(accounts))).toBe("written");
      const gameId = `${await tableHash(id)}:1`;
      expect(await accountRows("SELECT accounts FROM played WHERE id = ?", gameId)).toEqual([
        { accounts: count },
      ]);
      const seats = await accountRows(
        "SELECT user_id, colour, ranked FROM game_seats WHERE game_id = ? ORDER BY colour",
        gameId,
      );
      expect(seats.every((seat) => seat.ranked === ranked)).toBe(true);
      // An account seated twice keeps one row (the key is the account, the end time, the game).
      expect(seats.filter((seat) => seat.user_id === a.id)).toHaveLength(1);
    }
  });
});
