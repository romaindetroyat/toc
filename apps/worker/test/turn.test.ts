// « C’est ton tour » through the real alarms (plan 04-07, CONTEXT addendum, 04-RESEARCH Pattern 10),
// with production's alarm delivery (debug slow-online-bots: Date.now() equal to scheduledTime, an
// alarm left at its own time dropped). Ana (account, bleu) and Ben (account, jaune) play with two
// computers; the notice comes 2 s after Ben's socket closed (test option notifyMs). Ben's app is open
// on another screen (his hub socket is visible), so the notice reaches it as a frame; Ana, who is at
// the table, is never told.

import { env, runInDurableObject } from "cloudflare:test";
import { HUB_VERSION } from "@toc/protocol";
import type { Table } from "@toc/table";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { load } from "../src/storage.ts";
import {
  type Client,
  connectAs,
  createTable,
  deliverAsProduction,
  type HubClient,
  type Jar,
  newJar,
  openHub,
  resetAccounts,
  signUpPerson,
  token,
} from "./helpers.ts";

beforeEach(resetAccounts);

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

const NOTIFY_MS = 2000;

type Account = { jar: Jar; id: string; pseudo: string };

async function account(base: string): Promise<Account> {
  const jar = newJar();
  const person = await signUpPerson(`${base}${Math.floor(Math.random() * 1e6)}`, jar);
  return { jar, id: person.id, pseudo: person.pseudo };
}

const roomOf = (id: string) => env.GAME_ROOM.getByName(id);

async function readTable(id: string): Promise<Table> {
  const table = await runInDurableObject(roomOf(id), (_room, state) => load(state.storage.sql));
  if (table === null) throw new Error("no table");
  return table;
}

const alarmOf = (id: string) =>
  runInDurableObject(roomOf(id), (_room, state) => state.storage.getAlarm());

/** A hub socket of `who` that said hi and is visible, once the hub has read both. */
async function visibleHub(who: Account): Promise<HubClient> {
  const hub = await openHub({ jar: who.jar });
  hub.send({ t: "hi", v: HUB_VERSION });
  hub.send({ t: "vis", visible: true });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const seen = await runInDurableObject(env.PLAYER_HUB.getByName(who.id), (_hub, state) =>
      state.getWebSockets().map((ws) => ws.deserializeAttachment() as { visible?: boolean }),
    );
    if (seen.some((one) => one.visible === true)) return hub;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("the hub never saw the socket visible");
}

/** Waits (wall time) until the table passes `check`. */
async function untilTable(id: string, check: (table: Table) => boolean): Promise<Table> {
  const deadline = Date.now() + 20_000;
  let table = await readTable(id);
  while (Date.now() < deadline) {
    if (check(table)) return table;
    await new Promise((resolve) => setTimeout(resolve, 20));
    table = await readTable(id);
  }
  throw new Error(`the table never matched: ${JSON.stringify(table.notifyAt)} ${table.status}`);
}

/** Ana and Ben seated with their accounts, two computers, the game started. */
async function startedTable(): Promise<{
  id: string;
  ana: Account;
  ben: Account;
  anaTable: Client;
  benTable: Client;
}> {
  const ana = await account("Ana");
  const ben = await account("Ben");
  const id = await createTable({ pace: "zero", notifyMs: NOTIFY_MS });
  const anaTable = await connectAs(id, { jar: ana.jar });
  anaTable.send({ t: "hello", v: 5, token: token("a"), name: "Ana" });
  await anaTable.next("welcome");
  const benTable = await connectAs(id, { jar: ben.jar });
  benTable.send({ t: "hello", v: 5, token: token("b"), name: "Ben" });
  await benTable.next("welcome");
  anaTable.send({ t: "sit", seat: "bleu" });
  await anaTable.next("welcome", (frame) => frame.you.seat === "bleu");
  benTable.send({ t: "sit", seat: "jaune" });
  await benTable.next("welcome", (frame) => frame.you.seat === "jaune");
  anaTable.send({ t: "start" });
  await anaTable.next("table", (frame) => frame.table.status === "playing");
  return { id, ana, ben, anaTable, benTable };
}

describe("« C’est ton tour » under production's alarm delivery", () => {
  it("Ben's socket closes: 2 s later his hub gets the turn notice, Ana's gets nothing", async () => {
    restore = deliverAsProduction();
    const { id, ana, ben, anaTable, benTable } = await startedTable();
    const benHub = await visibleHub(ben);
    const anaHub = await visibleHub(ana);

    benTable.ws.close(1000, "bye");
    const paused = await untilTable(id, (table) => table.notifyAt.jaune !== undefined);
    expect(paused.status).toBe("paused");
    const notifyAt = paused.notifyAt.jaune as number;
    const since = paused.pause?.since as number;
    expect(notifyAt).toBe(since + NOTIFY_MS);
    expect(paused.deadlines.notify).toEqual({ at: notifyAt });

    const notice = await benHub.next();
    expect(notice).toEqual({
      t: "notice",
      kind: "turn",
      table: id,
      from: ana.pseudo,
      own: false,
      resumed: false,
      // The hub's clock is the alarm's: production runs it at exactly the notice's time.
      at: expect.any(Number),
    });
    expect(notice.at as number).toBeGreaterThanOrEqual(notifyAt);

    const after = await untilTable(id, (table) => table.notifyAt.jaune === null);
    expect(after.deadlines.notify).toBeUndefined();
    // The next alarm is after the notice's time, never at it (it would be dropped in production).
    const alarm = await alarmOf(id);
    expect(alarm === null || alarm > notifyAt, String(alarm)).toBe(true);

    // The hub kept the key, so the same pause is never pushed twice.
    const keys = await runInDurableObject(env.PLAYER_HUB.getByName(ben.id), (_hub, state) =>
      state.storage.sql.exec("SELECT kind, key FROM sent").toArray(),
    );
    expect(keys).toEqual([{ kind: "turn", key: `${id}:${since}` }]);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(anaHub.frames).toEqual([]);
    for (const socket of [anaTable.ws, benHub.ws, anaHub.ws]) socket.close(1000);
  }, 60_000);

  it("Ben back before the time: no notice", async () => {
    restore = deliverAsProduction();
    const { id, ben, anaTable, benTable } = await startedTable();
    const benHub = await visibleHub(ben);
    benTable.ws.close(1000, "bye");
    await untilTable(id, (table) => table.notifyAt.jaune !== undefined);
    const again = await connectAs(id, { jar: ben.jar });
    again.send({ t: "hello", v: 5, token: token("b"), name: "Ben" });
    await again.next("welcome");
    const back = await untilTable(id, (table) => table.status === "playing");
    expect(back.notifyAt).toEqual({});
    expect(back.deadlines.notify).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, NOTIFY_MS + 500));
    expect(benHub.frames).toEqual([]);
    for (const socket of [anaTable.ws, again.ws, benHub.ws]) socket.close(1000);
  }, 60_000);

  it("a saved game resumed without Ben tells him at once", async () => {
    const { id, ben, anaTable, benTable } = await startedTable();
    const benHub = await visibleHub(ben);
    benTable.ws.close(1000, "bye");
    await untilTable(id, (table) => table.status === "paused");
    anaTable.send({ t: "stop" });
    await untilTable(id, (table) => table.status === "saved");
    anaTable.send({ t: "resume" });
    const notice = await benHub.next();
    expect(notice).toMatchObject({ t: "notice", kind: "turn", table: id, resumed: true });
    const resumed = await readTable(id);
    expect(resumed.notifyAt).toEqual({ jaune: null });
    expect(resumed.deadlines.notify).toBeUndefined();
    for (const socket of [anaTable.ws, benHub.ws]) socket.close(1000);
  }, 60_000);
});
