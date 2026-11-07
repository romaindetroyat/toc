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

import {
  HISTORY_CURSOR_RE,
  HISTORY_PAGE_SIZE,
  type HistoryGame,
  type HistoryPage,
  type HistorySeat,
  type StatsAnswer,
} from "@toc/protocol";
import { type StatsRow, type StoredSeat, statsOf } from "./aggregate.ts";
import { sessionUser } from "./auth/session.ts";
import type { Meter } from "./db.ts";
import { json, notAllowed } from "./http.ts";

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

const READS = new Map<string, Read>([
  ["/api/me/results", (user, url, meter) => history(user, url, meter)],
  ["/api/me/stats", stats],
]);

/** GET /api/me/results, /api/me/stats (GET or HEAD only, a session); null for another path. */
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
