// « Mes résultats » on the server (plan 05-01, HIST-02, D-01 to D-04, D-12; 05-RESEARCH Pattern 4).
//   GET /api/me/results[?before=<ended_at>:<game_id>]  the signed-in player's finished games, newest
//       first, HISTORY_PAGE_SIZE at a time, with the cursor of the next page (null at the end)
// The user id comes from the session only (401 { error: "signed-out" } without one): there is no id
// parameter, so nobody reads another player's history (T-05-05). Each row comes from game_seats (the
// caller's seats, keyed for this order) joined to played; its seats are mapped to me, account (the
// stored pseudo), guest (the first name) or bot (the level), and every account id is dropped
// (T-05-01). The answer has the shape of HistoryPage (@toc/protocol), which the page checks.
// The cursor `before` is the `next` of the previous page, « <ended_at>:<game_id> »: read with an
// anchored regex and bound as two parameters, never put in the SQL text (400 { error: "cursor" }
// otherwise). The explicit OR form of the keyset (no row-value comparison) skips no game whose end
// time equals the cursor's.
// Plan 05-05 (HIST-03, HIST-04, D-01, D-02, D-13; Pattern 4), the same session rule:
//   GET /api/me/stats   « Mes chiffres »: every row of the caller (one query), aggregated by statsOf
//                       (aggregate.ts) for the three filters at once (StatsAnswer)
//   GET /api/me/ranking the friends ranking: the circle is the caller and the friends of the
//                       caller's own friendships (two rows per friendship, so one direction is
//                       enough; a friend of a friend never appears, T-05-15); each counts their
//                       ranked game_seats rows only (ranked = 1: online, two accounts or more; never a
//                       solo game), played with anyone; ordered by rankingOf (RankingAnswer)
//   POST /api/me/results/solo  a solo game the signed-in browser reports (D-01, T-05-11 to T-05-16),
//                       registered in index.ts's POSTS, so our own non-null Origin is checked first
//                       (403); then readJson(SoloReport) (415, 413, 400 body), the session (401),
//                       plausible (400 implausible), SOLO_PER_DAY reports a day per account through
//                       the account's PlayerHub.allow (429 rate), and one batch: the played row (id
//                       solo:<user_id>:<uuid>, kind solo, accounts 1) and its game_seats row taken from
//                       that played row (ranked 0, solo 1), both ON CONFLICT DO NOTHING, so a resend,
//                       even with other times, adds nothing (201 added, 200 already there). The game is
//                       client-claimed: it counts in the player's own history and figures, never in the
//                       ranking. Nothing of the body is a name: the player's seat is the session's
//                       account and pseudo, the computers are their levels with an empty name.

import { COLORS, teamOf } from "@toc/engine";
import {
  HISTORY_CURSOR_RE,
  HISTORY_PAGE_SIZE,
  type HistoryGame,
  type HistoryPage,
  type HistorySeat,
  type RankingAnswer,
  SoloReport,
  type StatsAnswer,
} from "@toc/protocol";
import {
  type RankingRow,
  rankingOf,
  type StatsRow,
  type StoredSeat,
  statsOf,
} from "./aggregate.ts";
import { sessionUser } from "./auth/session.ts";
import type { Meter } from "./db.ts";
import { json, notAllowed, readJson } from "./http.ts";

type PlayedRow = {
  id: string;
  kind: "online" | "solo";
  started_at: number;
  ended_at: number;
  winner: HistoryGame["winner"];
  seats: string;
  deals: number;
  creator: string | null;
  colour: HistoryGame["mine"];
  ranked: number;
};

/** One stored seat as the caller may see it: no account id, only me or another account. */
function seatFor(seat: StoredSeat, userId: string): HistorySeat {
  const kind = seat.kind === "account" ? (seat.account === userId ? "me" : "account") : seat.kind;
  return {
    colour: seat.colour,
    kind,
    name: seat.name,
    level: seat.level ?? null,
    handedOver: seat.handedOver === true,
    captured: seat.captured,
    lost: seat.lost,
    home: seat.home,
  };
}

function gameOf(row: PlayedRow, userId: string): HistoryGame {
  const stored = JSON.parse(row.seats) as StoredSeat[];
  const seats = stored.map((seat) => seatFor(seat, userId)) as HistoryGame["seats"];
  return {
    id: row.id,
    kind: row.kind,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    winner: row.winner,
    mine: row.colour,
    seats,
    deals: row.deals,
    creator: row.creator,
    ranked: row.ranked === 1,
  };
}

const COLUMNS = `p.id, p.kind, p.started_at, p.ended_at, p.winner, p.seats, p.deals, p.creator,
       gs.colour, gs.ranked`;

type Read = (user: { id: string; pseudo: string }, url: URL, meter: Meter) => Promise<Response>;

/** GET /api/me/stats: every game of the caller, aggregated (one query, the rows read once). */
const stats: Read = async (user, _url, meter) => {
  const found = await meter.all<StatsRow>(
    meter
      .prepare(
        `SELECT gs.colour, gs.won, gs.solo, gs.captured, gs.lost, gs.home, p.seats
           FROM game_seats gs JOIN played p ON p.id = gs.game_id
          WHERE gs.user_id = ?1
          ORDER BY gs.ended_at DESC, gs.game_id DESC`,
      )
      .bind(user.id),
  );
  const answer: StatsAnswer = statsOf(found.results, user.id);
  return json(answer, 200);
};

/** GET /api/me/ranking: the circle's ranked counts (one query), ranked by rankingOf. */
const ranking: Read = async (user, _url, meter) => {
  const found = await meter.all<RankingRow>(
    meter
      .prepare(
        `WITH circle(id) AS (SELECT ?1 UNION SELECT friend_id FROM friendships WHERE user_id = ?1)
         SELECT u.id, u.pseudo, COUNT(gs.game_id) AS games, COALESCE(SUM(gs.won), 0) AS wins
           FROM circle c JOIN users u ON u.id = c.id
           LEFT JOIN game_seats gs ON gs.user_id = c.id AND gs.ranked = 1
          GROUP BY u.id, u.pseudo`,
      )
      .bind(user.id),
  );
  const answer: RankingAnswer = rankingOf(found.results, user.id);
  return json(answer, 200);
};

const READS = new Map<string, Read>([
  ["/api/me/results", (user, url, meter) => history(user, url, meter)],
  ["/api/me/stats", stats],
  ["/api/me/ranking", ranking],
]);

/** GET /api/me/results, /api/me/stats, /api/me/ranking (GET or HEAD only, a session); null for another path. */
export async function resultsRoute(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
): Promise<Response | null> {
  const read = READS.get(url.pathname);
  if (read === undefined) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return notAllowed("GET");
  const user = await sessionUser(request, url, env, meter, now);
  if (user === null) return json({ error: "signed-out" }, 401);
  return read(user, url, meter);
}

/** GET /api/me/results: one page of the caller's history. */
async function history(user: { id: string }, url: URL, meter: Meter): Promise<Response> {
  const before = url.searchParams.get("before");
  let statement: D1PreparedStatement;
  if (before === null) {
    statement = meter
      .prepare(
        `SELECT ${COLUMNS}
           FROM game_seats gs JOIN played p ON p.id = gs.game_id
          WHERE gs.user_id = ?1
          ORDER BY gs.ended_at DESC, gs.game_id DESC LIMIT ?2`,
      )
      .bind(user.id, HISTORY_PAGE_SIZE + 1);
  } else {
    const cursor = HISTORY_CURSOR_RE.exec(before);
    const endedAt = Number(cursor?.[1]);
    if (cursor === null || !Number.isSafeInteger(endedAt)) return json({ error: "cursor" }, 400);
    statement = meter
      .prepare(
        `SELECT ${COLUMNS}
           FROM game_seats gs JOIN played p ON p.id = gs.game_id
          WHERE gs.user_id = ?1
            AND (gs.ended_at < ?2 OR (gs.ended_at = ?2 AND gs.game_id < ?3))
          ORDER BY gs.ended_at DESC, gs.game_id DESC LIMIT ?4`,
      )
      .bind(user.id, endedAt, cursor[2], HISTORY_PAGE_SIZE + 1);
  }
  const found = await meter.all<PlayedRow>(statement);
  const rows = found.results;
  const games = rows.slice(0, HISTORY_PAGE_SIZE).map((row) => gameOf(row, user.id));
  const last = rows[HISTORY_PAGE_SIZE - 1];
  const page: HistoryPage = {
    games,
    next:
      rows.length > HISTORY_PAGE_SIZE && last !== undefined ? `${last.ended_at}:${last.id}` : null,
  };
  return json(page, 200);
}

// --- The solo report (D-01; research Pattern 2 and A5: the thresholds stay « à confirmer ») ---

/**
 * The shortest believable solo game. Research A5 proposed 60 s; 30 s is chosen because the seeded
 * test-speed game of plan 01 took about 85 s, so a real game is always far longer (à confirmer).
 */
export const SOLO_MIN_MS = 30_000;
/** How far ahead of the server's clock a report may end (a device's clock running fast). */
export const SOLO_AHEAD_MS = 5 * 60_000;
/** How old a report may be: a game kept on an offline device (`toc.pending.v1`, plan 05-07). */
export const SOLO_MAX_AGE_MS = 60 * 86_400_000;
/** The most deals a game may have taken. */
export const SOLO_MAX_DEALS = 300;
/** The most knights a seat may have eaten, or lost. */
export const SOLO_MAX_COUNT = 64;
/** Solo reports a day per account (PlayerHub.allow, kind "solo"). */
export const SOLO_PER_DAY = 30;
const SOLO_WINDOW_MS = 86_400_000;

/**
 * A finished game as it could have happened (pure): 1 to SOLO_MAX_DEALS deals, at least SOLO_MIN_MS
 * long (so it also ends after it started), ended no later than SOLO_AHEAD_MS from `now` and no
 * earlier than SOLO_MAX_AGE_MS ago, every count within 0..SOLO_MAX_COUNT, the winning team's two
 * colours with their 4 knights home, the losers not both. The schema already checked the shape and
 * that the three other colours each have a level.
 */
export function plausible(report: SoloReport, now: number): boolean {
  if (report.deals < 1 || report.deals > SOLO_MAX_DEALS) return false;
  if (report.endedAt - report.startedAt < SOLO_MIN_MS) return false;
  if (report.endedAt > now + SOLO_AHEAD_MS || report.endedAt < now - SOLO_MAX_AGE_MS) return false;
  const seats = COLORS.map((colour) => ({ colour, ...report.seats[colour] }));
  if (seats.some((seat) => seat.captured > SOLO_MAX_COUNT || seat.lost > SOLO_MAX_COUNT)) {
    return false;
  }
  const winners = seats.filter((seat) => teamOf(seat.colour) === report.winner);
  const losers = seats.filter((seat) => teamOf(seat.colour) !== report.winner);
  if (!winners.every((seat) => seat.home === 4)) return false;
  return !losers.every((seat) => seat.home === 4);
}

/** The four seats of a solo game as played.seats stores them: the session's account, three levels. */
function soloSeats(report: SoloReport, user: { id: string; pseudo: string }): StoredSeat[] {
  return COLORS.map((colour) => {
    const counts = report.seats[colour];
    const human = colour === report.human;
    return {
      colour,
      kind: human ? "account" : "bot",
      account: human ? user.id : null,
      name: human ? user.pseudo : "",
      level: human ? null : (report.levels[colour] ?? null),
      handedOver: false,
      captured: counts.captured,
      lost: counts.lost,
      home: counts.home,
    };
  });
}

/** POST /api/me/results/solo (index.ts checked our Origin and the method). */
export async function soloRoute(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
): Promise<Response> {
  const read = await readJson(request, SoloReport);
  if (!read.ok) return read.response;
  const user = await sessionUser(request, url, env, meter, now);
  if (user === null) return json({ error: "signed-out" }, 401);
  const report = read.body;
  if (!plausible(report, now)) return json({ error: "implausible" }, 400);
  const hub = env.PLAYER_HUB.getByName(user.id);
  if (!(await hub.allow({ kind: "solo", max: SOLO_PER_DAY, windowMs: SOLO_WINDOW_MS, now }))) {
    return json({ error: "rate" }, 429);
  }
  const gameId = `solo:${user.id}:${report.id}`;
  const mine = report.seats[report.human];
  const [played] = await meter.batch([
    meter
      .prepare(
        `INSERT INTO played (id, kind, started_at, ended_at, winner, seats, deals, creator, accounts)
         VALUES (?, 'solo', ?, ?, ?, ?, ?, NULL, 1)
         ON CONFLICT (id) DO NOTHING`,
      )
      .bind(
        gameId,
        report.startedAt,
        report.endedAt,
        report.winner,
        JSON.stringify(soloSeats(report, user)),
        report.deals,
      ),
    // The seat row takes its end time and its result from the played row, the first report's: a
    // resend with other times hits the same key and adds nothing.
    meter
      .prepare(
        `INSERT INTO game_seats
           (user_id, ended_at, game_id, colour, won, ranked, solo, captured, lost, home)
         SELECT ?1, p.ended_at, p.id, ?3, CASE WHEN p.winner = ?4 THEN 1 ELSE 0 END, 0, 1, ?5, ?6, ?7
           FROM played p
          WHERE p.id = ?2 AND EXISTS (SELECT 1 FROM users WHERE id = ?1)
         ON CONFLICT DO NOTHING`,
      )
      .bind(
        user.id,
        gameId,
        report.human,
        teamOf(report.human),
        mine.captured,
        mine.lost,
        mine.home,
      ),
  ]);
  const added = (played?.meta?.changes ?? 0) > 0;
  return json({ added }, added ? 201 : 200);
}
