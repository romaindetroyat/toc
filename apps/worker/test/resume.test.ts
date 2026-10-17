// Coming back to a table inside workerd (plan 02-07, NET-02, HIST-01, D-06, D-12): real hibernatable
// sockets, real SQLite, evictions between steps. After an eviction every reconnecting socket's welcome
// deep-equals viewFor of the stored snapshot for its seat; a second socket of the same device closes
// the first with 4001; another protocol version is closed with 4002; a table idle for more than 30 days
// is purged by its alarm (ctx.storage.deleteAll(): no SQL table left, sockets closed with 4004, the
// summary answers 404); and the chef de table accepts or refuses a reclaim of a seat.

import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
  SELF,
} from "cloudflare:test";
import { randomLegal } from "@toc/bots";
import { type Action, type Color, type Rng, viewFor } from "@toc/engine";
import { CLOSE_ELSEWHERE, CLOSE_GONE, CLOSE_VERSION, PROTOCOL_VERSION } from "@toc/protocol";
import { EXPIRY_MS, type Table } from "@toc/table";
import { describe, expect, it } from "vitest";
import { commit, load } from "../src/storage.ts";
import { type Client, connect, createTable, ORIGIN, token } from "./helpers.ts";

const stubOf = (id: string) => env.GAME_ROOM.getByName(id);

async function readTable(id: string): Promise<Table> {
  const table = await runInDurableObject(stubOf(id), (_room, state) => load(state.storage.sql));
  if (table === null) throw new Error("no table");
  return table;
}

/** Rewrites the stored table (the object is evicted first, so no cached copy outlives it). */
async function editTable(id: string, edit: (table: Table) => void): Promise<void> {
  await evictDurableObject(stubOf(id));
  await runInDurableObject(stubOf(id), (_room, state) => {
    const table = load(state.storage.sql) as Table;
    edit(table);
    commit(state.storage.sql, table, [], Date.now());
  });
}

async function hello(id: string, letter: string, name: string): Promise<Client> {
  const client = await connect(id);
  client.send({ t: "hello", v: PROTOCOL_VERSION, token: token(letter), name });
  return client;
}

async function until(ready: () => Promise<boolean>, what: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Ana (bleu, creator) and Ben (jaune) start a table; computers on rouge and vert. */
async function startTwo(): Promise<{ id: string; ana: Client; ben: Client }> {
  const id = await createTable({ pace: "zero" });
  const ana = await hello(id, "a", "Ana");
  await ana.next("welcome");
  const ben = await hello(id, "b", "Ben");
  await ben.next("welcome");
  ana.send({ t: "sit", seat: "bleu" });
  await ana.next("welcome", (frame) => frame.you.seat === "bleu");
  ben.send({ t: "sit", seat: "jaune" });
  await ben.next("welcome", (frame) => frame.you.seat === "jaune");
  ana.send({ t: "start" });
  await ana.next("events");
  await ben.next("events");
  return { id, ana, ben };
}

/**
 * Plays until `acts` moves of people were made in play and a person is due again (no computer
 * deadline, so the table stands still): Ana and Ben play randomLegal on their own stored view.
 */
async function playSome(id: string, players: Record<"bleu" | "jaune", Client>, acts: number) {
  let rng: Rng = [20261017, 7, 8, 9];
  let made = 0;
  for (let step = 0; step < 400; step++) {
    const table = await readTable(id);
    const game = table.game;
    if (game === null) throw new Error("no game");
    if (table.deadlines.bot !== undefined) {
      await runDurableObjectAlarm(stubOf(id));
      continue;
    }
    const seat: Color =
      game.phase === "exchange"
        ? ((["bleu", "jaune"] as const).find((c) => game.given[c] === null) as Color)
        : game.turn;
    if (game.phase === "play" && made >= acts) return table;
    const client = players[seat as "bleu" | "jaune"];
    let action: Action;
    [action, rng] = randomLegal(viewFor(game, seat), seat, rng);
    client.send({ t: "act", base: table.seq, action });
    await until(async () => (await readTable(id)).seq > table.seq, `the act at ${table.seq}`);
    if (game.phase === "play") made += 1;
  }
  throw new Error("the table did not get there");
}

describe("the welcome is the exact resync (NET-02, SC3)", () => {
  it("after an eviction each reconnect deep-equals viewFor of the stored snapshot", async () => {
    const { id, ana, ben } = await startTwo();
    const before = await playSome(id, { bleu: ana, jaune: ben }, 3);
    await evictDurableObject(stubOf(id));

    // Ben's socket drops and comes back; Ana opens a second socket (a reload): the first gets 4001.
    ben.ws.close(1000, "bye");
    await ben.closed;
    const ben2 = await hello(id, "b", "Ben");
    const benWelcome = await ben2.next("welcome", (frame) => frame.table.status === "playing");
    const ana2 = await hello(id, "a", "Ana");
    const anaWelcome = await ana2.next("welcome");
    expect(await ana.closed).toEqual({ code: CLOSE_ELSEWHERE });

    const stored = await readTable(id);
    if (stored.game === null) throw new Error("no game");
    expect(stored.seq).toBe(before.seq);
    expect(benWelcome.seq).toBe(stored.seq);
    expect(anaWelcome.seq).toBe(stored.seq);
    expect(benWelcome.view).toEqual(viewFor(stored.game, "jaune"));
    expect(anaWelcome.view).toEqual(viewFor(stored.game, "bleu"));
    // No replay: after the welcome, no events frame on the new sockets.
    expect(ben2.frames.filter((frame) => frame.t === "events")).toEqual([]);
    ana2.ws.close(1000, "bye");
    ben2.ws.close(1000, "bye");
  }, 120_000);

  it("closes a client of another protocol version with 4002", async () => {
    const id = await createTable();
    const client = await connect(id);
    client.send({ t: "hello", v: PROTOCOL_VERSION + 1, token: token("d"), name: "Dan" });
    expect(await client.closed).toEqual({ code: CLOSE_VERSION });
  });
});

describe("« Arrêter la partie » and a resume after an eviction (SC4, HIST-01)", () => {
  it("saves for everyone and resumes the same game", async () => {
    const { id, ana, ben } = await startTwo();
    const before = await playSome(id, { bleu: ana, jaune: ben }, 1);
    ana.send({ t: "stop" });
    await ben.next("table", (frame) => frame.table.status === "saved");
    await evictDurableObject(stubOf(id));
    ana.ws.close(1000, "bye");
    ben.ws.close(1000, "bye");
    await ana.closed;
    await ben.closed;
    const ana2 = await hello(id, "a", "Ana");
    const welcome = await ana2.next("welcome");
    expect(welcome.table.status).toBe("saved");
    expect(welcome.view).toEqual(viewFor(before.game as NonNullable<Table["game"]>, "bleu"));
    const ben2 = await hello(id, "b", "Ben");
    await ben2.next("welcome");
    ana2.send({ t: "resume" });
    await ben2.next("table", (frame) => frame.table.status === "playing");
    const after = await readTable(id);
    expect(after.game).toEqual(before.game);
    ana2.ws.close(1000, "bye");
    ben2.ws.close(1000, "bye");
  }, 120_000);
});

describe("the 30-day expiry (D-06)", () => {
  it("arms the alarm at the creation, purges after 30 idle days, closes with 4004, answers 404", async () => {
    const id = await createTable();
    const stub = stubOf(id);
    const created = await readTable(id);
    expect(created.deadlines.expire?.at).toBe(created.createdAt + EXPIRY_MS);
    expect(
      await runInDurableObject(stub, (_room, state) => state.storage.getAlarm()),
    ).not.toBeNull();
    const ana = await hello(id, "a", "Ana");
    await ana.next("welcome");

    // 31 days without activity (the stored last activity moved back, the deadline made due).
    await editTable(id, (table) => {
      table.lastActivity = Date.now() - 31 * 24 * 60 * 60 * 1000;
      table.deadlines.expire = { at: Date.now() - 1 };
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await ana.closed).toEqual({ code: CLOSE_GONE });
    const left = await runInDurableObject(stub, (_room, state) => ({
      tables: state.storage.sql.exec("SELECT name FROM sqlite_master").toArray(),
      alarm: state.storage.getAlarm(),
    }));
    expect(left.tables).toEqual([]);
    expect(await left.alarm).toBeNull();
    const response = await SELF.fetch(`${ORIGIN}/api/tables/${id}`);
    expect(response.status).toBe(404);
    // A socket opened afterwards is closed with 4004 too.
    const late = await connect(id);
    expect(await late.closed).toEqual({ code: CLOSE_GONE });
  });

  it("re-arms at the last activity + 30 days when it fires early", async () => {
    const id = await createTable();
    const stub = stubOf(id);
    const ana = await hello(id, "a", "Ana");
    await ana.next("welcome");
    const activity = Date.now() - 10 * 24 * 60 * 60 * 1000;
    await editTable(id, (table) => {
      table.lastActivity = activity;
      table.deadlines.expire = { at: Date.now() - 1 };
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const table = await readTable(id);
    expect(table.deadlines.expire).toEqual({ at: activity + EXPIRY_MS });
    expect(ana.ws.readyState).toBe(WebSocket.OPEN);
    ana.ws.close(1000, "bye");
  });
});

describe("the reclaim of one's own seat (D-12, A7)", () => {
  it("refuses, then gives the seat to the new device; the old token is no longer seated", async () => {
    const { id, ana, ben } = await startTwo();
    ben.ws.close(1000, "bye");
    await ben.closed;
    await ana.next("table", (frame) => frame.table.status === "paused");

    // Bruno opens the link elsewhere: no seat, the game has started.
    const bruno = await hello(id, "c", "Bruno");
    const first = await bruno.next("welcome");
    expect(first.you.seat).toBeNull();
    expect(first.view).toBeNull();
    bruno.send({ t: "reclaim", seat: "jaune" });
    expect(await ana.next("reclaimRequest")).toEqual({
      t: "reclaimRequest",
      seat: "jaune",
      name: "Bruno",
    });
    await evictDurableObject(stubOf(id));
    ana.send({ t: "reclaimAnswer", seat: "jaune", accept: false });
    expect(await bruno.next("reclaimResult")).toEqual({ t: "reclaimResult", accepted: false });
    expect((await readTable(id)).seats.jaune).toMatchObject({ kind: "human" });

    bruno.send({ t: "reclaim", seat: "jaune" });
    await ana.next("reclaimRequest");
    ana.send({ t: "reclaimAnswer", seat: "jaune", accept: true });
    expect(await bruno.next("reclaimResult")).toEqual({ t: "reclaimResult", accepted: true });
    const seated = await bruno.next("welcome", (frame) => frame.you.seat === "jaune");
    const stored = await readTable(id);
    expect(seated.view).toEqual(viewFor(stored.game as NonNullable<Table["game"]>, "jaune"));
    expect(stored.status).toBe("playing");
    await ana.next("table", (frame) => frame.table.seats.jaune.name === "Bruno");

    // Ben's old device comes back: no seat.
    const old = await hello(id, "b", "Ben");
    const welcome = await old.next("welcome");
    expect(welcome.you.seat).toBeNull();
    expect(welcome.view).toBeNull();
    for (const client of [ana, bruno, old]) client.ws.close(1000, "bye");
  }, 120_000);
});
