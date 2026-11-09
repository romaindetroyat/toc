// Web Push from the PlayerHub (plan 04-07, D-08, APP-03; 04-RESEARCH Pattern 7, Pitfalls 1 and 10,
// Testing Strategy « Push encryption »), in workerd with the tests' D1. When notify finds the player
// away, the hub reads the account's subscriptions and sends one encrypted message to each through its
// deliver method, replaced here so nothing leaves the test. Each body is decrypted with the
// subscription's test key (RFC 8291), and the VAPID JWT is checked with its own key (RFC 8292). The
// VAPID secret is the test-only pair vitest.config.ts generates when it loads.

import { env, runInDurableObject } from "cloudflare:test";
import { HUB_VERSION, pushPayload } from "@toc/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerHub } from "../src/PlayerHub.ts";
import { buildPush, isPushEndpoint, topicFor, vapidOf } from "../src/push.ts";
import { type HubClient, newJar, openHub, resetAccounts, rows, signUpPerson } from "./helpers.ts";
import { decryptPush, readVapid, type TestSubscriber, testSubscriber } from "./push-decrypt.ts";

beforeEach(resetAccounts);
afterEach(() => {
  vi.restoreAllMocks();
});

const TABLE = "abcdefghijklmnopqrstuv";
const SUBJECT = "https://toc.romaindetroyat.workers.dev";
const FCM = "https://fcm.googleapis.com/fcm/send/test-endpoint-1";
const APPLE = "https://web.push.apple.com/QWxpY2UtZGV2aWNlLTE";
const HOUR = 3600_000;

type Sent = { endpoint: string; headers: Record<string, string>; body: Uint8Array };
type Deliver = (endpoint: string, init: RequestInit) => Promise<Response>;

const hubOf = (id: string) => env.PLAYER_HUB.getByName(id);

async function person(base: string) {
  const jar = newJar();
  const made = await signUpPerson(`${base}${Math.floor(Math.random() * 1e6)}`, jar);
  return { jar, id: made.id, pseudo: made.pseudo };
}

/** A subscription row for `userId` at `endpoint`, with a fresh test key pair. */
async function subscribe(userId: string, endpoint: string): Promise<TestSubscriber> {
  const subscriber = await testSubscriber();
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, user_id, session_hash, p256dh, auth, created_at)
     VALUES (?, ?, NULL, ?, ?, ?)`,
  )
    .bind(endpoint, userId, subscriber.p256dh, subscriber.auth, Date.now())
    .run();
  return subscriber;
}

/** Replaces the hub's deliver: every request is kept, answered `statuses[endpoint]` (201). */
async function capture(id: string, statuses: Record<string, number> = {}): Promise<Sent[]> {
  const sent: Sent[] = [];
  await runInDurableObject(hubOf(id), (hub: PlayerHub) => {
    (hub as unknown as { deliver: Deliver }).deliver = async (endpoint, init) => {
      sent.push({
        endpoint,
        headers: Object.fromEntries(new Headers(init.headers).entries()),
        body: new Uint8Array(init.body as Uint8Array),
      });
      return new Response(null, { status: statuses[endpoint] ?? 201 });
    };
  });
  return sent;
}

const turn = (key: string, now?: number) => ({
  kind: "turn" as const,
  table: TABLE,
  from: "Romain",
  own: false,
  resumed: false,
  key,
  ...(now === undefined ? {} : { now }),
});

const publicKey = () => {
  const vapid = vapidOf(env.VAPID_PRIVATE_KEY);
  if (vapid === null) throw new Error("no test VAPID secret");
  return vapid.publicKey;
};

describe("vapidOf and the endpoints", () => {
  it("reads the secret d.x.y; a missing or malformed secret gives null", () => {
    const vapid = vapidOf(env.VAPID_PRIVATE_KEY);
    expect(vapid?.publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/);
    expect(vapid?.privateKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const [d, x, y] = (env.VAPID_PRIVATE_KEY as string).split(".");
    expect(vapid?.privateKey).toBe(d);
    for (const bad of [
      undefined,
      "",
      "abc",
      `${d}.${x}`,
      `${d}.${x}.${y}.${y}`,
      `${d}.${x}.!${y}`,
    ]) {
      expect(vapidOf(bad), String(bad)).toBeNull();
    }
  });

  it("only the push services' hosts over https (the test host only in test mode)", () => {
    for (const ok of [
      FCM,
      APPLE,
      "https://api.push.apple.com/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isPushEndpoint(ok, false), ok).toBe(true);
    }
    expect(isPushEndpoint("https://push.toc.test/a", true)).toBe(true);
    for (const bad of [
      "https://push.toc.test/a",
      "http://fcm.googleapis.com/fcm/send/x",
      "https://fcm.googleapis.com.evil.test/x",
      "https://evil.test/fcm.googleapis.com",
      "https://push.apple.com.evil.test/x",
      "https://user:pass@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://localhost/x",
      "https://127.0.0.1/x",
      `https://fcm.googleapis.com/${"a".repeat(1100)}`,
      "not a url",
    ]) {
      expect(isPushEndpoint(bad, false), bad).toBe(false);
    }
  });

  it("a topic of at most 32 base64url characters, one per kind and table", async () => {
    const t = await topicFor("turn", TABLE);
    expect(t).toMatch(/^t-[A-Za-z0-9_-]{8}$/);
    expect(await topicFor("turn", TABLE)).toBe(t);
    expect(await topicFor("turn", "ABCDEFGHIJKLMNOPQRSTUV")).not.toBe(t);
    expect(await topicFor("invite", TABLE)).toMatch(/^i-[A-Za-z0-9_-]{8}$/);
  });
});

describe("the hub pushes when the player is away", () => {
  it("two subscriptions: two encrypted messages, the JSON payload, the VAPID JWT, the headers", async () => {
    const who = await person("Paul");
    const fcm = await subscribe(who.id, FCM);
    const apple = await subscribe(who.id, APPLE);
    const sent = await capture(who.id);
    const before = Math.floor(Date.now() / 1000);
    expect(await hubOf(who.id).notify(turn(`${TABLE}:1`))).toBe("push");
    expect(sent.map((each) => each.endpoint).sort()).toEqual([APPLE, FCM].sort());
    const expected = pushPayload({ kind: "turn", table: TABLE, from: "Romain", own: false });
    expect(expected.url).toBe(`/#/table/${TABLE}`);
    for (const each of sent) {
      const subscriber = each.endpoint === FCM ? fcm : apple;
      expect(JSON.parse(await decryptPush(subscriber, each.body))).toEqual(expected);
      const { claims, k } = await readVapid(each.headers.authorization as string);
      expect(k).toBe(publicKey());
      expect(claims.aud).toBe(new URL(each.endpoint).origin);
      expect(claims.sub).toBe(SUBJECT);
      expect(claims.exp).toBeGreaterThan(before);
      expect(claims.exp).toBeLessThanOrEqual(before + 24 * 3600 + 1);
      expect(each.headers.ttl).toBe("3600");
      expect(each.headers.urgency).toBe("high");
      expect(each.headers.topic).toBe(await topicFor("turn", TABLE));
      expect(each.headers.topic?.length).toBeLessThanOrEqual(32);
      expect(each.headers["content-encoding"]).toBe("aes128gcm");
      // The whole payload stays far below the 4 KB record, which the library pads to.
      expect(each.body.length).toBeLessThanOrEqual(4096);
    }
  });

  it("an invite carries its own texts and tag", async () => {
    const who = await person("Inv");
    const fcm = await subscribe(who.id, FCM);
    const sent = await capture(who.id);
    const answer = await hubOf(who.id).notify({
      kind: "invite",
      table: TABLE,
      from: "Marie",
      key: `sender:${TABLE}`,
    });
    expect(answer).toBe("push");
    expect(sent).toHaveLength(1);
    const body = JSON.parse(await decryptPush(fcm, (sent[0] as Sent).body));
    expect(body).toEqual(pushPayload({ kind: "invite", table: TABLE, from: "Marie" }));
    expect(body.tag).toBe(`inv-${TABLE}`);
  });

  it("the authorization is reused for an hour per push service, then signed again", async () => {
    const who = await person("Jwt");
    await subscribe(who.id, FCM);
    await subscribe(who.id, APPLE);
    const sent = await capture(who.id);
    const t0 = Date.now();
    await hubOf(who.id).notify(turn(`${TABLE}:a`, t0));
    await hubOf(who.id).notify(turn(`${TABLE}:b`, t0 + HOUR - 1));
    await hubOf(who.id).notify(turn(`${TABLE}:c`, t0 + HOUR + 1));
    const auth = (endpoint: string) =>
      sent.filter((each) => each.endpoint === endpoint).map((each) => each.headers.authorization);
    for (const endpoint of [FCM, APPLE]) {
      const [first, second, third] = auth(endpoint);
      expect(second).toBe(first);
      expect(third).not.toBe(first);
    }
    // One authorization per push service, never shared between origins (aud differs).
    expect(auth(FCM)[0]).not.toBe(auth(APPLE)[0]);
  });

  it("410 and 404 delete the subscription; 429 keeps it without a retry; 403 is logged once", async () => {
    const who = await person("Gone");
    const gone = "https://fcm.googleapis.com/fcm/send/gone";
    const missing = "https://fcm.googleapis.com/fcm/send/missing";
    const busy = "https://fcm.googleapis.com/fcm/send/busy";
    const refused = "https://web.push.apple.com/refused";
    for (const endpoint of [gone, missing, busy, refused]) await subscribe(who.id, endpoint);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sent = await capture(who.id, {
      [gone]: 410,
      [missing]: 404,
      [busy]: 429,
      [refused]: 403,
    });
    expect(await hubOf(who.id).notify(turn(`${TABLE}:1`))).toBe("push");
    expect(sent).toHaveLength(4);
    const left = await rows(
      "SELECT endpoint FROM push_subscriptions WHERE user_id = ? ORDER BY endpoint",
      who.id,
    );
    expect(left.map((row) => row.endpoint)).toEqual([busy, refused].sort());
    await hubOf(who.id).notify(turn(`${TABLE}:2`));
    // No retry of the 429 within a notice: one request per subscription and notice.
    expect(sent).toHaveLength(6);
    const forbidden = warn.mock.calls.filter((call) => String(call[0]).includes("403"));
    expect(forbidden).toHaveLength(1);
  });

  it("a stored endpoint outside the push services is never fetched", async () => {
    const who = await person("Ssrf");
    await subscribe(who.id, "https://evil.test/collect");
    await subscribe(who.id, FCM);
    const sent = await capture(who.id);
    await hubOf(who.id).notify(turn(`${TABLE}:1`));
    expect(sent.map((each) => each.endpoint)).toEqual([FCM]);
  });

  it("no VAPID secret: logged once, nothing delivered, away", async () => {
    const who = await person("NoKey");
    await subscribe(who.id, FCM);
    const sent = await capture(who.id);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await runInDurableObject(hubOf(who.id), (hub: PlayerHub) => {
      const self = hub as unknown as { env: Env };
      self.env = { ...self.env, VAPID_PRIVATE_KEY: undefined };
    });
    expect(await hubOf(who.id).notify(turn(`${TABLE}:1`))).toBe("away");
    expect(await hubOf(who.id).notify(turn(`${TABLE}:2`))).toBe("away");
    expect(sent).toEqual([]);
    const told = warn.mock.calls.filter((call) => String(call[0]).includes("VAPID"));
    expect(told).toHaveLength(1);
  });

  it("no subscription: away, nothing delivered", async () => {
    const who = await person("NoSub");
    const sent = await capture(who.id);
    expect(await hubOf(who.id).notify(turn(`${TABLE}:1`))).toBe("away");
    expect(sent).toEqual([]);
  });

  it("a present player gets the in-app notice and no push", async () => {
    const who = await person("Here");
    await subscribe(who.id, FCM);
    const sent = await capture(who.id);
    const hub: HubClient = await openHub({ jar: who.jar });
    hub.send({ t: "hi", v: HUB_VERSION });
    hub.send({ t: "vis", visible: true });
    const deadline = Date.now() + 10_000;
    let answer = "away";
    let n = 0;
    while (answer !== "notice" && Date.now() < deadline) {
      answer = await hubOf(who.id).notify(turn(`${TABLE}:wait-${n++}`));
      if (answer !== "notice") await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(answer).toBe("notice");
    // The earlier tries, before the hub read hi and vis, were pushes; the notice itself is none.
    const pushesBefore = sent.length;
    expect(await hubOf(who.id).notify(turn(`${TABLE}:present`))).toBe("notice");
    expect(sent).toHaveLength(pushesBefore);
    hub.ws.close(1000);
  });

  it("the same key twice: dup, one push", async () => {
    const who = await person("Dup");
    await subscribe(who.id, FCM);
    const sent = await capture(who.id);
    expect(await hubOf(who.id).notify(turn(`${TABLE}:1`))).toBe("push");
    expect(await hubOf(who.id).notify(turn(`${TABLE}:1`))).toBe("dup");
    expect(sent).toHaveLength(1);
  });
});

describe("the cost of one push (T-04-SC, Pitfall 10)", () => {
  it("measures one encrypted message inside workerd", async () => {
    const vapid = vapidOf(env.VAPID_PRIVATE_KEY);
    if (vapid === null) throw new Error("no VAPID");
    const subscriber = await testSubscriber();
    const subscription = { endpoint: FCM, p256dh: subscriber.p256dh, auth: subscriber.auth };
    const payload = pushPayload({ kind: "turn", table: TABLE, from: "Romain" });
    const runs = 50;
    const start = performance.now();
    for (let i = 0; i < runs; i++) await buildPush(subscription, payload, vapid, SUBJECT);
    const each = (performance.now() - start) / runs;
    console.log(`push: ${each.toFixed(3)} ms per encrypted message in workerd (${runs} runs)`);
    expect(each).toBeLessThan(50);
  });
});
