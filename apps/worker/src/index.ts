// The Worker « toc »: a small router in front of the built app (02-RESEARCH « Worker router »).
//   POST /api/tables        → a new table: 128-bit id, the GameRoom creates it, 201 { id }
//   GET  /ws/table/:id      → the WebSocket upgrade, handed to that table's GameRoom
//   other /api/*            → 404
//   everything else         → the app (static assets, or the embedded files of wrangler.embarque.jsonc)
// handleRequest answers null for what is not its own, so both deploy entries can share it.

import { isTableId, parseCreateTestOptions, toBase64Url } from "@toc/protocol";
import type { TestOptions } from "@toc/table";
import { GameRoom } from "./GameRoom.ts";

export { GameRoom };

declare global {
  // Not in the deploy configs, so `wrangler types` does not list it (tools/wrangler-configs.test.ts).
  interface Env {
    /** "1" only under `wrangler dev --var TOC_TEST_MODE:1` and the workerd tests (T-02-07). */
    TOC_TEST_MODE?: string;
  }
}

const MAX_BODY = 1024;

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** A WebSocket or a request from another site is refused (T-02-03); no Origin (a native app) passes. */
function sameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("Origin");
  return origin === null || origin === url.origin;
}

/** The test options of a creation body (pace, computer levels), honoured only in test mode. */
function testOptions(body: unknown, env: Env): TestOptions | null {
  if (env.TOC_TEST_MODE !== "1") return null;
  return parseCreateTestOptions(body);
}

async function createTableRoute(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }
  if (!sameOrigin(request, url)) return json({ error: "origin" }, 403);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: "body" }, 413);
  let body: unknown = {};
  if (text.trim() !== "") {
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: "body" }, 400);
    }
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = toBase64Url(bytes);
  const created = await env.GAME_ROOM.getByName(id).create({
    tableId: id,
    test: testOptions(body, env),
  });
  if (!created) return json({ error: "exists" }, 409);
  return json({ id }, 201);
}

export async function handleRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === "/api/tables") return createTableRoute(request, env, url);

  const socket = /^\/ws\/table\/([^/]*)$/.exec(url.pathname);
  if (socket !== null) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Upgrade attendu", { status: 426 });
    }
    const id = socket[1];
    // A malformed id never reaches getByName, so random paths create no object (T-02-04).
    if (!isTableId(id)) return new Response("Table introuvable", { status: 404 });
    if (!sameOrigin(request, url)) return new Response("Refusé", { status: 403 });
    return env.GAME_ROOM.getByName(id).fetch(request);
  }

  if (
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/ws/")
  ) {
    return json({ error: "not-found" }, 404);
  }
  return null;
}

export default {
  async fetch(request, env) {
    return (await handleRequest(request, env)) ?? env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
