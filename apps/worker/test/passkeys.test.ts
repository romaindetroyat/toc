// The passkeys of an account and a new backup code (plan 04-02, ACCT-01, D-02; 04-RESEARCH Patterns 1
// and 3, T-04-06, T-04-30, T-04-31), in workerd with miniflare's D1. Adding a passkey for this device
// (excludeCredentials), the list in GET /api/me, removing one (never the last; its sessions end), and
// a new backup code behind a fresh assertion of one of the account's own passkeys (step-up). The rows
// written by each call are logged (x-toc-d1) for the plan's SUMMARY.

import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { macOf } from "../src/auth/backup.ts";
import { type SoftAuthenticator, softAuthenticator } from "./authenticator.ts";
import {
  del,
  get,
  type Jar,
  logIn,
  MAC_UA,
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

type CreationOptions = {
  challenge: string;
  user: { id: string; name: string };
  excludeCredentials?: { id: string }[];
};

type RequestOptions = {
  challenge: string;
  rpId: string;
  allowCredentials?: { id: string; type: string }[];
};

type Me = {
  id: string;
  passkeys: { id: string; label: string; current: boolean; backedUp: boolean; createdAt: number }[];
};

/** Adds a new software passkey on the jar's device; answers both responses and the passkey. */
async function addPasskey(
  jar: Jar,
  userAgent = MAC_UA,
): Promise<{ options: Response; verify: Response; passkey: SoftAuthenticator }> {
  const options = await post("/api/auth/passkeys/options", {}, { jar });
  const passkey = await softAuthenticator("toc.test", ORIGIN);
  if (options.status !== 200) {
    return { options, verify: options, passkey };
  }
  const { challenge } = (await options.clone().json()) as CreationOptions;
  const verify = await post(
    "/api/auth/passkeys/verify",
    { response: await passkey.create(challenge) },
    { jar, userAgent },
  );
  return { options, verify, passkey };
}

async function meOf(jar: Jar): Promise<Me> {
  const response = await get("/api/me", jar);
  expect(response.status).toBe(200);
  return (await response.json()) as Me;
}

const tokenHash = (jar: Jar) => sha256Url((jar.cookie ?? "").split("=")[1] as string);

describe("adding a passkey for this device", () => {
  it("options: the account's handle and its passkeys excluded, a challenge bound to the account", async () => {
    const jar = newJar();
    const zoe = await signUpPerson("Zoé", jar);
    const response = await post("/api/auth/passkeys/options", {}, { jar });
    expect(response.status).toBe(200);
    console.log(`add a passkey: options x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    const options = (await response.json()) as CreationOptions & {
      authenticatorSelection: { residentKey: string };
    };
    expect(options.user.id).toBe(zoe.handle);
    expect(options.user.name).toBe("Zoé");
    expect(options.excludeCredentials?.map((c) => c.id)).toEqual([zoe.passkey.id]);
    expect(options.authenticatorSelection.residentKey).toBe("required");
    const [challenge] = await rows("SELECT * FROM challenges");
    expect(challenge).toMatchObject({
      challenge: options.challenge,
      purpose: "add",
      user_id: zoe.id,
    });
  });

  it("without a session: 401", async () => {
    const response = await post("/api/auth/passkeys/options", {});
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "signed-out" });
    const verify = await post("/api/auth/passkeys/verify", { response: {} });
    expect(verify.status).toBe(401);
  });

  it("verify: a new passkey row with its label, now this device's key", async () => {
    const jar = newJar();
    const zoe = await signUpPerson("Zoé", jar);
    const { verify, passkey } = await addPasskey(jar);
    expect(verify.status, await verify.clone().text()).toBe(201);
    console.log(`add a passkey: verify x-toc-d1 ${verify.headers.get("x-toc-d1")}`);
    const body = (await verify.json()) as { passkey: Record<string, unknown> };
    expect(body.passkey).toMatchObject({
      id: passkey.id,
      label: "Mac",
      lastUsedAt: null,
      backedUp: false,
      current: true,
    });
    const [row] = await rows("SELECT * FROM passkeys WHERE id = ?", passkey.id);
    expect(row).toMatchObject({ user_id: zoe.id, rp_id: "toc.test", label: "Mac", counter: 0 });
    // The new key opens the account too.
    expect((await logIn(passkey, zoe.handle)).verify.status).toBe(200);
  });

  it("a challenge of another account or of another purpose: expired, nothing added", async () => {
    const zoeJar = newJar();
    await signUpPerson("Zoé", zoeJar);
    const louJar = newJar();
    await signUpPerson("Lou", louJar);
    const lous = (await (
      await post("/api/auth/passkeys/options", {}, { jar: louJar })
    ).json()) as CreationOptions;
    const stranger = await softAuthenticator("toc.test", ORIGIN);
    const crossed = await post(
      "/api/auth/passkeys/verify",
      { response: await stranger.create(lous.challenge) },
      { jar: zoeJar },
    );
    expect(crossed.status).toBe(400);
    expect(await crossed.json()).toEqual({ error: "expired" });

    const stepup = (await (
      await post("/api/auth/backup-code/options", {}, { jar: zoeJar })
    ).json()) as RequestOptions;
    const wrongPurpose = await post(
      "/api/auth/passkeys/verify",
      { response: await stranger.create(stepup.challenge) },
      { jar: zoeJar },
    );
    expect(wrongPurpose.status).toBe(400);
    expect(await wrongPurpose.json()).toEqual({ error: "expired" });
    expect(await rows("SELECT * FROM passkeys")).toHaveLength(2);
  });

  it("the same credential twice: already-here", async () => {
    const jar = newJar();
    await signUpPerson("Zoé", jar);
    const { passkey, verify } = await addPasskey(jar);
    expect(verify.status).toBe(201);
    const options = (await (
      await post("/api/auth/passkeys/options", {}, { jar })
    ).json()) as CreationOptions;
    expect(options.excludeCredentials?.map((c) => c.id)).toContain(passkey.id);
    const again = await post(
      "/api/auth/passkeys/verify",
      { response: await passkey.create(options.challenge) },
      { jar },
    );
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "already-here" });
  });
});

describe("the list of passkeys in GET /api/me", () => {
  it("newest first, « cet appareil » for the session's key, synced from backed_up", async () => {
    const phone = newJar();
    const zoe = await signUpPerson("Zoé", phone);
    const computer = newJar();
    expect((await logIn(zoe.passkey, zoe.handle, computer)).verify.status).toBe(200);
    const { passkey } = await addPasskey(computer);
    await rows("UPDATE passkeys SET created_at = created_at - ? WHERE id = ?", DAY, zoe.passkey.id);
    await rows("UPDATE passkeys SET backed_up = 1 WHERE id = ?", zoe.passkey.id);

    const fromComputer = await meOf(computer);
    expect(fromComputer.passkeys.map((p) => [p.id, p.current, p.backedUp])).toEqual([
      [passkey.id, true, false],
      [zoe.passkey.id, false, true],
    ]);
    const fromPhone = await meOf(phone);
    expect(fromPhone.passkeys.map((p) => [p.id, p.current])).toEqual([
      [passkey.id, false],
      [zoe.passkey.id, true],
    ]);
  });
});

describe("DELETE /api/auth/passkeys/:id", () => {
  it("removes one's own passkey and signs out the devices opened with it (a lost phone)", async () => {
    const phone = newJar();
    const zoe = await signUpPerson("Zoé", phone);
    // Marie's new computer: signed in with the phone's key, then a key of its own.
    const computer = newJar();
    expect((await logIn(zoe.passkey, zoe.handle, computer)).verify.status).toBe(200);
    const { passkey } = await addPasskey(computer);
    const tablet = newJar();
    expect((await logIn(zoe.passkey, zoe.handle, tablet)).verify.status).toBe(200);

    const response = await del(`/api/auth/passkeys/${zoe.passkey.id}`, { jar: computer });
    expect(response.status).toBe(204);
    console.log(`remove a passkey: x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    expect(await rows("SELECT id FROM passkeys")).toEqual([{ id: passkey.id }]);
    // The phone's and the tablet's sessions were opened with the removed key.
    expect((await get("/api/me", phone)).status).toBe(401);
    expect((await get("/api/me", tablet)).status).toBe(401);
    expect((await get("/api/me", computer)).status).toBe(200);
    expect(await rows("SELECT * FROM sessions")).toHaveLength(1);
  });

  it("adding a key moves this device's session onto it: removing the old key keeps it signed in", async () => {
    const jar = newJar();
    const zoe = await signUpPerson("Zoé", jar);
    const { passkey } = await addPasskey(jar);
    const [session] = await rows("SELECT passkey_id FROM sessions");
    expect(session?.passkey_id).toBe(passkey.id);
    expect((await del(`/api/auth/passkeys/${zoe.passkey.id}`, { jar })).status).toBe(204);
    expect((await get("/api/me", jar)).status).toBe(200);
  });

  it("the key of this very session: removed, and this device's cookie expired", async () => {
    const phone = newJar();
    const zoe = await signUpPerson("Zoé", phone);
    const computer = newJar();
    expect((await logIn(zoe.passkey, zoe.handle, computer)).verify.status).toBe(200);
    await addPasskey(computer);
    const response = await del(`/api/auth/passkeys/${zoe.passkey.id}`, { jar: phone });
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect(phone.cookie).toBeNull();
    expect((await get("/api/me", computer)).status).toBe(200);
  });

  it("the last passkey: 409 last, nothing removed", async () => {
    const jar = newJar();
    const zoe = await signUpPerson("Zoé", jar);
    const response = await del(`/api/auth/passkeys/${zoe.passkey.id}`, { jar });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "last" });
    expect(await rows("SELECT * FROM passkeys")).toHaveLength(1);
    expect((await get("/api/me", jar)).status).toBe(200);
  });

  it("another account's passkey, or none: 404", async () => {
    const zoeJar = newJar();
    await signUpPerson("Zoé", zoeJar);
    await addPasskey(zoeJar);
    const lou = await signUpPerson("Lou");
    for (const id of [lou.passkey.id, "AAAAAAAAAAAAAAAAAAAAAA", "not%20base64"]) {
      const response = await del(`/api/auth/passkeys/${id}`, { jar: zoeJar });
      expect(response.status, id).toBe(404);
      expect(await response.json()).toEqual({ error: "not-found" });
    }
    expect(await rows("SELECT * FROM passkeys")).toHaveLength(3);
  });

  it("without a session: 401; without our Origin: 403; a GET: 405", async () => {
    const jar = newJar();
    const zoe = await signUpPerson("Zoé", jar);
    await addPasskey(jar);
    const path = `/api/auth/passkeys/${zoe.passkey.id}`;
    expect((await del(path)).status).toBe(401);
    for (const origin of [null, "https://evil.test", "null"]) {
      const response = await del(path, { jar: { ...jar }, origin });
      expect(response.status, String(origin)).toBe(403);
    }
    const read = await get(path, { ...jar });
    expect(read.status).toBe(405);
    expect(read.headers.get("allow")).toBe("DELETE");
    expect(await rows("SELECT * FROM passkeys")).toHaveLength(2);
  });
});

describe("a new backup code (D-02, step-up)", () => {
  it("options: the account's passkeys allowed, a stepup challenge bound to the account", async () => {
    const jar = newJar();
    const zoe = await signUpPerson("Zoé", jar);
    const response = await post("/api/auth/backup-code/options", {}, { jar });
    expect(response.status).toBe(200);
    console.log(`new backup code: options x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    const options = (await response.json()) as RequestOptions;
    expect(options.rpId).toBe("toc.test");
    expect(options.allowCredentials?.map((c) => c.id)).toEqual([zoe.passkey.id]);
    const [challenge] = await rows("SELECT * FROM challenges");
    expect(challenge).toMatchObject({
      challenge: options.challenge,
      purpose: "stepup",
      user_id: zoe.id,
    });
    expect((await post("/api/auth/backup-code/options", {})).status).toBe(401);
  });

  it("verify with the account's own passkey: a new code once, the old one dead, auth_at now", async () => {
    const jar = newJar();
    const zoe = await signUpPerson("Zoé", jar);
    const pepper = env.TOC_PEPPER as string;
    const [before] = await rows("SELECT backup_mac, backup_at FROM users");
    expect(before?.backup_mac).toBe(await macOf(pepper, zoe.id, zoe.backupCode));
    await rows("UPDATE sessions SET auth_at = 0");

    const options = (await (
      await post("/api/auth/backup-code/options", {}, { jar })
    ).json()) as RequestOptions;
    const started = Date.now();
    const response = await post(
      "/api/auth/backup-code/verify",
      { response: await zoe.passkey.get(options.challenge, zoe.handle) },
      { jar },
    );
    expect(response.status, await response.clone().text()).toBe(200);
    console.log(`new backup code: verify x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    const { backupCode } = (await response.json()) as { backupCode: string };
    expect(backupCode).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{20}$/);
    expect(backupCode).not.toBe(zoe.backupCode);

    const [after] = await rows("SELECT backup_mac, backup_at FROM users");
    expect(after?.backup_mac).toBe(await macOf(pepper, zoe.id, backupCode));
    expect(after?.backup_mac).not.toBe(await macOf(pepper, zoe.id, zoe.backupCode));
    expect(after?.backup_at as number).toBeGreaterThanOrEqual(started);
    const [session] = await rows(
      "SELECT auth_at FROM sessions WHERE id_hash = ?",
      await tokenHash(jar),
    );
    expect(session?.auth_at as number).toBeGreaterThanOrEqual(started);
    // The code is nowhere in D1, and the challenge is spent.
    expect(JSON.stringify(await rows("SELECT * FROM users"))).not.toContain(backupCode);
    const again = await post(
      "/api/auth/backup-code/verify",
      { response: await zoe.passkey.get(options.challenge, zoe.handle) },
      { jar },
    );
    expect(again.status).toBe(400);
    expect(await again.json()).toEqual({ error: "expired" });
  });

  it("an assertion by another account's passkey: refused, the code unchanged", async () => {
    const jar = newJar();
    await signUpPerson("Zoé", jar);
    const lou = await signUpPerson("Lou");
    const [before] = await rows("SELECT backup_mac FROM users WHERE pseudo = 'Zoé'");
    const options = (await (
      await post("/api/auth/backup-code/options", {}, { jar })
    ).json()) as RequestOptions;
    const response = await post(
      "/api/auth/backup-code/verify",
      { response: await lou.passkey.get(options.challenge, lou.handle) },
      { jar },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "refused" });
    const [after] = await rows("SELECT backup_mac FROM users WHERE pseudo = 'Zoé'");
    expect(after?.backup_mac).toBe(before?.backup_mac);
  });

  it("no new code without the step-up: a login challenge, a bad signature, no session", async () => {
    const jar = newJar();
    const zoe = await signUpPerson("Zoé", jar);
    // A login challenge is not a step-up one.
    const login = (await (await post("/api/auth/login/options", {})).json()) as RequestOptions;
    const withLogin = await post(
      "/api/auth/backup-code/verify",
      { response: await zoe.passkey.get(login.challenge, zoe.handle) },
      { jar },
    );
    expect(withLogin.status).toBe(400);
    expect(await withLogin.json()).toEqual({ error: "expired" });
    // Another key signing for Zoé's credential id.
    const options = (await (
      await post("/api/auth/backup-code/options", {}, { jar })
    ).json()) as RequestOptions;
    const impostor = await softAuthenticator("toc.test", ORIGIN);
    const forged = {
      ...(await impostor.get(options.challenge, zoe.handle)),
      id: zoe.passkey.id,
      rawId: zoe.passkey.id,
    };
    const refused = await post("/api/auth/backup-code/verify", { response: forged }, { jar });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({ error: "refused" });
    // A valid assertion without the session cookie.
    const fresh = (await (
      await post("/api/auth/backup-code/options", {}, { jar })
    ).json()) as RequestOptions;
    const anonymous = await post("/api/auth/backup-code/verify", {
      response: await zoe.passkey.get(fresh.challenge, zoe.handle),
    });
    expect(anonymous.status).toBe(401);
    const [user] = await rows("SELECT backup_mac FROM users");
    expect(user?.backup_mac).toBe(await macOf(env.TOC_PEPPER as string, zoe.id, zoe.backupCode));
  });
});
