// Test helpers for the workerd tests: create a table through the router, open real hibernatable
// sockets on it, send frames and wait for the frames the table sends back.

import { SELF } from "cloudflare:test";
import type { ClientFrame, ServerFrame } from "@toc/protocol";

export const ORIGIN = "https://toc.test";

/** POST /api/tables; the test options are honoured because TOC_TEST_MODE is "1" in vitest.config.ts. */
export async function createTable(test: unknown = { pace: "zero" }): Promise<string> {
  const response = await SELF.fetch(`${ORIGIN}/api/tables`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ test }),
  });
  if (response.status !== 201) throw new Error(`create: ${response.status}`);
  const body = (await response.json()) as { id: string };
  return body.id;
}

export type Client = {
  ws: WebSocket;
  /** Every frame received so far, in order. */
  frames: ServerFrame[];
  /** Every raw text received, for the leak checks. */
  raw: string[];
  send(frame: ClientFrame | Record<string, unknown>): void;
  /** The next frame not yet taken whose type is `t` and that passes `where` (others are skipped). */
  next<T extends ServerFrame["t"]>(
    t: T,
    where?: (frame: Extract<ServerFrame, { t: T }>) => boolean,
  ): Promise<Extract<ServerFrame, { t: T }>>;
  /** The latest seq seen in a welcome or events frame. */
  seq(): number;
  closed: Promise<{ code: number }>;
  /** The close code once the socket closed, else null (for a test's failure message). */
  closeCode(): number | null;
};

/** How often a test client pings, as the app does every 20 s (plan 02-06): well inside the 75 s. */
const PING_EVERY_MS = 10_000;

/**
 * Opens a socket on /ws/table/<id> and accepts it on the test side. Like the app, the client sends
 * "ping" every PING_EVERY_MS (the object's auto-response answers "pong" without waking it), so a long
 * test is never swept as silent; `ping: false` leaves it silent.
 */
export async function connect(
  id: string,
  headers: Record<string, string> = {},
  options: { ping?: boolean } = {},
): Promise<Client> {
  const response = await SELF.fetch(`${ORIGIN}/ws/table/${id}`, {
    headers: { Upgrade: "websocket", ...headers },
  });
  const ws = response.webSocket;
  if (ws === null || ws === undefined) throw new Error(`no socket: ${response.status}`);
  ws.accept();
  const frames: ServerFrame[] = [];
  const raw: string[] = [];
  let cursor = 0;
  let wake: (() => void) | null = null;
  let lastSeq = 0;
  ws.addEventListener("message", (event) => {
    const text = typeof event.data === "string" ? event.data : "";
    // The auto-response to a ping is not a frame.
    if (text === "pong") return;
    raw.push(text);
    const frame = JSON.parse(text) as ServerFrame;
    if (frame.t === "welcome" || frame.t === "events") lastSeq = frame.seq;
    frames.push(frame);
    wake?.();
  });
  const pinger =
    options.ping === false
      ? null
      : setInterval(() => {
          try {
            ws.send("ping");
          } catch {
            // Closed meanwhile.
          }
        }, PING_EVERY_MS);
  let closeCode: number | null = null;
  const closed = new Promise<{ code: number }>((resolve) => {
    ws.addEventListener("close", (event) => {
      closeCode = event.code;
      if (pinger !== null) clearInterval(pinger);
      resolve({ code: event.code });
      wake?.();
    });
  });
  return {
    ws,
    frames,
    raw,
    send(frame) {
      ws.send(JSON.stringify(frame));
    },
    async next(t, where) {
      // Wall time, not a poll count: the CPU-heavy Node tests run alongside (as in bots.test.ts).
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        while (cursor < frames.length) {
          const frame = frames[cursor++] as ServerFrame;
          if (frame.t === t && (where === undefined || where(frame as never)))
            return frame as never;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
          setTimeout(resolve, 5);
        });
        wake = null;
      }
      throw new Error(`no ${t} frame`);
    },
    seq: () => lastSeq,
    closed,
    closeCode: () => closeCode,
  };
}

/**
 * A browser's cookie for the account routes (plan 04-01): the `name=value` of the last Set-Cookie,
 * dropped when the server expires it (Max-Age=0). One jar per simulated browser.
 */
export type Jar = { cookie: string | null };

export const newJar = (): Jar => ({ cookie: null });

function keep(jar: Jar | undefined, response: Response): void {
  const set = response.headers.get("set-cookie");
  if (jar === undefined || set === null) return;
  jar.cookie = /;\s*Max-Age=0\b/i.test(set) ? null : (set.split(";")[0] ?? null);
}

export type CallOptions = {
  /** The Origin header: the test origin by default, null for none. */
  origin?: string | null;
  jar?: Jar;
  contentType?: string;
  userAgent?: string;
};

/** A JSON POST as the app sends it (the page's Origin, application/json), keeping the cookie. */
export async function post(
  path: string,
  body: unknown,
  options: CallOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": options.contentType ?? "application/json",
  };
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  if (origin !== null) headers.Origin = origin;
  if (options.jar?.cookie) headers.Cookie = options.jar.cookie;
  if (options.userAgent) headers["User-Agent"] = options.userAgent;
  const response = await SELF.fetch(`${ORIGIN}${path}`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  keep(options.jar, response);
  return response;
}

/** A GET with the jar's cookie, keeping what the answer sets. */
export async function get(path: string, jar?: Jar): Promise<Response> {
  const headers: Record<string, string> = {};
  if (jar?.cookie) headers.Cookie = jar.cookie;
  const response = await SELF.fetch(`${ORIGIN}${path}`, { headers });
  keep(jar, response);
  return response;
}

/** A device token: 43 base64url characters. */
export function token(letter: string): string {
  return letter.repeat(43);
}

/**
 * A near-end start position (test option `before`, plan 02-09): bleu's 5 brings the eighth knight of
 * bleu-rouge home (R-16.1 from bleu's side); the dealer is vert.
 */
export const NEAR_END = {
  pawns: {
    bleu: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 66 }],
    rouge: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
  },
  hands: { bleu: ["5S"] },
  turn: "bleu",
};
