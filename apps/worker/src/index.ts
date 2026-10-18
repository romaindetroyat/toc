// The Worker « toc »: a small router in front of the built app (02-RESEARCH « Worker router »).
//   POST /api/tables        → a new table: 128-bit id, the GameRoom creates it, 201 { id }
//   GET  /api/tables/:id    → the table's public summary (02-04), 404 when there is no such table
//   GET  /ws/table/:id      → the WebSocket upgrade, handed to that table's GameRoom
// Accounts (plan 04-01, src/auth, src/me.ts; every POST needs our own Origin and a JSON body):
//   GET  /api/invitations/:code      → the state of an invitation link (or the bootstrap code)
//   POST /api/auth/signup/options    → a passkey's creation options for { invitation, pseudo }
//   POST /api/auth/signup/verify     → the account, its session cookie and its backup code
//   GET  /api/me                     → the signed-in account, or 401 (renews a session seen > 7 days ago)
// Plan 04-02:
//   POST /api/auth/login/options     → usernameless authentication options (nothing written)
//   POST /api/auth/login/verify      → a new session on this device and the account
//   POST /api/auth/logout            → this device's session ends, 204
//   POST /api/auth/passkeys/options  → creation options for a passkey on this device (session)
//   POST /api/auth/passkeys/verify   → the new passkey
//   DELETE /api/auth/passkeys/:id    → one's own passkey goes, never the last (Origin, no body)
//   POST /api/auth/backup-code/options → step-up options (the account's passkeys)
//   POST /api/auth/backup-code/verify  → the step-up and a new backup code, shown once
// Plan 04-03 (no session needed; Origin and JSON as above):
//   POST /api/auth/recover           → { pseudo, code }: the account's PlayerHub checks the code (and
//                                      locks after 5 wrong ones), then creation options for a passkey
//   POST /api/auth/recover/verify    → the new passkey, every other session ended, a new session and
//                                      a new backup code, shown once
// Plan 04-04:
//   GET  /api/me/tables              → the account's tables (« Mes parties en cours » everywhere)
//   DELETE /api/me/tables/:id        → one forgotten (Origin, no body), 204
//   GET  /ws/table/:id with a session cookie → our non-null Origin required; the upgrade reaches
//                                      the GameRoom as a new request carrying x-toc-account and
//                                      x-toc-pseudo, set by the Worker only
//   POST /api/test/invitation        → TOC_TEST_MODE only: an invitation for the browser tests
// Plan 04-05 (social.ts; a session, and for a write our Origin, JSON for a POST):
//   POST /api/invitations            → a new link { id, code, expiresAt } (10 pending at most)
//   GET  /api/invitations            → the caller's pending links { id, createdAt, expiresAt }
//   DELETE /api/invitations/:id      → one pending link disabled, 204
//   GET  /api/invitations/:code      → also own and friend for a signed-in caller
//   POST /api/invitations/:code/accept → the inviter becomes a friend, the link is spent
//   POST /api/friends/code           → the caller's friend code { code, expiresAt } (24 hours)
//   POST /api/friends/code/redeem    → { code }: its owner becomes a friend (10 failures an hour)
//   GET  /api/friends                → the caller's friends { id, pseudo, since }
//   DELETE /api/friends/:id          → the friendship goes, both ways, 204
//   other /api/*            → 404
// In TOC_TEST_MODE every /api answer carries x-toc-d1 (the D1 rows the request wrote and read).
//   everything else         → the app (static assets, or the embedded files of wrangler.embarque.jsonc)
// handleRequest answers null for what is not its own, so both deploy entries can share it.

import { isTableId, parseCreateTestOptions, toBase64Url } from "@toc/protocol";
import type { TestOptions } from "@toc/table";
import { loginOptions, loginVerify, logout } from "./auth/login.ts";
import {
  addOptions,
  addVerify,
  backupCodeOptions,
  backupCodeVerify,
  removePasskey,
} from "./auth/passkeys.ts";
import { recoverOptions, recoverVerify } from "./auth/recover.ts";
import { hasCookie, sessionUser } from "./auth/session.ts";
import { invitationRoute, mintInvitation, signupOptions, signupVerify } from "./auth/signup.ts";
import { Meter } from "./db.ts";
import { ACCOUNT_HEADER, GameRoom, PSEUDO_HEADER } from "./GameRoom.ts";
import { json, notAllowed, writeAllowed } from "./http.ts";
import { meRoute, meTablesRoute } from "./me.ts";
import { PlayerHub } from "./PlayerHub.ts";
import { socialRoute } from "./social.ts";

// The two Durable Object classes of both deploy configs (GameRoom: migration v1; PlayerHub, one per
// account: migration v2, plan 04-03). The embedded entry re-exports both (worker-embedded/index.js).
export { GameRoom, PlayerHub };

declare global {
  // Not in the deploy configs, so `wrangler types` does not list it (tools/wrangler-configs.test.ts).
  interface Env {
    /** "1" only under `wrangler dev --var TOC_TEST_MODE:1` and the workerd tests (T-02-07). */
    TOC_TEST_MODE?: string;
    /** Secret (wrangler secret put): the HMAC key of the backup codes (plan 04-01, D-02). */
    TOC_PEPPER?: string;
    /** Secret: the one-time code of the first account, accepted while no account exists (D-03). */
    TOC_BOOTSTRAP?: string;
  }
}

const MAX_BODY = 1024;

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

/**
 * The public summary of a table (T-02-15: first names, seat kinds, status, game number, last activity;
 * never an id, a token hash or a card). A malformed id never reaches getByName, and an unknown one is
 * answered without writing anything (T-02-16).
 */
async function summaryRoute(request: Request, env: Env, id: string): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { allow: "GET" } });
  }
  if (!isTableId(id)) return json({ error: "not-found" }, 404);
  const found = await env.GAME_ROOM.getByName(id).summary();
  return found === null ? json({ error: "not-found" }, 404) : json(found, 200);
}

type Post = (request: Request, env: Env, url: URL, meter: Meter, now: number) => Promise<Response>;

/** The POST routes of the accounts (plans 04-01 to 04-03), each behind writeAllowed and readJson. */
const POSTS = new Map<string, Post>([
  ["/api/auth/signup/options", signupOptions],
  ["/api/auth/signup/verify", signupVerify],
  [
    "/api/auth/login/options",
    (request, env, url, _meter, now) => loginOptions(request, env, url, now),
  ],
  ["/api/auth/login/verify", loginVerify],
  ["/api/auth/logout", (request, env, url, meter) => logout(request, env, url, meter)],
  ["/api/auth/passkeys/options", addOptions],
  ["/api/auth/passkeys/verify", addVerify],
  ["/api/auth/backup-code/options", backupCodeOptions],
  ["/api/auth/backup-code/verify", backupCodeVerify],
  ["/api/auth/recover", recoverOptions],
  ["/api/auth/recover/verify", recoverVerify],
]);

/** The account routes (plans 04-01, 04-02), or null for a path that is not one of them. */
async function accountRoute(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
): Promise<Response | null> {
  const now = Date.now();
  const path = url.pathname;
  // Plan 04-05: the links made by players and the friends (social.ts); then the state of a link.
  const social = await socialRoute(request, env, url, meter, now);
  if (social !== null) return social;
  const invitation = /^\/api\/invitations\/([^/]*)$/.exec(path);
  if (invitation !== null)
    return invitationRoute(request, env, url, meter, now, invitation[1] ?? "");
  if (path === "/api/me") {
    if (request.method !== "GET" && request.method !== "HEAD") return notAllowed("GET");
    return meRoute(request, env, url, meter, now);
  }
  const tables = await meTablesRoute(request, env, url, meter, now);
  if (tables !== null) return tables;
  const post = POSTS.get(path);
  const key = post === undefined ? /^\/api\/auth\/passkeys\/([^/]+)$/.exec(path) : null;
  if (key !== null) {
    if (request.method !== "DELETE") return notAllowed("DELETE");
    // No body: the Origin is the whole check (T-04-32).
    if (!writeAllowed(request, url)) return json({ error: "origin" }, 403);
    return removePasskey(key[1] ?? "")(request, env, url, meter, now);
  }
  const test = path === "/api/test/invitation" && env.TOC_TEST_MODE === "1";
  if (post === undefined && !test) return null;
  if (request.method !== "POST") return notAllowed("POST");
  // Every write: our own non-null Origin first (403), then the route's readJson (415, 413, 400).
  if (!writeAllowed(request, url)) return json({ error: "origin" }, 403);
  if (post !== undefined) return post(request, env, url, meter, now);
  return mintInvitation(request, meter, now);
}

/**
 * The table upgrade, forwarded as a new request (plan 04-04, T-04-08): only Upgrade, and for a
 * session the account the Worker read from the cookie (x-toc-account, x-toc-pseudo encoded); a copy
 * the client sent never reaches the GameRoom. With a session cookie the upgrade needs our own
 * non-null Origin (T-04-02); a guest keeps the phase-2 rule (sameOrigin, checked before).
 */
async function tableUpgrade(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  id: string,
): Promise<Response> {
  const me = hasCookie(request, url, env)
    ? await sessionUser(request, url, env, meter, Date.now())
    : null;
  if (me !== null && !writeAllowed(request, url)) return new Response("Refusé", { status: 403 });
  const headers = new Headers({ Upgrade: "websocket" });
  if (me !== null) {
    headers.set(ACCOUNT_HEADER, me.id);
    headers.set(PSEUDO_HEADER, encodeURIComponent(me.pseudo));
  }
  return env.GAME_ROOM.getByName(id).fetch(new Request(request.url, { headers }));
}

async function route(request: Request, env: Env, url: URL, meter: Meter): Promise<Response | null> {
  if (url.pathname === "/api/tables") return createTableRoute(request, env, url);

  const summary = /^\/api\/tables\/([^/]*)$/.exec(url.pathname);
  if (summary !== null) return summaryRoute(request, env, summary[1] ?? "");

  const account = await accountRoute(request, env, url, meter);
  if (account !== null) return account;

  const socket = /^\/ws\/table\/([^/]*)$/.exec(url.pathname);
  if (socket !== null) {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Upgrade attendu", { status: 426 });
    }
    const id = socket[1];
    // A malformed id never reaches getByName, so random paths create no object (T-02-04).
    if (!isTableId(id)) return new Response("Table introuvable", { status: 404 });
    if (!sameOrigin(request, url)) return new Response("Refusé", { status: 403 });
    return tableUpgrade(request, env, url, meter, id);
  }

  if (isApi(url.pathname) || url.pathname.startsWith("/ws/")) {
    return json({ error: "not-found" }, 404);
  }
  return null;
}

const isApi = (path: string) => path === "/api" || path.startsWith("/api/");

export async function handleRequest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const meter = new Meter(env.DB);
  const response = await route(request, env, url, meter);
  if (response === null || env.TOC_TEST_MODE !== "1" || !isApi(url.pathname)) return response;
  // Test mode: what this request cost in D1 rows (T-04-27, the Free plan's 100 000 writes a day).
  const measured = new Response(response.body, response);
  measured.headers.set("x-toc-d1", meter.header());
  return measured;
}

export default {
  async fetch(request, env) {
    return (await handleRequest(request, env)) ?? env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
