// One online table: a SQLite-backed Durable Object with hibernating sockets and one alarm
// (02-RESEARCH Patterns 2 and 3). It is a thin shell around the pure reducer of @toc/table: every
// frame, socket close and alarm becomes one reduce() call, then a synchronous SQLite commit, then the
// per-person sends, then the alarm is moved to the table's next deadline.
//
// Alarms (debug slow-online-bots): production runs an alarm with Date.now() exactly at its scheduled
// time, and the runtime keeps alarm times in whole milliseconds. The alarm is armed at the deadline
// rounded up, and an alarm handler never arms its own time again (that alarm would be dropped until
// production's rescan, a minute later).
//
// Nothing lives only in memory: `cached` is a copy of the snapshot, dropped on eviction and read again
// from SQLite. Sockets carry their person in their attachment ({ who, helloAt, account }), which
// survives hibernation. No timer function anywhere: deadlines are alarms (CLAUDE.md, Hibernation API).
//
// Presence (plan 02-06, 02-RESEARCH Pattern 7, Pitfall 5): a socket closing is a `gone` (the fast
// path, the page's pagehide closes with 1000). A locked phone may keep its socket open without a
// word: the client pings every 20 s, the runtime answers "pong" without waking the object and
// records when (getWebSocketAutoResponseTimestamp). Every alarm first closes, with 4000, each socket
// whose last sign of life (that timestamp, else its hello) is older than SILENCE_MS, and runs `gone`
// for its person when no other socket of theirs is open; the table keeps a sweep deadline every
// SWEEP_MS while a game runs or waits, so such an alarm comes.
//
// Expiry (plan 02-07, D-06): the table is created with an expire deadline 30 days on. When a tick
// answers `purge` (30 days without activity), the object closes every socket with CLOSE_GONE and
// calls ctx.storage.deleteAll(), which also removes the alarm (compatibility date ≥ 2026-02-24); later
// requests find no table (4004, 404).
//
// Game records (plan 02-09, D-14; 02-RESEARCH Pattern 12): a step that carries finished games' records
// (the winning play, or a d1Retry tick) is committed and sent first; then each record is written to
// D1 (src/record.ts, one row per game whatever happens) and, when written or when there is no DB
// binding yet, the `recorded` command clears it. A failed write leaves it pending: the table already
// armed its d1Retry deadline. Nothing on the game path reads D1.
//
// Accounts (plan 04-04, 04-RESEARCH Pattern 4): the Worker forwards the session's account on the
// upgrade (x-toc-account, x-toc-pseudo, set by the Worker only); the attachment keeps it. At hello
// the object hashes the device, guest and account ids, then @toc/table's resolveWho picks the person
// (rules 1-4) on the table as it is after that await. A step that links a person or moves a linked
// person's seat writes table_members after the commit (members.ts), best effort.

import { DurableObject } from "cloudflare:workers";
import type { Rng } from "@toc/engine";
import {
  CLOSE_ELSEWHERE,
  CLOSE_GONE,
  CLOSE_SILENT,
  CLOSE_VERSION,
  PROTOCOL_VERSION,
  parseClientFrame,
  type ServerFrame,
  type TableStatus,
  type TableSummary,
  toBase64Url,
} from "@toc/protocol";
import {
  type Command,
  createTable,
  type GameRecord,
  type HelloAccount,
  type Member,
  nextDeadline,
  reduce,
  resolveWho,
  SILENCE_MS,
  summary,
  type Table,
  type TestOptions,
} from "@toc/table";
import { writeMembers } from "./members.ts";
import { writeGame } from "./record.ts";
import { commit, createSchema, hasTable, load } from "./storage.ts";

/**
 * What a socket remembers through hibernation: its person, once it said hello, and the account the
 * Worker forwarded on its upgrade (plan 04-04), null for a guest.
 */
type Attachment = { who: string | null; helloAt: number; account: HelloAccount | null };

/** Set by the Worker only, from the session cookie (index.ts tableUpgrade, T-04-08). */
export const ACCOUNT_HEADER = "x-toc-account";
export const PSEUDO_HEADER = "x-toc-pseudo";

/**
 * What a table invite needs to know (plan 04-06, GameRoom.inviteInfo): the table's status, and
 * whether the sender and the friend are people of it (by their accounts).
 */
export type InviteInfo = { status: TableStatus; senderHere: boolean; friendHere: boolean };

/** A socket forgotten (closed by the object): its close handler finds no person. */
const FORGOTTEN: Attachment = { who: null, helloAt: 0, account: null };

/** Four words from the secure random source (deck seeds, the computers' stream). */
export function randomSeed(): Rng {
  const words = new Uint32Array(4);
  crypto.getRandomValues(words);
  return [words[0] as number, words[1] as number, words[2] as number, words[3] as number];
}

/**
 * A person's id at one table: base64url SHA-256 of the table id and a device token (T-02-06), or of
 * `${tableId}:guest:${token}` (a signed-out device on a linked person, rule 4) or
 * `${tableId}:acct:${userId}` (a new account person, rule 3; plan 04-04).
 */
async function personId(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return toBase64Url(new Uint8Array(digest));
}

function attachmentOf(ws: WebSocket): Attachment {
  const value = ws.deserializeAttachment() as Partial<Attachment> | null;
  return { who: value?.who ?? null, helloAt: value?.helloAt ?? 0, account: value?.account ?? null };
}

/** The account the Worker forwarded on the upgrade, or null (a guest, or headers out of shape). */
function forwardedAccount(request: Request): HelloAccount | null {
  const id = request.headers.get(ACCOUNT_HEADER);
  const encoded = request.headers.get(PSEUDO_HEADER);
  if (id === null || encoded === null || id === "" || id.length > 64) return null;
  try {
    const pseudo = decodeURIComponent(encoded);
    return pseudo === "" || pseudo.length > 200 ? null : { id, pseudo };
  } catch {
    return null;
  }
}

export class GameRoom extends DurableObject<Env> {
  /** The snapshot as last read or written; undefined until read (after every eviction). */
  private cached: Table | null | undefined;
  /** The alarm as last set by this instance; undefined until read. */
  private armed: number | null | undefined;
  /** The missing DB binding was logged by this instance (once, plan 02-09). */
  private toldNoDatabase = false;
  /** While an alarm handler runs: the time that alarm was scheduled for; else null. */
  private firing: number | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Heartbeats are answered by the runtime without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /** RPC from the Worker: a new table. False when this id already holds one. */
  async create(options: { tableId: string; test: TestOptions | null }): Promise<boolean> {
    const sql = this.ctx.storage.sql;
    if (hasTable(sql)) return false;
    createSchema(sql);
    const table = createTable({
      tableId: options.tableId,
      now: Date.now(),
      seed: randomSeed(),
      test: options.test,
    });
    commit(sql, table, [], Date.now());
    this.cached = table;
    // The 30-day expiry is the first deadline of every table.
    this.arm(nextDeadline(table));
    return true;
  }

  /**
   * RPC from the Worker: the table's public summary, or null when this id holds no table. Reads
   * sqlite_master first, so asking about an unknown id creates no schema (T-02-16).
   */
  async summary(): Promise<TableSummary | null> {
    const table = this.table();
    return table === null ? null : summary(table);
  }

  /**
   * RPC from the Worker (plan 04-06, invite.ts): the status (as the summary words it) and whether
   * the sender and the friend are people of the table, from the people's accounts; null when this id
   * holds no table. Reads the snapshot only: nothing is written, no schema is created.
   */
  async inviteInfo(input: { sender: string; friend: string }): Promise<InviteInfo | null> {
    const table = this.table();
    if (table === null) return null;
    return {
      status: summary(table).status,
      senderHere: table.people.some((person) => person.account === input.sender),
      friendHere: table.people.some((person) => person.account === input.friend),
    };
  }

  /**
   * The WebSocket upgrade, already checked by the Worker (id format, Origin), which also set the
   * account headers from the session cookie (plan 04-04).
   */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Upgrade attendu", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      who: null,
      helloAt: Date.now(),
      account: forwardedAccount(request),
    } satisfies Attachment);
    // An unknown id: the socket is closed at once and nothing is written.
    if (!hasTable(this.ctx.storage.sql)) server.close(CLOSE_GONE, "table introuvable");
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    const parsed = parseClientFrame(message);
    if (!parsed.ok) {
      this.send(ws, { t: "error", code: "bad-frame" });
      return;
    }
    const frame = parsed.frame;
    const attachment = attachmentOf(ws);
    if (frame.t !== "hello") {
      // Frames before hello are ignored (T-02-05). A winning play's record is written before the
      // handler ends.
      if (attachment.who !== null) await this.run({ t: "client", who: attachment.who, frame });
      return;
    }
    if (frame.v !== PROTOCOL_VERSION) {
      ws.close(CLOSE_VERSION, "nouvelle version");
      return;
    }
    const table = this.table();
    if (table === null) {
      ws.close(CLOSE_GONE, "table introuvable");
      return;
    }
    // The only await before the synchronous section: the device, guest and account hashes.
    const tableId = table.tableId;
    const account = attachment.account;
    const [device, guest, accountWho] = await Promise.all([
      personId(`${tableId}:${frame.token}`),
      personId(`${tableId}:guest:${frame.token}`),
      account === null ? null : personId(`${tableId}:acct:${account.id}`),
    ]);
    const current = this.table();
    if (current === null) {
      ws.close(CLOSE_GONE, "table introuvable");
      return;
    }
    // The four rules of 04-RESEARCH Pattern 4 on the table as it is now (accounts.ts).
    const who = resolveWho(current, {
      device,
      guest,
      account: account === null || accountWho === null ? null : { id: account.id, who: accountWho },
    });
    ws.serializeAttachment({ who, helloAt: Date.now(), account } satisfies Attachment);
    // One live socket per person: the older one is told it is open elsewhere (another device of
    // the same account included, rule 1).
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws && attachmentOf(other).who === who) {
        other.serializeAttachment(FORGOTTEN);
        other.close(CLOSE_ELSEWHERE, "ouverte ailleurs");
      }
    }
    // A link or a seat change writes table_members before the handler ends.
    await this.run({ t: "hello", who, name: frame.name, account });
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.left(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.left(ws);
  }

  async alarm(alarmInfo?: AlarmInvocationInfo): Promise<void> {
    // The alarm that fired is no longer set.
    this.armed = null;
    // Nothing is armed again at or before this alarm's own time (arm). Absent when a test calls the
    // handler itself.
    this.firing = alarmInfo?.scheduledTime ?? null;
    try {
      // Silent sockets first: a person found gone pauses the game before the tick runs (NET-03).
      this.sweepSilent(Date.now());
      // A retry follows a failed invocation (over the Free plan's CPU limit, for instance): a
      // computer decision still pending is then made at level 1, so the table never freezes (D-11).
      await this.run({ t: "tick", retry: alarmInfo?.isRetry === true });
    } finally {
      this.firing = null;
    }
  }

  /**
   * Closes every socket silent for more than SILENCE_MS (no answered ping since, no hello) with 4000,
   * then runs `gone` for each of their people who has no other open socket (T-02-26).
   */
  private sweepSilent(now: number): void {
    const sockets = this.ctx.getWebSockets();
    const silent = new Set<string>();
    for (const ws of sockets) {
      const { who, helloAt } = attachmentOf(ws);
      const answered = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      if (now - Math.max(answered, helloAt) <= SILENCE_MS) continue;
      // Its close handler must not run `gone` a second time: the attachment forgets the person.
      ws.serializeAttachment(FORGOTTEN);
      try {
        ws.close(CLOSE_SILENT, "silencieux");
      } catch {
        // Already closing.
      }
      if (who !== null) silent.add(who);
    }
    for (const who of silent) {
      const still = sockets.some(
        (other) => other.readyState === WebSocket.OPEN && attachmentOf(other).who === who,
      );
      if (!still) this.run({ t: "gone", who });
    }
  }

  /** A socket closed: the person is gone when no other open socket is theirs. */
  private left(ws: WebSocket): void {
    const { who } = attachmentOf(ws);
    if (who === null) return;
    const still = this.ctx
      .getWebSockets()
      .some(
        (other) =>
          other !== ws && other.readyState === WebSocket.OPEN && attachmentOf(other).who === who,
      );
    if (!still) this.run({ t: "gone", who });
  }

  private table(): Table | null {
    if (this.cached === undefined) this.cached = load(this.ctx.storage.sql);
    return this.cached;
  }

  /**
   * reduce → commit (synchronous SQL) → per-person sends → the alarm at the next deadline. A purge
   * (only from a tick) returns the deletion's promise, which the alarm awaits; finished games'
   * records and the account's tables (plan 04-04) return the D1 writes' promise, which the handler
   * awaits.
   */
  private run(command: Command): Promise<void> | undefined {
    const table = this.table();
    if (table === null) return;
    const now = Date.now();
    const result = reduce(table, command, { now, seed: randomSeed });
    if (result.purge === true) return this.purge();
    if (result.table !== table) {
      commit(this.ctx.storage.sql, result.table, result.log, now);
      this.cached = result.table;
    }
    if (result.out.length > 0) {
      const sockets = this.ctx.getWebSockets();
      for (const { to, frame } of result.out) {
        for (const ws of sockets) {
          if (attachmentOf(ws).who === to) this.send(ws, frame);
        }
      }
    }
    this.arm(nextDeadline(result.table));
    const writes: Promise<void>[] = [];
    if (result.records !== undefined && result.records.length > 0) {
      writes.push(this.record(result.table.tableId, result.records));
    }
    if (result.members !== undefined && result.members.length > 0) {
      writes.push(this.members(result.table.tableId, result.members, now));
    }
    if (writes.length === 0) return;
    return writes.length === 1 ? writes[0] : Promise.all(writes).then(() => undefined);
  }

  /**
   * Writes the account's tables to D1 after the commit (plan 04-04, members.ts): best effort, a
   * failure logged and ignored (the next seat change writes the row again); no DB binding is logged
   * once, like the game records.
   */
  private async members(tableId: string, members: readonly Member[], now: number): Promise<void> {
    const { outcome } = await writeMembers(this.env.DB, tableId, members, now);
    if (outcome === "failed") console.warn("table members: not written to D1");
    if (outcome === "skipped" && !this.toldNoDatabase) {
      this.toldNoDatabase = true;
      console.log("table members: no D1 binding (DB), the account's tables are not kept");
    }
  }

  /**
   * Writes finished games to D1 after their step's commit. Written, or no DB binding (D1 not created
   * yet, D-14): the record is no longer pending. Failed: it stays pending for the d1Retry deadline.
   */
  private async record(tableId: string, records: readonly GameRecord[]): Promise<void> {
    for (const record of records) {
      const outcome = await writeGame(this.env.DB, tableId, record);
      if (outcome === "failed") {
        console.warn(`table record: game ${record.gameNo} not written to D1, retried later`);
        continue;
      }
      if (outcome === "skipped" && !this.toldNoDatabase) {
        this.toldNoDatabase = true;
        console.log("table record: no D1 binding (DB), finished games are not recorded");
      }
      this.run({ t: "recorded", gameNo: record.gameNo });
    }
  }

  /**
   * 30 days without activity: every socket is closed with CLOSE_GONE (its close handler finds no
   * person), then the whole storage goes, the alarm with it. Nothing is cached any more.
   */
  private async purge(): Promise<void> {
    this.cached = null;
    this.armed = null;
    for (const ws of this.ctx.getWebSockets()) {
      ws.serializeAttachment(FORGOTTEN);
      try {
        ws.close(CLOSE_GONE, "table effacée");
      } catch {
        // Already closing.
      }
    }
    await this.ctx.storage.deleteAll();
  }

  private send(ws: WebSocket, frame: ServerFrame): void {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      // A socket closing meanwhile: its close handler runs next.
    }
  }

  /**
   * Moves the one alarm to `deadline` (or removes it), only when it changed: each set is a row
   * written. The runtime keeps whole milliseconds, truncated, and it drops an alarm that its own
   * handler leaves at the time it fired for (no write, nothing scheduled: production then waits for
   * its rescan, about a minute). So the alarm goes to the deadline rounded up, never below it (a
   * computer's play time is fractional), and while an alarm runs, after that alarm's time (a computer
   * due at once, a Champion's next slice).
   */
  private arm(deadline: number | null): void {
    let at = deadline === null ? null : Math.ceil(deadline);
    if (at !== null && this.firing !== null && at <= this.firing) at = this.firing + 1;
    if (at === this.armed) return;
    this.armed = at;
    if (at === null) void this.ctx.storage.deleteAlarm();
    else void this.ctx.storage.setAlarm(at);
  }
}
