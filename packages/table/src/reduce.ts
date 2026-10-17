// The table reducer (02-RESEARCH Pattern 1): every frame, socket close and alarm of the Durable Object
// becomes one call reduce(table, command, ctx) → { table, out, log }. Pure: the clock is ctx.now and the
// deck seed is ctx.seed(); the input table is never modified. `out` lists the frames to send, each for
// one person (built in frames.ts only); `log` lists the accepted actions with their raw events, kept
// on the server and never sent.
//
// The engine's apply() is the only judge of a move (NET-01): the seat comes from the person, never from
// the frame, and a base that is not the table's seq is refused as stale (Pitfall 3).
//
// Plan 02-07: activity (lastActivity, the 30-day clock of EXPIRY_MS) is a hello or a client frame
// that changed the table, set here once for all; a tick (a computer's move included) or a socket gone
// is not. A tick past the idle days answers `purge`: the Durable Object then deletes everything.

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
  PauseFrame,
  ReclaimAnswerFrame,
  ReclaimFrame,
  ServerFrame,
} from "@toc/protocol";
import { FALLBACK_LEVEL, scheduleBot, stillDue, thinkTick } from "./bots.ts";
import { eventsFrameFor, tableFrame, tablePublic, welcomeFor } from "./frames.ts";
import {
  applyChoice,
  hostOf,
  onExpireDue,
  onGone,
  onHello,
  onPauseChoiceDue,
  resume as resumeGame,
  SWEEP_MS,
  stopGame,
  wantsSweep,
} from "./presence.ts";
import { copyTable, personOf, type Table } from "./table.ts";

export type Command =
  /** A socket said hello: `who` is the hash of the table id and its device token. */
  | { t: "hello"; who: string; name: string }
  /** The last socket of `who` closed, or the Durable Object swept it as silent (plan 02-06). */
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

/**
 * `purge`: the table has been idle for EXPIRY_MS; the Durable Object deletes its whole storage and
 * closes every socket with CLOSE_GONE (plan 02-07, D-06). `table` is then the unchanged input.
 */
export type Reduced = { table: Table; out: Out[]; log: LogEntry[]; purge?: true };

const unchanged = (table: Table): Reduced => ({ table, out: [], log: [] });

function refuse(table: Table, who: string, code: ErrorCode): Reduced {
  return { table, out: [{ to: who, frame: { t: "error", code } }], log: [] };
}

/**
 * A table frame to every person online who is not already sent a snapshot, when the public table
 * changed (someone sat, left, came back, the game started or paused, another computer is now due).
 * The frame carries the server's clock `now`; the comparison leaves it out.
 */
function publicChanges(before: Table, after: Table, skip: ReadonlySet<string>, now: number): Out[] {
  if (JSON.stringify(tablePublic(before, 0)) === JSON.stringify(tablePublic(after, 0))) return [];
  const frame = tableFrame(after, now);
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
  scheduleBot(next, played.events, now);
  const out: Out[] = [];
  for (const person of next.people) {
    if (person.seat === null) continue;
    out.push({ to: person.who, frame: eventsFrameFor(next, played.events, person.seat) });
  }
  out.push(...publicChanges(before, next, new Set(), now));
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
  // Back at the table: the pause may end, a handed-over seat is theirs again (plan 02-06).
  const { regained } = onHello(next, who, now);
  const out: Out[] = [
    { to: who, frame: welcomeFor(next, who, now, regained) },
    ...publicChanges(table, next, new Set([who]), now),
  ];
  // The seat's own person is back: a reclaim of it is void (plan 02-07).
  const seat = personOf(next, who)?.seat ?? null;
  const asked = seat === null ? undefined : next.reclaims[seat];
  if (seat !== null && asked !== undefined) {
    delete next.reclaims[seat];
    out.push({ to: asked.who, frame: { t: "reclaimResult", accepted: false } });
  }
  return { table: next, out, log: [] };
}

function gone(table: Table, who: string, now: number): Reduced {
  if (personOf(table, who)?.online !== true) return unchanged(table);
  const next = copyTable(table);
  const person = personOf(next, who);
  if (person !== undefined) person.online = false;
  // A seated person missing during a game pauses it for everyone (NET-03, D-04).
  onGone(next, who, now);
  return { table: next, out: publicChanges(table, next, new Set([who]), now), log: [] };
}

/**
 * A change of the waiting room: a welcome to each online person whose seat changed (their `you`
 * changed), a table frame to every other person online when the public table changed.
 */
function lobbyChange(before: Table, next: Table, now: number): Reduced {
  const moved = new Set<string>();
  for (const person of next.people) {
    const was = personOf(before, person.who)?.seat ?? null;
    if (person.online && was !== person.seat) moved.add(person.who);
  }
  const out: Out[] = [...moved].map((who) => ({ to: who, frame: welcomeFor(next, who, now) }));
  out.push(...publicChanges(before, next, moved, now));
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
  return { table: next, out: publicChanges(table, next, new Set(), now), log: [] };
}

/**
 * « Quitter la table ». In the waiting room the seat is freed and the person goes; the creator's record
 * stays (unseated, offline) so the role and the name come back with them. Once the game has started a
 * seated person keeps the seat and goes offline: the game pauses for the others as when a socket
 * closes, and the same link brings them back (plan 02-07; the client then closes its socket).
 */
function leave(table: Table, who: string, now: number): Reduced {
  const person = personOf(table, who);
  if (person === undefined) return unchanged(table);
  if (table.status !== "lobby" && person.seat !== null) {
    if (!person.online) return unchanged(table);
    const away = copyTable(table);
    const self = personOf(away, who);
    if (self !== undefined) self.online = false;
    onGone(away, who, now);
    return { table: away, out: publicChanges(table, away, new Set([who]), now), log: [] };
  }
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
  return { table: next, out: publicChanges(table, next, new Set([who]), now), log: [] };
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
  // Nothing is played while the game waits for someone, or once it is saved (D-04).
  if (table.status === "paused" || table.status === "saved") return refuse(table, who, "paused");
  if (table.status !== "playing" || table.game === null || seat === null) {
    return refuse(table, who, "illegal");
  }
  if (frame.base !== table.seq) {
    const stale = refuse(table, who, "stale");
    stale.out.push({ to: who, frame: welcomeFor(table, who, now) });
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

/**
 * The host's choice after the pause's minute (NET-04): the derived host only (T-02-24), while the
 * host is choosing only.
 */
function pause(table: Table, who: string, frame: PauseFrame, now: number): Reduced {
  if (table.status !== "paused" || table.pause === null) return refuse(table, who, "refused");
  if (hostOf(table) !== who) return refuse(table, who, "not-host");
  if (!table.pause.choosing) return refuse(table, who, "refused");
  // The protocol already checked 1 to 5; the core checks again.
  const level = frame.level === undefined ? undefined : parseBotLevel(frame.level);
  if (level === null) return refuse(table, who, "bad-frame");
  const next = copyTable(table);
  applyChoice(next, frame.choice, level, now);
  return { table: next, out: publicChanges(table, next, new Set(), now), log: [] };
}

/** « Reprendre la partie »: the host, on a saved game only. */
function resume(table: Table, who: string, now: number): Reduced {
  if (table.status !== "saved") return refuse(table, who, "refused");
  if (hostOf(table) !== who) return refuse(table, who, "not-host");
  const next = copyTable(table);
  resumeGame(next, now);
  return { table: next, out: publicChanges(table, next, new Set(), now), log: [] };
}

/**
 * « Arrêter la partie » (SC4): the host saves a running or paused game at any moment, in any phase
 * (not a won one, whose next step is the rematch).
 */
function stop(table: Table, who: string, now: number): Reduced {
  const running = table.status === "playing" || table.status === "paused";
  if (!running || table.game === null || table.game.phase === "won") {
    return refuse(table, who, "refused");
  }
  if (hostOf(table) !== who) return refuse(table, who, "not-host");
  const next = copyTable(table);
  stopGame(next, now);
  return { table: next, out: publicChanges(table, next, new Set(), now), log: [] };
}

const noReclaim = (table: Table, who: string): Reduced => ({
  table,
  out: [{ to: who, frame: { t: "reclaimResult", accepted: false } }],
  log: [],
});

/**
 * « C’est moi, {Nom} » (D-12, T-02-28): someone without a seat asks for a started table's seat whose
 * person is offline. Only one pending request per seat and per asker, and only when there is a host
 * to ask; the host alone receives it, with the first name the asker typed. Anything else is answered
 * at once with reclaimResult { accepted: false }.
 */
function reclaim(table: Table, who: string, frame: ReclaimFrame, now: number): Reduced {
  const person = personOf(table, who);
  const seat = table.seats[frame.seat];
  const host = hostOf(table);
  if (
    person === undefined ||
    table.status === "lobby" ||
    person.seat !== null ||
    seat.kind !== "human" ||
    personOf(table, seat.who)?.online === true ||
    table.reclaims[frame.seat] !== undefined ||
    Object.values(table.reclaims).some((each) => each?.who === who) ||
    host === null
  ) {
    return noReclaim(table, who);
  }
  const next = copyTable(table);
  next.reclaims[frame.seat] = { who, name: person.name, since: now };
  return {
    table: next,
    out: [{ to: host, frame: { t: "reclaimRequest", seat: frame.seat, name: person.name } }],
    log: [],
  };
}

/**
 * The host's answer to a pending reclaim. Accepted (and the seat's person still offline): the asker
 * holds the seat, the old person is forgotten (their token no longer opens it), the creator's role
 * follows the creator's seat, and the asker gets the welcome on it (regained when the computer was
 * playing it). Refused: the asker alone reads reclaimResult { accepted: false }.
 */
function reclaimAnswer(table: Table, who: string, frame: ReclaimAnswerFrame, now: number): Reduced {
  if (hostOf(table) !== who) return refuse(table, who, "not-host");
  const asked = table.reclaims[frame.seat];
  if (asked === undefined) return refuse(table, who, "refused");
  const next = copyTable(table);
  delete next.reclaims[frame.seat];
  const asker = personOf(next, asked.who);
  const seat = next.seats[frame.seat];
  if (
    !frame.accept ||
    asker === undefined ||
    asker.seat !== null ||
    seat.kind !== "human" ||
    personOf(next, seat.who)?.online === true
  ) {
    return noReclaim(next, asked.who);
  }
  const old = seat.who;
  next.seats[frame.seat] = { kind: "human", who: asked.who, handedOver: seat.handedOver ?? null };
  asker.seat = frame.seat;
  next.people = next.people.filter((each) => each.who !== old);
  if (next.creator === old) next.creator = asked.who;
  // The asker is at the table now: the pause may end, a handed-over seat is theirs (onHello).
  const { regained } = asker.online ? onHello(next, asked.who, now) : { regained: false };
  return {
    table: next,
    out: [
      { to: asked.who, frame: { t: "reclaimResult", accepted: true } },
      { to: asked.who, frame: welcomeFor(next, asked.who, now, regained) },
      ...publicChanges(table, next, new Set([asked.who]), now),
    ],
    log: [],
  };
}

/**
 * The alarm: every due deadline of the table. The sweep only re-arms itself (the Durable Object
 * closed the silent sockets before this tick); the pause's minute lets the host choose; then the
 * computer player due.
 */
function tick(table: Table, now: number, retry: boolean): Reduced {
  let base = table;
  const edit = (): Table => {
    if (base === table) base = copyTable(table);
    return base;
  };
  const { sweep, pauseChoice, expire } = table.deadlines;
  // EXPIRY_MS idle: the whole table goes (D-06); fired early, the deadline moves (Pattern 3).
  if (expire !== undefined && now >= expire.at && onExpireDue(edit(), now)) {
    return { table, out: [], log: [], purge: true };
  }
  if (sweep !== undefined && now >= sweep.at) edit().deadlines.sweep = { at: now + SWEEP_MS };
  if (pauseChoice !== undefined && now >= pauseChoice.at) onPauseChoiceDue(edit(), now);
  const played = botTick(base, now, retry);
  if (played.table !== base) return played;
  if (base === table) return unchanged(table);
  return { table: base, out: publicChanges(table, base, new Set(), now), log: [] };
}

function botTick(table: Table, now: number, retry: boolean): Reduced {
  const deadline = table.deadlines.bot;
  if (deadline === undefined || now < deadline.at) return unchanged(table);
  const next = copyTable(table);
  const pending = next.thinking;
  if (deadline.seq !== next.seq || pending === null || !stillDue(next, pending)) {
    // A deadline for another state (alarms come at least once): recomputed, nothing played.
    if (pending !== null && !stillDue(next, pending)) next.thinking = null;
    scheduleBot(next, [], now);
    return { table: next, out: publicChanges(table, next, new Set(), now), log: [] };
  }
  const thought = thinkTick(next, now, retry);
  const game = next.game;
  if (thought === null || game === null) {
    // Decided or one slice further: the deadline moves to the next slice or the play time.
    scheduleBot(next, [], now);
    return { table: next, out: publicChanges(table, next, new Set(), now), log: [] };
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

/**
 * The pending reclaims, sent again to the host when the host changed (D-05) or when the host said
 * hello (a reload, another tab): the dialog « Rendre sa place à … ? » follows the chef de table.
 */
function reclaimsForHost(before: Table, result: Reduced, command: Command): Out[] {
  const host = hostOf(result.table);
  if (host === null) return [];
  const hello = command.t === "hello" && command.who === host;
  if (!hello && hostOf(before) === host) return [];
  const out: Out[] = [];
  for (const [seat, asked] of Object.entries(result.table.reclaims)) {
    if (asked === undefined) continue;
    const frame: ServerFrame = { t: "reclaimRequest", seat: seat as Color, name: asked.name };
    out.push({ to: host, frame });
  }
  return out;
}

/**
 * One command of the Durable Object. After it, the sweep deadline is armed while a game runs or waits
 * with a seated person online, and removed otherwise (presence.ts); a hello or a client frame that
 * changed the table is activity (EXPIRY_MS counts from it).
 */
export function reduce(table: Table, command: Command, ctx: Ctx): Reduced {
  let result = route(table, command, ctx);
  if (result.purge === true) return result;
  if (result.table !== table && (command.t === "hello" || command.t === "client")) {
    result.table.lastActivity = ctx.now;
  }
  const again = reclaimsForHost(table, result, command);
  if (again.length > 0) result = { ...result, out: [...result.out, ...again] };
  const wanted = wantsSweep(result.table);
  const armed = result.table.deadlines.sweep !== undefined;
  if (wanted === armed) return result;
  const next = result.table === table ? copyTable(table) : result.table;
  if (wanted) next.deadlines.sweep = { at: ctx.now + SWEEP_MS };
  else delete next.deadlines.sweep;
  return { ...result, table: next };
}

function route(table: Table, command: Command, ctx: Ctx): Reduced {
  switch (command.t) {
    case "hello":
      return hello(table, command.who, command.name, ctx.now);
    case "gone":
      return gone(table, command.who, ctx.now);
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
        case "pause":
          return pause(table, command.who, frame, ctx.now);
        case "resume":
          return resume(table, command.who, ctx.now);
        case "stop":
          return stop(table, command.who, ctx.now);
        case "reclaim":
          return reclaim(table, command.who, frame, ctx.now);
        case "reclaimAnswer":
          return reclaimAnswer(table, command.who, frame, ctx.now);
      }
    }
  }
}
