// Web Push (plan 04-07, D-08, APP-03; 04-RESEARCH Pattern 7, Pitfalls 1, 2 and 10).
//
// The key: one Worker secret, VAPID_PRIVATE_KEY = `d.x.y` (tools/vapid-keys.mjs: the P-256 private
// scalar and the public point, base64url). vapidOf derives the 65-byte public key from it, so the
// deploy never edits a config file and the pair cannot drift (GET /api/push/key serves it). No
// e-mail (D-01): the JWT's subject is the site's origin (env.ORIGIN), which Apple accepts.
//
// One push: buildPushPayload of @block65/webcrypto-web-push (VAPID, RFC 8292, and aes128gcm, RFC 8291;
// every message padded to the 4 096-byte record), TTL one hour, urgency high, and a Topic per kind and
// table (at most 32 base64url characters) so a newer notice replaces one not yet delivered. The
// PlayerHub sends it (only when the player is away) and keeps the authorization per push service for
// at most an hour (Apple: « Don't refresh your JWT more frequently than once per hour »).
//
// Endpoints (T-04-53, SSRF): https on the default port, no credentials, at most MAX_ENDPOINT_CHARS,
// and a host of the push services only (Apple, Google, Mozilla, Microsoft); the test host
// push.toc.test only in TOC_TEST_MODE.
//
// The routes (plan 04-07; Pattern 7 « Storage », T-04-56):
//   GET    /api/push/key             { key }: the public key, or 503 push-off without the secret
//   POST   /api/push/subscriptions   { endpoint, keys { p256dh, auth } } (session, our Origin, JSON):
//                                    400 endpoint (not a push service) or keys (not 65 and 16 bytes),
//                                    else 201 and the row upserted for this account and this session
//                                    (an endpoint known for another account moves to this one); an
//                                    account keeps its MAX_SUBSCRIPTIONS newest rows
//   DELETE /api/push/subscriptions   { endpoint } (session, our Origin, JSON): 204 for one's own row,
//                                    404 otherwise
// A signed-out or recovered device loses its rows with its session (push_subscriptions.session_hash
// ON DELETE CASCADE, D-12).

import { buildPushPayload } from "@block65/webcrypto-web-push";
import {
  type NoticeKind,
  PushEndpointBody,
  type PushKeyAnswer,
  type PushPayload,
  PushSubscriptionBody,
  toBase64Url,
} from "@toc/protocol";
import { sessionUser } from "./auth/session.ts";
import type { Meter } from "./db.ts";
import { json, notAllowed, readJson, writeAllowed } from "./http.ts";

/** How long a push service keeps an undelivered message (seconds). */
export const PUSH_TTL_S = 3600;
/** The longest time one VAPID authorization is reused for a push service. */
export const JWT_REUSE_MS = 3600_000;
/** The longest endpoint the server keeps or fetches. */
export const MAX_ENDPOINT_CHARS = 1024;
/** The test-only push host (TOC_TEST_MODE). */
export const TEST_PUSH_HOST = "push.toc.test";

export type Vapid = { publicKey: string; privateKey: string };

/** A stored subscription: its endpoint and its keys (base64url). */
export type StoredSubscription = { endpoint: string; p256dh: string; auth: string };

const FIELD = /^[A-Za-z0-9_-]{43}$/;

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The bytes of a base64url text when it holds exactly `length` bytes, else null. */
export function bytesOf(text: string, length: number): Uint8Array | null {
  const bytes = fromBase64Url(text);
  return bytes !== null && bytes.length === length ? bytes : null;
}

/**
 * The VAPID pair of the secret `d.x.y`, or null when it is missing or malformed. The public key is
 * the uncompressed point 0x04 ‖ x ‖ y, base64url (87 characters).
 */
export function vapidOf(secret: string | undefined): Vapid | null {
  if (typeof secret !== "string") return null;
  const parts = secret.trim().split(".");
  if (parts.length !== 3 || !parts.every((part) => FIELD.test(part))) return null;
  const [d, x, y] = parts as [string, string, string];
  const xs = bytesOf(x, 32);
  const ys = bytesOf(y, 32);
  if (bytesOf(d, 32) === null || xs === null || ys === null) return null;
  const point = new Uint8Array(65);
  point[0] = 4;
  point.set(xs, 1);
  point.set(ys, 33);
  return { publicKey: toBase64Url(point), privateKey: d };
}

/** The push services' hosts (Apple, Google, Mozilla, Microsoft). */
function pushHost(host: string): boolean {
  return (
    host === "web.push.apple.com" ||
    host.endsWith(".push.apple.com") ||
    host === "fcm.googleapis.com" ||
    host.endsWith(".push.services.mozilla.com") ||
    host.endsWith(".notify.windows.com")
  );
}

/** Whether the server may keep and fetch this endpoint (T-04-53). */
export function isPushEndpoint(endpoint: string, testMode: boolean): boolean {
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT_CHARS) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") {
    return false;
  }
  return pushHost(url.hostname) || (testMode && url.hostname === TEST_PUSH_HOST);
}

/** The Topic of a notice: t- (turn) or i- (invite) and 8 characters of the table's SHA-256. */
export async function topicFor(kind: NoticeKind, table: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(table));
  return `${kind === "turn" ? "t" : "i"}-${toBase64Url(new Uint8Array(digest)).slice(0, 8)}`;
}

export type BuiltPush = {
  /** The push service's origin (the JWT's audience, the key of the authorization cache). */
  origin: string;
  headers: Record<string, string>;
  body: Uint8Array;
};

/**
 * One encrypted push of `payload` to `subscription`, signed for `subject`. `authorization`: a value
 * signed earlier for the same push service, reused instead of the new one.
 */
export async function buildPush(
  subscription: StoredSubscription,
  payload: PushPayload,
  vapid: Vapid,
  subject: string,
  authorization?: string,
): Promise<BuiltPush> {
  const built = await buildPushPayload(
    {
      data: payload,
      options: {
        ttl: PUSH_TTL_S,
        urgency: "high",
        topic: await topicFor(payload.t, tableOf(payload)),
      },
    },
    {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    { subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
  );
  const headers: Record<string, string> = { ...built.headers };
  if (authorization !== undefined) headers.authorization = authorization;
  return { origin: new URL(subscription.endpoint).origin, headers, body: built.body };
}

/** The table id of a payload, from its link /#/table/<id>. */
function tableOf(payload: PushPayload): string {
  return payload.url.slice(payload.url.lastIndexOf("/") + 1);
}

/** The most subscriptions an account keeps (T-04-57): the oldest goes for an 11th. */
export const MAX_SUBSCRIPTIONS = 10;

/** GET /api/push/key: the public key derived from the secret, or 503 push-off without it. */
export function pushKeyRoute(env: Env): Response {
  const vapid = vapidOf(env.VAPID_PRIVATE_KEY);
  if (vapid === null) return json({ error: "push-off" }, 503);
  return json({ key: vapid.publicKey } satisfies PushKeyAnswer, 200);
}

/** The push routes, or null for a path that is not one of them. */
export async function pushRoute(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
): Promise<Response | null> {
  if (url.pathname === "/api/push/key") {
    if (request.method !== "GET" && request.method !== "HEAD") return notAllowed("GET");
    return pushKeyRoute(env);
  }
  if (url.pathname !== "/api/push/subscriptions") return null;
  if (request.method !== "POST" && request.method !== "DELETE") return notAllowed("POST, DELETE");
  // Our own non-null Origin first (403), then the JSON body (415, 413, 400), then the session (401).
  if (!writeAllowed(request, url)) return json({ error: "origin" }, 403);
  if (request.method === "DELETE") {
    const read = await readJson(request, PushEndpointBody);
    if (!read.ok) return read.response;
    const me = await sessionUser(request, url, env, meter, now);
    if (me === null) return json({ error: "signed-out" }, 401);
    const done = await meter.run(
      meter
        .prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?")
        .bind(read.body.endpoint, me.id),
    );
    return (done.meta?.changes ?? 0) > 0
      ? new Response(null, { status: 204, headers: { "cache-control": "no-store" } })
      : json({ error: "not-found" }, 404);
  }
  const read = await readJson(request, PushSubscriptionBody);
  if (!read.ok) return read.response;
  const me = await sessionUser(request, url, env, meter, now);
  if (me === null) return json({ error: "signed-out" }, 401);
  const { endpoint, keys } = read.body;
  if (!isPushEndpoint(endpoint, env.TOC_TEST_MODE === "1")) {
    return json({ error: "endpoint" }, 400);
  }
  const point = bytesOf(keys.p256dh, 65);
  if (point === null || point[0] !== 4 || bytesOf(keys.auth, 16) === null) {
    return json({ error: "keys" }, 400);
  }
  await meter.batch([
    meter
      .prepare(
        `INSERT INTO push_subscriptions (endpoint, user_id, session_hash, p256dh, auth, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id,
           session_hash = excluded.session_hash, p256dh = excluded.p256dh, auth = excluded.auth,
           created_at = excluded.created_at, ok_at = NULL`,
      )
      .bind(endpoint, me.id, me.sessionHash, keys.p256dh, keys.auth, now),
    // The account keeps its newest MAX_SUBSCRIPTIONS rows.
    meter
      .prepare(
        `DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint NOT IN (
           SELECT endpoint FROM push_subscriptions WHERE user_id = ?
            ORDER BY created_at DESC, rowid DESC LIMIT ?)`,
      )
      .bind(me.id, me.id, MAX_SUBSCRIPTIONS),
  ]);
  return new Response(null, { status: 201, headers: { "cache-control": "no-store" } });
}
