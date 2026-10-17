// The table reducer (02-RESEARCH Pattern 1): every frame, socket close and alarm of the Durable Object
// becomes one call reduce(table, command, ctx) → { table, out, log }. Pure: the clock is ctx.now and the
// deck seed is ctx.seed(); the input table is never modified. `out` lists the frames to send, each for
// one person (built in frames.ts only); `log` lists the accepted actions with their raw events, kept
// on the server and never sent.
//
// The engine's apply() is the only judge of a move (NET-01): the seat comes from the person, never from
// the frame, and a base that is not the table's seq is refused as stale (Pitfall 3).

import { BOT_NAMES, type BotLevel } from "@toc/bots";
import {
  type Action,
  apply,
  COLORS,
  type Color,
  type GameEvent,
  type GameState,
  IllegalActionError,
  next as nextRandom,
  type Rng,
  shuffle,
  startGame,
} from "@toc/engine";
import type { ActFrame, ErrorCode, ServerFrame, SitFrame, StartFrame } from "@toc/protocol";
import { FALLBACK_LEVEL, scheduleBot, stillDue, thinkTick } from "./bots.ts";
import { eventsFrameFor, personOf, tableFrame, tablePublic, welcomeFor } from "./frames.ts";
import { copyTable, type Table } from "./table.ts";

export type Command =
  /** A socket said hello: `who` is the hash of the table id and its device token. */
  | { t: "hello"; who: string; name: string }
  /** The last socket of `who` closed. */
  | { t: "gone"; who: string }
  /** The alarm fired; `retry` when the runtime retries it after a failed invocation (D-11). */
  | { t: "tick"; retry: boolean }
  /** A frame of a person who said hello. */
  | { t: "client"; who: string; frame: SitFrame | StartFrame | ActFrame };

export type Ctx = {
  now: number;
  /** A fresh deck seed (crypto.getRandomValues in the Durable Object). */
  seed: () => Rng;
};

export type Out = { to: string; frame: ServerFrame };

/** How a computer player's move was decided: its level, the ticks it took, a retry's fallback. */
export type BotInfo = { level: BotLevel; slices: number; fallback: boolean };

/** One accepted change of the game, for the server-only event log. */
export type LogEntry = {
  seq: number;
  gameNo: number;
  seat: Color | null;
  action: Action | null;
  events: GameEvent[];
  /** Present for a computer player's move. */
  bot?: BotInfo;
};

export type Reduced = { table: Table; out: Out[]; log: LogEntry[] };

const unchanged = (table: Table): Reduced => ({ table, out: [], log: [] });

function refuse(table: Table, who: string, code: ErrorCode): Reduced {
  return { table, out: [{ to: who, frame: { t: "error", code } }], log: [] };
}

/**
 * A table frame to every person online who is not already sent a snapshot, when the public table
 * changed (someone sat, left, came back, the game started, another computer is now due).
 */
function publicChanges(before: Table, after: Table, skip: ReadonlySet<string>): Out[] {
  if (JSON.stringify(tablePublic(before)) === JSON.stringify(tablePublic(after))) return [];
  const frame = tableFrame(after);
  return after.people
    .filter((person) => person.online && !skip.has(person.who))
    .map((person) => ({ to: person.who, frame }));
}

/** An accepted change of the game: the new state, the log line, one events frame per seated person. */
function commitPlay(
  before: Table,
  next: Table,
  played: { state: GameState; events: GameEvent[] },
  seat: Color | null,
  action: Action | null,
  now: number,
  bot?: BotInfo,
): Reduced {
  next.game = played.state;
  next.seq += 1;
  next.lastActivity = now;
  scheduleBot(next, played.events, now);
  const out: Out[] = [];
  for (const person of next.people) {
    if (person.seat === null) continue;
    out.push({ to: person.who, frame: eventsFrameFor(next, played.events, person.seat) });
  }
  out.push(...publicChanges(before, next, new Set()));
  const entry: LogEntry = {
    seq: next.seq,
    gameNo: next.gameNo,
    seat,
    action,
    events: played.events,
  };
  if (bot !== undefined) entry.bot = bot;
  const log: LogEntry[] = [entry];
  return { table: next, out, log };
}

function hello(table: Table, who: string, name: string, now: number): Reduced {
  const next = copyTable(table);
  if (next.creator === null) next.creator = who;
  const person = personOf(next, who);
  if (person === undefined) next.people.push({ who, name, seat: null, online: true });
  else {
    person.name = name;
    person.online = true;
  }
  next.lastActivity = now;
  return {
    table: next,
    out: [{ to: who, frame: welcomeFor(next, who) }, ...publicChanges(table, next, new Set([who]))],
    log: [],
  };
}

function gone(table: Table, who: string): Reduced {
  if (personOf(table, who)?.online !== true) return unchanged(table);
  const next = copyTable(table);
  const person = personOf(next, who);
  if (person !== undefined) person.online = false;
  return { table: next, out: publicChanges(table, next, new Set([who])), log: [] };
}

function sit(table: Table, who: string, seat: Color, now: number): Reduced {
  if (table.status !== "lobby") return refuse(table, who, "started");
  const holder = table.seats[seat];
  if (holder.kind === "human") {
    if (holder.who !== who) return refuse(table, who, "seat-taken");
    return { table, out: [{ to: who, frame: welcomeFor(table, who) }], log: [] };
  }
  const next = copyTable(table);
  const person = personOf(next, who);
  if (person === undefined) return unchanged(table);
  if (person.seat !== null) next.seats[person.seat] = { kind: "free" };
  next.seats[seat] = { kind: "human", who };
  person.seat = seat;
  next.lastActivity = now;
  return {
    table: next,
    out: [{ to: who, frame: welcomeFor(next, who) }, ...publicChanges(table, next, new Set([who]))],
    log: [],
  };
}

function start(table: Table, who: string, ctx: Ctx): Reduced {
  if (table.status !== "lobby") return refuse(table, who, "started");
  if (table.creator !== who || personOf(table, who)?.seat == null) {
    return refuse(table, who, "not-host");
  }
  const next = copyTable(table);
  // Like the local game (GameController.createGame): the first dealer, then the horse names.
  const [u, rng] = nextRandom(next.botRng);
  const firstDealer = COLORS[Math.floor(u * COLORS.length)] as Color;
  const [horses, afterNames] = shuffle(BOT_NAMES, rng);
  next.botRng = afterNames;
  let horse = 0;
  for (const color of COLORS) {
    if (next.seats[color].kind === "free") {
      next.seats[color] = { kind: "bot", name: horses[horse++] as string };
    }
  }
  next.status = "playing";
  next.gameNo += 1;
  return commitPlay(table, next, startGame({ firstDealer }, ctx.seed()), null, null, ctx.now);
}

function act(table: Table, who: string, frame: ActFrame, now: number): Reduced {
  const seat = personOf(table, who)?.seat ?? null;
  if (table.status !== "playing" || table.game === null || seat === null) {
    return refuse(table, who, "illegal");
  }
  if (frame.base !== table.seq) {
    const stale = refuse(table, who, "stale");
    stale.out.push({ to: who, frame: welcomeFor(table, who) });
    return stale;
  }
  let played: { state: GameState; events: GameEvent[] };
  try {
    played = apply(table.game, seat, frame.action);
  } catch (error) {
    // A code only: the error's message spells the action out (02-RESEARCH Pattern 4).
    if (error instanceof IllegalActionError) return refuse(table, who, "illegal");
    throw error;
  }
  return commitPlay(table, copyTable(table), played, seat, frame.action, now);
}

function tick(table: Table, now: number, retry: boolean): Reduced {
  const deadline = table.deadlines.bot;
  if (deadline === undefined || now < deadline.at) return unchanged(table);
  const next = copyTable(table);
  const pending = next.thinking;
  if (deadline.seq !== next.seq || pending === null || !stillDue(next, pending)) {
    // A deadline for another state (alarms come at least once): recomputed, nothing played.
    if (pending !== null && !stillDue(next, pending)) next.thinking = null;
    scheduleBot(next, [], now);
    return { table: next, out: publicChanges(table, next, new Set()), log: [] };
  }
  const thought = thinkTick(next, now, retry);
  const game = next.game;
  if (thought === null || game === null) {
    // Decided or one slice further: the deadline moves to the next slice or the play time.
    scheduleBot(next, [], now);
    return { table: next, out: publicChanges(table, next, new Set()), log: [] };
  }
  const seat = pending.seat;
  const bot: BotInfo = {
    level: pending.fallback ? FALLBACK_LEVEL : pending.level,
    slices: pending.slices,
    fallback: pending.fallback,
  };
  next.thinking = null;
  return commitPlay(table, next, apply(game, seat, thought.action), seat, thought.action, now, bot);
}

export function reduce(table: Table, command: Command, ctx: Ctx): Reduced {
  switch (command.t) {
    case "hello":
      return hello(table, command.who, command.name, ctx.now);
    case "gone":
      return gone(table, command.who);
    case "tick":
      return tick(table, ctx.now, command.retry);
    case "client": {
      if (personOf(table, command.who) === undefined) return unchanged(table);
      const frame = command.frame;
      switch (frame.t) {
        case "sit":
          return sit(table, command.who, frame.seat, ctx.now);
        case "start":
          return start(table, command.who, ctx);
        case "act":
          return act(table, command.who, frame, ctx.now);
      }
    }
  }
}
