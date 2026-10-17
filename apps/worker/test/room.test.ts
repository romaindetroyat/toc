// The table's Durable Object in workerd, with real SQLite and hibernatable sockets. Every step of the
// game scenario evicts the object first (02-RESEARCH Pitfall 2): the in-memory cache is gone, the
// sockets and their attachments survive, and the table must carry on from its SQLite snapshot.

import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
  SELF,
} from "cloudflare:test";
import { type Action, type Color, type GameEvent, legalActions } from "@toc/engine";
import type { EventsFrame } from "@toc/protocol";
import type { Table } from "@toc/table";
import { describe, expect, it } from "vitest";
import { load } from "../src/storage.ts";
import { type Client, connect, createTable, ORIGIN, token } from "./helpers.ts";

const stubOf = (id: string) => env.GAME_ROOM.getByName(id);

async function readTable(id: string): Promise<Table> {
  const table = await runInDurableObject(stubOf(id), (_room, state) => load(state.storage.sql));
  if (table === null) throw new Error("no table");
  return table;
}

/** Fires the alarm (evicting before each) until no computer player is due. */
async function untilHumanDue(id: string): Promise<Table> {
  for (let i = 0; i < 400; i++) {
    await evictDurableObject(stubOf(id));
    const table = await readTable(id);
    if (table.deadlines.bot === undefined) return table;
    await runDurableObjectAlarm(stubOf(id));
  }
  throw new Error("the computer players never stopped");
}

/** The human seat that must act now, if any. */
function dueHuman(table: Table, humans: Record<Color, Client | undefined>): Color | null {
  const game = table.game;
  if (game === null || game.phase === "won") return null;
  if (game.phase === "exchange") {
    return (["bleu", "jaune"] as const).find((c) => humans[c] && game.given[c] === null) ?? null;
  }
  return humans[game.turn] ? game.turn : null;
}

function handDealt(frame: EventsFrame) {
  return frame.events.filter(
    (event): event is Extract<GameEvent, { t: "handDealt" }> => event.t === "handDealt",
  );
}

describe("router", () => {
  it("creates a table: 201 and a 22-character id", async () => {
    const response = await SELF.fetch(`${ORIGIN}/api/tables`, { method: "POST" });
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("refuses an upgrade without Upgrade (426), a malformed id (404), another site (403)", async () => {
    const id = await createTable();
    expect((await SELF.fetch(`${ORIGIN}/ws/table/${id}`)).status).toBe(426);
    const ws = { Upgrade: "websocket" };
    expect((await SELF.fetch(`${ORIGIN}/ws/table/short`, { headers: ws })).status).toBe(404);
    const evil = await SELF.fetch(`${ORIGIN}/ws/table/${id}`, {
      headers: { ...ws, Origin: "https://evil.example" },
    });
    expect(evil.status).toBe(403);
    const same = await SELF.fetch(`${ORIGIN}/ws/table/${id}`, {
      headers: { ...ws, Origin: ORIGIN },
    });
    expect(same.status).toBe(101);
    expect((await SELF.fetch(`${ORIGIN}/api/nothing`)).status).toBe(404);
  });

  it("closes a socket to a table never created with 4004 and writes nothing", async () => {
    const id = "Zz_never-created-0000a";
    const client = await connect(id);
    expect(await client.closed).toEqual({ code: 4004 });
    const tables = await runInDurableObject(stubOf(id), (_room, state) =>
      state.storage.sql
        .exec("SELECT name FROM sqlite_master WHERE name NOT LIKE '\\_cf\\_%' ESCAPE '\\'")
        .toArray(),
    );
    expect(tables).toEqual([]);
  });
});

describe("a table, two people and two computers", () => {
  it("joins, seats, starts, deals each hand to its owner only, and plays through evictions", async () => {
    const id = await createTable({ pace: "zero" });
    const stub = stubOf(id);

    const ana = await connect(id);
    ana.send({ t: "hello", v: 3, token: token("a"), name: "Ana" });
    expect(await ana.next("welcome")).toMatchObject({
      you: { seat: null, host: true },
      view: null,
    });
    await evictDurableObject(stub);

    const ben = await connect(id);
    ben.send({ t: "hello", v: 3, token: token("b"), name: " Ben " });
    expect(await ben.next("welcome")).toMatchObject({
      you: { seat: null, host: false },
      table: { creatorName: "Ana" },
    });
    await evictDurableObject(stub);

    ana.send({ t: "sit", seat: "bleu" });
    expect(await ana.next("welcome")).toMatchObject({ you: { seat: "bleu", host: true } });
    await evictDurableObject(stub);
    ben.send({ t: "sit", seat: "jaune" });
    expect(await ben.next("welcome")).toMatchObject({ you: { seat: "jaune" } });
    const seen = await ana.next("table");
    expect(seen.table.seats.jaune).toMatchObject({ kind: "human", name: "Ben" });
    await evictDurableObject(stub);

    // Ben is not the host.
    ben.send({ t: "start" });
    expect(await ben.next("error")).toEqual({ t: "error", code: "not-host" });

    ana.send({ t: "start" });
    const humans: Record<Color, Client | undefined> = {
      bleu: ana,
      jaune: ben,
      rouge: undefined,
      vert: undefined,
    };
    for (const [client, seat] of [
      [ana, "bleu"],
      [ben, "jaune"],
    ] as const) {
      const deal = await client.next("events");
      const dealt = handDealt(deal);
      expect(dealt).toHaveLength(4);
      for (const each of dealt) {
        if (each.seat === seat) expect(each.cards).toHaveLength(5);
        else expect(each.cards).toBeNull();
      }
      expect(deal.view.hand).toEqual(dealt.find((d) => d.seat === seat)?.cards);
      expect(deal.view.seat).toBe(seat);
    }

    // The exchange and the first plays: each step after an eviction, the bots through the alarm.
    let humanMoves = 0;
    for (let step = 0; step < 60 && humanMoves < 4; step++) {
      const table = await untilHumanDue(id);
      const seat = dueHuman(table, humans);
      if (seat === null) break;
      const client = humans[seat] as Client;
      const other = (seat === "bleu" ? ben : ana) as Client;
      const game = table.game;
      if (game === null) throw new Error("no game");
      const action = legalActions(game, seat)[0] as Action;
      // A stale base is refused and answered with a fresh welcome.
      if (humanMoves === 0) {
        client.send({ t: "act", base: table.seq + 3, action });
        expect(await client.next("error")).toEqual({ t: "error", code: "stale" });
        expect((await client.next("welcome", (f) => f.seq === table.seq)).seq).toBe(table.seq);
      }
      await evictDurableObject(stub);
      client.send({ t: "act", base: table.seq, action });
      const mine = await client.next("events", (f) => f.seq === table.seq + 1);
      const theirs = await other.next("events", (f) => f.seq === table.seq + 1);
      expect(mine.seq).toBe(table.seq + 1);
      expect(theirs.seq).toBe(mine.seq);
      expect(theirs.view.pawns).toEqual(mine.view.pawns);
      humanMoves += 1;
    }
    expect(humanMoves).toBe(4);

    // After all of that, an illegal action changes nothing.
    const before = await untilHumanDue(id);
    const seat = dueHuman(before, humans) as Color;
    (humans[seat] as Client).send({
      t: "act",
      base: before.seq,
      action: { t: "move", card: "13S", pawn: "rouge0" },
    });
    expect(await (humans[seat] as Client).next("error")).toEqual({ t: "error", code: "illegal" });
    expect(await readTable(id)).toEqual(before);

    // No frame carried a token, a token hash, a full state or the deck rng.
    const table = await readTable(id);
    const people = table.people.map((p) => p.who);
    for (const text of [...ana.raw, ...ben.raw]) {
      expect(text).not.toContain(token("a"));
      expect(text).not.toContain(token("b"));
      for (const who of people) expect(text).not.toContain(who);
      expect(text).not.toContain('"kind":"state"');
      expect(text).not.toContain('"rng"');
      expect(text).not.toContain('"talon"');
    }
  }, 60_000);

  it("closes an older socket of the same device with 4001", async () => {
    const id = await createTable();
    const first = await connect(id);
    first.send({ t: "hello", v: 3, token: token("c"), name: "Clo" });
    await first.next("welcome");
    const second = await connect(id);
    second.send({ t: "hello", v: 3, token: token("c"), name: "Clo" });
    await second.next("welcome");
    expect(await first.closed).toEqual({ code: 4001 });
  });

  it("closes a socket that speaks another protocol version with 4002", async () => {
    const id = await createTable();
    const client = await connect(id);
    client.send({ t: "hello", v: 99, token: token("d"), name: "Dan" });
    expect(await client.closed).toEqual({ code: 4002 });
  });

  it("ignores frames before hello and answers bad frames with bad-frame", async () => {
    const id = await createTable();
    const client = await connect(id);
    client.send({ t: "start" });
    client.ws.send("x".repeat(5000));
    client.send({ t: "hello", v: 3, token: token("e"), name: "Eve" });
    const welcome = await client.next("welcome");
    expect(welcome.you).toEqual({ seat: null, host: true });
    expect(client.frames.map((f) => f.t)).toEqual(["error", "welcome"]);
  });
});
