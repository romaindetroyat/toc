// The table protocol: every frame a browser and the table's Durable Object exchange, validated with
// zod/mini on both sides (CLAUDE.md: the server treats every client frame as hostile).
//
// Client → server: hello (always first), sit, stand, move, level, leave, start, act, pause, resume,
// stop, reclaim, reclaimAnswer, chat, rematch, speed. Server → client: welcome (the one snapshot), events (one batch of
// play, already projected for its reader), table (public data only), error (a code, never a message),
// the reclaim's reclaimRequest (to the chef de table) and reclaimResult (to the one who asked), and chat
// (a quick message: a seat and one of twelve ids). No frame type carries a GameState, the deck rng, another seat's cards or a
// token (RULE-19): `view` is a PlayerView built by viewFor, `events` went through eventsFor.
// Later plans add frames to these unions: each is a strict object in a discriminated union on "t".

import {
  type Action,
  COLORS,
  type Color,
  type GameEvent,
  type PlayerView,
  type Scenario,
  type Team,
} from "@toc/engine";
import * as z from "zod/mini";
import { CHAT_KEEP, QUICK_MESSAGES, type QuickMessageId } from "./messages.ts";
import { DEVICE_TOKEN_RE, normalizeName } from "./names.ts";

/**
 * Bumped when a frame changes shape: an older client is closed with CLOSE_VERSION (Pitfall 10).
 * 2 (plan 02-06): the table may be paused or saved, and a client must ping every PING_MS (a client
 * of version 1 never pings, so the silence sweep would close it).
 * 3 (plan 02-07): stop, the leave during a game and the reclaim; a chef de table of version 2 would
 * drop the reclaim's request and leave the one who asked waiting.
 * Plan 02-08 adds chat without a bump: an older page never sends it and drops the frames it does not
 * know (the chat frame, the welcome's chat key), and deploys are atomic.
 * 4 (plan 02-09): a won game makes the table « finished », with its winner and the rematch votes; a
 * page of version 3 cannot read that status (it would drop every table frame from the end on).
 * 5 (plan 02-10b): the table's « Avance rapide » (TablePublic.fast, the speed frame); a page of
 * version 4 would strip the flag and animate at the normal speed while the table plays at the fast
 * pace (the computers no longer wait for its animations), so its moves would lag ever further behind.
 * 6 (plan 04-14, G18): a view's ring knights carry `justOut`, the only knight protected on its own
 * losange; a page of version 5 would read every knight on its 18 as protected (progress 0, or any lap)
 * and hide the moves that pass, eat or swap an ordinary one.
 */
export const PROTOCOL_VERSION = 6;

/** The longest client frame, in characters, checked before JSON.parse (T-02-05). */
export const MAX_FRAME_CHARS = 4096;

/** The server closed a socket silent for too long (no ping): the client reconnects (4000). */
export const CLOSE_SILENT = 4000;
/** The same device opened the table in another tab or on another device (4001). */
export const CLOSE_ELSEWHERE = 4001;
/** The client speaks another protocol version: reload the page (4002). */
export const CLOSE_VERSION = 4002;
/** No such table: never created, or erased (4004). */
export const CLOSE_GONE = 4004;

// --- Client frames ---

const colour = z.enum(COLORS);
const card = z.string().check(z.regex(/^(1[0-3]|[1-9])[SHDC]$/));
const pawn = z.string().check(z.regex(/^(bleu|jaune|rouge|vert)[0-3]$/));
const count = z.int().check(z.minimum(0));

/**
 * The most parts of a 7 plan: seven steps of at least one each. Not four (one per knight): a knight may
 * come back after another one (G5) and the partner's knights may finish the 7 (G12), and apply()
 * plays every such split. A narrower bound here refused legal moves as bad-frame.
 */
const SEVEN_PARTS = 7;

/** The six engine actions (packages/engine/src/types.ts), shape only: apply() decides legality. */
const actionSchema = z.discriminatedUnion("t", [
  z.strictObject({ t: z.literal("give"), card }),
  z.strictObject({ t: z.literal("exit"), card, pawn }),
  z.strictObject({ t: z.literal("move"), card, pawn }),
  z.strictObject({ t: z.literal("swap"), card, pawn, target: pawn }),
  z.strictObject({
    t: z.literal("seven"),
    card,
    plan: z
      .array(z.strictObject({ pawn, steps: z.int().check(z.minimum(1), z.maximum(7)) }))
      .check(z.minLength(1), z.maxLength(SEVEN_PARTS)),
  }),
  z.strictObject({ t: z.literal("discard") }),
]);

/** A computer's strength 1 to 5: a whole number, never a string (T-02-21). */
const levelValue = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

const clientFrameSchema = z.discriminatedUnion("t", [
  z.strictObject({
    t: z.literal("hello"),
    v: z.int(),
    token: z.string().check(z.regex(DEVICE_TOKEN_RE)),
    name: z.string().check(z.maxLength(200)),
  }),
  z.strictObject({ t: z.literal("sit"), seat: colour }),
  z.strictObject({ t: z.literal("stand") }),
  z.strictObject({ t: z.literal("move"), who: colour, to: colour }),
  z.strictObject({ t: z.literal("level"), seat: colour, level: levelValue }),
  z.strictObject({ t: z.literal("leave") }),
  z.strictObject({ t: z.literal("start") }),
  z.strictObject({ t: z.literal("act"), base: count, action: actionSchema }),
  z.strictObject({
    t: z.literal("pause"),
    choice: z.enum(["wait", "bot", "save"]),
    level: z.optional(levelValue),
  }),
  z.strictObject({ t: z.literal("resume") }),
  z.strictObject({ t: z.literal("stop") }),
  z.strictObject({ t: z.literal("reclaim"), seat: colour }),
  z.strictObject({ t: z.literal("reclaimAnswer"), seat: colour, accept: z.boolean() }),
  z.strictObject({ t: z.literal("chat"), msg: z.enum(QUICK_MESSAGES) }),
  z.strictObject({ t: z.literal("rematch"), agree: z.boolean() }),
  z.strictObject({ t: z.literal("speed"), fast: z.boolean() }),
]);

/** The first frame of every socket: the protocol version, the device token and the first name. */
export type HelloFrame = { t: "hello"; v: number; token: string; name: string };
/** Take a free seat of the waiting room (or move to it from one's own seat). */
export type SitFrame = { t: "sit"; seat: Color };
/** Leave one's seat in the waiting room (« Libérer ma place »). */
export type StandFrame = { t: "stand" };
/**
 * The host moves the person on seat `who` to `to`: a free seat, or a person's seat (the two swap). Before
 * the start only (D-03).
 */
export type MoveFrame = { t: "move"; who: Color; to: Color };
/** The host sets the strength of a free seat's future computer (D-03). */
export type LevelFrame = { t: "level"; seat: Color; level: Level };
/** Leave the table (« Quitter la table »): in the waiting room the person and their seat go. */
export type LeaveFrame = { t: "leave" };
/** The host starts the game: the free seats become computer players. */
export type StartFrame = { t: "start" };
/** One action of the sender's seat, played on the table at `base` (its seq). */
export type ActFrame = { t: "act"; base: number; action: Action };
/** What the host chose for the missing players after the pause's minute (D-04). */
export type PauseChoice = "wait" | "bot" | "save";
/**
 * The host's choice once the pause's minute is over: wait one more minute, give the missing seats to
 * the computer at `level` (only with "bot"; Galopeur when left out), or save and stop (NET-04).
 */
export type PauseFrame = { t: "pause"; choice: PauseChoice; level?: Level };
/** The host resumes a saved game (« Reprendre la partie »). */
export type ResumeFrame = { t: "resume" };
/** The host stops the game at any moment: it is saved for everyone (« Arrêter la partie », SC4). */
export type StopFrame = { t: "stop" };
/**
 * Someone without a seat asks for a started table's seat whose person is offline: their own, begun
 * on another device or in another app (« C’est moi, {Nom} », D-12). The host must accept.
 */
export type ReclaimFrame = { t: "reclaim"; seat: Color };
/** The host's answer to a reclaim of `seat` (« Rendre sa place » or « Refuser »). */
export type ReclaimAnswerFrame = { t: "reclaimAnswer"; seat: Color; accept: boolean };
/** A quick message (D-07): one of the twelve ids, never text; the server adds the sender's seat. */
export type ChatSendFrame = { t: "chat"; msg: QuickMessageId };
/**
 * « Revanche » on the end plank (D-08): a seated person agrees to a new game at the same table, or
 * withdraws (a second tap). The game starts when every seated person online agrees.
 */
export type RematchFrame = { t: "rematch"; agree: boolean };
/**
 * The chef de table switches the table's « Avance rapide » on or off (plan 02-10b): the computers
 * think at the fast pace and every page plays the moves fast. Anyone else is refused (not-host).
 */
export type SpeedFrame = { t: "speed"; fast: boolean };
export type ClientFrame =
  | HelloFrame
  | SitFrame
  | StandFrame
  | MoveFrame
  | LevelFrame
  | LeaveFrame
  | StartFrame
  | ActFrame
  | PauseFrame
  | ResumeFrame
  | StopFrame
  | ReclaimFrame
  | ReclaimAnswerFrame
  | ChatSendFrame
  | RematchFrame
  | SpeedFrame;

export type ParsedClientFrame = { ok: true; frame: ClientFrame } | { ok: false };

/**
 * A client frame from untrusted text: too long, not JSON, an unknown type, an extra key, a seat, card
 * or pawn outside the engine's formats, a 7 plan of more than seven parts, a base that is not a natural
 * number, a first name that normalizes to nothing, or a level with a pause choice other than "bot" are
 * all refused. The hello's name comes back
 * normalized (normalizeName).
 */
export function parseClientFrame(raw: unknown): ParsedClientFrame {
  if (typeof raw !== "string" || raw.length > MAX_FRAME_CHARS) return { ok: false };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  const parsed = clientFrameSchema.safeParse(data);
  if (!parsed.success) return { ok: false };
  // The regexes above pin every card and pawn id to the engine's template literal types.
  const frame = parsed.data as ClientFrame;
  // A level goes with the hand-over only.
  if (frame.t === "pause" && frame.choice !== "bot" && frame.level !== undefined) {
    return { ok: false };
  }
  if (frame.t !== "hello") return { ok: true, frame };
  const name = normalizeName(frame.name);
  return name === null ? { ok: false } : { ok: true, frame: { ...frame, name } };
}

// --- Server frames ---

export type Level = 1 | 2 | 3 | 4 | 5;

/** One seat as everyone may see it: free (a computer will sit there), a computer, or a person. */
export type SeatPublic = {
  kind: "free" | "bot" | "human";
  /** The person's first name or the computer's horse name; null for a free seat. */
  name: string | null;
  /** The computer's strength (a free seat's planned one). */
  level: Level;
  /** A person has a live socket; always true for a computer. */
  online: boolean;
  /** A person's seat the computer plays for, at this strength, until they return; else null. */
  handedOver: Level | null;
};

/**
 * The pause (D-04): the seats whose people are missing, when it began, when the host may choose
 * (server time, ms since the epoch) and whether the host is choosing now.
 */
export type PausePublic = {
  missing: Color[];
  since: number;
  choiceAt: number;
  choosing: boolean;
};

/**
 * A seat's answer to « Revanche » on the end plank: yes, not yet, its person is offline (their seat
 * goes to the computer if the rematch starts), or a computer seat (always yes).
 */
export type RematchVote = "yes" | "no" | "offline" | "bot";

export const REMATCH_VOTES: readonly RematchVote[] = ["yes", "no", "offline", "bot"];

/** What anyone at the table may know of it. No token, no hash, no card. */
export type TablePublic = {
  /** finished (plan 02-09): the game is won; the end plank shows and the rematch is voted. */
  status: "lobby" | "playing" | "paused" | "saved" | "finished";
  seats: Record<Color, SeatPublic>;
  /**
   * The host's seat (« chef de table »): the creator, or while the creator is away during a game the
   * first person online clockwise from the creator's seat (D-05); null when there is none.
   */
  host: Color | null;
  creatorName: string | null;
  gameNo: number;
  /** The computer player due to act. */
  thinking: Color | null;
  /** The first names of the people at the table, online, without a seat (« Sans place »). */
  unseated: string[];
  /** The pause, while the status is "paused"; else null. */
  pause: PausePublic | null;
  /** The team that brought its eight knights home, while the status is "finished"; else null. */
  winner: Team | null;
  /** Each seat's answer to « Revanche », while the status is "finished"; else null. */
  rematch: Record<Color, RematchVote> | null;
  /**
   * The table's « Avance rapide » (plan 02-10b), set by the chef de table: the computers think at the
   * fast pace, every page plays the moves fast.
   */
  fast: boolean;
  /** The server's clock when the frame was built (ms since the epoch): the countdown's reference. */
  now: number;
};

export type You = { seat: Color | null; host: boolean };

export type ErrorCode =
  | "bad-frame"
  | "not-host"
  | "illegal"
  | "stale"
  | "seat-taken"
  | "started"
  | "table-full"
  | "paused"
  | "refused"
  | "rate";

export const ERROR_CODES: readonly ErrorCode[] = [
  "bad-frame",
  "not-host",
  "illegal",
  "stale",
  "seat-taken",
  "started",
  "table-full",
  "paused",
  "refused",
  "rate",
];

/** One quick message as the table keeps it: the sender's seat, the id, the server's time. */
export type ChatEntry = { from: Color; msg: QuickMessageId; at: number };

/** The one snapshot: on hello, after a stale act, after a seat change. */
export type WelcomeFrame = {
  t: "welcome";
  you: You;
  table: TablePublic;
  /** viewFor(state, you.seat) while a game runs and the reader has a seat; else null. */
  view: PlayerView | null;
  seq: number;
  /** Present when this hello took the seat back from the computer (« Tu reprends ta place. »). */
  regained?: true;
  /** The last quick messages the table kept (at most CHAT_KEEP), oldest first. */
  chat: ChatEntry[];
};
/** One batch of play: eventsFor(events, seat) and the reader's view after it. */
export type EventsFrame = { t: "events"; seq: number; events: GameEvent[]; view: PlayerView };
export type TableFrame = { t: "table"; table: TablePublic };
export type ErrorFrame = { t: "error"; code: ErrorCode };
/** To the host only: `name` (the first name they typed) asks for `seat` (« Rendre sa place à … ? »). */
export type ReclaimRequestFrame = { t: "reclaimRequest"; seat: Color; name: string };
/**
 * To the one who asked only: the host refused, or the request could not be made (the seat is online,
 * already asked for, or there is no host); accepted comes with a welcome on the seat.
 */
export type ReclaimResultFrame = { t: "reclaimResult"; accepted: boolean };
/** A quick message, to everyone online at the table (the sender included). */
export type ChatFrame = { t: "chat" } & ChatEntry;
export type ServerFrame =
  | WelcomeFrame
  | EventsFrame
  | TableFrame
  | ErrorFrame
  | ReclaimRequestFrame
  | ReclaimResultFrame
  | ChatFrame;

const level = z.int().check(z.minimum(1), z.maximum(5));
const seatPublic = z.object({
  kind: z.enum(["free", "bot", "human"]),
  name: z.nullable(z.string().check(z.maxLength(64))),
  level,
  online: z.boolean(),
  handedOver: z.nullable(level),
});
const pausePublic = z.object({
  missing: z.array(colour).check(z.maxLength(4)),
  since: count,
  choiceAt: count,
  choosing: z.boolean(),
});
const rematchVote = z.enum(REMATCH_VOTES as [RematchVote, ...RematchVote[]]);
const tablePublic = z.object({
  status: z.enum(["lobby", "playing", "paused", "saved", "finished"]),
  seats: z.object({ bleu: seatPublic, jaune: seatPublic, rouge: seatPublic, vert: seatPublic }),
  host: z.nullable(colour),
  creatorName: z.nullable(z.string().check(z.maxLength(64))),
  gameNo: count,
  thinking: z.nullable(colour),
  unseated: z.array(z.string().check(z.maxLength(64))).check(z.maxLength(64)),
  pause: z.nullable(pausePublic),
  winner: z.nullable(z.enum(["bleu-rouge", "jaune-vert"])),
  rematch: z.nullable(
    z.object({ bleu: rematchVote, jaune: rematchVote, rouge: rematchVote, vert: rematchVote }),
  ),
  fast: z.boolean(),
  now: count,
});
/** The view and the events come from the engine's own builders on the server; the envelope is checked. */
const view = z.custom<PlayerView>(
  (value) =>
    typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "view",
);
const events = z.array(
  z.custom<GameEvent>(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      typeof (value as { t?: unknown }).t === "string",
  ),
);

const chatEntry = z.object({ from: colour, msg: z.enum(QUICK_MESSAGES), at: count });

const serverFrameSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("welcome"),
    you: z.object({ seat: z.nullable(colour), host: z.boolean() }),
    table: tablePublic,
    view: z.nullable(view),
    seq: count,
    regained: z.optional(z.literal(true)),
    chat: z.array(chatEntry).check(z.maxLength(CHAT_KEEP)),
  }),
  z.object({ t: z.literal("events"), seq: count, events, view }),
  z.object({ t: z.literal("table"), table: tablePublic }),
  z.object({ t: z.literal("error"), code: z.enum(ERROR_CODES as [ErrorCode, ...ErrorCode[]]) }),
  z.object({
    t: z.literal("reclaimRequest"),
    seat: colour,
    name: z.string().check(z.maxLength(64)),
  }),
  z.object({ t: z.literal("reclaimResult"), accepted: z.boolean() }),
  z.object({ t: z.literal("chat"), from: colour, msg: z.enum(QUICK_MESSAGES), at: count }),
]);

/** A server frame from the socket, or null when it does not have the expected shape. */
export function parseServerFrame(raw: unknown): ServerFrame | null {
  if (typeof raw !== "string") return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = serverFrameSchema.safeParse(data);
  return parsed.success ? (parsed.data as ServerFrame) : null;
}

// --- Table creation (POST /api/tables) ---

/**
 * The test options of a creation body, honoured by the Worker only under TOC_TEST_MODE=1 (T-02-07):
 * `pace` "zero" makes the computers act at once; `levels` sets the strength of computer seats until the
 * waiting room's picker exists (plan 02-05).
 */
export type CreateTestOptions = {
  pace: "zero" | "normal";
  levels?: Partial<Record<Color, Level>>;
  /** The pause's minute, shortened for the end-to-end tests (plan 02-06), 500 ms to 60 s. */
  pauseMs?: number;
  /** « C’est ton tour » sooner than 30 s (plan 04-07), 100 ms to 2 minutes. */
  notifyMs?: number;
  /**
   * The game starts from this position instead of a deal (plan 02-09: a near-end table for the end
   * plank and the rematch): a scenario's `before` block, at most MAX_BEFORE_CHARS characters.
   */
  before?: Scenario["before"];
};

/** The longest test start position, as JSON (T-02-39). */
export const MAX_BEFORE_CHARS = 4096;

const pawnSpec = z.union([
  z.literal("S"),
  z.strictObject({ p: z.int().check(z.minimum(-72), z.maximum(143)) }),
  z.strictObject({ h: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]) }),
]);
const pawnSpecs = z.tuple([pawnSpec, pawnSpec, pawnSpec, pawnSpec]);
const handSpec = z.array(card).check(z.maxLength(5));
const beforeSchema = z.strictObject({
  pawns: z.optional(
    z.strictObject({
      bleu: z.optional(pawnSpecs),
      jaune: z.optional(pawnSpecs),
      rouge: z.optional(pawnSpecs),
      vert: z.optional(pawnSpecs),
    }),
  ),
  hands: z.optional(
    z.strictObject({
      bleu: z.optional(handSpec),
      jaune: z.optional(handSpec),
      rouge: z.optional(handSpec),
      vert: z.optional(handSpec),
    }),
  ),
  turn: colour,
  phase: z.optional(z.enum(["exchange", "play"])),
  dealer: z.optional(colour),
  dealIndex: z.optional(z.union([z.literal(0), z.literal(1), z.literal(2)])),
});

const testLevel = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const createTestSchema = z.strictObject({
  pace: z.enum(["zero", "normal"]),
  levels: z.optional(
    z.strictObject({
      bleu: z.optional(testLevel),
      jaune: z.optional(testLevel),
      rouge: z.optional(testLevel),
      vert: z.optional(testLevel),
    }),
  ),
  pauseMs: z.optional(z.int().check(z.minimum(500), z.maximum(60_000))),
  notifyMs: z.optional(z.int().check(z.minimum(100), z.maximum(120_000))),
  before: z.optional(beforeSchema),
});

/** The test options of a parsed creation body, or null when absent or malformed. */
export function parseCreateTestOptions(body: unknown): CreateTestOptions | null {
  if (typeof body !== "object" || body === null) return null;
  const test = (body as { test?: unknown }).test;
  const before = (test as { before?: unknown } | null | undefined)?.before;
  if (before !== undefined && JSON.stringify(before).length > MAX_BEFORE_CHARS) return null;
  const parsed = createTestSchema.safeParse(test);
  return parsed.success ? (parsed.data as CreateTestOptions) : null;
}

// --- Public table summary (GET /api/tables/:id, plan 02-04) ---

/** Where a table stands (« Salle d’attente », « En cours », « En pause », « Sauvegardée », « Terminée »). */
export type TableStatus = "lobby" | "playing" | "paused" | "saved" | "finished";

export const TABLE_STATUSES: readonly TableStatus[] = [
  "lobby",
  "playing",
  "paused",
  "saved",
  "finished",
];

/** One seat in the summary: its kind and its first name or horse name (null for a free seat). */
export type SummarySeat = { kind: "free" | "bot" | "human"; name: string | null };

/**
 * What anyone holding a table's link may read without joining (T-02-15): the status, the creator's
 * first name, each seat's kind and name, the game number and the last activity. No person id, no token
 * or token hash, no table id, no card.
 */
export type TableSummary = {
  status: TableStatus;
  creatorName: string | null;
  seats: Record<Color, SummarySeat>;
  gameNo: number;
  /** The table's last activity, in ms since the epoch. */
  updatedAt: number;
  /** The seats the paused game waits for (« En pause : on t’attend » when one is this device's). */
  missing: Color[];
};

const summarySeat = z.strictObject({
  kind: z.enum(["free", "bot", "human"]),
  name: z.nullable(z.string().check(z.maxLength(64))),
});
const tableSummarySchema = z.strictObject({
  status: z.enum(TABLE_STATUSES as [TableStatus, ...TableStatus[]]),
  creatorName: z.nullable(z.string().check(z.maxLength(64))),
  seats: z.strictObject({
    bleu: summarySeat,
    jaune: summarySeat,
    rouge: summarySeat,
    vert: summarySeat,
  }),
  gameNo: count,
  updatedAt: count,
  missing: z.array(colour).check(z.maxLength(4)),
});

/** A table summary from untrusted JSON data (the response body), or null when it is not one. */
export function parseTableSummary(data: unknown): TableSummary | null {
  const parsed = tableSummarySchema.safeParse(data);
  return parsed.success ? (parsed.data as TableSummary) : null;
}
