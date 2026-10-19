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
import type { Table } from "@toc/table";
import { describe, expect, it } from "vitest";
import type { GameRoom } from "../src/GameRoom.ts";
import { tableHash, writeGame } from "../src/record.ts";
import { commit, load } from "../src/storage.ts";
import { type Client, connect, createTable, NEAR_END, token } from "./helpers.ts";

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
      again.records = [replayed];
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
