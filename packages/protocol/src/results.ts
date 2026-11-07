// « Mes résultats » (plan 05-01, HIST-02, D-01 to D-04, D-12; 05-RESEARCH Pattern 4): the answer of
// GET /api/me/results, shared by the Worker (what it builds) and the page (what it accepts, untrusted).
// A seat is the caller's (me), another account's (by its pseudo), a guest's (by the first name typed
// at the table) or a computer's (by its level): never an account id, a `who`, a token or a card.
// Pure, no I/O.

import { COLORS } from "@toc/engine";
import * as z from "zod/mini";

/** The games of one page of the history (the next page starts after the last one). */
export const HISTORY_PAGE_SIZE = 20;

/**
 * The cursor of the next page: the last game's end time and its id, « <ended_at>:<game_id> ». A game
 * id is a table hash and a game number (online), or « solo:<user_id>:<uuid> » (solo, plan 05-05).
 */
export const HISTORY_CURSOR_RE = /^(\d{1,16}):([A-Za-z0-9_-]{1,64}(?::[A-Za-z0-9_-]{1,64}){1,2})$/;

const level = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const team = z.enum(["bleu-rouge", "jaune-vert"]);
const count = z.number().check(z.int(), z.gte(0), z.lte(64));
const time = z.number().check(z.int(), z.gte(0));

const historySeat = z.strictObject({
  colour: z.enum(COLORS),
  /** me: the caller's seat; account: another account (its pseudo); guest: no account; bot: a computer. */
  kind: z.enum(["me", "account", "guest", "bot"]),
  /** The pseudo, the guest's first name or the horse name (the page shows a computer by its level). */
  name: z.string().check(z.maxLength(40)),
  /** A computer's level, or the level a person's seat was handed over at; else null. */
  level: z.nullable(level),
  /** The computer finished this person's seat. */
  handedOver: z.boolean(),
  captured: count,
  lost: count,
  home: z.number().check(z.int(), z.gte(0), z.lte(4)),
});

export type HistorySeat = z.infer<typeof historySeat>;

const historyGame = z.strictObject({
  id: z.string().check(z.maxLength(200)),
  kind: z.enum(["online", "solo"]),
  startedAt: time,
  endedAt: time,
  winner: team,
  /** The caller's colour in that game. */
  mine: z.enum(COLORS),
  /** The four seats, in the order bleu, jaune, rouge, vert. */
  seats: z.tuple([historySeat, historySeat, historySeat, historySeat]),
  deals: z.number().check(z.int(), z.gte(0)),
  /** Online: the table creator's shown name. */
  creator: z.nullable(z.string().check(z.maxLength(40))),
  /** The game counts in the friends ranking (online, two accounts or more, D-02, D-13). */
  ranked: z.boolean(),
});

export type HistoryGame = z.infer<typeof historyGame>;

const historyPage = z.strictObject({
  games: z.array(historyGame).check(z.maxLength(HISTORY_PAGE_SIZE)),
  /** The cursor of the next page (the `before` query), or null when there is no older game. */
  next: z.nullable(z.string().check(z.regex(HISTORY_CURSOR_RE))),
});

/** GET /api/me/results: one page of the signed-in player's finished games, newest first. */
export type HistoryPage = z.infer<typeof historyPage>;

/** The page's untrusted answer as a HistoryPage, or null when it is out of shape. */
export function parseHistoryPage(data: unknown): HistoryPage | null {
  const parsed = historyPage.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** The schema itself, for the Worker's own checks in the tests. */
export const HistoryPage = historyPage;
