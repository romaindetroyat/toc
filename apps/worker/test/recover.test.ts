// Recovering an account with its backup code on a new device (plan 04-03, ACCT-01, D-02, SC1;
// 04-RESEARCH Pattern 3, Pitfall 9, T-04-03, T-04-05, T-04-06), in workerd with miniflare's D1 and the
// real PlayerHub. Paul lost his phone: on a new device he types his pseudo and his backup code, the
// account's hub checks the code (and counts wrong ones), he creates a passkey there, every other
// session of the account ends, and he gets a new code. A wrong pseudo and a wrong code get the same
// answer; an unknown pseudo never reaches a hub. The rows written by each call are logged (x-toc-d1)
// for the plan's SUMMARY.

import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { macOf } from "../src/auth/backup.ts";
import { recoverOptions } from "../src/auth/recover.ts";
import { Meter } from "../src/db.ts";
import { softAuthenticator } from "./authenticator.ts";
import {
  get,
  type Jar,
  logIn,
  MAC_UA,
  newJar,
  ORIGIN,
  type Person,
  post,
  resetAccounts,
  rows,
  sha256Url,
  signUpPerson,
} from "./helpers.ts";

const MINUTE = 60_000;

beforeEach(resetAccounts);

type CreationOptions = {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  excludeCredentials?: { id: string }[];
};

type Recovered = {
  me: {
    id: string;
    pseudo: string;
    passkeys: { id: string; current: boolean }[];
    hasBackupCode: boolean;
    backupAt: number;
  };
  backupCode: string;
};

const tokenHash = (jar: Jar) => sha256Url((jar.cookie ?? "").split("=")[1] as string);

/** A pseudo and a code to POST /api/auth/recover on `jar`'s device. */
const ask = (pseudo: string, code: string, jar: Jar = newJar()) =>
  post("/api/auth/recover", { pseudo, code }, { jar });

/** A wrong code of the right shape (another person's, in effect). */
const WRONG_CODE = "K7QM2XRAP9DWHT4ENB6Z";

/** The whole recovery on a new device: options, a new passkey, verify. */
async function recoverOn(jar: Jar, pseudo: string, code: string) {
  const options = await ask(pseudo, code, jar);
  if (options.status !== 200) throw new Error(`recover options: ${options.status}`);
  const created = (await options.clone().json()) as CreationOptions;
  const passkey = await softAuthenticator("toc.test", ORIGIN);
  const verify = await post(
    "/api/auth/recover/verify",
    { response: await passkey.create(created.challenge) },
    { jar, userAgent: MAC_UA },
  );
  return { options, created, verify, passkey };
}

/** The env of the router with PLAYER_HUB.getByName counted (the names asked for, in order). */
function countingEnv(): { env: Env; names: string[] } {
  const names: string[] = [];
  const real = env.PLAYER_HUB;
  const hub = {
    getByName: (name: string) => {
      names.push(name);
      return real.getByName(name);
    },
  };
  const counted = new Proxy(env, {
    get: (target, key) => (key === "PLAYER_HUB" ? hub : Reflect.get(target, key)),
  }) as Env;
  return { env: counted, names };
}

/** recoverOptions called directly with the counting env, as the router calls it. */
async function askCounted(pseudo: string, code: string) {
  const { env: counted, names } = countingEnv();
  const url = new URL(`${ORIGIN}/api/auth/recover`);
  const request = new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ pseudo, code }),
  });
  const db = env.DB;
  if (db === undefined) throw new Error("no D1 binding in the tests");
  const meter = new Meter(db);
  const response = await recoverOptions(request, counted, url, meter, Date.now());
  return { response, names, meter };
}

describe("POST /api/auth/recover", () => {
  it("a code that cannot be one: 400 format, without reading D1", async () => {
    await signUpPerson("Paul");
    for (const code of ["", "K7QM-2XRA", "K7QM-2XRA-P9DW-HT4E-NB6U", "x".repeat(60)]) {
      const response = await ask("Paul", code);
      expect(response.status, code).toBe(400);
      expect(await response.json()).toEqual({ error: "format" });
      expect(response.headers.get("x-toc-d1")).toBe("w=0;r=0");
    }
  });

  it("the right code (any case, dashes, O for 0): the creation options for the account", async () => {
    const paul = await signUpPerson("Paul");
    const typed = paul.backupCode.toLowerCase().replace(/(.{4})(?!$)/g, "$1-");
    const response = await ask("paul", typed);
    expect(response.status).toBe(200);
    console.log(`recover: options (right code) x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    const options = (await response.json()) as CreationOptions;
    expect(options.rp).toEqual({ id: "toc.test", name: "TOC" });
    expect(options.user.id).toBe(paul.handle);
    expect(options.user.name).toBe("Paul");
    expect(options.excludeCredentials?.map((key) => key.id)).toEqual([paul.passkey.id]);
    // A challenge of purpose recover, bound to the account, holding the MAC of the code given.
    const [challenge] = await rows("SELECT * FROM challenges");
    expect(challenge?.challenge).toBe(options.challenge);
    expect(challenge?.purpose).toBe("recover");
    expect(challenge?.user_id).toBe(paul.id);
    const [user] = await rows("SELECT backup_mac FROM users WHERE id = ?", paul.id);
    expect(JSON.parse(String(challenge?.pending))).toEqual({ mac: user?.backup_mac });
    expect(String(challenge?.pending)).not.toContain(paul.backupCode);
  });

  it("an unknown pseudo and a wrong code: the same status and body, nothing written to D1", async () => {
    await signUpPerson("Paul");
    const answers = [];
    for (const [pseudo, code] of [
      ["Paul", WRONG_CODE],
      ["Personne", WRONG_CODE],
      ["?", WRONG_CODE],
    ] as const) {
      const response = await ask(pseudo, code);
      expect(response.headers.get("x-toc-d1"), pseudo).toMatch(/^w=0;/);
      answers.push({ status: response.status, body: await response.text() });
    }
    expect(answers).toEqual(
      Array(3).fill({ status: 400, body: JSON.stringify({ error: "wrong" }) }),
    );
  });

  it("an unknown pseudo reaches no PlayerHub (Pitfall 9); a real account's reaches its own", async () => {
    const paul = await signUpPerson("Paul");
    for (const pseudo of ["Personne", "?", ""]) {
      const unknown = await askCounted(pseudo, WRONG_CODE);
      expect(unknown.response.status, pseudo).toBe(400);
      expect(await unknown.response.json()).toEqual({ error: "wrong" });
      expect(unknown.names, pseudo).toEqual([]);
    }
    const wrong = await askCounted("Paul", WRONG_CODE);
    expect(wrong.response.status).toBe(400);
    expect(await wrong.response.json()).toEqual({ error: "wrong" });
    expect(wrong.names).toEqual([paul.id]);
    // The hub counted that one: four more wrong codes lock the account.
    for (let i = 0; i < 3; i++) expect((await ask("Paul", WRONG_CODE)).status).toBe(400);
    expect((await ask("Paul", WRONG_CODE)).status).toBe(429);
  });

  it("five wrong codes, then the right one: 429 locked with the time it opens again", async () => {
    const paul = await signUpPerson("Paul");
    const before = Date.now();
    for (let i = 0; i < 4; i++) {
      const response = await ask("Paul", WRONG_CODE);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "wrong" });
    }
    const fifth = await ask("Paul", WRONG_CODE);
    expect(fifth.status).toBe(429);
    const locked = (await fifth.json()) as { error: string; until: number };
    expect(locked.error).toBe("locked");
    expect(locked.until).toBeGreaterThanOrEqual(before + 15 * MINUTE);
    expect(locked.until).toBeLessThanOrEqual(Date.now() + 15 * MINUTE);
    const right = await ask("Paul", paul.backupCode);
    expect(right.status).toBe(429);
    expect(await right.json()).toEqual({ error: "locked", until: locked.until });
    expect(right.headers.get("x-toc-d1")).toMatch(/^w=0;/);
    // A locked account's attempts write nothing to D1 and store no challenge.
    expect(await rows("SELECT * FROM challenges")).toEqual([]);
  });

  it("refuses another site, a body that is not JSON, a GET", async () => {
    const paul = await signUpPerson("Paul");
    const body = { pseudo: "Paul", code: paul.backupCode };
    expect((await post("/api/auth/recover", body, { origin: "https://evil.test" })).status).toBe(
      403,
    );
    expect((await post("/api/auth/recover", body, { origin: null })).status).toBe(403);
    expect(
      (await post("/api/auth/recover", JSON.stringify(body), { contentType: "text/plain" })).status,
    ).toBe(415);
    expect((await post("/api/auth/recover", { ...body, more: 1 })).status).toBe(400);
    expect((await get("/api/auth/recover")).status).toBe(405);
    expect((await get("/api/auth/recover/verify")).status).toBe(405);
  });
});

describe("POST /api/auth/recover/verify", () => {
  /** Paul signed in on his phone (signed up there) and on a Mac, with a push subscription each. */
  async function paulOnTwoDevices(): Promise<{ paul: Person; phone: Jar; mac: Jar }> {
    const phone = newJar();
    const paul = await signUpPerson("Paul", phone);
    const mac = newJar();
    const login = await logIn(paul.passkey, paul.handle, mac);
    expect(login.verify.status).toBe(200);
    const subscribe = env.DB?.prepare(
      `INSERT INTO push_subscriptions (endpoint, user_id, session_hash, p256dh, auth, created_at)
       VALUES (?, ?, ?, 'k', 'a', 1)`,
    );
    if (subscribe === undefined) throw new Error("no D1 binding in the tests");
    await subscribe.bind("https://push.test/phone", paul.id, await tokenHash(phone)).run();
    await subscribe.bind("https://push.test/mac", paul.id, await tokenHash(mac)).run();
    return { paul, phone, mac };
  }

  it("a new passkey here, every other session ended, a new session and a new code shown once", async () => {
    const { paul, phone, mac } = await paulOnTwoDevices();
    const [before] = await rows("SELECT backup_mac, backup_at FROM users WHERE id = ?", paul.id);
    const here = newJar();
    const { verify, passkey, created } = await recoverOn(here, "Paul", paul.backupCode);
    expect(verify.status).toBe(200);
    console.log(`recover: verify x-toc-d1 ${verify.headers.get("x-toc-d1")}`);
    expect(verify.headers.get("set-cookie")).toMatch(/^__Host-toc_session=[A-Za-z0-9_-]{43};/);
    expect(here.cookie).not.toBeNull();
    const body = (await verify.json()) as Recovered;
    expect(body.backupCode).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{20}$/);
    expect(body.backupCode).not.toBe(paul.backupCode);
    expect(body.me.id).toBe(paul.id);
    expect(body.me.pseudo).toBe("Paul");
    expect(body.me.hasBackupCode).toBe(true);
    // Both keys are listed (the lost phone's can be removed in « Clés d'accès »); this one is current.
    expect(body.me.passkeys.map((key) => [key.id, key.current]).sort()).toEqual(
      [
        [passkey.id, true],
        [paul.passkey.id, false],
      ].sort(),
    );
    expect(created.user.id).toBe(paul.handle);

    // The lost phone and the Mac are signed out, their push subscriptions gone (cascade).
    expect((await get("/api/me", phone)).status).toBe(401);
    expect((await get("/api/me", mac)).status).toBe(401);
    expect(await rows("SELECT * FROM push_subscriptions")).toEqual([]);
    const sessions = await rows("SELECT id_hash, passkey_id FROM sessions");
    expect(sessions).toEqual([{ id_hash: await tokenHash(here), passkey_id: passkey.id }]);
    const me = await get("/api/me", here);
    expect(me.status).toBe(200);

    // The new code's MAC replaced the old one; the code itself is nowhere in D1.
    const [after] = await rows("SELECT backup_mac, backup_at FROM users WHERE id = ?", paul.id);
    expect(after?.backup_mac).not.toBe(before?.backup_mac);
    expect(after?.backup_mac).toBe(await macOf(String(env.TOC_PEPPER), paul.id, body.backupCode));
    const [key] = await rows("SELECT user_id, rp_id, label FROM passkeys WHERE id = ?", passkey.id);
    expect(key).toEqual({ user_id: paul.id, rp_id: "toc.test", label: "Mac" });

    // The used code no longer opens anything; the new one does.
    const old = await ask("Paul", paul.backupCode);
    expect(old.status).toBe(400);
    expect(await old.json()).toEqual({ error: "wrong" });
    expect((await ask("Paul", body.backupCode)).status).toBe(200);
  });

  it("the new passkey signs in afterwards, the lost one still does until removed", async () => {
    const { paul } = await paulOnTwoDevices();
    const { verify, passkey } = await recoverOn(newJar(), "Paul", paul.backupCode);
    expect(verify.status).toBe(200);
    expect((await logIn(passkey, paul.handle)).verify.status).toBe(200);
    // The lost phone's passkey is not removed by the recovery: « Retire la clé de l'appareil perdu ».
    expect((await logIn(paul.passkey, paul.handle)).verify.status).toBe(200);
  });

  it("after the 5-minute delay: 400 expired, and the same code opens a new recovery", async () => {
    const { paul, phone } = await paulOnTwoDevices();
    const here = newJar();
    const options = await ask("Paul", paul.backupCode, here);
    const { challenge } = (await options.json()) as CreationOptions;
    await env.DB?.prepare("UPDATE challenges SET expires_at = ?")
      .bind(Date.now() - 1)
      .run();
    const passkey = await softAuthenticator("toc.test", ORIGIN);
    const late = await post(
      "/api/auth/recover/verify",
      { response: await passkey.create(challenge) },
      { jar: here },
    );
    expect(late.status).toBe(400);
    expect(await late.json()).toEqual({ error: "expired" });
    expect(late.headers.get("set-cookie")).toBeNull();
    // Nothing happened: the phone is still signed in, no key added, the code not spent.
    expect((await get("/api/me", phone)).status).toBe(200);
    expect(await rows("SELECT id FROM passkeys WHERE id = ?", passkey.id)).toEqual([]);
    const again = await recoverOn(here, "Paul", paul.backupCode);
    expect(again.verify.status).toBe(200);
  });

  it("the code changed meanwhile (a new code made on another device): 400 expired, nothing done", async () => {
    const { paul, phone } = await paulOnTwoDevices();
    const here = newJar();
    const options = await ask("Paul", paul.backupCode, here);
    const { challenge } = (await options.json()) as CreationOptions;
    await env.DB?.prepare("UPDATE users SET backup_mac = 'another' WHERE id = ?")
      .bind(paul.id)
      .run();
    const passkey = await softAuthenticator("toc.test", ORIGIN);
    const verify = await post(
      "/api/auth/recover/verify",
      { response: await passkey.create(challenge) },
      { jar: here },
    );
    expect(verify.status).toBe(400);
    expect(await verify.json()).toEqual({ error: "expired" });
    expect((await get("/api/me", phone)).status).toBe(200);
    expect(await rows("SELECT id FROM passkeys WHERE id = ?", passkey.id)).toEqual([]);
  });

  it("single use: the same challenge a second time is expired", async () => {
    const { paul } = await paulOnTwoDevices();
    const here = newJar();
    const options = await ask("Paul", paul.backupCode, here);
    const { challenge } = (await options.json()) as CreationOptions;
    const passkey = await softAuthenticator("toc.test", ORIGIN);
    const response = await passkey.create(challenge);
    expect((await post("/api/auth/recover/verify", { response }, { jar: here })).status).toBe(200);
    const twice = await post("/api/auth/recover/verify", { response }, { jar: newJar() });
    expect(twice.status).toBe(400);
    expect(await twice.json()).toEqual({ error: "expired" });
  });

  it("a passkey made for another site: refused, and the code is not spent", async () => {
    const { paul, phone } = await paulOnTwoDevices();
    const here = newJar();
    const options = await ask("Paul", paul.backupCode, here);
    const { challenge } = (await options.json()) as CreationOptions;
    const passkey = await softAuthenticator("toc.test", ORIGIN);
    const verify = await post(
      "/api/auth/recover/verify",
      { response: await passkey.create(challenge, { origin: "https://evil.test" }) },
      { jar: here },
    );
    expect(verify.status).toBe(400);
    expect(await verify.json()).toEqual({ error: "refused" });
    expect((await get("/api/me", phone)).status).toBe(200);
    expect((await recoverOn(here, "Paul", paul.backupCode)).verify.status).toBe(200);
  });

  it("another account's recovery challenge cannot be answered for this one", async () => {
    const { paul } = await paulOnTwoDevices();
    const zoe = await signUpPerson("Zoé");
    const options = await ask("Zoé", zoe.backupCode);
    const { challenge } = (await options.json()) as CreationOptions;
    const passkey = await softAuthenticator("toc.test", ORIGIN);
    const verify = await post("/api/auth/recover/verify", {
      response: await passkey.create(challenge),
    });
    // The challenge is Zoé's: the account recovered is hers, never Paul's.
    expect(verify.status).toBe(200);
    const body = (await verify.json()) as Recovered;
    expect(body.me.id).toBe(zoe.id);
    expect(await rows("SELECT id FROM passkeys WHERE user_id = ?", paul.id)).toHaveLength(1);
  });

  it("a malformed answer: 400 body; no answer for a challenge never handed out: 400 expired", async () => {
    await paulOnTwoDevices();
    const passkey = await softAuthenticator("toc.test", ORIGIN);
    const stranger = await post("/api/auth/recover/verify", {
      response: await passkey.create("bm90LWEtY2hhbGxlbmdl"),
    });
    expect(stranger.status).toBe(400);
    expect(await stranger.json()).toEqual({ error: "expired" });
    const malformed = await post("/api/auth/recover/verify", { response: { id: "x" } });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: "body" });
  });
});
