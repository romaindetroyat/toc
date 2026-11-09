// One account's own Durable Object (plan 04-03; 04-RESEARCH Patterns 3 and 6): PLAYER_HUB.getByName(
// userId), SQLite-backed, created by migration v2. Only the Worker reaches it: through RPC, and since
// plan 04-06 through the /ws/me upgrade it forwards (the account read from the session cookie, in
// x-toc-account). It holds what must be counted strongly and per account without writing D1 on every
// call:
//   checkBackupCode   the backup-code attempts of a recovery (T-04-34). The Worker passes the MAC
//                     stored in D1 and the MAC of the code typed; the hub compares them in constant time
//                     and keeps neither. BACKUP_FAILURES wrong codes in a row lock the account
//                     BACKUP_LOCK_MS; once a lock has been served, each further wrong code locks it again,
//                     twice as long each time (30 minutes, 1 hour…), at most BACKUP_LOCK_MAX_MS. While
//                     locked even the right code is refused. A right code resets the count and the ladder.
//   allow             sliding-window rate limits per kind (friend codes in 04-05, invitations later):
//                     true and counted for the first `max` calls inside `windowMs`, then false (not
//                     counted) until the oldest leaves the window
//   release           gives one counted call back (04-05: a friend code that worked is no failure)
//
// Presence (plan 04-06, D-08; Pattern 6, Pitfall 1): the app keeps one hibernating socket to its hub
// on every screen while signed in. It says hi with HUB_VERSION (another version: closed with 4002;
// frames before hi are ignored), then vis { visible } on open and on every visibility change. The
// attachment { hi, visible, seenAt } survives hibernation. The app pings every 20 s while visible;
// the runtime answers "pong" without waking the hub and records when. A socket is present when it
// said hi, its last vis was visible and its last sign of life (a frame, or that pong) is at most
// HUB_SILENCE_MS old: a hidden tab, a locked phone or a closed app is away. The browser never decides.
//   notify            { kind, table, from, own?, resumed?, key, now? }: the same invite (key = sender
//                     and table) within INVITE_DEDUPE_MS, or the same turn key (table and pause) within
//                     TURN_KEEP_MS, answers dup and sends nothing; else the notice frame goes to every
//                     present socket ("notice"), or nobody is present: the push (plan 04-07, below)
//                     goes to each of the account's subscriptions ("push"), or there is none to
//                     send ("away"). Each kept key is one row of `sent`, pruned on every notify.
//
// Web Push (plan 04-07, D-08; 04-RESEARCH Pattern 7, Pitfalls 1 and 10): when nobody is present, the
// hub reads the account's subscriptions from D1 (one query, at most MAX_SUBSCRIPTIONS rows), builds
// one encrypted message per subscription (push.ts) and delivers each through `deliver` (fetch; the
// tests replace it on the instance). 201 is fine; 404 and 410 delete the subscription; 429 keeps it
// and nothing is retried; 403 (a refused VAPID key) is logged once per instance. The authorization
// is reused per push service for at most JWT_REUSE_MS, in memory (signed again after an eviction).
// No VAPID secret: logged once, nothing sent, "away". The browser never decides: the service worker
// shows every push it receives (Apple revokes the permission otherwise).
//
// Times come from the caller (`now`, Date.now() by default) and are compared on each call: no timer
// function and no alarm (a lock ends by itself when its time has passed). The tables are created on
// first use, so an account that never recovers anything keeps an empty object.

import { DurableObject } from "cloudflare:workers";
import {
  CLOSE_VERSION,
  HUB_VERSION,
  NOTICE_FROM_MAX,
  type NoticeFrame,
  type NoticeKind,
  type PushNotice,
  parseHubClientFrame,
  pushPayload,
} from "@toc/protocol";
import { sameMac } from "./auth/backup.ts";
import { ACCOUNT_HEADER } from "./GameRoom.ts";
import {
  buildPush,
  isPushEndpoint,
  JWT_REUSE_MS,
  MAX_SUBSCRIPTIONS,
  type StoredSubscription,
  type Vapid,
  vapidOf,
} from "./push.ts";

/** A visible socket with no sign of life for longer than this is away (the app pings every 20 s). */
export const HUB_SILENCE_MS = 45_000;
/** One invite per sender and table in this window (T-04-50); the UI shows « Invitation envoyée ». */
export const INVITE_DEDUPE_MS = 10 * 60_000;
/** A turn key (a table and its pause) is kept this long: the same pause is never notified twice. */
export const TURN_KEEP_MS = 24 * 3600_000;

/** What a hub socket remembers through hibernation. */
type Seen = { hi: boolean; visible: boolean; seenAt: number };

export type NotifyInput = {
  kind: NoticeKind;
  table: string;
  from: string;
  own?: boolean;
  resumed?: boolean;
  /** The dedupe key: `${sender}:${table}` for an invite, `${table}:${pause}` for a turn. */
  key: string;
  /**
   * The hub's own account id (the name it was reached by), for its push subscriptions; the callers
   * pass it, the runtime's ctx.id.name otherwise. A different id than the hub's sends no push.
   */
  account?: string;
  now?: number;
};

/**
 * notice: shown in the open app; push: nobody present, sent to the account's subscriptions (plan
 * 04-07); away: nobody present and nothing sent (no subscription, no VAPID secret); dup: already sent.
 */
export type NotifyAnswer = "notice" | "push" | "away" | "dup";

function seenOf(ws: WebSocket): Seen {
  const value = ws.deserializeAttachment() as Partial<Seen> | null;
  return {
    hi: value?.hi === true,
    visible: value?.visible === true,
    seenAt: typeof value?.seenAt === "number" ? value.seenAt : 0,
  };
}

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
  /** The VAPID authorization per push-service origin and when it was signed (plan 04-07). */
  private signed = new Map<string, { authorization: string; at: number }>();
  /** Logged once per instance: no VAPID secret; a 403 from a push service. */
  private toldNoVapid = false;
  private toldRefused = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // The app's heartbeat is answered by the runtime without waking the hub (T-04-52).
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

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
      // Plan 04-06: the notices sent, for the dedupe (one row per kind and key).
      sql.exec(
        `CREATE TABLE IF NOT EXISTS sent (
           kind TEXT NOT NULL,
           key TEXT NOT NULL,
           at INTEGER NOT NULL,
           PRIMARY KEY (kind, key)
         ) WITHOUT ROWID`,
      );
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

  /**
   * RPC from the Worker (plan 04-05): gives back one call of `kind` that allow counted at `at`, when
   * that call turned out not to be what the limit counts (a friend code that worked: only failures
   * count). Charging first and giving back after keeps parallel calls inside the limit.
   */
  async release(input: { kind: string; at: number }): Promise<void> {
    this.sql().exec(
      `DELETE FROM limits WHERE rowid =
         (SELECT rowid FROM limits WHERE kind = ? AND at = ? LIMIT 1)`,
      input.kind,
      input.at,
    );
  }

  /**
   * The /ws/me upgrade, already checked by the Worker (session, our Origin), which set the account
   * from the cookie (x-toc-account). The socket hibernates; it is away until hi and vis visible.
   */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Upgrade attendu", { status: 426 });
    }
    if (!request.headers.get(ACCOUNT_HEADER)) return new Response("Refusé", { status: 403 });
    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ hi: false, visible: false, seenAt: Date.now() } satisfies Seen);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    const frame = parseHubClientFrame(message);
    if (frame === null) return;
    const seen = seenOf(ws);
    if (frame.t === "hi") {
      if (frame.v !== HUB_VERSION) {
        ws.close(CLOSE_VERSION, "nouvelle version");
        return;
      }
      ws.serializeAttachment({ ...seen, hi: true, seenAt: Date.now() } satisfies Seen);
      return;
    }
    // Frames before hi are ignored.
    if (!seen.hi) return;
    ws.serializeAttachment({ hi: true, visible: frame.visible, seenAt: Date.now() } satisfies Seen);
  }

  async webSocketClose(): Promise<void> {
    // Nothing kept per socket: a closed socket is simply no longer among getWebSockets().
  }

  async webSocketError(): Promise<void> {}

  /** The open sockets present at `now`: said hi, last vis visible, a sign of life recent enough. */
  private present(now: number): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => {
      if (ws.readyState !== WebSocket.OPEN) return false;
      const seen = seenOf(ws);
      if (!seen.hi || !seen.visible) return false;
      const answered = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      return now - Math.max(seen.seenAt, answered) <= HUB_SILENCE_MS;
    });
  }

  /**
   * RPC from the Worker (an invite, invite.ts) and later from a GameRoom (a turn, plan 04-07): dup
   * when this kind and key were sent recently, else the notice to every present socket, or away.
   * The key is remembered either way, so a push is not sent twice either.
   */
  async notify(input: NotifyInput): Promise<NotifyAnswer> {
    const now = input.now ?? Date.now();
    const sql = this.sql();
    sql.exec(
      "DELETE FROM sent WHERE (kind = 'invite' AND at <= ?) OR (kind <> 'invite' AND at <= ?)",
      now - INVITE_DEDUPE_MS,
      now - TURN_KEEP_MS,
    );
    const known = sql.exec("SELECT 1 FROM sent WHERE kind = ? AND key = ?", input.kind, input.key);
    if (known.toArray().length > 0) return "dup";
    sql.exec("INSERT INTO sent (kind, key, at) VALUES (?, ?, ?)", input.kind, input.key, now);

    const sockets = this.present(now);
    if (sockets.length === 0) return this.push(input, now);
    const frame: NoticeFrame = {
      t: "notice",
      kind: input.kind,
      table: input.table,
      from: [...input.from].slice(0, NOTICE_FROM_MAX).join(""),
      ...(input.own === undefined ? {} : { own: input.own }),
      ...(input.resumed === undefined ? {} : { resumed: input.resumed }),
      at: now,
    };
    const text = JSON.stringify(frame);
    for (const ws of sockets) {
      try {
        ws.send(text);
      } catch {
        // Closing meanwhile.
      }
    }
    return "notice";
  }

  /**
   * Sends the push of a notice to every subscription of the account (nobody present). "push" when at
   * least one message went out, else "away".
   */
  private async push(input: NotifyInput, now: number): Promise<NotifyAnswer> {
    const account = this.ctx.id.name ?? input.account;
    if (account === undefined || (input.account !== undefined && input.account !== account)) {
      return "away";
    }
    const vapid = vapidOf(this.env.VAPID_PRIVATE_KEY);
    if (vapid === null) {
      if (!this.toldNoVapid) {
        this.toldNoVapid = true;
        console.warn("push: no VAPID secret (VAPID_PRIVATE_KEY), no notification is sent");
      }
      return "away";
    }
    const db = this.env.DB;
    if (db === undefined) return "away";
    const testMode = this.env.TOC_TEST_MODE === "1";
    const found = await db
      .prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ? LIMIT ?")
      .bind(account, MAX_SUBSCRIPTIONS)
      .all<StoredSubscription>();
    // A row that is not a push service's endpoint is never fetched (T-04-53).
    const subscriptions = found.results.filter((sub) => isPushEndpoint(sub.endpoint, testMode));
    if (subscriptions.length === 0) return "away";
    const notice: PushNotice =
      input.kind === "invite"
        ? { kind: "invite", from: input.from }
        : {
            kind: "turn",
            from: input.from,
            ...(input.own === undefined ? {} : { own: input.own }),
            ...(input.resumed === undefined ? {} : { resumed: input.resumed }),
          };
    const payload = pushPayload({ ...notice, table: input.table });
    await Promise.all(
      subscriptions.map((sub) => this.sendOne(db, account, sub, payload, vapid, now)),
    );
    return "push";
  }

  /** One push: built, delivered, and the subscription dropped when the push service says it is gone. */
  private async sendOne(
    db: D1Database,
    account: string,
    sub: StoredSubscription,
    payload: ReturnType<typeof pushPayload>,
    vapid: Vapid,
    now: number,
  ): Promise<void> {
    let status: number;
    let origin = "";
    try {
      origin = new URL(sub.endpoint).origin;
      const cached = this.signed.get(origin);
      const reuse =
        cached !== undefined && now >= cached.at && now - cached.at < JWT_REUSE_MS
          ? cached.authorization
          : undefined;
      const built = await buildPush(sub, payload, vapid, this.env.ORIGIN, reuse);
      if (reuse === undefined && built.headers.authorization !== undefined) {
        this.signed.set(origin, { authorization: built.headers.authorization, at: now });
      }
      const response = await this.deliver(sub.endpoint, {
        method: "POST",
        headers: built.headers,
        body: built.body,
      });
      status = response.status;
    } catch (error) {
      console.warn("push: not delivered", error instanceof Error ? error.message : error);
      return;
    }
    if (status === 404 || status === 410) {
      await db
        .prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?")
        .bind(sub.endpoint, account)
        .run();
      return;
    }
    if (status === 403) {
      // A refused key (BadJwtToken, VapidPkHashMismatch): signed again next time.
      this.signed.delete(origin);
      if (!this.toldRefused) {
        this.toldRefused = true;
        console.warn(`push: 403 from ${origin}, the VAPID key or its JWT was refused`);
      }
    }
    // 429 and any other answer: kept, never retried (the next notice tries again).
  }

  /**
   * Sends one push request (fetch). Checks the endpoint again, so even a direct call can only reach
   * a push service (T-04-53). The workerd tests replace it on the instance.
   */
  async deliver(endpoint: string, init: RequestInit): Promise<Response> {
    if (!isPushEndpoint(endpoint, this.env.TOC_TEST_MODE === "1")) {
      throw new Error("push: not a push service endpoint");
    }
    return fetch(endpoint, init);
  }
}
