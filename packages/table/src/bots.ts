// The computer players of an online table (plan 02-03, D-11; 02-RESEARCH Pattern 8, Pitfalls 3, 4, 6).
// The same rule as the local game (apps/web GameController): a computer player decides first, then
// plays when the think time its decision deserves is over, so its own thinking is inside that time.
// - Due: during the exchange the first computer seat (COLORS order) whose give is missing, one at a
//   time, so their gives are staggered by their own think times (at least SINGLE_BASE_MS apart); in
//   play the turn seat when a computer holds it. It becomes due in the commit that made it due (dueAt)
//   and is kept in table.thinking, whose seat is TablePublic.thinking (the « réfléchit » sign).
// - Decide: the tick that finds it due. Levels 1 to 4 (and every exchange) decide in that one tick.
//   The Champion's search runs SLICE_UNITS units per tick, one alarm invocation each, its checkpoint
//   stored in table.thinking (so in the SQLite snapshot), the next slice due at once; when its budget
//   is spent, or HARD_CAP_MS after dueAt, its best move so far is the decision.
// - Play: playAt = dueAt + eventsDuration(last batch, "normal") + paceFor(thought, "normal", u), u drawn
//   from the table's bot rng after the decision (like the local game), never before the decision
//   tick. Under the zero test pace there is no wait, no think time and no cap (hardCap("test")).
// - A retried alarm (the previous invocation failed, for instance over the Free plan's CPU limit) that
//   finds the decision still pending decides at FALLBACK_LEVEL (randomLegal) and marks it: the table
//   never freezes.
// - Every deadline is re-checked when it fires (alarms come at least once): the seq for a play, the
//   give still missing for an exchange; otherwise nothing is played and the deadline is recomputed.
// The bot sees viewFor(game, seat) only (T-02-11). Pure: the clock is the caller's `now`.

import { eventsDuration } from "@toc/board";
import {
  type BotLevel,
  chooseAction,
  createThinker,
  hardCap,
  paceFor,
  type Speed,
  type Thought,
} from "@toc/bots";
import { type GameEvent, next as nextRandom, viewFor } from "@toc/engine";
import { computerLevel, dueBot, type PendingThink, type Table } from "./table.ts";

/**
 * Units of the Champion's search per alarm invocation. One rollout (1 + CHAMPION_PLIES = 5 units) is
 * the finest step the search has; `node tools/bench-bots.mjs --level 5 --slice N` on the 40 bench
 * positions (2026-10-17, this machine, ms per slice with the checkpoint round trip):
 * N 5: p50 0.55, p95 5.47, max 25.9, 57 slices per decision; N 8: p95 9.8; N 16: p95 16.9;
 * N 30: p95 23.1; N 60: p95 39.8. The smallest slice keeps the p95 nearest the 5 ms target (half of
 * the assumed 10 ms Free-plan limit, 02-RESEARCH A2); see 02-03-SUMMARY for the full table.
 */
export const SLICE_UNITS = 5;

/** The level of a decision made by a retried alarm: randomLegal, which cannot run out of CPU. */
export const FALLBACK_LEVEL: BotLevel = 1;

/** The pace the table's computer players follow: the local game's normal pace, none under the test pace. */
export function speedOf(table: Table): Speed {
  return table.test?.pace === "zero" ? "test" : "normal";
}

/** Whether `pending` is still the decision of the computer player due on this table. */
export function stillDue(table: Table, pending: PendingThink): boolean {
  const game = table.game;
  if (table.status !== "playing" || game === null) return false;
  // A seat given back to its person (plan 02-06) is no longer the computer's.
  if (computerLevel(table, pending.seat) === null) return false;
  if (pending.base === "exchange") {
    return game.phase === "exchange" && game.given[pending.seat] === null;
  }
  return game.phase === "play" && pending.base === table.seq && game.turn === pending.seat;
}

/**
 * After a change of the table (`events` the batch it produced, at `now`): keeps the pending decision if
 * it is still due, else makes the computer player now due pending (or none), and arms its deadline for
 * the table's seq. Edits `table` (a copy owned by the reducer).
 */
export function scheduleBot(table: Table, events: readonly GameEvent[], now: number): void {
  const kept = table.thinking ?? null;
  if (kept !== null && stillDue(table, kept)) {
    table.thinking = kept;
  } else {
    const seat = dueBot(table);
    const game = table.game;
    table.thinking =
      seat === null || game === null
        ? null
        : {
            seat,
            base: game.phase === "exchange" ? "exchange" : table.seq,
            level: computerLevel(table, seat) ?? table.levels[seat],
            dueAt: now,
            waitMs: speedOf(table) === "test" ? 0 : eventsDuration(events, "normal"),
            checkpoint: null,
            slices: 0,
            thought: null,
            playAt: null,
            fallback: false,
          };
  }
  const pending = table.thinking;
  if (pending === null) {
    delete table.deadlines.bot;
    return;
  }
  // Undecided: due at once (decide first). Decided: at its play time.
  const at = pending.thought === null ? pending.dueAt : (pending.playAt ?? pending.dueAt);
  table.deadlines.bot = { at, seq: table.seq };
}

/**
 * One tick of the pending decision at `now`: decides (in one go, one Champion slice, the best so far
 * at the cap, or at FALLBACK_LEVEL when `retry`), then returns the thought when its play time has come,
 * else null. Edits `table` (a copy owned by the reducer): the checkpoint, the decision, the bot rng.
 */
export function thinkTick(table: Table, now: number, retry: boolean): Thought | null {
  const pending = table.thinking;
  const game = table.game;
  if (pending === null || game === null) return null;
  if (pending.thought === null) {
    pending.slices += 1;
    const view = viewFor(game, pending.seat);
    let thought: Thought;
    if (retry) {
      thought = chooseAction(view, pending.seat, FALLBACK_LEVEL, table.botRng);
      pending.fallback = true;
    } else {
      const thinker = createThinker(
        view,
        pending.seat,
        pending.level,
        table.botRng,
        undefined,
        pending.checkpoint,
      );
      const cap = hardCap(speedOf(table));
      const capped = cap !== null && now - pending.dueAt >= cap;
      if (!capped && !thinker.step(SLICE_UNITS)) {
        pending.checkpoint = thinker.checkpoint();
        return null;
      }
      thought = thinker.result();
    }
    // Like the local game: the rng moves on with the decision, then the think time's draw.
    let u: number;
    [u, table.botRng] = nextRandom(thought.rng);
    pending.checkpoint = null;
    pending.thought = thought;
    pending.playAt = Math.max(
      now,
      pending.dueAt + pending.waitMs + paceFor(thought, speedOf(table), u),
    );
  }
  if (pending.playAt === null || now < pending.playAt) return null;
  return pending.thought;
}
