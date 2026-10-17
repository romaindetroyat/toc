// The pause inside workerd (plan 02-06, D-04, D-05, NET-03, NET-04): real hibernatable sockets, real
// SQLite, the alarm, evictions between steps. A person's socket closing pauses the game for the
// others; the minute is a deadline the alarm fires (made due here through the stored table); the
// chef de table hands the seat to the computer, which plays it on alarms; the person comes back and
// gets the seat at once. A socket silent for more than SILENCE_MS (no ping since its hello: its
// getWebSocketAutoResponseTimestamp is null) is closed with 4000 by the next alarm and its seat is
// gone. When the creator is the one missing, the next person online clockwise is the chef de table.

import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import { CLOSE_SILENT, type TablePublic } from "@toc/protocol";
import { SILENCE_MS, type Table } from "@toc/table";
import { describe, expect, it } from "vitest";
import { commit, load } from "../src/storage.ts";
import { type Client, connect, createTable, token } from "./helpers.ts";

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

type LogRow = { seat: string | null; bot: { level: number } | null };

function logOf(id: string): Promise<LogRow[]> {
  return runInDurableObject(stubOf(id), (_room, state) =>
    state.storage.sql
      .exec("SELECT seat, bot FROM events ORDER BY seq")
      .toArray()
      .map((row) => ({
        seat: row.seat === null ? null : String(row.seat),
        bot: row.bot === null ? null : (JSON.parse(String(row.bot)) as { level: number }),
      })),
  );
}

const tableOf = async (client: Client, where: (table: TablePublic) => boolean) =>
  (await client.next("table", (frame) => where(frame.table))).table;

async function hello(id: string, letter: string, name: string, ping = true): Promise<Client> {
  const client = await connect(id, {}, { ping });
  client.send({ t: "hello", v: 3, token: token(letter), name });
  return client;
}

describe("the pause in the Durable Object", () => {
  it("pauses, lets the host hand the seat over, gives it back, sweeps a silent socket, passes the role", async () => {
    const id = await createTable({ pace: "zero" });
    const stub = stubOf(id);
    const ana = await hello(id, "a", "Ana");
    await ana.next("welcome");
    let ben = await hello(id, "b", "Ben");
    await ben.next("welcome");
    ana.send({ t: "sit", seat: "bleu" });
    await ana.next("welcome", (frame) => frame.you.seat === "bleu");
    ben.send({ t: "sit", seat: "jaune" });
    await ben.next("welcome", (frame) => frame.you.seat === "jaune");
    ana.send({ t: "start" });
    await ana.next("events");
    await ben.next("events");

    // Ben's socket closes: Ana sees the pause at once, with Ben missing.
    ben.ws.close(1000, "bye");
    const paused = await tableOf(ana, (table) => table.status === "paused");
    expect(paused.pause).toMatchObject({ missing: ["jaune"], choosing: false });
    expect(paused.seats.jaune).toMatchObject({ name: "Ben", online: false, handedOver: null });
    expect(paused.host).toBe("bleu");
    const stored = await readTable(id);
    expect(stored.deadlines.bot).toBeUndefined();
    expect(stored.deadlines.pauseChoice?.at).toBe(paused.pause?.choiceAt);

    // The minute is over (made due through the stored table, after an eviction): the alarm.
    await editTable(id, (table) => {
      const at = Date.now() - 1;
      if (table.pause !== null) table.pause.choiceAt = at;
      table.deadlines.pauseChoice = { at };
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await tableOf(ana, (table) => table.pause?.choosing === true);

    // « Confier sa place à l’ordinateur » at Pur-sang: the game goes on, the computer plays for Ben.
    await evictDurableObject(stub);
    ana.send({ t: "pause", choice: "bot", level: 4 });
    const handed = await tableOf(ana, (table) => table.status === "playing");
    expect(handed.seats.jaune).toMatchObject({ online: false, handedOver: 4 });
    expect(handed.pause).toBeNull();
    for (let i = 0; i < 200; i++) {
      if ((await logOf(id)).some((row) => row.seat === "jaune" && row.bot?.level === 4)) break;
      await runDurableObjectAlarm(stub);
    }
    expect((await logOf(id)).some((row) => row.seat === "jaune" && row.bot?.level === 4)).toBe(
      true,
    );

    // Ben comes back: the seat is his again at once, the computer's turn for it dropped.
    await evictDurableObject(stub);
    ben = await hello(id, "b", "Ben", false);
    const welcome = await ben.next("welcome");
    expect(welcome).toMatchObject({ regained: true, you: { seat: "jaune", host: false } });
    expect(welcome.view).not.toBeNull();
    const back = await readTable(id);
    expect(back.seats.jaune).toMatchObject({ kind: "human", handedOver: null });
    expect(back.thinking?.seat).not.toBe("jaune");
    await tableOf(
      ana,
      (table) => table.seats.jaune.handedOver === null && table.seats.jaune.online,
    );

    // Ben's new socket never pings: once its hello is SILENCE_MS old, the next alarm closes it with
    // 4000 and the game pauses again.
    await evictDurableObject(stub);
    const benSeat = back.seats.jaune;
    if (benSeat.kind !== "human") throw new Error("jaune is not Ben's");
    await runInDurableObject(stub, (_room, state) => {
      for (const ws of state.getWebSockets()) {
        const attachment = ws.deserializeAttachment() as { who: string | null; helloAt: number };
        if (attachment.who === benSeat.who) {
          expect(state.getWebSocketAutoResponseTimestamp(ws)).toBeNull();
          ws.serializeAttachment({ ...attachment, helloAt: Date.now() - SILENCE_MS - 5_000 });
        }
      }
    });
    expect((await readTable(id)).deadlines.sweep).toBeDefined();
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await ben.closed).toEqual({ code: CLOSE_SILENT });
    const swept = await tableOf(ana, (table) => table.status === "paused");
    expect(swept.pause?.missing).toEqual(["jaune"]);
    // Ana pings: her socket stays.
    expect(ana.ws.readyState).toBe(WebSocket.OPEN);

    // Ben is back; then Ana leaves: Ben is the chef de table and the game waits for her.
    ben = await hello(id, "b", "Ben");
    await ben.next("welcome", (frame) => frame.table.status === "playing");
    await tableOf(ana, (table) => table.status === "playing");
    ana.ws.close(1000, "bye");
    const roles = await tableOf(ben, (table) => table.status === "paused");
    expect(roles.host).toBe("jaune");
    expect(roles.pause?.missing).toEqual(["bleu"]);
    // And when she returns the role goes back to her.
    const anaBack = await hello(id, "a", "Ana");
    expect(await anaBack.next("welcome")).toMatchObject({ you: { seat: "bleu", host: true } });
    const after = await tableOf(ben, (table) => table.status === "playing");
    expect(after.host).toBe("bleu");
    anaBack.ws.close(1000, "bye");
    ben.ws.close(1000, "bye");
  }, 120_000);
});
