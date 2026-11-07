// The record of a finished game in D1 (plan 02-09, HIST-01 support for phase 5, D-14; 02-RESEARCH
// Pattern 12). The table's Durable Object calls writeGame after the SQLite commit of the step that
// carries a record (or of a d1Retry tick). The row is keyed by game_id = hash of the table id + ":" +
// gameNo and inserted with ON CONFLICT DO NOTHING, so writing it again (an alarm comes at least once,
// a retry after a lost answer) never makes a second row.
//
// The binding is optional (D-14): until the D1 database exists and plan 02-10 binds it as DB, there
// is no env.DB and writeGame answers "skipped"; the game goes on and nothing is written. Never read on
// the game path: the Durable Object's SQLite is the source of truth for resuming.
//
// Plan 05-01 (HIST-02, D-01 to D-04, D-13; 05-RESEARCH Patterns 1 and 3, Pitfall 5): the same batch
// also writes, when at least one seat had an account, the played row (id = the games row's game_id)
// and one game_seats row per account (0003_results.sql), all ON CONFLICT DO NOTHING. Each game_seats
// row is an INSERT … SELECT … WHERE EXISTS on the account, so a vanished account is skipped instead of
// failing the whole batch (which would retry every hour forever). The games row keeps the 02-09 seat
// fields only: no account id ever reaches it. A record pending from before plan 05-01 (no account, no
// tally) writes the games row alone. A failed batch writes nothing and the record stays pending.

import { teamOf } from "@toc/engine";
import { toBase64Url } from "@toc/protocol";
import type { GameRecord, RecordSeat } from "@toc/table";

/** written: the row is there (new, or already there); skipped: no database; failed: try later. */
export type WriteOutcome = "written" | "skipped" | "failed";

/** base64url SHA-256 of the table id: the table's key in D1, which does not reveal the id (T-02-36). */
export async function tableHash(tableId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tableId));
  return toBase64Url(new Uint8Array(digest));
}

/** The 02-09 fields of a seat: all the legacy games row ever holds. */
type LegacySeat = Pick<RecordSeat, "colour" | "kind" | "name" | "level" | "handedOver">;

/**
 * A record as the Durable Object may hold it: one from before plan 05-01 lacks the account, the tally
 * and the creator's name.
 */
export type StoredRecord = Omit<GameRecord, "seats" | "creatorName"> & {
  seats: (LegacySeat & Partial<Omit<RecordSeat, keyof LegacySeat>>)[];
  creatorName?: string | null;
};

const legacySeat = (seat: LegacySeat): LegacySeat => ({
  colour: seat.colour,
  kind: seat.kind,
  name: seat.name,
  level: seat.level,
  handedOver: seat.handedOver,
});

/** A seat of a phase-5 record, every field there (a pending record from before has none of them). */
const complete = (seat: StoredRecord["seats"][number]): seat is RecordSeat =>
  seat.account !== undefined &&
  typeof seat.captured === "number" &&
  typeof seat.lost === "number" &&
  typeof seat.home === "number";

/** The kind of a seat in played.seats: an account, a guest (a person without one) or a computer. */
const seatKind = (seat: RecordSeat) =>
  seat.kind === "bot" ? "bot" : seat.account === null ? "guest" : "account";

/** The played row and the game_seats rows of a phase-5 record with an account at the table, else []. */
function resultStatements(
  db: D1Database,
  gameId: string,
  record: StoredRecord,
): D1PreparedStatement[] {
  const seats = record.seats;
  if (seats.length !== 4 || !seats.every(complete)) return [];
  const accounts = new Set(seats.flatMap((seat) => (seat.account === null ? [] : [seat.account])));
  if (accounts.size === 0) return [];
  const ranked = accounts.size >= 2 ? 1 : 0;
  const played = seats.map((seat) => ({
    colour: seat.colour,
    kind: seatKind(seat),
    account: seat.account,
    name: seat.name,
    level: seat.level,
    handedOver: seat.handedOver,
    captured: seat.captured,
    lost: seat.lost,
    home: seat.home,
  }));
  const statements = [
    db
      .prepare(
        `INSERT INTO played (id, kind, started_at, ended_at, winner, seats, deals, creator, accounts)
         VALUES (?, 'online', ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
      )
      .bind(
        gameId,
        record.startedAt,
        record.endedAt,
        record.winner,
        JSON.stringify(played),
        record.deals,
        record.creatorName ?? null,
        accounts.size,
      ),
  ];
  // One row per account: an account seated twice (two devices) keeps its first seat.
  const done = new Set<string>();
  for (const seat of seats) {
    if (seat.account === null || done.has(seat.account)) continue;
    done.add(seat.account);
    statements.push(
      db
        .prepare(
          `INSERT INTO game_seats
             (user_id, ended_at, game_id, colour, won, ranked, solo, captured, lost, home)
           SELECT ?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8, ?9
            WHERE EXISTS (SELECT 1 FROM users WHERE id = ?1)
           ON CONFLICT DO NOTHING`,
        )
        .bind(
          seat.account,
          record.endedAt,
          gameId,
          seat.colour,
          teamOf(seat.colour) === record.winner ? 1 : 0,
          ranked,
          seat.captured,
          seat.lost,
          seat.home,
        ),
    );
  }
  return statements;
}

export async function writeGame(
  db: D1Database | undefined,
  tableId: string,
  record: StoredRecord,
): Promise<WriteOutcome> {
  if (db === undefined || db === null) return "skipped";
  try {
    const hash = await tableHash(tableId);
    const gameId = `${hash}:${record.gameNo}`;
    const games = db
      .prepare(
        `INSERT INTO games
           (game_id, table_hash, game_no, started_at, ended_at, winner, seats, deals, captures)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (game_id) DO NOTHING`,
      )
      .bind(
        gameId,
        hash,
        record.gameNo,
        record.startedAt,
        record.endedAt,
        record.winner,
        JSON.stringify(record.seats.map(legacySeat)),
        record.deals,
        JSON.stringify(record.captures),
      );
    await db.batch([games, ...resultStatements(db, gameId, record)]);
    return "written";
  } catch {
    return "failed";
  }
}
