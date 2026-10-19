// The push subscriptions of each device (plan 04-07, D-08, D-12; 04-RESEARCH Pattern 7 « Storage »,
// T-04-53, T-04-56), in workerd with the tests' D1. GET /api/push/key serves the public key derived
// from the VAPID secret; POST /api/push/subscriptions keeps a device's endpoint (session, our Origin,
// JSON; push services only; at most 10 per account) tied to this session; DELETE removes one's own.
// Signing out or a recovery removes the device's rows with its session (ON DELETE CASCADE).

import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { pushKeyRoute, vapidOf } from "../src/push.ts";
import { softAuthenticator } from "./authenticator.ts";
import {
  get,
  type Jar,
  MAC_UA,
  newJar,
  ORIGIN,
  post,
  resetAccounts,
  rows,
  sha256Url,
  signUpPerson,
} from "./helpers.ts";
import { testSubscriber } from "./push-decrypt.ts";

beforeEach(resetAccounts);

const FCM = "https://fcm.googleapis.com/fcm/send/device-1";
const APPLE = "https://web.push.apple.com/QWxpY2U";
const TEST_HOST = "https://push.toc.test/device-1";

async function person(base: string, jar: Jar = newJar()) {
  const made = await signUpPerson(`${base}${Math.floor(Math.random() * 1e6)}`, jar);
  return { jar, ...made };
}

const sessionHash = (jar: Jar) => sha256Url((jar.cookie ?? "").split("=")[1] as string);

async function keys() {
  const subscriber = await testSubscriber();
  return { p256dh: subscriber.p256dh, auth: subscriber.auth };
}

const save = async (jar: Jar, endpoint: string, options: { origin?: string | null } = {}) =>
  post("/api/push/subscriptions", { endpoint, keys: await keys() }, { jar, ...options });

/** DELETE /api/push/subscriptions with a JSON body, as the app sends it. */
async function remove(
  jar: Jar,
  body: unknown,
  options: { origin?: string | null; contentType?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": options.contentType ?? "application/json",
  };
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  if (origin !== null) headers.Origin = origin;
  if (jar.cookie) headers.Cookie = jar.cookie;
  return SELF.fetch(`${ORIGIN}/api/push/subscriptions`, {
    method: "DELETE",
    headers,
    body: JSON.stringify(body),
  });
}

const subscriptions = () =>
  rows("SELECT endpoint, user_id, session_hash FROM push_subscriptions ORDER BY endpoint");

describe("GET /api/push/key", () => {
  it("the public key derived from the secret, 87 base64url characters, never cached", async () => {
    const response = await get("/api/push/key");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { key } = (await response.json()) as { key: string };
    expect(key).toMatch(/^[A-Za-z0-9_-]{87}$/);
    expect(key).toBe(vapidOf(env.VAPID_PRIVATE_KEY)?.publicKey);
    expect(JSON.stringify(key)).not.toContain((env.VAPID_PRIVATE_KEY as string).split(".")[0]);
  });

  it("503 push-off without the secret", async () => {
    const response = pushKeyRoute({ ...env, VAPID_PRIVATE_KEY: undefined } as Env);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "push-off" });
  });

  it("only GET", async () => {
    const response = await SELF.fetch(`${ORIGIN}/api/push/key`, {
      method: "POST",
      headers: { Origin: ORIGIN },
    });
    expect(response.status).toBe(405);
  });
});

describe("POST /api/push/subscriptions", () => {
  it("201: the row for this account and this session", async () => {
    const paul = await person("Paul");
    const response = await save(paul.jar, FCM);
    expect(response.status).toBe(201);
    expect(await subscriptions()).toEqual([
      { endpoint: FCM, user_id: paul.id, session_hash: await sessionHash(paul.jar) },
    ]);
    // The same endpoint again: still one row (upsert), new keys kept.
    const again = { endpoint: FCM, keys: await keys() };
    expect((await post("/api/push/subscriptions", again, { jar: paul.jar })).status).toBe(201);
    const [row] = await rows("SELECT p256dh, auth FROM push_subscriptions");
    expect(row).toEqual({ p256dh: again.keys.p256dh, auth: again.keys.auth });
  });

  it("the test push host is accepted in test mode", async () => {
    const paul = await person("Test");
    expect((await save(paul.jar, TEST_HOST)).status).toBe(201);
  });

  it("401 without a session, 403 without our Origin, 415 without JSON", async () => {
    const paul = await person("Gate");
    expect((await save(newJar(), FCM)).status).toBe(401);
    expect((await save(paul.jar, FCM, { origin: null })).status).toBe(403);
    expect((await save(paul.jar, FCM, { origin: "https://evil.test" })).status).toBe(403);
    const text = await post(
      "/api/push/subscriptions",
      JSON.stringify({ endpoint: FCM, keys: await keys() }),
      { jar: paul.jar, contentType: "text/plain" },
    );
    expect(text.status).toBe(415);
    expect(await subscriptions()).toEqual([]);
  });

  it("400 endpoint for anything but a push service over https, 400 keys for wrong sizes", async () => {
    const paul = await person("Ssrf");
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/x",
      "https://evil.test/collect",
      "https://fcm.googleapis.com.evil.test/x",
      "https://169.254.169.254/latest",
      "https://fcm.googleapis.com:8443/x",
    ]) {
      const response = await save(paul.jar, endpoint);
      expect(response.status, endpoint).toBe(400);
      expect(await response.json()).toEqual({ error: "endpoint" });
    }
    const good = await keys();
    for (const bad of [
      { p256dh: good.p256dh.slice(0, 40), auth: good.auth },
      { p256dh: good.p256dh, auth: `${good.auth}AAAA` },
      { p256dh: good.p256dh, auth: good.auth.slice(0, 10) },
    ]) {
      const response = await post(
        "/api/push/subscriptions",
        { endpoint: FCM, keys: bad },
        { jar: paul.jar },
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "keys" });
    }
    // Over 1 024 characters, or another shape: the body is refused.
    const long = await post(
      "/api/push/subscriptions",
      { endpoint: `${FCM}/${"a".repeat(1100)}`, keys: good },
      { jar: paul.jar },
    );
    expect(long.status).toBe(400);
    const extra = await post(
      "/api/push/subscriptions",
      { endpoint: FCM, keys: good, user: "someone" },
      { jar: paul.jar },
    );
    expect(extra.status).toBe(400);
    expect(await subscriptions()).toEqual([]);
  });

  it("an endpoint known for another account moves to this one", async () => {
    const paul = await person("Paul");
    const lea = await person("Lea");
    expect((await save(paul.jar, FCM)).status).toBe(201);
    expect((await save(lea.jar, FCM)).status).toBe(201);
    expect(await subscriptions()).toEqual([
      { endpoint: FCM, user_id: lea.id, session_hash: await sessionHash(lea.jar) },
    ]);
  });

  it("the 11th subscription of an account removes the oldest", async () => {
    const paul = await person("Many");
    for (let i = 0; i < 11; i++) {
      expect((await save(paul.jar, `${FCM}-${i}`)).status).toBe(201);
    }
    const kept = (await subscriptions()).map((row) => row.endpoint);
    expect(kept).toHaveLength(10);
    expect(kept).not.toContain(`${FCM}-0`);
    expect(kept).toContain(`${FCM}-10`);
  });
});

describe("DELETE /api/push/subscriptions", () => {
  it("204 for one's own row; 404 for another's or an unknown one", async () => {
    const paul = await person("Del");
    const lea = await person("Lea");
    await save(paul.jar, FCM);
    await save(lea.jar, APPLE);
    expect((await remove(paul.jar, { endpoint: APPLE })).status).toBe(404);
    expect((await remove(paul.jar, { endpoint: FCM })).status).toBe(204);
    expect((await remove(paul.jar, { endpoint: FCM })).status).toBe(404);
    expect((await subscriptions()).map((row) => row.endpoint)).toEqual([APPLE]);
  });

  it("401 without a session, 403 without our Origin, 400 for another shape", async () => {
    const paul = await person("Gate");
    await save(paul.jar, FCM);
    expect((await remove(newJar(), { endpoint: FCM })).status).toBe(401);
    expect((await remove(paul.jar, { endpoint: FCM }, { origin: null })).status).toBe(403);
    expect((await remove(paul.jar, { endpoint: FCM, more: 1 })).status).toBe(400);
    expect((await remove(paul.jar, { endpoint: FCM }, { contentType: "text/plain" })).status).toBe(
      415,
    );
    expect(await subscriptions()).toHaveLength(1);
  });
});

describe("signing out or a recovery ends the device's notifications (D-12)", () => {
  it("logout removes this device's subscription, not the account's other devices'", async () => {
    const phone = newJar();
    const paul = await person("Out", phone);
    const laptop = newJar();
    const login = await post("/api/auth/login/options", {}, { jar: laptop });
    const { challenge } = (await login.json()) as { challenge: string };
    const assertion = await paul.passkey.get(challenge, paul.handle);
    const verified = await post(
      "/api/auth/login/verify",
      { response: assertion },
      { jar: laptop, userAgent: MAC_UA },
    );
    expect(verified.status).toBe(200);
    await save(phone, FCM);
    await save(laptop, APPLE);
    expect((await post("/api/auth/logout", {}, { jar: phone })).status).toBe(204);
    expect((await subscriptions()).map((row) => row.endpoint)).toEqual([APPLE]);
  });

  it("a recovery on a new device removes the subscriptions of every other session", async () => {
    const phone = newJar();
    const paul = await person("Lost", phone);
    await save(phone, FCM);
    const fresh = newJar();
    const options = await post(
      "/api/auth/recover",
      { pseudo: paul.pseudo, code: paul.backupCode },
      { jar: fresh },
    );
    expect(options.status).toBe(200);
    const { challenge } = (await options.json()) as { challenge: string };
    const passkey = await softAuthenticator("toc.test", ORIGIN);
    const verify = await post(
      "/api/auth/recover/verify",
      { response: await passkey.create(challenge) },
      { jar: fresh, userAgent: MAC_UA },
    );
    expect(verify.status).toBe(200);
    expect(await subscriptions()).toEqual([]);
  });

  it("the D1 cost of one subscription: one session read, the row and its index written", async () => {
    const paul = await person("Cost");
    const response = await save(paul.jar, FCM);
    const cost = response.headers.get("x-toc-d1");
    console.log(`push subscription: ${cost}`);
    expect(cost).toMatch(/^w=\d+;r=\d+$/);
  });
});
