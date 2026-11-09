// The account's tables in D1 (plan 04-04, ACCT-02; 04-RESEARCH Pattern 4 « Cross-device Mes parties
// en cours »). table_members(user_id, table_id, seat, joined_at) holds, for each account, the online
// tables it is at and its seat there; « Mes parties en cours » merges it with the device's own list,
// so the installed app (its own storage) and every other device know the account's tables.
//   writeMembers(db, …)         the GameRoom's upsert after a commit (best effort, like the game
//                               record): one row per account whose person became linked or whose
//                               seat changed; the join time stays the first one
//   GET /api/me/tables          the session's tables, newest first, at most MAX_ACCOUNT_TABLES
//   DELETE /api/me/tables/:id   one table forgotten (our Origin, no body), 204
// Nothing on the game path reads D1: a failed write is logged by the GameRoom and ignored; the next
// seat change writes the row again.

import { type AccountTable, isTableId, MAX_ACCOUNT_TABLES } from "@toc/protocol";
import type { Member } from "@toc/table";
import { sessionUser } from "./auth/session.ts";
import type { Meter } from "./db.ts";
import { json } from "./http.ts";
import type { WriteOutcome } from "./record.ts";

/** The rows to write for `members` (one per account, its last seat) at table `tableId`. */
export async function writeMembers(
  db: D1Database | undefined,
  tableId: string,
  members: readonly Member[],
  now: number,
): Promise<{ outcome: WriteOutcome; rowsWritten: number }> {
  if (db === undefined || db === null) return { outcome: "skipped", rowsWritten: 0 };
  const last = new Map<string, Member>();
  for (const member of members) last.set(member.account, member);
  if (last.size === 0) return { outcome: "written", rowsWritten: 0 };
  try {
    const statements = [...last.values()].map((member) =>
      db
        .prepare(
          `INSERT INTO table_members (user_id, table_id, seat, joined_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (user_id, table_id) DO UPDATE SET seat = excluded.seat`,
        )
        .bind(member.account, tableId, member.seat, now),
    );
    const results = await db.batch(statements);
    const rowsWritten = results.reduce((sum, result) => sum + (result.meta?.rows_written ?? 0), 0);
    return { outcome: "written", rowsWritten };
  } catch {
    return { outcome: "failed", rowsWritten: 0 };
  }
}

type MemberRow = { table_id: string; seat: AccountTable["seat"]; joined_at: number };

/** GET /api/me/tables: the session's tables, newest first; 401 without a session. */
export async function myTablesRoute(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
): Promise<Response> {
  const user = await sessionUser(request, url, env, meter, now);
  if (user === null) return json({ error: "signed-out" }, 401);
  const found = await meter.all<MemberRow>(
    meter
      .prepare(
        `SELECT table_id, seat, joined_at FROM table_members WHERE user_id = ?
          ORDER BY joined_at DESC, table_id LIMIT ?`,
      )
      .bind(user.id, MAX_ACCOUNT_TABLES),
  );
  const tables: AccountTable[] = found.results.map((row) => ({
    tableId: row.table_id,
    seat: row.seat,
    joinedAt: row.joined_at,
  }));
  return json(tables, 200);
}

/** DELETE /api/me/tables/:id (the router checked our Origin): 204, or 401 without a session. */
export async function forgetMyTableRoute(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
  tableId: string,
): Promise<Response> {
  const user = await sessionUser(request, url, env, meter, now);
  if (user === null) return json({ error: "signed-out" }, 401);
  if (!isTableId(tableId)) return json({ error: "not-found" }, 404);
  await meter.run(
    meter
      .prepare("DELETE FROM table_members WHERE user_id = ? AND table_id = ?")
      .bind(user.id, tableId),
  );
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
