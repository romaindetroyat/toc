// The computer players of an online table inside workerd (plan 02-03, D-11): real SQLite, real alarms,
// hibernatable sockets, evictDurableObject between steps. One person (Ana, bleu) plays with randomLegal
// from the view her own socket received; the computers play through the alarm, the Champion in slices
// of SLICE_UNITS units, one alarm invocation each, its checkpoint stored with the table.
// Under the test pace the alarm also fires by itself, so the test reads the server's own log (one row
// per accepted change, with the computer's level, slices and fallback flag) rather than the table
// between two computer moves.

import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import { CHAMPION_BUDGET, chooseAction, randomLegal } from "@toc/bots";
import {
  type Action,
  type Color,
  type GameState,
  type PlayerView,
  type Rng,
  viewFor,
} from "@toc/engine";
import type { ServerFrame } from "@toc/protocol";
import { SLICE_UNITS, type Table } from "@toc/table";
import { describe, expect, it } from "vitest";
import { commit, load } from "../src/storage.ts";
import { type Client, connect, createTable, token } from "./helpers.ts";

const stubOf = (id: string) => env.GAME_ROOM.getByName(id);
const STEP_CAP = 4000;
const EVICT_EVERY = 20;
/** Each setAlarm() is billed as one row written (Cloudflare Durable Objects pricing). */
const ALARM_ROWS = 1;

async function readTable(id: string): Promise<Table> {
  const table = await runInDurableObject(stubOf(id), (_room, state) => load(state.storage.sql));
  if (table === null) throw new Error("no table");
  return table;
}

type BotInfo = { level: number; slices: number; fallback: boolean };
type LogRow = { seq: number; seat: string | null; action: Action | null; bot: BotInfo | null };

function logOf(id: string): Promise<LogRow[]> {
  return runInDurableObject(stubOf(id), (_room, state) =>
    state.storage.sql
      .exec("SELECT seq, seat, action, bot FROM events ORDER BY seq")
      .toArray()
      .map((row) => ({
        seq: Number(row.seq),
        seat: row.seat === null ? null : String(row.seat),
        action: row.action === null ? null : (JSON.parse(String(row.action)) as Action),
        bot: row.bot === null ? null : (JSON.parse(String(row.bot)) as BotInfo),
      })),
  );
}

/** How long a frame may take to arrive: generous, the whole suite runs CPU-heavy tests alongside. */
const FRAME_WAIT_MS = 60_000;

async function until(ready: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + FRAME_WAIT_MS;
  while (Date.now() < deadline) {
    if (ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error(`timed out waiting for ${what}`);
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

/** Ana creates the table with `test`, sits bleu and (by default) starts; computers take the others. */
async function seatAna(test: unknown, start = true): Promise<{ id: string; ana: Client }> {
  const id = await createTable(test);
  const ana = await connect(id);
  ana.send({ t: "hello", v: 4, token: token("a"), name: "Ana" });
  await ana.next("welcome");
  ana.send({ t: "sit", seat: "bleu" });
  await ana.next("welcome", (frame) => frame.you.seat === "bleu");
  if (start) {
    ana.send({ t: "start" });
    await ana.next("events");
  }
  return { id, ana };
}

/**
 * Drives the table until `done` holds: Ana acts when she is due (randomLegal on her own view), the
 * alarm is run when a computer is due (it also fires by itself), the object is evicted every
 * EVICT_EVERY steps.
 */
async function drive(
  id: string,
  ana: Client,
  done: (table: Table) => boolean,
): Promise<{ table: Table; alarms: number; acts: number; evictions: number }> {
  const stub = stubOf(id);
  let rng: Rng = [20261017, 3, 5, 7];
  let alarms = 0;
  let acts = 0;
  let evictions = 0;
  for (let step = 0; step < STEP_CAP; step++) {
    if (step % EVICT_EVERY === 0) {
      await evictDurableObject(stub);
      evictions += 1;
    }
    const table = await readTable(id);
    if (done(table)) return { table, alarms, acts, evictions };
    const game = table.game;
    if (game === null) throw new Error("no game");
    const anaDue = game.phase === "exchange" ? game.given.bleu === null : game.turn === "bleu";
    if (!anaDue || game.phase === "won") {
      if (table.deadlines.bot === undefined) throw new Error("nobody is due");
      if (await runDurableObjectAlarm(stub)) alarms += 1;
      continue;
    }
    await until(() => viewAt(ana, table.seq) !== null, `Ana's view at ${table.seq}`);
    let action: Action;
    [action, rng] = randomLegal(viewAt(ana, table.seq) as PlayerView, "bleu", rng);
    ana.send({ t: "act", base: table.seq, action });
    await until(
      () => viewAt(ana, table.seq + 1) !== null,
      `Ana's events after her act at ${table.seq} (last frames: ${JSON.stringify(
        ana.frames
          .slice(-3)
          .map((f) => [f.t, "seq" in f ? f.seq : null, f.t === "error" ? f.code : null]),
      )})`,
    );
    acts += 1;
  }
  throw new Error("the table did not get there within the step cap");
}

/** Rows written by one commit of `table` with `logLines` lines, measured on this object's SQLite. */
function rowsOfCommit(id: string, logLines: number): Promise<number> {
  return runInDurableObject(stubOf(id), (_room, state) => {
    const table = load(state.storage.sql) as Table;
    const lines = Array.from({ length: logLines }, (_, i) => ({
      seq: 1_000_000 + i,
      gameNo: 99,
      seat: "rouge" as Color,
      action: null,
      events: [],
      bot: { level: 5 as const, slices: 1, fallback: false },
    }));
    const rows = commit(state.storage.sql, table, lines, Date.now());
    state.storage.sql.exec("DELETE FROM events WHERE seq >= 1000000");
    return rows;
  });
}

describe("computer players in the Durable Object", () => {
  it("one person and three Champions play a whole deal through alarms and slices", async () => {
    const { id, ana } = await seatAna({
      pace: "zero",
      levels: { jaune: 5, rouge: 5, vert: 5 },
    });
    const run = await drive(id, ana, (table) => (table.game?.dealsPlayed ?? 0) >= 1);
    const log = await logOf(id);
    const champions = log.filter((row) => row.bot !== null);
    expect(champions.length).toBeGreaterThan(3);
    const maxSlices = Math.ceil(CHAMPION_BUDGET.plies / SLICE_UNITS);
    for (const row of champions) {
      expect(row.bot?.level).toBe(5);
      expect(row.bot?.fallback).toBe(false);
      expect(row.bot?.slices).toBeGreaterThanOrEqual(1);
      expect(row.bot?.slices).toBeLessThanOrEqual(maxSlices);
    }
    // Ana's moves carry no computer info.
    expect(log.filter((row) => row.seat === "bleu").every((row) => row.bot === null)).toBe(true);
    expect(run.evictions).toBeGreaterThan(1);

    // The row budget (D-11, T-02-13): each slice is one table UPSERT and one setAlarm; the tick that
    // plays also writes its log line.
    const snapshotRows = await rowsOfCommit(id, 0);
    const playRows = await rowsOfCommit(id, 1);
    const slices = champions.map((row) => row.bot?.slices as number);
    const searched = slices.filter((n) => n > 1);
    const rowsPerDecision = (n: number) =>
      (n - 1) * (snapshotRows + ALARM_ROWS) + playRows + ALARM_ROWS;
    const total = slices.reduce((sum, n) => sum + rowsPerDecision(n), 0);
    console.log(
      `rows (workerd): snapshot commit ${snapshotRows} row(s), commit with a log line ${playRows}; ` +
        `${champions.length} Champion decisions in the deal (${searched.length} searched), ` +
        `slices mean ${(slices.reduce((a, b) => a + b, 0) / slices.length).toFixed(1)} max ${Math.max(...slices)}; ` +
        `rows per Champion decision mean ${(total / champions.length).toFixed(1)}, max ${rowsPerDecision(Math.max(...slices))}; ` +
        `rows for the deal's Champion decisions ${total}; ${run.alarms} alarms run by the test, ${run.acts} acts by Ana`,
    );
    expect(snapshotRows).toBeGreaterThanOrEqual(1);
  }, 300_000);

  it("one person and levels 2, 3, 4 play a whole game to gameWon", async () => {
    const { id, ana } = await seatAna({ pace: "zero", levels: { jaune: 2, rouge: 3, vert: 4 } });
    const run = await drive(id, ana, (table) => table.game?.phase === "won");
    const log = await logOf(id);
    const last = log.at(-1);
    expect(run.table.game?.phase).toBe("won");
    expect(run.table.deadlines.bot).toBeUndefined();
    expect(run.table.thinking).toBeNull();
    // One row per seq: no computer ever played twice for one seq.
    expect(new Set(log.map((row) => row.seq)).size).toBe(log.length);
    for (const row of log) {
      if (row.seat === null || row.seat === "bleu") continue;
      const level = { jaune: 2, rouge: 3, vert: 4 }[row.seat as "jaune" | "rouge" | "vert"];
      expect(row.bot).toEqual({ level, slices: 1, fallback: false });
    }
    expect(last?.seq).toBe(run.table.seq);
    expect(run.acts).toBeGreaterThan(20);
    console.log(
      `levels 2-4 (workerd): ${log.length} log rows to gameWon, ${run.alarms} alarms run by the test, ${run.acts} acts by Ana, ${run.evictions} evictions`,
    );
  }, 300_000);

  it("a retried alarm decides at level 1 and the log marks the fallback", async () => {
    const { id, ana } = await seatAna(
      { pace: "normal", levels: { jaune: 5, rouge: 5, vert: 5 } },
      false,
    );
    const stub = stubOf(id);
    // The start, then at once the alarm that runs the first decision, delivered as a retry (as if its
    // first invocation had failed), inside one turn of the object so the real alarm cannot run first.
    const { before, decided } = await runInDurableObject(stub, async (room, state) => {
      const socket = state.getWebSockets()[0];
      if (socket === undefined) throw new Error("no socket");
      await room.webSocketMessage(socket, JSON.stringify({ t: "start" }));
      const before = load(state.storage.sql) as Table;
      await room.alarm({ isRetry: true, retryCount: 1, scheduledTime: Date.now() });
      return { before, decided: load(state.storage.sql) as Table };
    });
    const seat = before.thinking?.seat as Color;
    expect(before.thinking).toMatchObject({ thought: null, slices: 0 });
    const fallback = chooseAction(viewFor(before.game as GameState, seat), seat, 1, before.botRng);
    expect(decided.thinking).toMatchObject({ seat, fallback: true, slices: 1, thought: fallback });
    expect(decided.seq).toBe(before.seq);
    // Played by the real alarm once the deal is animated and the think time is over.
    let log: LogRow[] = [];
    for (let i = 0; i < 300; i++) {
      log = await logOf(id);
      if (log.some((row) => row.seat === seat)) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(log.find((row) => row.seat === seat)).toMatchObject({
      action: fallback.action,
      bot: { level: 1, slices: 1, fallback: true },
    });
    ana.ws.close(1000, "bye");
  }, 60_000);
});
