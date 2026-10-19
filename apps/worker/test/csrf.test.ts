// Cross-site requests riding the session cookie (plan 04-02; 04-RESEARCH Pitfall 5, T-04-01, T-04-32).
// Every cookie-authenticated write of the account API, with a signed-in browser's cookie, is refused
// without our own non-null Origin (403) and without a JSON body (415), and changes nothing. No GET
// changes anything: the write routes answer 405 to a GET, and GET /api/me only renews the caller's
// own session.

import { beforeEach, describe, expect, it } from "vitest";
import {
  del,
  get,
  type Jar,
  newJar,
  ORIGIN,
  post,
  resetAccounts,
  rows,
  signUpPerson,
} from "./helpers.ts";

beforeEach(resetAccounts);

/**
 * Every POST of the account API that a browser with a session cookie can reach (04-01 to 04-03). The
 * one DELETE, /api/auth/passkeys/:id, has no body: it needs the Origin only (passkeys.test.ts and
 * below).
 */
const WRITES = [
  "/api/auth/signup/options",
  "/api/auth/signup/verify",
  "/api/auth/login/options",
  "/api/auth/login/verify",
  "/api/auth/logout",
  "/api/auth/passkeys/options",
  "/api/auth/passkeys/verify",
  "/api/auth/backup-code/options",
  "/api/auth/backup-code/verify",
  // Plan 04-03: the recovery needs no session, but it is a write all the same (a new passkey, every
  // session ended, a new code), behind the same Origin and JSON checks.
  "/api/auth/recover",
  "/api/auth/recover/verify",
];

/** What D1 holds of the account, to prove a refused call changed nothing. */
async function snapshot(): Promise<string> {
  const tables = ["users", "passkeys", "sessions", "challenges", "invitations", "friendships"];
  const all: unknown[] = [];
  for (const table of tables) all.push(await rows(`SELECT * FROM ${table}`));
  return JSON.stringify(all, (_key, value) =>
    value instanceof ArrayBuffer ? [...new Uint8Array(value)] : value,
  );
}

async function signedIn(): Promise<Jar> {
  const jar = newJar();
  await signUpPerson("Zoé", jar);
  return jar;
}

describe("cookie-authenticated writes", () => {
  it("DELETE /api/auth/passkeys/:id without our non-null Origin: 403, the key stays", async () => {
    const jar = await signedIn();
    const [key] = await rows("SELECT id FROM passkeys");
    const before = await snapshot();
    for (const origin of [null, "https://evil.test", "null", "http://toc.test"]) {
      const response = await del(`/api/auth/passkeys/${key?.id}`, { jar: { ...jar }, origin });
      expect(response.status, String(origin)).toBe(403);
    }
    expect(await snapshot()).toBe(before);
  });

  it("no Origin, a foreign Origin or a null Origin: 403, and nothing changes", async () => {
    const jar = await signedIn();
    const before = await snapshot();
    for (const path of WRITES) {
      for (const origin of [null, "https://evil.test", "null", "http://toc.test"]) {
        const response = await post(path, {}, { jar: { ...jar }, origin });
        expect(response.status, `${path} ${origin}`).toBe(403);
        expect(await response.json()).toEqual({ error: "origin" });
        expect(response.headers.get("set-cookie"), path).toBeNull();
      }
    }
    expect(await snapshot()).toBe(before);
    expect((await get("/api/me", jar)).status).toBe(200);
  });

  it("our Origin but no JSON content type: 415, and nothing changes", async () => {
    const jar = await signedIn();
    const before = await snapshot();
    for (const path of WRITES) {
      for (const contentType of [
        "text/plain",
        "application/x-www-form-urlencoded",
        "multipart/form-data",
      ]) {
        const response = await post(path, "{}", { jar: { ...jar }, contentType });
        expect(response.status, `${path} ${contentType}`).toBe(415);
      }
    }
    expect(await snapshot()).toBe(before);
    expect((await get("/api/me", jar)).status).toBe(200);
  });

  it("a GET on a write route: 405, never a change", async () => {
    const jar = await signedIn();
    const before = await snapshot();
    for (const path of WRITES) {
      const response = await get(path, { ...jar });
      expect(response.status, path).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
    }
    expect(await snapshot()).toBe(before);
  });

  it("our own Origin and JSON: the logout goes through", async () => {
    const jar = await signedIn();
    const response = await post("/api/auth/logout", {}, { jar, origin: ORIGIN });
    expect(response.status).toBe(204);
    expect(await rows("SELECT * FROM sessions")).toEqual([]);
  });
});
