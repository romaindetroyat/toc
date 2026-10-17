// Every real socket frame of a whole game passes the leak oracle (RULE-19, SC2, T-02-08), inside
// workerd with real SQLite and hibernatable sockets. Ana (bleu) stays connected; Ben (jaune) drops
// twice and comes back with hello; rouge and vert are computer players driven by the alarm; the object
// is evicted every 25 steps.
//
// The frames are judged against the state each was built from. Under the test pace the alarm also
// fires by itself, so the test cannot read the state between two computer moves; instead it reads the
// stored game once, in the same turn as the start, then replays the server's own event log (seat and
// action of every accepted change) through apply(): the state at every seq. At every step the replay is
// checked equal to the stored snapshot, so it is the server's history, not a model of it.

import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import { randomLegal } from "@toc/bots";
import {
  type Action,
  apply,
  type Color,
  type GameState,
  type PlayerView,
  type Rng,
  viewFor,
} from "@toc/engine";
import type { ServerFrame } from "@toc/protocol";
import type { Table } from "@toc/table";
import { frameProblems, leakedCards, sameJson } from "@toc/table/oracle";
import { describe, expect, it } from "vitest";
import { load } from "../src/storage.ts";
import { type Client, connect, createTable, token } from "./helpers.ts";

const stubOf = (id: string) => env.GAME_ROOM.getByName(id);
const ALARM_CAP = 600;
const STEP_CAP = 3000;
const EVICT_EVERY = 25;
/** Ben's socket closes at the first step from each of these on which he is connected. */
const DROPS = [30, 150];

async function readTable(id: string): Promise<Table> {
  const table = await runInDurableObject(stubOf(id), (_room, state) => load(state.storage.sql));
  if (table === null) throw new Error("no table");
  return table;
}

type LogRow = { seq: number; seat: string | null; action: string | null };

/** The server's own log of accepted changes after `seq`, in order. */
function logAfter(id: string, seq: number): Promise<LogRow[]> {
  return runInDurableObject(stubOf(id), (_room, state) =>
    state.storage.sql
      .exec("SELECT seq, seat, action FROM events WHERE seq > ? ORDER BY seq", seq)
      .toArray()
      .map((row) => ({
        seq: Number(row.seq),
        seat: row.seat === null ? null : String(row.seat),
        action: row.action === null ? null : String(row.action),
      })),
  );
}

/** How long a frame may take: wall time, not a poll count (the CPU-heavy Node tests run alongside). */
const FRAME_WAIT_MS = 60_000;

/** Waits until `ready` holds (frames arrive asynchronously on the test's side of the sockets). */
async function until(ready: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + FRAME_WAIT_MS;
  while (Date.now() < deadline) {
    if (ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** The latest view a client received for `seq` (its own events or welcome frame). */
function viewAt(client: Client, seq: number): PlayerView | null {
  for (let i = client.frames.length - 1; i >= 0; i--) {
    const frame = client.frames[i] as ServerFrame;
    if ((frame.t === "events" || frame.t === "welcome") && frame.seq === seq && frame.view) {
      return frame.view;
    }
  }
  return null;
}

/** One socket's frames and who read them: frames before index `seatedFrom` reached an unseated person. */
type Reader = { name: string; client: Client; seat: Color; seatedFrom: number };

describe("leak oracle on the real frames of a whole game", () => {
  it("passes on every frame of both sockets, through reconnects and evictions", async () => {
    const id = await createTable({ pace: "zero" });
    const stub = stubOf(id);
    const readers: Reader[] = [];

    const ana = await connect(id);
    ana.send({ t: "hello", v: 1, token: token("a"), name: "Ana" });
    await ana.next("welcome");
    let ben = await connect(id);
    ben.send({ t: "hello", v: 1, token: token("b"), name: "Ben" });
    await ben.next("welcome");
    readers.push({ name: "ana", client: ana, seat: "bleu", seatedFrom: ana.raw.length });
    ana.send({ t: "sit", seat: "bleu" });
    await ana.next("welcome");
    readers.push({ name: "ben#1", client: ben, seat: "jaune", seatedFrom: ben.raw.length });
    ben.send({ t: "sit", seat: "jaune" });
    await ben.next("welcome");

    // The person ids live on the server only; no frame may carry one, nor a device token.
    const lobby = await readTable(id);
    const forbidden = [...lobby.people.map((person) => person.who), token("a"), token("b")];
    const creator = lobby.creator;

    // The start, delivered inside the object, and the stored game read in the same turn: no alarm can
    // run in between, so this is the game at the start's seq.
    const started = await runInDurableObject(stub, async (room, state) => {
      const socket = state
        .getWebSockets()
        .find((ws) => (ws.deserializeAttachment() as { who?: string }).who === creator);
      if (socket === undefined) throw new Error("no socket for the creator");
      await room.webSocketMessage(socket, JSON.stringify({ t: "start" }));
      return load(state.storage.sql);
    });
    if (started?.game == null) throw new Error("the game did not start");
    const states = new Map<number, GameState>([[started.seq, started.game]]);
    let known = started.seq;

    /** Extends the history up to the stored table's seq and checks it against the snapshot. */
    async function follow(table: Table): Promise<void> {
      for (const row of await logAfter(id, known)) {
        expect(row.seq).toBe(known + 1);
        const before = states.get(known) as GameState;
        if (row.seat === null || row.action === null) throw new Error(`no action at ${row.seq}`);
        states.set(
          row.seq,
          apply(before, row.seat as Color, JSON.parse(row.action) as Action).state,
        );
        known = row.seq;
      }
      expect(known).toBeGreaterThanOrEqual(table.seq);
      expect(sameJson(states.get(table.seq), table.game)).toBe(true);
    }

    let rng: Rng = [20261017, 2, 3, 4];
    let alarms = 0;
    let evictions = 0;
    let humanActs = 0;
    let away = false;
    let drops = 0;
    let reconnects = 0;
    let won = false;
    for (let step = 0; step < STEP_CAP; step++) {
      if (step % EVICT_EVERY === 0) {
        await evictDurableObject(stub);
        evictions += 1;
      }
      const table = await readTable(id);
      await follow(table);
      const game = table.game as GameState;
      if (game.phase === "won") {
        won = true;
        break;
      }
      // Ben's socket closes (a phone locked, a tunnel): the table goes on without him.
      if (!away && drops < DROPS.length && step >= (DROPS[drops] as number)) {
        ben.ws.close(1000, "bye");
        await ben.closed;
        drops += 1;
        away = true;
        for (let i = 0; i < 500; i++) {
          const now = await readTable(id);
          if (now.people.find((p) => p.name === "Ben")?.online === false) break;
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        continue;
      }
      if (table.deadlines.bot !== undefined) {
        if (alarms >= ALARM_CAP) break;
        await runDurableObjectAlarm(stub);
        alarms += 1;
        continue;
      }
      const seat: Color =
        game.phase === "exchange"
          ? ((["bleu", "jaune"] as const).find((c) => game.given[c] === null) as Color)
          : game.turn;
      if (seat !== "bleu" && seat !== "jaune") throw new Error(`no computer due, ${seat} to play`);
      if (seat === "jaune" && away) {
        // Ben comes back: a new socket, hello with the same device token.
        ben = await connect(id);
        readers.push({ name: `ben#${reconnects + 2}`, client: ben, seat: "jaune", seatedFrom: 0 });
        ben.send({ t: "hello", v: 1, token: token("b"), name: "Ben" });
        const welcome = await ben.next("welcome");
        expect(welcome.you).toEqual({ seat: "jaune", host: false });
        const at = (await readTable(id)).seq;
        await follow(await readTable(id));
        expect(welcome.seq).toBeLessThanOrEqual(at);
        expect(sameJson(welcome.view, viewFor(states.get(welcome.seq) as GameState, "jaune"))).toBe(
          true,
        );
        away = false;
        reconnects += 1;
        continue;
      }
      // The human due plays from the view its own socket received for this seq.
      const client = seat === "bleu" ? ana : ben;
      await until(() => viewAt(client, table.seq) !== null, `${seat}'s view at ${table.seq}`);
      let action: Action;
      [action, rng] = randomLegal(viewAt(client, table.seq) as PlayerView, seat, rng);
      client.send({ t: "act", base: table.seq, action });
      await until(() => viewAt(client, table.seq + 1) !== null, `${seat}'s events after its act`);
      humanActs += 1;
    }

    expect(won, "the game reached gameWon within the caps").toBe(true);
    expect(drops).toBe(2);
    expect(reconnects).toBe(2);
    expect(evictions).toBeGreaterThan(5);
    expect(alarms).toBeGreaterThan(0);
    expect(humanActs).toBeGreaterThan(20);

    // Every frame of every socket, judged against the state it was built from.
    let checked = 0;
    for (const reader of readers) {
      let lastSeq = 0;
      for (const [index, text] of reader.client.raw.entries()) {
        const frame = JSON.parse(text) as ServerFrame;
        const seat = index < reader.seatedFrom ? null : reader.seat;
        if (frame.t === "welcome" || frame.t === "events") lastSeq = frame.seq;
        const after = states.get(lastSeq) ?? null;
        const before = frame.t === "events" ? (states.get(lastSeq - 1) ?? null) : after;
        expect(leakedCards(text, before, after, seat), `${reader.name} frame ${index}`).toEqual([]);
        expect(
          frameProblems(frame, after, seat, forbidden),
          `${reader.name} frame ${index}`,
        ).toEqual([]);
        checked += 1;
      }
    }
    // Ana was connected the whole game: she received every batch, from the deal to the win.
    const anaSeqs = new Set(
      ana.frames.filter((frame) => frame.t === "events").map((frame) => frame.seq),
    );
    for (let seq = started.seq; seq <= known; seq++)
      expect(anaSeqs.has(seq), `seq ${seq}`).toBe(true);
    const last = ana.frames.filter((frame) => frame.t === "events").at(-1);
    expect(last?.t === "events" && last.events.some((event) => event.t === "gameWon")).toBe(true);
    expect(checked).toBeGreaterThan(known);
    console.log(
      `leak oracle (workerd): ${checked} frames over ${known} seqs, ${alarms} alarms, ${humanActs} human acts, ${reconnects} reconnects, ${evictions} evictions`,
    );
  }, 240_000);
});
