// One account's own Durable Object (plan 04-03; 04-RESEARCH Patterns 3 and 6): PLAYER_HUB.getByName(
// userId), SQLite-backed, created by migration v2. Only the Worker reaches it, through RPC; no route
// forwards a request to it in this plan. It holds what must be counted strongly and per account
// without writing D1 on every call:
//   checkBackupCode   the backup-code attempts of a recovery (T-04-34). The Worker passes the MAC
//                     stored in D1 and the MAC of the code typed; the hub compares them in constant time
//                     and keeps neither. BACKUP_FAILURES wrong codes in a row lock the account
//                     BACKUP_LOCK_MS; once a lock has been served, each further wrong code locks it again,
//                     twice as long each time (30 minutes, 1 hour…), at most BACKUP_LOCK_MAX_MS. While
//                     locked even the right code is refused. A right code resets the count and the ladder.
//   allow             sliding-window rate limits per kind (friend codes in 04-05, invitations later):
//                     true and counted for the first `max` calls inside `windowMs`, then false (not
//                     counted) until the oldest leaves the window
// Presence, notices and Web Push come in plans 04-06 and 04-07.
//
// Times come from the caller (`now`, Date.now() by default) and are compared on each call: no timer
// function and no alarm (a lock ends by itself when its time has passed). The tables are created on
// first use, so an account that never recovers anything keeps an empty object.

import { DurableObject } from "cloudflare:workers";
import { sameMac } from "./auth/backup.ts";

/** Wrong codes in a row before the first lock. */
export const BACKUP_FAILURES = 5;
/** The first lock: 15 minutes, then twice as long after each wrong code that follows a lock. */
export const BACKUP_LOCK_MS = 15 * 60_000;
/** The longest lock: 24 hours. */
export const BACKUP_LOCK_MAX_MS = 24 * 3600_000;

export type BackupCheck =
  | { ok: true }
  | { ok: false; reason: "wrong" }
  | { ok: false; reason: "locked"; until: number };

/** The duration of the lock number `level` (0 for the first): 15 minutes doubled, capped at 24 hours. */
export function lockDuration(level: number): number {
  // 2^7 × 15 minutes is already over 24 hours: the cap holds whatever the level.
  return Math.min(BACKUP_LOCK_MS * 2 ** Math.min(level, 7), BACKUP_LOCK_MAX_MS);
}

type Attempts = { failures: number; lockedUntil: number; level: number };

export class PlayerHub extends DurableObject<Env> {
  /** The tables exist in this instance's SQLite (checked once per instance). */
  private ready = false;

  private sql(): SqlStorage {
    const sql = this.ctx.storage.sql;
    if (!this.ready) {
      // failures: wrong codes in a row; locked_until: ms, 0 when not locked; level: locks so far.
      sql.exec(
        `CREATE TABLE IF NOT EXISTS attempts (
           id INTEGER PRIMARY KEY CHECK (id = 1),
           failures INTEGER NOT NULL,
           locked_until INTEGER NOT NULL,
           level INTEGER NOT NULL
         )`,
      );
      sql.exec(
        `CREATE TABLE IF NOT EXISTS limits (
           kind TEXT NOT NULL,
           at INTEGER NOT NULL
         )`,
      );
      sql.exec("CREATE INDEX IF NOT EXISTS limits_kind_at ON limits (kind, at)");
      this.ready = true;
    }
    return sql;
  }

  private attempts(sql: SqlStorage): Attempts {
    const row = sql
      .exec("SELECT failures, locked_until, level FROM attempts WHERE id = 1")
      .toArray()[0];
    if (row === undefined) return { failures: 0, lockedUntil: 0, level: 0 };
    return {
      failures: Number(row.failures),
      lockedUntil: Number(row.locked_until),
      level: Number(row.level),
    };
  }

  private save(sql: SqlStorage, attempts: Attempts): void {
    sql.exec(
      `INSERT INTO attempts (id, failures, locked_until, level) VALUES (1, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET failures = excluded.failures,
         locked_until = excluded.locked_until, level = excluded.level`,
      attempts.failures,
      attempts.lockedUntil,
      attempts.level,
    );
  }

  /**
   * RPC from the Worker (auth/recover.ts): is `given` (the MAC of the code typed) the account's
   * `expected` MAC? Counted: wrong codes in a row lock the account (see the header).
   */
  async checkBackupCode(input: {
    expected: string;
    given: string;
    now?: number;
  }): Promise<BackupCheck> {
    const now = input.now ?? Date.now();
    const sql = this.sql();
    const attempts = this.attempts(sql);
    if (attempts.lockedUntil > now)
      return { ok: false, reason: "locked", until: attempts.lockedUntil };

    if (sameMac(input.expected, input.given)) {
      if (attempts.failures !== 0 || attempts.level !== 0 || attempts.lockedUntil !== 0) {
        sql.exec("DELETE FROM attempts");
      }
      return { ok: true };
    }

    const failures = attempts.failures + 1;
    if (failures < BACKUP_FAILURES) {
      this.save(sql, { ...attempts, failures });
      return { ok: false, reason: "wrong" };
    }
    // The fifth wrong code in a row, or any wrong code after a lock: locked again, twice as long.
    const until = now + lockDuration(attempts.level);
    this.save(sql, { failures, lockedUntil: until, level: attempts.level + 1 });
    return { ok: false, reason: "locked", until };
  }

  /**
   * RPC from the Worker: one more call of `kind` allowed now? True (and counted) while fewer than
   * `max` calls of that kind fell inside the last `windowMs`; false otherwise (not counted). The
   * entries that left the window are removed first.
   */
  async allow(input: {
    kind: string;
    max: number;
    windowMs: number;
    now?: number;
  }): Promise<boolean> {
    const now = input.now ?? Date.now();
    const sql = this.sql();
    sql.exec("DELETE FROM limits WHERE kind = ? AND at <= ?", input.kind, now - input.windowMs);
    const count = Number(
      sql.exec("SELECT COUNT(*) AS n FROM limits WHERE kind = ?", input.kind).one().n,
    );
    if (count >= input.max) return false;
    sql.exec("INSERT INTO limits (kind, at) VALUES (?, ?)", input.kind, now);
    return true;
  }
}
