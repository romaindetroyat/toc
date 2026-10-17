// The record of a finished game in D1 (plan 02-09, HIST-01 support for phase 5, D-14; 02-RESEARCH
// Pattern 12). The table's Durable Object calls writeGame after the SQLite commit of the step that
// carries a record (or of a d1Retry tick). The row is keyed by game_id = hash of the table id + ":" +
// gameNo and inserted with ON CONFLICT DO NOTHING, so writing it again (an alarm comes at least once,
// a retry after a lost answer) never makes a second row.
//
// The binding is optional (D-14): until the D1 database exists and plan 02-10 binds it as DB, there
// is no env.DB and writeGame answers "skipped"; the game goes on and nothing is written. Never read on
// the game path: the Durable Object's SQLite is the source of truth for resuming.

import { toBase64Url } from "@toc/protocol";
import type { GameRecord } from "@toc/table";

/** written: the row is there (new, or already there); skipped: no database; failed: try later. */
export type WriteOutcome = "written" | "skipped" | "failed";

/** base64url SHA-256 of the table id: the table's key in D1, which does not reveal the id (T-02-36). */
export async function tableHash(tableId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tableId));
  return toBase64Url(new Uint8Array(digest));
}

export async function writeGame(
  db: D1Database | undefined,
  tableId: string,
  record: GameRecord,
): Promise<WriteOutcome> {
  if (db === undefined || db === null) return "skipped";
  try {
    const hash = await tableHash(tableId);
    await db
      .prepare(
        `INSERT INTO games
           (game_id, table_hash, game_no, started_at, ended_at, winner, seats, deals, captures)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (game_id) DO NOTHING`,
      )
      .bind(
        `${hash}:${record.gameNo}`,
        hash,
        record.gameNo,
        record.startedAt,
        record.endedAt,
        record.winner,
        JSON.stringify(record.seats),
        record.deals,
        JSON.stringify(record.captures),
      )
      .run();
    return "written";
  } catch {
    return "failed";
  }
}
