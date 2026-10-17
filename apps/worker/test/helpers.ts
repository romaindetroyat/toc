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
};

/** Opens a socket on /ws/table/<id> and accepts it on the test side. */
export async function connect(id: string, headers: Record<string, string> = {}): Promise<Client> {
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
    raw.push(text);
    const frame = JSON.parse(text) as ServerFrame;
    if (frame.t === "welcome" || frame.t === "events") lastSeq = frame.seq;
    frames.push(frame);
    wake?.();
  });
  const closed = new Promise<{ code: number }>((resolve) => {
    ws.addEventListener("close", (event) => {
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
      for (let attempt = 0; attempt < 2000; attempt++) {
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
  };
}

/** A device token: 43 base64url characters. */
export function token(letter: string): string {
  return letter.repeat(43);
}
