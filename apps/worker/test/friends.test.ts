// Friend codes, the friends list and removing a friend (plan 04-05, ACCT-03, D-06; 04-RESEARCH
// Pattern 5, T-04-04), in workerd with the tests' D1 and real PlayerHubs. A signed-in player gets a
// short code (TOC-XXXX-XXXX: 8 Crockford symbols, 40 bits, 24 hours, the newest replaces the older
// one, kept as an HMAC under the pepper); another signed-in player redeems it. Failed codes are
// limited to 10 an hour per requester in the requester's hub, checked before any lookup. The list is
// in French alphabetical order; a removal deletes both directions. The D1 rows written by a code, a
// redemption and a removal are logged (x-toc-d1) for the SUMMARY.

import { env } from "cloudflare:test";
import { FRIEND_CODE_TTL_MS, formatFriendCode } from "@toc/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import {
  del,
  get,
  type Jar,
  newJar,
  post,
  resetAccounts,
  rows,
  sha256Url,
  signUpPerson,
} from "./helpers.ts";

beforeEach(resetAccounts);

const CODE_RE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/;

type Account = { jar: Jar; id: string; pseudo: string };

async function account(pseudo: string): Promise<Account> {
  const jar = newJar();
  const person = await signUpPerson(pseudo, jar);
  return { jar, id: person.id, pseudo: person.pseudo };
}

async function codeOf(who: Account): Promise<{ code: string; expiresAt: number }> {
  const response = await post("/api/friends/code", {}, { jar: who.jar });
  expect(response.status).toBe(201);
  return (await response.json()) as { code: string; expiresAt: number };
}

const redeem = (who: Account, code: string) =>
  post("/api/friends/code/redeem", { code }, { jar: who.jar });

async function friendRows(): Promise<string[]> {
  return (await rows("SELECT user_id, friend_id FROM friendships")).map(
    (row) => `${row.user_id}>${row.friend_id}`,
  );
}

/** A friendship written directly (both rows). */
async function befriend(a: Account, b: Account, at = Date.now()): Promise<void> {
  await rows(
    "INSERT INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?), (?, ?, ?)",
    a.id,
    b.id,
    at,
    b.id,
    a.id,
    at,
  );
}

/** A code that no account holds (all 8 symbols valid). */
const NOBODY = "ZZZZZZZZ";

describe("POST /api/friends/code", () => {
  it("201 { code, expiresAt }: 8 symbols, 24 hours, kept as an HMAC (never the code)", async () => {
    const zoe = await account("Zoé");
    const before = Date.now();
    const response = await post("/api/friends/code", {}, { jar: zoe.jar });
    expect(response.status).toBe(201);
    console.log(`friend code: x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    const body = (await response.json()) as { code: string; expiresAt: number };
    expect(body.code).toMatch(CODE_RE);
    expect(body.expiresAt).toBeGreaterThanOrEqual(before + FRIEND_CODE_TTL_MS);
    expect(body.expiresAt).toBeLessThanOrEqual(Date.now() + FRIEND_CODE_TTL_MS);

    const stored = await rows("SELECT * FROM invitations WHERE kind = 'code'");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ inviter_id: zoe.id, expires_at: body.expiresAt });
    expect(stored[0]?.code_hash).not.toBe(await sha256Url(body.code));
    const dump = JSON.stringify(await rows("SELECT * FROM invitations"));
    expect(dump).not.toContain(body.code);
    expect(dump).not.toContain(formatFriendCode(body.code));
  });

  it("a second code replaces the first: the old one is unknown", async () => {
    const zoe = await account("Zoé");
    const yann = await account("Yann");
    const first = await codeOf(zoe);
    const replacing = await post("/api/friends/code", {}, { jar: zoe.jar });
    expect(replacing.status).toBe(201);
    console.log(`friend code replacing one: x-toc-d1 ${replacing.headers.get("x-toc-d1")}`);
    const second = (await replacing.json()) as { code: string; expiresAt: number };
    expect(second.code).not.toBe(first.code);
    expect(await rows("SELECT id FROM invitations WHERE kind = 'code'")).toHaveLength(1);
    const old = await redeem(yann, first.code);
    expect(old.status).toBe(404);
    expect(await old.json()).toEqual({ error: "unknown" });
    expect((await redeem(yann, second.code)).status).toBe(200);
  });

  it("needs a session (401), our Origin (403) and a JSON body (415)", async () => {
    const zoe = await account("Zoé");
    expect((await post("/api/friends/code", {})).status).toBe(401);
    expect((await post("/api/friends/code", {}, { jar: zoe.jar, origin: null })).status).toBe(403);
    expect(
      (await post("/api/friends/code", "{}", { jar: zoe.jar, contentType: "text/plain" })).status,
    ).toBe(415);
    expect((await get("/api/friends/code", zoe.jar)).status).toBe(405);
    expect(await rows("SELECT id FROM invitations WHERE kind = 'code'")).toHaveLength(0);
  });
});

describe("POST /api/friends/code/redeem", () => {
  it("another player's code: 200 { friend }, two rows; the code stays valid until it expires", async () => {
    const zoe = await account("Zoé");
    const yann = await account("Yann");
    const ana = await account("Ana");
    const { code } = await codeOf(zoe);
    const before = Date.now();
    // As a person types it: lower case, the prefix, a space, O for 0, I or L for 1.
    const typed = formatFriendCode(code)
      .toLowerCase()
      .replace(/0/g, "o")
      .replace(/1/g, "l")
      .replace("-", " ");
    const response = await redeem(yann, typed);
    expect(response.status).toBe(200);
    console.log(`redeem friend code: x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    const body = (await response.json()) as { friend: { since: number } };
    expect(body).toEqual({ friend: { id: zoe.id, pseudo: "Zoé", since: body.friend.since } });
    expect(body.friend.since).toBeGreaterThanOrEqual(before);
    expect((await friendRows()).sort()).toEqual(
      [`${yann.id}>${zoe.id}`, `${zoe.id}>${yann.id}`].sort(),
    );

    // Not single use: Ana redeems it too.
    expect((await redeem(ana, code)).status).toBe(200);
    expect(await friendRows()).toHaveLength(4);
  });

  it("one's own code: 409 own; already friends: 200 { already: true, friend }", async () => {
    const zoe = await account("Zoé");
    const yann = await account("Yann");
    const { code } = await codeOf(zoe);
    const own = await redeem(zoe, code);
    expect(own.status).toBe(409);
    expect(await own.json()).toEqual({ error: "own" });

    await befriend(zoe, yann, 1234);
    const again = await redeem(yann, code);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({
      already: true,
      friend: { id: zoe.id, pseudo: "Zoé", since: 1234 },
    });
    expect(await friendRows()).toHaveLength(2);
  });

  it("bad format: 400 format; unknown or expired: 404 unknown", async () => {
    const zoe = await account("Zoé");
    const yann = await account("Yann");
    for (const code of ["TOC-ABCD-EFG", "ABCDEFGHJ", "", "TOC-UUUU-UUUU"]) {
      const response = await redeem(yann, code);
      expect(response.status, code).toBe(400);
      expect(await response.json()).toEqual({ error: "format" });
    }
    const unknown = await redeem(yann, NOBODY);
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "unknown" });
    const { code } = await codeOf(zoe);
    await rows("UPDATE invitations SET expires_at = 3 WHERE kind = 'code'");
    const expired = await redeem(yann, code);
    expect(expired.status).toBe(404);
    expect(await expired.json()).toEqual({ error: "unknown" });
    expect(await friendRows()).toEqual([]);
  });

  it("10 failures an hour: the 11th call is refused (429 rate) before any lookup", async () => {
    const zoe = await account("Zoé");
    const yann = await account("Yann");
    const { code } = await codeOf(zoe);
    // Bad formats are not counted.
    for (let i = 0; i < 12; i++) expect((await redeem(yann, "TOC-1")).status).toBe(400);
    for (let i = 0; i < 9; i++) expect((await redeem(yann, NOBODY)).status).toBe(404);
    // Neither are one's own code nor a friend's: Yann's own code, three times.
    const mine = await codeOf(yann);
    for (let i = 0; i < 3; i++) expect((await redeem(yann, mine.code)).status).toBe(409);
    expect((await redeem(yann, NOBODY)).status).toBe(404);
    // The eleventh: refused even with a valid code, which is never looked up.
    const refused = await redeem(yann, code);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: "rate" });
    expect(await friendRows()).toEqual([]);
    // The limit is the requester's: Ana still adds Zoé.
    const ana = await account("Ana");
    expect((await redeem(ana, code)).status).toBe(200);
  });

  it("parallel failures never let more than 10 lookups through", async () => {
    const yann = await account("Yann");
    const answers = await Promise.all(Array.from({ length: 14 }, () => redeem(yann, NOBODY)));
    const statuses = answers.map((answer) => answer.status);
    expect(statuses.filter((status) => status === 404)).toHaveLength(10);
    expect(statuses.filter((status) => status === 429)).toHaveLength(4);
  });

  it("needs our Origin (403) and a session (401)", async () => {
    const zoe = await account("Zoé");
    const yann = await account("Yann");
    const { code } = await codeOf(zoe);
    expect(
      (await post("/api/friends/code/redeem", { code }, { jar: yann.jar, origin: null })).status,
    ).toBe(403);
    expect((await post("/api/friends/code/redeem", { code })).status).toBe(401);
    expect((await post("/api/friends/code/redeem", { code, x: 1 }, { jar: yann.jar })).status).toBe(
      400,
    );
    expect(await friendRows()).toEqual([]);
  });

  it("the hub counts the failures under code-fail (one hour)", async () => {
    const yann = await account("Yann");
    for (let i = 0; i < 10; i++) await redeem(yann, NOBODY);
    const hub = env.PLAYER_HUB.getByName(yann.id);
    expect(
      await hub.allow({ kind: "code-fail", max: 10, windowMs: 3600_000, now: Date.now() }),
    ).toBe(false);
    expect(
      await hub.allow({
        kind: "code-fail",
        max: 10,
        windowMs: 3600_000,
        now: Date.now() + 3600_000,
      }),
    ).toBe(true);
  });
});

describe("GET /api/friends", () => {
  it("the caller's friends { id, pseudo, since } in French alphabetical order", async () => {
    const me = await account("Romain");
    const others = await Promise.all(
      ["Zoé", "émile", "Ana", "Élodie", "bruno"].map((pseudo) => account(pseudo)),
    );
    for (const [i, other] of others.entries()) await befriend(me, other, 1000 + i);
    const stranger = await account("Xavier");
    await befriend(others[0] as Account, stranger);

    const response = await get("/api/friends", me.jar);
    expect(response.status).toBe(200);
    console.log(`friends list: x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    const list = (await response.json()) as { id: string; pseudo: string; since: number }[];
    expect(list.map((friend) => friend.pseudo)).toEqual(["Ana", "bruno", "Élodie", "émile", "Zoé"]);
    const zoe = others[0] as Account;
    expect(list.at(-1)).toEqual({ id: zoe.id, pseudo: "Zoé", since: 1000 });
  });

  it("an empty list without friends; 401 signed out", async () => {
    const zoe = await account("Zoé");
    expect(await (await get("/api/friends", zoe.jar)).json()).toEqual([]);
    expect((await get("/api/friends")).status).toBe(401);
  });
});

describe("DELETE /api/friends/:id", () => {
  it("204 and both rows gone; then 404", async () => {
    const zoe = await account("Zoé");
    const yann = await account("Yann");
    const ana = await account("Ana");
    await befriend(zoe, yann);
    await befriend(zoe, ana);
    const response = await del(`/api/friends/${yann.id}`, { jar: zoe.jar });
    expect(response.status).toBe(204);
    console.log(`remove friend: x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    expect((await friendRows()).sort()).toEqual(
      [`${ana.id}>${zoe.id}`, `${zoe.id}>${ana.id}`].sort(),
    );
    expect(await (await get("/api/friends", yann.jar)).json()).toEqual([]);
    expect((await del(`/api/friends/${yann.id}`, { jar: zoe.jar })).status).toBe(404);
  });

  it("not a friend or a bad id: 404; our Origin (403) and a session (401) first", async () => {
    const zoe = await account("Zoé");
    const yann = await account("Yann");
    await befriend(zoe, yann);
    const ana = await account("Ana");
    expect((await del(`/api/friends/${ana.id}`, { jar: zoe.jar })).status).toBe(404);
    expect((await del("/api/friends/nope", { jar: zoe.jar })).status).toBe(404);
    expect((await del(`/api/friends/${yann.id}`, { jar: zoe.jar, origin: null })).status).toBe(403);
    expect((await del(`/api/friends/${yann.id}`)).status).toBe(401);
    expect(await friendRows()).toHaveLength(2);
  });
});
