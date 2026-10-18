// Sign-up by invitation, the session cookie and GET /api/me (plan 04-01, ACCT-01, ACCT-02, D-02,
// D-03, D-04, D-06, D-10, D-11; 04-RESEARCH Patterns 1 to 5 and 9, Pitfalls 5, 6 and 12), in workerd
// with miniflare's D1 and migration 0002. A software passkey (test/authenticator.ts) answers the
// registration ceremony, so SimpleWebAuthn verifies real signatures. Each test starts from empty
// account tables. The rows written by each sign-up are logged (x-toc-d1) for the plan's SUMMARY.

import { env } from "cloudflare:test";
import { toBase64Url } from "@toc/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { handleRequest } from "../src/index.ts";
import { softAuthenticator } from "./authenticator.ts";
import { get, type Jar, newJar, ORIGIN, post } from "./helpers.ts";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const DAY = 24 * 3600 * 1000;

const db = () => {
  if (env.DB === undefined) throw new Error("no D1 binding in the tests");
  return env.DB;
};

const ACCOUNT_TABLES = [
  "table_members",
  "push_subscriptions",
  "friendships",
  "sessions",
  "challenges",
  "invitations",
  "passkeys",
  "users",
];

beforeEach(async () => {
  await db().batch(ACCOUNT_TABLES.map((table) => db().prepare(`DELETE FROM ${table}`)));
});

async function sha256Url(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return toBase64Url(new Uint8Array(digest));
}

function randomCode(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

/** A user row written directly (an inviter), with no passkey. */
async function insertUser(pseudo: string, key = pseudo.toLowerCase()): Promise<string> {
  const id = randomCode();
  await db()
    .prepare(
      "INSERT INTO users (id, pseudo, pseudo_key, webauthn_user_id, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, pseudo, key, toBase64Url(crypto.getRandomValues(new Uint8Array(32))), Date.now())
    .run();
  return id;
}

/** An invitation row written directly; answers its code. */
async function insertInvitation(
  inviterId: string | null,
  options: { expiresAt?: number; usedAt?: number | null } = {},
): Promise<string> {
  const code = randomCode();
  await db()
    .prepare(
      `INSERT INTO invitations (id, code_hash, kind, inviter_id, created_at, expires_at, used_at)
       VALUES (?, ?, 'link', ?, ?, ?, ?)`,
    )
    .bind(
      randomCode(),
      await sha256Url(code),
      inviterId,
      Date.now(),
      options.expiresAt ?? Date.now() + 7 * DAY,
      options.usedAt ?? null,
    )
    .run();
  return code;
}

type Row = Record<string, unknown>;
const rows = async (sql: string, ...values: unknown[]): Promise<Row[]> =>
  (
    await db()
      .prepare(sql)
      .bind(...values)
      .all<Row>()
  ).results;

/** Every row of every account table as text, for the leak checks. */
async function everyRow(): Promise<string> {
  const all: Row[] = [];
  for (const table of ACCOUNT_TABLES) all.push(...(await rows(`SELECT * FROM ${table}`)));
  return JSON.stringify(all, (_key, value) =>
    value instanceof ArrayBuffer ? toBase64Url(new Uint8Array(value)) : value,
  );
}

type Options = {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  authenticatorSelection: { residentKey: string };
};

/** The whole sign-up: options, the software passkey, verify. Answers the verify response. */
async function signUp(
  invitation: string,
  pseudo: string,
  jar: Jar = newJar(),
): Promise<{ response: Response; options: Options; optionsCost: string | null }> {
  const opened = await post("/api/auth/signup/options", { invitation, pseudo }, { jar });
  expect(opened.status, await opened.clone().text()).toBe(200);
  const options = (await opened.json()) as Options;
  const passkey = await softAuthenticator("toc.test", ORIGIN);
  const created = await passkey.create(options.challenge);
  const response = await post(
    "/api/auth/signup/verify",
    { response: created },
    { jar, userAgent: IPHONE },
  );
  return { response, options, optionsCost: opened.headers.get("x-toc-d1") };
}

describe("GET /api/invitations/:code", () => {
  it("a malformed code: unknown, without reading D1", async () => {
    for (const bad of ["short", "x".repeat(23), "abcdefghijklmnopqrst%21"]) {
      const response = await get(`/api/invitations/${bad}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ state: "unknown" });
      expect(response.headers.get("x-toc-d1")).toBe("w=0;r=0");
    }
  });

  it("ok with the inviter and the expiry; used and expired keep the inviter; unknown otherwise", async () => {
    const ana = await insertUser("Ana");
    const expiresAt = Date.now() + 7 * DAY;
    const ok = await insertInvitation(ana, { expiresAt });
    expect(await (await get(`/api/invitations/${ok}`)).json()).toEqual({
      state: "ok",
      inviter: "Ana",
      expiresAt,
    });
    const used = await insertInvitation(ana, { usedAt: Date.now() });
    expect(await (await get(`/api/invitations/${used}`)).json()).toEqual({
      state: "used",
      inviter: "Ana",
    });
    const expired = await insertInvitation(ana, { expiresAt: Date.now() - 1 });
    expect(await (await get(`/api/invitations/${expired}`)).json()).toEqual({
      state: "expired",
      inviter: "Ana",
    });
    expect(await (await get(`/api/invitations/${randomCode()}`)).json()).toEqual({
      state: "unknown",
    });
  });

  it("the bootstrap code: ok while no account exists, then unknown", async () => {
    const bootstrap = env.TOC_BOOTSTRAP as string;
    expect(bootstrap).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await (await get(`/api/invitations/${bootstrap}`)).json()).toEqual({
      state: "ok",
      bootstrap: true,
      inviter: null,
    });
    await insertUser("Romain");
    expect(await (await get(`/api/invitations/${bootstrap}`)).json()).toEqual({
      state: "unknown",
    });
  });
});

describe("POST /api/auth/signup/options", () => {
  it("refuses a missing, foreign or null Origin (T-04-20)", async () => {
    const code = await insertInvitation(await insertUser("Ana"));
    for (const origin of [null, "https://evil.test", "null"]) {
      const response = await post(
        "/api/auth/signup/options",
        { invitation: code, pseudo: "Zoé" },
        { origin },
      );
      expect(response.status, String(origin)).toBe(403);
    }
  });

  it("415 without JSON, 413 over 8 KB, 400 on a bad body", async () => {
    const code = await insertInvitation(await insertUser("Ana"));
    const body = { invitation: code, pseudo: "Zoé" };
    expect(
      (await post("/api/auth/signup/options", body, { contentType: "text/plain" })).status,
    ).toBe(415);
    const big = JSON.stringify({ ...body, pad: "x".repeat(9000) });
    expect((await post("/api/auth/signup/options", big)).status).toBe(413);
    expect((await post("/api/auth/signup/options", "{nope")).status).toBe(400);
    expect((await post("/api/auth/signup/options", { ...body, extra: 1 })).status).toBe(400);
  });

  it("a refused pseudo: 400 with its reason", async () => {
    const code = await insertInvitation(await insertUser("Ana"));
    const response = await post("/api/auth/signup/options", {
      invitation: code,
      pseudo: "Марія",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "pseudo", reason: "chars" });
  });

  it("an invitation unknown, used or expired: 410 with its state", async () => {
    const ana = await insertUser("Ana");
    const cases: [string, string][] = [
      [randomCode(), "unknown"],
      ["not-a-code", "unknown"],
      [await insertInvitation(ana, { usedAt: Date.now() }), "used"],
      [await insertInvitation(ana, { expiresAt: Date.now() - 1 }), "expired"],
    ];
    for (const [invitation, error] of cases) {
      const response = await post("/api/auth/signup/options", { invitation, pseudo: "Zoé" });
      expect(response.status, error).toBe(410);
      expect(await response.json()).toEqual({ error });
    }
  });

  it("a pseudo taken without regard to case or accents: 409 (D-04)", async () => {
    await insertUser("Élodie", "elodie");
    const code = await insertInvitation(await insertUser("Ana"));
    const response = await post("/api/auth/signup/options", { invitation: code, pseudo: "elodie" });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "taken" });
  });

  it("creation options for a resident key, and a challenge row holding the pending sign-up", async () => {
    const code = await insertInvitation(await insertUser("Ana"));
    const before = Date.now();
    const response = await post("/api/auth/signup/options", {
      invitation: code,
      pseudo: "  Zoé  Lou ",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const options = (await response.json()) as Options;
    expect(options.rp).toEqual({ id: "toc.test", name: "TOC" });
    expect(options.user.name).toBe("Zoé Lou");
    expect(options.user.displayName).toBe("Zoé Lou");
    expect(options.authenticatorSelection.residentKey).toBe("required");
    const [challenge] = await rows("SELECT * FROM challenges");
    expect(challenge?.challenge).toBe(options.challenge);
    expect(challenge?.purpose).toBe("register");
    expect(challenge?.user_id).toBeNull();
    const expires = challenge?.expires_at as number;
    expect(expires).toBeGreaterThanOrEqual(before + 5 * 60_000);
    expect(expires).toBeLessThanOrEqual(Date.now() + 5 * 60_000);
    const pending = JSON.parse(challenge?.pending as string) as Record<string, unknown>;
    expect(pending.pseudo).toBe("Zoé Lou");
    expect(pending.key).toBe("zoe lou");
    expect(pending.invitation).toBe(await sha256Url(code));
    expect(pending.bootstrap).toBe(false);
    expect(pending.userId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    // The WebAuthn user handle: 32 random bytes, never the pseudo.
    expect(pending.handle).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(options.user.id).toBe(pending.handle);
  });
});

describe("POST /api/auth/signup/verify", () => {
  it("an invitation from Ana: the account, the passkey, the friendship, the session and the code", async () => {
    const ana = await insertUser("Ana");
    const code = await insertInvitation(ana);
    const jar = newJar();
    const { response, optionsCost } = await signUp(code, "Zoé", jar);
    expect(response.status, await response.clone().text()).toBe(201);
    console.log(
      `sign-up with an inviter: options x-toc-d1 ${optionsCost}, verify x-toc-d1 ${response.headers.get("x-toc-d1")}`,
    );

    const set = response.headers.get("set-cookie") ?? "";
    expect(set).toMatch(/^__Host-toc_session=[A-Za-z0-9_-]{43};/);
    for (const part of ["Path=/", "Secure", "HttpOnly", "SameSite=Lax", "Max-Age=34560000"]) {
      expect(set).toContain(part);
    }
    expect(set).not.toMatch(/Domain=/i);
    const token = (jar.cookie ?? "").split("=")[1] as string;

    const body = (await response.json()) as {
      me: { id: string; pseudo: string; passkeys: { label: string; current: boolean }[] };
      backupCode: string;
    };
    expect(body.backupCode).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{20}$/);
    expect(body.me.pseudo).toBe("Zoé");
    expect(body.me.passkeys).toHaveLength(1);
    expect(body.me.passkeys[0]).toMatchObject({ label: "iPhone", current: true });
    expect(JSON.stringify(body)).not.toContain(token);

    const [user] = await rows("SELECT * FROM users WHERE id = ?", body.me.id);
    expect(user?.pseudo_key).toBe("zoe");
    expect(user?.invited_by).toBe(ana);
    expect(user?.backup_mac).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(typeof user?.backup_at).toBe("number");

    const [passkey] = await rows("SELECT * FROM passkeys WHERE user_id = ?", body.me.id);
    expect(passkey?.rp_id).toBe("toc.test");
    expect(passkey?.label).toBe("iPhone");
    expect(passkey?.counter).toBe(0);

    const [invitation] = await rows("SELECT * FROM invitations");
    expect(typeof invitation?.used_at).toBe("number");
    expect(invitation?.used_by).toBe(body.me.id);

    const friends = await rows("SELECT user_id, friend_id FROM friendships ORDER BY user_id");
    expect(friends).toHaveLength(2);
    expect(friends).toEqual(
      expect.arrayContaining([
        { user_id: ana, friend_id: body.me.id },
        { user_id: body.me.id, friend_id: ana },
      ]),
    );

    const [session] = await rows("SELECT * FROM sessions");
    expect(session?.id_hash).toBe(await sha256Url(token));
    expect(session?.user_id).toBe(body.me.id);
    expect(session?.passkey_id).toBe(passkey?.id);

    // No live secret in D1 (T-04-23): no backup code, no session token, no pepper.
    const all = await everyRow();
    expect(all).not.toContain(body.backupCode);
    expect(all).not.toContain(token);
    expect(all).not.toContain(env.TOC_PEPPER as string);

    // The challenge is spent: the same answer again is refused.
    expect(await rows("SELECT * FROM challenges")).toEqual([]);
  });

  it("the same verify again: 400 expired", async () => {
    const code = await insertInvitation(await insertUser("Ana"));
    const opened = await post("/api/auth/signup/options", { invitation: code, pseudo: "Zoé" });
    const options = (await opened.json()) as Options;
    const created = await (await softAuthenticator("toc.test", ORIGIN)).create(options.challenge);
    expect((await post("/api/auth/signup/verify", { response: created })).status).toBe(201);
    const again = await post("/api/auth/signup/verify", { response: created });
    expect(again.status).toBe(400);
    expect(await again.json()).toEqual({ error: "expired" });
  });

  it("an answer from another origin is refused", async () => {
    const code = await insertInvitation(await insertUser("Ana"));
    const opened = await post("/api/auth/signup/options", { invitation: code, pseudo: "Zoé" });
    const options = (await opened.json()) as Options;
    const passkey = await softAuthenticator("toc.test", ORIGIN);
    const created = await passkey.create(options.challenge, { origin: "https://evil.test" });
    const response = await post("/api/auth/signup/verify", { response: created });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "refused" });
    expect(await rows("SELECT * FROM users WHERE pseudo = 'Zoé'")).toEqual([]);
    // The invitation was not claimed.
    expect(await (await get(`/api/invitations/${code}`)).json()).toMatchObject({ state: "ok" });
  });

  it("the bootstrap code makes the first account, with no friendship (D-03)", async () => {
    const { response, optionsCost } = await signUp(env.TOC_BOOTSTRAP as string, "Romain");
    expect(response.status, await response.clone().text()).toBe(201);
    console.log(
      `bootstrap sign-up: options x-toc-d1 ${optionsCost}, verify x-toc-d1 ${response.headers.get("x-toc-d1")}`,
    );
    const body = (await response.json()) as { me: { id: string; pseudo: string } };
    expect(body.me.pseudo).toBe("Romain");
    expect(await rows("SELECT * FROM friendships")).toEqual([]);
    const [user] = await rows("SELECT * FROM users");
    expect(user?.invited_by).toBeNull();
    expect(user?.backup_mac).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Dead once an account exists.
    const again = await post("/api/auth/signup/options", {
      invitation: env.TOC_BOOTSTRAP,
      pseudo: "Autre",
    });
    expect(again.status).toBe(410);
    expect(await again.json()).toEqual({ error: "unknown" });
  });

  it("two bootstrap sign-ups started together end with one account", async () => {
    const bootstrap = env.TOC_BOOTSTRAP as string;
    const first = (await (
      await post("/api/auth/signup/options", { invitation: bootstrap, pseudo: "Romain" })
    ).json()) as Options;
    const second = (await (
      await post("/api/auth/signup/options", { invitation: bootstrap, pseudo: "Intrus" })
    ).json()) as Options;
    const a = await (await softAuthenticator("toc.test", ORIGIN)).create(first.challenge);
    const b = await (await softAuthenticator("toc.test", ORIGIN)).create(second.challenge);
    expect((await post("/api/auth/signup/verify", { response: a })).status).toBe(201);
    const late = await post("/api/auth/signup/verify", { response: b });
    expect(late.status).toBe(410);
    expect(await late.json()).toEqual({ error: "unknown" });
    expect((await rows("SELECT pseudo FROM users")).map((row) => row.pseudo)).toEqual(["Romain"]);
  });

  it("an invitation serves once (D-11)", async () => {
    const code = await insertInvitation(await insertUser("Ana"));
    expect((await signUp(code, "Zoé")).response.status).toBe(201);
    const again = await post("/api/auth/signup/options", { invitation: code, pseudo: "Lou" });
    expect(again.status).toBe(410);
    expect(await again.json()).toEqual({ error: "used" });
    expect(await (await get(`/api/invitations/${code}`)).json()).toEqual({
      state: "used",
      inviter: "Ana",
    });
  });

  it("two sign-ups racing for one pseudo: the second is taken, its invitation released (Pitfall 6)", async () => {
    const ana = await insertUser("Ana");
    const one = await insertInvitation(ana);
    const two = await insertInvitation(ana);
    const first = (await (
      await post("/api/auth/signup/options", { invitation: one, pseudo: "Élodie" })
    ).json()) as Options;
    const second = (await (
      await post("/api/auth/signup/options", { invitation: two, pseudo: "elodie" })
    ).json()) as Options;
    const a = await (await softAuthenticator("toc.test", ORIGIN)).create(first.challenge);
    const b = await (await softAuthenticator("toc.test", ORIGIN)).create(second.challenge);
    expect((await post("/api/auth/signup/verify", { response: a })).status).toBe(201);
    const late = await post("/api/auth/signup/verify", { response: b });
    expect(late.status).toBe(409);
    expect(await late.json()).toEqual({ error: "taken" });
    expect(await (await get(`/api/invitations/${two}`)).json()).toMatchObject({ state: "ok" });
    expect(await rows("SELECT * FROM users WHERE pseudo_key = 'elodie'")).toHaveLength(1);
    expect(await rows("SELECT * FROM passkeys")).toHaveLength(1);
  });

  it("without the pepper secret the sign-up calls answer 503 config", async () => {
    const code = await insertInvitation(await insertUser("Ana"));
    const bare = { ...env, TOC_PEPPER: undefined } as Env;
    for (const path of ["/api/auth/signup/options", "/api/auth/signup/verify"]) {
      const response = await handleRequest(
        new Request(`${ORIGIN}${path}`, {
          method: "POST",
          headers: { Origin: ORIGIN, "content-type": "application/json" },
          body: JSON.stringify({ invitation: code, pseudo: "Zoé" }),
        }),
        bare,
      );
      expect(response?.status, path).toBe(503);
      expect(await response?.json()).toEqual({ error: "config" });
    }
  });
});

describe("GET /api/me", () => {
  it("with the session cookie: the account (ACCT-02)", async () => {
    const jar = newJar();
    const { response } = await signUp(await insertInvitation(await insertUser("Ana")), "Zoé", jar);
    const signed = (await response.json()) as { me: { id: string } };
    const me = await get("/api/me", jar);
    expect(me.status).toBe(200);
    expect(me.headers.get("cache-control")).toBe("no-store");
    const body = (await me.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      id: signed.me.id,
      pseudo: "Zoé",
      hasBackupCode: true,
    });
    expect(typeof body.createdAt).toBe("number");
    expect(typeof body.backupAt).toBe("number");
    expect(body.passkeys).toEqual([
      expect.objectContaining({
        label: "iPhone",
        lastUsedAt: null,
        backedUp: false,
        current: true,
      }),
    ]);
    expect(Object.keys(body).sort()).toEqual(
      ["backupAt", "createdAt", "hasBackupCode", "id", "passkeys", "pseudo"].sort(),
    );
  });

  it("without a cookie: 401 signed-out", async () => {
    const response = await get("/api/me");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "signed-out" });
  });

  it("an unknown or expired session: 401 and the cookie expired", async () => {
    const unknown = { cookie: `__Host-toc_session=${"a".repeat(43)}` };
    const response = await get("/api/me", unknown);
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toMatch(/^__Host-toc_session=;.*Max-Age=0/);

    const jar = newJar();
    await signUp(await insertInvitation(await insertUser("Ana")), "Zoé", jar);
    await db()
      .prepare("UPDATE sessions SET expires_at = ?")
      .bind(Date.now() - 1)
      .run();
    const expired = await get("/api/me", jar);
    expect(expired.status).toBe(401);
    expect(jar.cookie).toBeNull();
  });
});

describe("test mode", () => {
  it("POST /api/test/invitation mints a fresh, used or expired invitation with no inviter", async () => {
    const fresh = await post("/api/test/invitation", {});
    expect(fresh.status).toBe(201);
    const { code } = (await fresh.json()) as { code: string };
    expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await (await get(`/api/invitations/${code}`)).json()).toMatchObject({
      state: "ok",
      inviter: null,
    });
    const used = (await (await post("/api/test/invitation", { used: true })).json()) as {
      code: string;
    };
    expect(await (await get(`/api/invitations/${used.code}`)).json()).toEqual({
      state: "used",
      inviter: null,
    });
    const expired = (await (await post("/api/test/invitation", { expired: true })).json()) as {
      code: string;
    };
    expect(await (await get(`/api/invitations/${expired.code}`)).json()).toEqual({
      state: "expired",
      inviter: null,
    });
    // A sign-up through it makes no friendship.
    const { response } = await signUp(code, "Zoé");
    expect(response.status).toBe(201);
    expect(await rows("SELECT * FROM friendships")).toEqual([]);
  });

  it("outside test mode: no test route and no x-toc-d1 header", async () => {
    const live = { ...env, TOC_TEST_MODE: undefined } as Env;
    const minted = await handleRequest(
      new Request(`${ORIGIN}/api/test/invitation`, {
        method: "POST",
        headers: { Origin: ORIGIN, "content-type": "application/json" },
        body: "{}",
      }),
      live,
    );
    expect(minted?.status).toBe(404);
    const state = await handleRequest(new Request(`${ORIGIN}/api/invitations/short`), live);
    expect(state?.status).toBe(200);
    expect(state?.headers.get("x-toc-d1")).toBeNull();
  });

  it("every /api answer carries x-toc-d1 in test mode", async () => {
    for (const response of [
      await get("/api/me"),
      await get("/api/nothing"),
      await get(`/api/invitations/${randomCode()}`),
    ]) {
      expect(response.headers.get("x-toc-d1")).toMatch(/^w=\d+;r=\d+$/);
    }
  });
});
