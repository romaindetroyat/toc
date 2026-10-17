// The computer players at the real pace inside workerd (debug slow-online-bots, 2026-10-17): no test
// pace, only the runtime's own alarms (never runDurableObjectAlarm). Ana (bleu) and Bea (jaune) act
// as soon as it is their turn; the two computers (rouge, vert) must each play within TURN_MS of the
// animation of the move that made them due, measured on the server's own log (the commit times).
//
// Production runs an alarm with Date.now() exactly at its scheduledTime (measured on 2026-10-17: the
// pause's minute ran 0 ms late 4 times in 5), where workerd runs it a few ms later. A computer's play
// time is fractional and an alarm is whole milliseconds: the alarm came at the millisecond below it,
// the tick found it not yet due and armed the same time again, and production drops an alarm left at
// its own time (no write, nothing scheduled) until its rescan about a minute later. The « production »
// cases run every alarm that way: Date.now() reads scheduledTime during the handler, and an alarm the
// handler leaves at scheduledTime (after production's clamp to that Date.now()) is deleted.

import { env, runInDurableObject } from "cloudflare:test";
import { CHOICE_CEILING_MS, FAST_CEILING_MS, HARD_CAP_MS, randomLegal } from "@toc/bots";
import type { Action, Color, GameEvent, PlayerView, Rng } from "@toc/engine";
import type { ServerFrame } from "@toc/protocol";
import type { Table } from "@toc/table";
import { afterEach, describe, expect, it } from "vitest";
import { eventsDuration } from "../../../packages/board/src/motion.ts";
import { GameRoom } from "../src/GameRoom.ts";
import { load } from "../src/storage.ts";
import { type Client, connect, createTable, token } from "./helpers.ts";

/** A computer's turn: its think time (at most CHOICE_CEILING_MS) plus a second for the alarms. */
const TURN_MS = CHOICE_CEILING_MS + 1_000;
/**
 * « Avance rapide » (plan 02-10b): a computer's think time is at most FAST_CEILING_MS; this is the
 * slack left for the alarms and the decision itself (a Galopeur decides in a few ms).
 */
const FAST_SLACK_MS = 250;
/** How long the drive waits for one move before it reports the stall. */
const STALL_MS = 15_000;

const stubOf = (id: string) => env.GAME_ROOM.getByName(id);

type Row = {
  seq: number;
  seat: string | null;
  action: Action | null;
  events: GameEvent[];
  at: number;
  bot: { level: number; slices: number } | null;
};

function logOf(id: string): Promise<Row[]> {
  return runInDurableObject(stubOf(id), (_room, state) =>
    state.storage.sql
      .exec("SELECT seq, seat, action, events, at, bot FROM events ORDER BY seq")
      .toArray()
      .map((row) => ({
        seq: Number(row.seq),
        seat: row.seat === null ? null : String(row.seat),
        action: row.action === null ? null : (JSON.parse(String(row.action)) as Action),
        events: JSON.parse(String(row.events)) as GameEvent[],
        at: Number(row.at),
        bot: row.bot === null ? null : (JSON.parse(String(row.bot)) as Row["bot"]),
      })),
  );
}

async function readTable(id: string): Promise<Table> {
  const table = await runInDurableObject(stubOf(id), (_room, state) => load(state.storage.sql));
  if (table === null) throw new Error("no table");
  return table;
}

function viewAt(client: Client, seq: number): PlayerView | null {
  for (let i = client.frames.length - 1; i >= 0; i--) {
    const frame = client.frames[i] as ServerFrame;
    if ((frame.t === "events" || frame.t === "welcome") && frame.seq === seq && frame.view) {
      return frame.view;
    }
  }
  return null;
}

/**
 * Runs every alarm the way production does (see the header) until the returned function is called.
 */
function deliverAsProduction(): () => void {
  const alarm = GameRoom.prototype.alarm;
  GameRoom.prototype.alarm = async function (this: GameRoom, info?: AlarmInvocationInfo) {
    if (info === undefined) return alarm.call(this, info);
    const fired = info.scheduledTime;
    const storage = (this as unknown as { ctx: DurableObjectState }).ctx.storage;
    const { setAlarm, deleteAlarm } = storage;
    // The alarm the handler leaves, as production stores it: whole ms, never before its Date.now().
    let left: number | null = fired;
    storage.setAlarm = (time, options) => {
      left = Math.max(Math.trunc(Number(time)), fired);
      return setAlarm.call(storage, time, options);
    };
    storage.deleteAlarm = (options) => {
      left = null;
      return deleteAlarm.call(storage, options);
    };
    const now = Date.now;
    Date.now = () => fired;
    try {
      await alarm.call(this, info);
    } finally {
      Date.now = now;
      storage.setAlarm = setAlarm;
      storage.deleteAlarm = deleteAlarm;
    }
    // Left at its own time: production does not schedule it again.
    if (left === fired) await deleteAlarm.call(storage);
  };
  return () => {
    GameRoom.prototype.alarm = alarm;
  };
}

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

/** A computer's play and the commit just before it, which made it due. */
type Turn = { due: Row; move: Row };

/**
 * Ana and Bea sit bleu and jaune, the computers take rouge and vert at `levels` (Galopeur by default),
 * the game starts; the two people act as soon as they are due until the computers' plays in the log
 * are `enough`. Returns each of those plays with the commit that made it due.
 */
async function play(
  levels: Partial<Record<Color, 1 | 2 | 3 | 4 | 5>> | undefined,
  enough: (turns: Turn[]) => boolean,
  options: { fast?: boolean } = {},
): Promise<{ id: string; turns: Turn[] }> {
  const id = await createTable(
    levels === undefined ? { pace: "normal" } : { pace: "normal", levels },
  );
  const ana = await connect(id);
  const bea = await connect(id);
  const people: Record<string, Client> = { bleu: ana, jaune: bea };
  ana.send({ t: "hello", v: 5, token: token("a"), name: "Ana" });
  await ana.next("welcome");
  bea.send({ t: "hello", v: 5, token: token("b"), name: "Bea" });
  await bea.next("welcome");
  ana.send({ t: "sit", seat: "bleu" });
  await ana.next("welcome", (frame) => frame.you.seat === "bleu");
  bea.send({ t: "sit", seat: "jaune" });
  await bea.next("welcome", (frame) => frame.you.seat === "jaune");
  if (options.fast === true) {
    // The chef de table switches the table's « Avance rapide » on before the start (plan 02-10b).
    ana.send({ t: "speed", fast: true });
    await bea.next("table", (frame) => frame.table.fast);
  }
  ana.send({ t: "start" });
  let rng: Rng = [20261017, 11, 13, 17];
  const acted = new Set<string>();
  let lastChange = Date.now();
  let lastSeq = -1;
  for (;;) {
    const log = await logOf(id);
    const turns = log
      .filter((row) => row.bot !== null && row.action?.t !== "give")
      .map((move) => {
        const due = log.find((row) => row.seq === move.seq - 1);
        if (due === undefined) throw new Error(`no row before ${move.seq}`);
        return { due, move };
      });
    if (enough(turns)) {
      ana.ws.close(1000, "bye");
      bea.ws.close(1000, "bye");
      return { id, turns };
    }
    const table = await readTable(id);
    if (table.seq !== lastSeq) {
      lastSeq = table.seq;
      lastChange = Date.now();
    }
    if (Date.now() - lastChange > STALL_MS) {
      throw new Error(
        `stalled at seq ${table.seq}: ${table.thinking?.seat ?? "nobody"} thinking, deadline ${JSON.stringify(table.deadlines.bot)}, ${Date.now() - lastChange} ms without a move`,
      );
    }
    const game = table.game;
    if (game === null) throw new Error("no game");
    for (const [seat, client] of Object.entries(people)) {
      const due =
        game.phase === "exchange"
          ? game.given[seat as Color] === null && game.hands[seat as Color].length > 0
          : game.phase === "play" && game.turn === seat;
      const key = `${seat}@${table.seq}`;
      const view = viewAt(client, table.seq);
      if (!due || acted.has(key) || view === null) continue;
      acted.add(key);
      let action: Action;
      [action, rng] = randomLegal(view, seat as Color, rng);
      client.send({ t: "act", base: table.seq, action });
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * Each computer play, its delay after the commit that made it due, and the budget it had: the
 * animation of that commit at `mode` plus `extra`.
 */
function report(turns: Turn[], extra: number, mode: "normal" | "fast" = "normal") {
  return turns.map(({ due, move }) => ({
    seat: move.seat,
    seq: move.seq,
    delay: move.at - due.at,
    animation: Math.round(eventsDuration(due.events, mode)),
    budget: Math.round(eventsDuration(due.events, mode)) + extra,
    slices: move.bot?.slices,
  }));
}

describe("computer players at the real pace", () => {
  it("two people and two Galopeurs: each computer plays within 3 s of the animation", async () => {
    const { turns } = await play(undefined, (done) => done.length >= 4);
    const rows = report(turns, TURN_MS);
    console.log(`workerd delivery: ${JSON.stringify(rows)}`);
    for (const row of rows) expect(row.delay, JSON.stringify(row)).toBeLessThanOrEqual(row.budget);
  }, 90_000);

  it("the same when every alarm runs at exactly its time, as in production", async () => {
    restore = deliverAsProduction();
    // A computer made due by another computer's move (rouge then vert), inside that move's alarm.
    const byComputer = (turn: Turn) => turn.due.bot !== null;
    const { turns } = await play(
      undefined,
      (done) => done.length >= 12 || (done.length >= 4 && done.some(byComputer)),
    );
    const rows = report(turns, TURN_MS);
    console.log(`production delivery: ${JSON.stringify(rows)}`);
    for (const row of rows) expect(row.delay, JSON.stringify(row)).toBeLessThanOrEqual(row.budget);
    expect(turns.some(byComputer)).toBe(true);
  }, 90_000);

  it("« Avance rapide » on: each Galopeur plays within 0.3 s of the fast animation", async () => {
    restore = deliverAsProduction();
    const byComputer = (turn: Turn) => turn.due.bot !== null;
    const { id, turns } = await play(
      undefined,
      (done) => done.length >= 12 || (done.length >= 6 && done.some(byComputer)),
      { fast: true },
    );
    expect((await readTable(id)).fast).toBe(true);
    const rows = report(turns, FAST_CEILING_MS + FAST_SLACK_MS, "fast");
    console.log(`production delivery, fast: ${JSON.stringify(rows)}`);
    for (const row of rows) expect(row.delay, JSON.stringify(row)).toBeLessThanOrEqual(row.budget);
    expect(rows.length).toBeGreaterThanOrEqual(6);
  }, 90_000);

  it("two Champions still decide in slices, one alarm each, within their cap", async () => {
    restore = deliverAsProduction();
    // Until a decision took more than one slice (a forced move takes one), at most ten plays.
    const { turns } = await play(
      { rouge: 5, vert: 5 },
      (done) =>
        done.length >= 10 ||
        (done.length >= 2 && done.some((turn) => (turn.move.bot?.slices ?? 0) > 1)),
    );
    const rows = report(turns, HARD_CAP_MS + 1_000);
    console.log(`production delivery, Champions: ${JSON.stringify(rows)}`);
    for (const row of rows) {
      expect(row.delay, JSON.stringify(row)).toBeLessThanOrEqual(row.budget);
    }
    expect(rows.some((row) => (row.slices ?? 0) > 1)).toBe(true);
  }, 150_000);
});
