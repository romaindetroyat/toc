// The table protocol: every frame a browser and the table's Durable Object exchange, validated with
// zod/mini on both sides (CLAUDE.md: the server treats every client frame as hostile).
//
// Client → server: hello (always first), sit, start, act. Server → client: welcome (the one snapshot),
// events (one batch of play, already projected for its reader), table (public data only), error (a
// code, never a message). No frame type carries a GameState, the deck rng, another seat's cards or a
// token (RULE-19): `view` is a PlayerView built by viewFor, `events` went through eventsFor.
// Later plans add frames to these unions: each is a strict object in a discriminated union on "t".

import { type Action, COLORS, type Color, type GameEvent, type PlayerView } from "@toc/engine";
import * as z from "zod/mini";
import { DEVICE_TOKEN_RE, normalizeName } from "./names.ts";

/** Bumped when a frame changes shape: an older client is closed with CLOSE_VERSION (Pitfall 10). */
export const PROTOCOL_VERSION = 1;

/** The longest client frame, in characters, checked before JSON.parse (T-02-05). */
export const MAX_FRAME_CHARS = 4096;

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
      .check(z.minLength(1), z.maxLength(4)),
  }),
  z.strictObject({ t: z.literal("discard") }),
]);

const clientFrameSchema = z.discriminatedUnion("t", [
  z.strictObject({
    t: z.literal("hello"),
    v: z.int(),
    token: z.string().check(z.regex(DEVICE_TOKEN_RE)),
    name: z.string().check(z.maxLength(200)),
  }),
  z.strictObject({ t: z.literal("sit"), seat: colour }),
  z.strictObject({ t: z.literal("start") }),
  z.strictObject({ t: z.literal("act"), base: count, action: actionSchema }),
]);

/** The first frame of every socket: the protocol version, the device token and the first name. */
export type HelloFrame = { t: "hello"; v: number; token: string; name: string };
/** Take a free seat of the waiting room (or move to it from one's own seat). */
export type SitFrame = { t: "sit"; seat: Color };
/** The host starts the game: the free seats become computer players. */
export type StartFrame = { t: "start" };
/** One action of the sender's seat, played on the table at `base` (its seq). */
export type ActFrame = { t: "act"; base: number; action: Action };
export type ClientFrame = HelloFrame | SitFrame | StartFrame | ActFrame;

export type ParsedClientFrame = { ok: true; frame: ClientFrame } | { ok: false };

/**
 * A client frame from untrusted text: too long, not JSON, an unknown type, an extra key, a seat, card
 * or pawn outside the engine's formats, a 7 plan of more than four parts, a base that is not a natural
 * number, or a first name that normalizes to nothing are all refused. The hello's name comes back
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
};

/** What anyone at the table may know of it. No token, no hash, no card. */
export type TablePublic = {
  status: "lobby" | "playing";
  seats: Record<Color, SeatPublic>;
  /** The host's seat (the creator), or null while the host has no seat. */
  host: Color | null;
  creatorName: string | null;
  gameNo: number;
  /** The computer player due to act. */
  thinking: Color | null;
};

export type You = { seat: Color | null; host: boolean };

export type ErrorCode = "bad-frame" | "not-host" | "illegal" | "stale" | "seat-taken" | "started";

export const ERROR_CODES: readonly ErrorCode[] = [
  "bad-frame",
  "not-host",
  "illegal",
  "stale",
  "seat-taken",
  "started",
];

/** The one snapshot: on hello, after a stale act, after a seat change. */
export type WelcomeFrame = {
  t: "welcome";
  you: You;
  table: TablePublic;
  /** viewFor(state, you.seat) while a game runs and the reader has a seat; else null. */
  view: PlayerView | null;
  seq: number;
};
/** One batch of play: eventsFor(events, seat) and the reader's view after it. */
export type EventsFrame = { t: "events"; seq: number; events: GameEvent[]; view: PlayerView };
export type TableFrame = { t: "table"; table: TablePublic };
export type ErrorFrame = { t: "error"; code: ErrorCode };
export type ServerFrame = WelcomeFrame | EventsFrame | TableFrame | ErrorFrame;

const level = z.int().check(z.minimum(1), z.maximum(5));
const seatPublic = z.object({
  kind: z.enum(["free", "bot", "human"]),
  name: z.nullable(z.string().check(z.maxLength(64))),
  level,
  online: z.boolean(),
});
const tablePublic = z.object({
  status: z.enum(["lobby", "playing"]),
  seats: z.object({ bleu: seatPublic, jaune: seatPublic, rouge: seatPublic, vert: seatPublic }),
  host: z.nullable(colour),
  creatorName: z.nullable(z.string().check(z.maxLength(64))),
  gameNo: count,
  thinking: z.nullable(colour),
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

const serverFrameSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("welcome"),
    you: z.object({ seat: z.nullable(colour), host: z.boolean() }),
    table: tablePublic,
    view: z.nullable(view),
    seq: count,
  }),
  z.object({ t: z.literal("events"), seq: count, events, view }),
  z.object({ t: z.literal("table"), table: tablePublic }),
  z.object({ t: z.literal("error"), code: z.enum(ERROR_CODES as [ErrorCode, ...ErrorCode[]]) }),
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
};

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
});

/** The test options of a parsed creation body, or null when absent or malformed. */
export function parseCreateTestOptions(body: unknown): CreateTestOptions | null {
  if (typeof body !== "object" || body === null) return null;
  const parsed = createTestSchema.safeParse((body as { test?: unknown }).test);
  return parsed.success ? (parsed.data as CreateTestOptions) : null;
}
