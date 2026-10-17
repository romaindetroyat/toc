// One online table: a SQLite-backed Durable Object with hibernating sockets and one alarm
// (02-RESEARCH Patterns 2 and 3). It is a thin shell around the pure reducer of @toc/table: every
// frame, socket close and alarm becomes one reduce() call, then a synchronous SQLite commit, then the
// per-person sends, then the alarm is moved to the table's next deadline.
//
// Nothing lives only in memory: `cached` is a copy of the snapshot, dropped on eviction and read again
// from SQLite. Sockets carry their person in their attachment ({ who, helloAt }), which survives
// hibernation. No timer function anywhere: deadlines are alarms (CLAUDE.md, Hibernation API).

import { DurableObject } from "cloudflare:workers";
import type { Rng } from "@toc/engine";
import {
  CLOSE_ELSEWHERE,
  CLOSE_GONE,
  CLOSE_VERSION,
  PROTOCOL_VERSION,
  parseClientFrame,
  type ServerFrame,
  toBase64Url,
} from "@toc/protocol";
import {
  type Command,
  createTable,
  nextDeadline,
  reduce,
  type Table,
  type TestOptions,
} from "@toc/table";
import { commit, createSchema, hasTable, load } from "./storage.ts";

/** What a socket remembers through hibernation: its person, once it said hello. */
type Attachment = { who: string | null; helloAt: number };

/** Four words from the secure random source (deck seeds, the computers' stream). */
export function randomSeed(): Rng {
  const words = new Uint32Array(4);
  crypto.getRandomValues(words);
  return [words[0] as number, words[1] as number, words[2] as number, words[3] as number];
}

/** A person's id at one table: SHA-256 of the table id and the device token (T-02-06). */
async function personId(tableId: string, token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${tableId}:${token}`),
  );
  return toBase64Url(new Uint8Array(digest));
}

function attachmentOf(ws: WebSocket): Attachment {
  const value = ws.deserializeAttachment() as Partial<Attachment> | null;
  return { who: value?.who ?? null, helloAt: value?.helloAt ?? 0 };
}

export class GameRoom extends DurableObject<Env> {
  /** The snapshot as last read or written; undefined until read (after every eviction). */
  private cached: Table | null | undefined;
  /** The alarm as last set by this instance; undefined until read. */
  private armed: number | null | undefined;

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
    return true;
  }

  /** The WebSocket upgrade, already checked by the Worker (id format, Origin). */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Upgrade attendu", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ who: null, helloAt: Date.now() } satisfies Attachment);
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
      // Frames before hello are ignored (T-02-05).
      if (attachment.who !== null) this.run({ t: "client", who: attachment.who, frame });
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
    // The only await of the handler, before the synchronous section.
    const who = await personId(table.tableId, frame.token);
    ws.serializeAttachment({ who, helloAt: Date.now() } satisfies Attachment);
    // One live socket per device: the older one is told it is open elsewhere.
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws && attachmentOf(other).who === who) {
        other.serializeAttachment({ who: null, helloAt: 0 } satisfies Attachment);
        other.close(CLOSE_ELSEWHERE, "ouverte ailleurs");
      }
    }
    this.run({ t: "hello", who, name: frame.name });
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
    // A retry follows a failed invocation (over the Free plan's CPU limit, for instance): a computer
    // decision still pending is then made at level 1, so the table never freezes (D-11).
    this.run({ t: "tick", retry: alarmInfo?.isRetry === true });
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

  /** reduce → commit (synchronous SQL) → per-person sends → the alarm at the next deadline. */
  private run(command: Command): void {
    const table = this.table();
    if (table === null) return;
    const now = Date.now();
    const result = reduce(table, command, { now, seed: randomSeed });
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
  }

  private send(ws: WebSocket, frame: ServerFrame): void {
    try {
      ws.send(JSON.stringify(frame));
    } catch {
      // A socket closing meanwhile: its close handler runs next.
    }
  }

  /** Moves the one alarm to `at` (or removes it), only when it changed: each set is a row written. */
  private arm(at: number | null): void {
    if (at === this.armed) return;
    this.armed = at;
    if (at === null) void this.ctx.storage.deleteAlarm();
    else void this.ctx.storage.setAlarm(at);
  }
}
