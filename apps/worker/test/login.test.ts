// Signing in with a passkey, staying signed in, signing out (plan 04-02, ACCT-01, ACCT-02, D-12;
// 04-RESEARCH Patterns 1 and 4, Pitfall 10, A15), in workerd with miniflare's D1. A software passkey
// (test/authenticator.ts) signs real assertions. Each jar is one browser: a second jar is a second
// device of the same account. The rows written by a login, a logout and a refresh are logged
// (x-toc-d1) for the plan's SUMMARY.

import { env } from "cloudflare:test";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { toBase64Url } from "@toc/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { loginChallenge } from "../src/auth/challenge.ts";
import { softAuthenticator } from "./authenticator.ts";
import {
  get,
  logIn,
  newJar,
  ORIGIN,
  post,
  resetAccounts,
  rows,
  sha256Url,
  signUpPerson,
} from "./helpers.ts";

const DAY = 24 * 3600 * 1000;

beforeEach(resetAccounts);

const pepper = () => env.TOC_PEPPER as string;

/** The assertion of `challenge` posted to login verify. */
async function verifyWith(response: Record<string, unknown>, jar = newJar()): Promise<Response> {
  return post("/api/auth/login/verify", { response }, { jar });
}

describe("POST /api/auth/login/options", () => {
  it("usernameless options for toc.test, and nothing written to D1 (T-04-29)", async () => {
    const response = await post("/api/auth/login/options", {});
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-toc-d1")).toBe("w=0;r=0");
    const options = (await response.json()) as Record<string, unknown>;
    expect(options.rpId).toBe("toc.test");
    expect(options.userVerification).toBe("preferred");
    expect(options.allowCredentials ?? []).toEqual([]);
    expect(typeof options.challenge).toBe("string");
    expect(await rows("SELECT * FROM challenges")).toEqual([]);
  });

  it("two calls give two challenges", async () => {
    const a = (await (await post("/api/auth/login/options", {})).json()) as { challenge: string };
    const b = (await (await post("/api/auth/login/options", {})).json()) as { challenge: string };
    expect(a.challenge).not.toBe(b.challenge);
  });
});

describe("POST /api/auth/login/verify", () => {
  it("the passkey of the sign-up opens a new session on another device (ACCT-01)", async () => {
    const zoe = await signUpPerson("Zoé");
    const computer = newJar();
    const before = Date.now();
    const { options, verify } = await logIn(zoe.passkey, zoe.handle, computer);
    expect(verify.status, await verify.clone().text()).toBe(200);
    console.log(
      `login: options x-toc-d1 ${options.headers.get("x-toc-d1")}, verify x-toc-d1 ${verify.headers.get("x-toc-d1")}`,
    );
    const set = verify.headers.get("set-cookie") ?? "";
    expect(set).toMatch(/^__Host-toc_session=[A-Za-z0-9_-]{43};/);
    expect(set).toContain("HttpOnly");
    expect(set).toContain("Max-Age=34560000");
    const body = (await verify.json()) as {
      me: { id: string; pseudo: string; passkeys: { id: string; current: boolean }[] };
    };
    expect(body.me.id).toBe(zoe.id);
    expect(body.me.pseudo).toBe("Zoé");
    expect(body.me.passkeys).toEqual([
      expect.objectContaining({ id: zoe.passkey.id, current: true }),
    ]);

    const token = (computer.cookie ?? "").split("=")[1] as string;
    const [session] = await rows(
      "SELECT * FROM sessions WHERE id_hash = ?",
      await sha256Url(token),
    );
    expect(session?.user_id).toBe(zoe.id);
    expect(session?.passkey_id).toBe(zoe.passkey.id);
    expect(session?.auth_at as number).toBeGreaterThanOrEqual(before);
    expect(await rows("SELECT * FROM sessions WHERE user_id = ?", zoe.id)).toHaveLength(2);

    const [passkey] = await rows("SELECT counter, last_used_at FROM passkeys");
    expect(passkey?.counter).toBe(1);
    expect(passkey?.last_used_at as number).toBeGreaterThanOrEqual(before);

    const me = await get("/api/me", computer);
    expect(me.status).toBe(200);
    expect(((await me.json()) as { id: string }).id).toBe(zoe.id);
  });

  it("a synced passkey whose counter stays at 0 is accepted (A15)", async () => {
    const zoe = await signUpPerson("Zoé");
    for (let i = 0; i < 2; i++) {
      const options = (await (await post("/api/auth/login/options", {})).json()) as {
        challenge: string;
      };
      const assertion = await zoe.passkey.get(options.challenge, zoe.handle, { counter: 0 });
      expect((await verifyWith(assertion)).status).toBe(200);
    }
    const [passkey] = await rows("SELECT counter FROM passkeys");
    expect(passkey?.counter).toBe(0);
  });

  it("the same assertion twice: the second is expired (spent)", async () => {
    const zoe = await signUpPerson("Zoé");
    const { verify, assertion } = await logIn(zoe.passkey, zoe.handle);
    expect(verify.status).toBe(200);
    const again = await verifyWith(assertion);
    expect(again.status).toBe(400);
    expect(await again.json()).toEqual({ error: "expired" });
  });

  it("a challenge whose tag does not match: expired, nothing written", async () => {
    const zoe = await signUpPerson("Zoé");
    const options = (await (await post("/api/auth/login/options", {})).json()) as {
      challenge: string;
    };
    const bytes = new Uint8Array(isoBase64URL.toBuffer(options.challenge));
    bytes[bytes.length - 1] = ((bytes[bytes.length - 1] as number) ^ 1) & 255;
    const forged = toBase64Url(bytes);
    const response = await verifyWith(await zoe.passkey.get(forged, zoe.handle));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "expired" });
    expect(response.headers.get("x-toc-d1")).toMatch(/^w=0;/);
    // A challenge of our own shape signed with another key, and a random one.
    const other = await loginChallenge("another-pepper", Date.now());
    expect((await verifyWith(await zoe.passkey.get(other, zoe.handle))).status).toBe(400);
    const random = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const odd = await verifyWith(await zoe.passkey.get(random, zoe.handle));
    expect(odd.status).toBe(400);
    expect(await odd.json()).toEqual({ error: "expired" });
  });

  it("a challenge older than 5 minutes: expired", async () => {
    const zoe = await signUpPerson("Zoé");
    const old = await loginChallenge(pepper(), Date.now() - 5 * 60_000 - 1000);
    const response = await verifyWith(await zoe.passkey.get(old, zoe.handle));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "expired" });
    // Four minutes old is still good.
    const recent = await loginChallenge(pepper(), Date.now() - 4 * 60_000);
    expect((await verifyWith(await zoe.passkey.get(recent, zoe.handle))).status).toBe(200);
  });

  it("a passkey TOC does not know: unknown", async () => {
    await signUpPerson("Zoé");
    const stranger = await softAuthenticator("toc.test", ORIGIN);
    const options = (await (await post("/api/auth/login/options", {})).json()) as {
      challenge: string;
    };
    const response = await verifyWith(await stranger.get(options.challenge, "c29tZW9uZQ"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "unknown" });
    expect(await rows("SELECT * FROM challenges")).toEqual([]);
  });

  it("a user handle other than the owner's: unknown", async () => {
    const zoe = await signUpPerson("Zoé");
    const lou = await signUpPerson("Lou");
    for (const handle of [lou.handle, "", "AAAA"]) {
      const options = (await (await post("/api/auth/login/options", {})).json()) as {
        challenge: string;
      };
      const response = await verifyWith(await zoe.passkey.get(options.challenge, handle));
      expect(response.status, handle).toBe(400);
      expect(await response.json()).toEqual({ error: "unknown" });
    }
  });

  it("a signature that does not verify: refused, no session", async () => {
    const zoe = await signUpPerson("Zoé");
    const impostor = await softAuthenticator("toc.test", ORIGIN);
    const options = (await (await post("/api/auth/login/options", {})).json()) as {
      challenge: string;
    };
    const assertion = await impostor.get(options.challenge, zoe.handle);
    const forged = { ...assertion, id: zoe.passkey.id, rawId: zoe.passkey.id };
    const jar = newJar();
    const response = await verifyWith(forged, jar);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "refused" });
    expect(jar.cookie).toBeNull();
    expect(await rows("SELECT * FROM sessions WHERE user_id = ?", zoe.id)).toHaveLength(1);
    // A failed assertion spends nothing: no row written for it (T-04-29).
    expect(await rows("SELECT * FROM challenges")).toEqual([]);
  });

  it("an assertion made at another origin: refused", async () => {
    const zoe = await signUpPerson("Zoé");
    const elsewhere = newJar();
    const options = (await (
      await post("/api/auth/login/options", {}, { jar: elsewhere })
    ).json()) as {
      challenge: string;
    };
    // The same key, answering as a page of another site.
    const assertion = await zoe.passkey.get(options.challenge, zoe.handle);
    const data = JSON.parse(
      new TextDecoder().decode(
        isoBase64URL.toBuffer((assertion.response as { clientDataJSON: string }).clientDataJSON),
      ),
    ) as Record<string, unknown>;
    const moved = {
      ...assertion,
      response: {
        ...(assertion.response as Record<string, unknown>),
        clientDataJSON: toBase64Url(
          new TextEncoder().encode(JSON.stringify({ ...data, origin: "https://evil.test" })),
        ),
      },
    };
    const response = await verifyWith(moved, elsewhere);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "refused" });
  });
});

describe("the sliding session (ACCT-02, Pattern 4)", () => {
  it("seen more than 7 days ago: GET /api/me renews the cookie and moves the expiry 400 days on", async () => {
    const jar = newJar();
    await signUpPerson("Zoé", jar);
    const token = (jar.cookie ?? "").split("=")[1] as string;
    const hash = await sha256Url(token);
    const old = Date.now() - 8 * DAY;
    await rows(
      "UPDATE sessions SET seen_at = ?, expires_at = ? WHERE id_hash = ?",
      old,
      old + 400 * DAY,
      hash,
    );
    const before = Date.now();
    const response = await get("/api/me", jar);
    expect(response.status).toBe(200);
    console.log(`refresh after 8 days: GET /api/me x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    const set = response.headers.get("set-cookie") ?? "";
    expect(set).toBe(
      `__Host-toc_session=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=34560000`,
    );
    const [session] = await rows(
      "SELECT seen_at, expires_at FROM sessions WHERE id_hash = ?",
      hash,
    );
    expect(session?.seen_at as number).toBeGreaterThanOrEqual(before);
    expect(session?.expires_at as number).toBeGreaterThanOrEqual(before + 400 * DAY);
    expect(session?.expires_at as number).toBeLessThanOrEqual(Date.now() + 400 * DAY);
    // The next visit, a moment later, writes nothing.
    const next = await get("/api/me", jar);
    expect(next.headers.get("set-cookie")).toBeNull();
    expect(next.headers.get("x-toc-d1")).toMatch(/^w=0;/);
  });

  it("seen 1 day ago: no Set-Cookie and nothing written", async () => {
    const jar = newJar();
    await signUpPerson("Zoé", jar);
    const yesterday = Date.now() - DAY;
    await rows("UPDATE sessions SET seen_at = ?", yesterday);
    const response = await get("/api/me", jar);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-toc-d1")).toMatch(/^w=0;/);
    const [session] = await rows("SELECT seen_at FROM sessions");
    expect(session?.seen_at).toBe(yesterday);
  });

  it("an expired session opens nothing; a new login opens a fresh one", async () => {
    const jar = newJar();
    const zoe = await signUpPerson("Zoé", jar);
    await rows("UPDATE sessions SET expires_at = ?", Date.now() - 1);
    expect((await get("/api/me", jar)).status).toBe(401);
    const { verify } = await logIn(zoe.passkey, zoe.handle);
    expect(verify.status).toBe(200);
    const live = await rows("SELECT * FROM sessions WHERE expires_at > ?", Date.now());
    expect(live).toHaveLength(1);
  });
});

describe("POST /api/auth/logout (D-12)", () => {
  it("ends this device's session and its notifications; the other devices stay signed in", async () => {
    const phone = newJar();
    const zoe = await signUpPerson("Zoé", phone);
    const computer = newJar();
    expect((await logIn(zoe.passkey, zoe.handle, computer)).verify.status).toBe(200);
    const cookie = phone.cookie as string;
    const hash = await sha256Url(cookie.split("=")[1] as string);
    await rows(
      `INSERT INTO push_subscriptions (endpoint, user_id, session_hash, p256dh, auth, created_at)
       VALUES ('https://push.test/1', ?, ?, 'k', 'a', ?)`,
      zoe.id,
      hash,
      Date.now(),
    );

    const response = await post("/api/auth/logout", {}, { jar: phone });
    expect(response.status).toBe(204);
    console.log(`logout: x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    expect(response.headers.get("set-cookie")).toMatch(/^__Host-toc_session=;.*Max-Age=0/);
    expect(phone.cookie).toBeNull();
    expect(await rows("SELECT * FROM sessions WHERE id_hash = ?", hash)).toEqual([]);
    expect(await rows("SELECT * FROM push_subscriptions")).toEqual([]);

    expect((await get("/api/me", { cookie })).status).toBe(401);
    expect((await get("/api/me", computer)).status).toBe(200);
  });

  it("without a session: 204 all the same, and the cookie expired", async () => {
    const response = await post("/api/auth/logout", {});
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect(response.headers.get("x-toc-d1")).toBe("w=0;r=0");
  });
});
