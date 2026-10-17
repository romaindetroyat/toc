// The table reducer (02-RESEARCH Pattern 1): every frame, socket close and alarm of the Durable Object
// becomes one call reduce(table, command, ctx) → { table, out, log }. Pure: the clock is ctx.now and the
// deck seed is ctx.seed(); the input table is never modified. `out` lists the frames to send, each for
// one person (built in frames.ts only); `log` lists the accepted actions with their raw events, kept
// on the server and never sent.
//
// The engine's apply() is the only judge of a move (NET-01): the seat comes from the person, never from
// the frame, and a base that is not the table's seq is refused as stale (Pitfall 3).

import { BOT_NAMES, type BotLevel, parseBotLevel } from "@toc/bots";
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
import type {
  ActFrame,
  ClientFrame,
  ErrorCode,
  HelloFrame,
  LevelFrame,
  MoveFrame,
  ServerFrame,
} from "@toc/protocol";
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
  | { t: "client"; who: string; frame: Exclude<ClientFrame, HelloFrame> };

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

/**
 * A change of the waiting room: a welcome to each online person whose seat changed (their `you`
 * changed), a table frame to every other person online when the public table changed.
 */
function lobbyChange(before: Table, next: Table, now: number): Reduced {
  next.lastActivity = now;
  const moved = new Set<string>();
  for (const person of next.people) {
    const was = personOf(before, person.who)?.seat ?? null;
    if (person.online && was !== person.seat) moved.add(person.who);
  }
  const out: Out[] = [...moved].map((who) => ({ to: who, frame: welcomeFor(next, who) }));
  out.push(...publicChanges(before, next, moved));
  return { table: next, out, log: [] };
}

const isFull = (table: Table) => COLORS.every((color) => table.seats[color].kind === "human");

function sit(table: Table, who: string, seat: Color, now: number): Reduced {
  if (table.status !== "lobby") return refuse(table, who, "started");
  const holder = table.seats[seat];
  if (holder.kind === "human") {
    if (holder.who === who) {
      return { table, out: [{ to: who, frame: welcomeFor(table, who) }], log: [] };
    }
    // Someone without a seat finds the four seats held by people (D-12, « La table est complète »).
    if (personOf(table, who)?.seat === null && isFull(table)) {
      return refuse(table, who, "table-full");
    }
    return refuse(table, who, "seat-taken");
  }
  const next = copyTable(table);
  const person = personOf(next, who);
  if (person === undefined) return unchanged(table);
  // The old seat is free again, at the table's level for that colour (Galopeur unless the host chose).
  if (person.seat !== null) next.seats[person.seat] = { kind: "free" };
  next.seats[seat] = { kind: "human", who };
  person.seat = seat;
  return lobbyChange(table, next, now);
}

/** « Libérer ma place »: the person stays at the table without a seat. */
function stand(table: Table, who: string, now: number): Reduced {
  if (table.status !== "lobby") return refuse(table, who, "started");
  const seat = personOf(table, who)?.seat ?? null;
  if (seat === null) return unchanged(table);
  const next = copyTable(table);
  next.seats[seat] = { kind: "free" };
  const person = personOf(next, who);
  if (person !== undefined) person.seat = null;
  return lobbyChange(table, next, now);
}

/** The host moves a person to a free seat, or swaps two people (D-03). */
function move(table: Table, who: string, frame: MoveFrame, now: number): Reduced {
  if (table.status !== "lobby") return refuse(table, who, "started");
  if (table.creator !== who) return refuse(table, who, "not-host");
  const from = table.seats[frame.who];
  if (from.kind !== "human") return refuse(table, who, "illegal");
  if (frame.who === frame.to) return unchanged(table);
  const next = copyTable(table);
  const mover = personOf(next, from.who);
  if (mover === undefined) return unchanged(table);
  const target = next.seats[frame.to];
  if (target.kind === "human") {
    next.seats[frame.who] = { kind: "human", who: target.who };
    const other = personOf(next, target.who);
    if (other !== undefined) other.seat = frame.who;
  } else {
    next.seats[frame.who] = { kind: "free" };
  }
  next.seats[frame.to] = { kind: "human", who: from.who };
  mover.seat = frame.to;
  return lobbyChange(table, next, now);
}

/** The host sets the strength of a free seat; saved at once, seen by everyone (D-03). */
function level(table: Table, who: string, frame: LevelFrame, now: number): Reduced {
  if (table.status !== "lobby") return refuse(table, who, "started");
  if (table.creator !== who) return refuse(table, who, "not-host");
  // The protocol already checked 1 to 5; the core checks again (T-02-21).
  const value = parseBotLevel(frame.level);
  if (value === null) return refuse(table, who, "bad-frame");
  if (table.seats[frame.seat].kind !== "free") return refuse(table, who, "seat-taken");
  if (table.levels[frame.seat] === value) return unchanged(table);
  const next = copyTable(table);
  next.levels[frame.seat] = value;
  next.lastActivity = now;
  return { table: next, out: publicChanges(table, next, new Set()), log: [] };
}

/**
 * « Quitter la table » in the waiting room: the seat is freed and the person goes. The creator's record
 * stays (unseated, offline) so the role and the name come back with them (plan 02-06 adds the
 * hand-over). Once the game runs only someone without a seat may go this way (02-07 adds the rest).
 */
function leave(table: Table, who: string, now: number): Reduced {
  const person = personOf(table, who);
  if (person === undefined) return unchanged(table);
  if (table.status !== "lobby" && person.seat !== null) return refuse(table, who, "started");
  const next = copyTable(table);
  if (person.seat !== null) next.seats[person.seat] = { kind: "free" };
  if (who === next.creator) {
    const creator = personOf(next, who);
    if (creator !== undefined) {
      creator.seat = null;
      creator.online = false;
    }
  } else {
    next.people = next.people.filter((each) => each.who !== who);
  }
  next.lastActivity = now;
  return { table: next, out: publicChanges(table, next, new Set([who])), log: [] };
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
        case "stand":
          return stand(table, command.who, ctx.now);
        case "move":
          return move(table, command.who, frame, ctx.now);
        case "level":
          return level(table, command.who, frame, ctx.now);
        case "leave":
          return leave(table, command.who, ctx.now);
        case "start":
          return start(table, command.who, ctx);
        case "act":
          return act(table, command.who, frame, ctx.now);
      }
    }
  }
}
