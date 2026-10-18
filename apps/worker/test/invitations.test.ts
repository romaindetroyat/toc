// Invitation links made by a player (plan 04-05, ACCT-03, D-03, D-06, D-11; 04-RESEARCH Pattern 5,
// T-04-04), in workerd with the tests' D1. A signed-in player creates a link (128 bits, SHA-256 at
// rest, single use, 7 days, at most 10 pending), lists and disables the pending ones; anyone holding
// the code reads its state, with own and friend for a signed-in caller; a signed-in proche accepts it
// in one call and becomes a friend; a proche without an account signs up through it (the 04-01
// batch). The D1 rows written by a creation and an acceptance are logged (x-toc-d1) for the SUMMARY.

import { INVITE_TTL_MS } from "@toc/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createLink,
  del,
  get,
  type Jar,
  newJar,
  post,
  resetAccounts,
  rows,
  sha256Url,
  signUpPerson,
  signUpWith,
} from "./helpers.ts";

beforeEach(resetAccounts);

const CODE_RE = /^[A-Za-z0-9_-]{22}$/;

/** A signed-in account and its browser. */
async function account(pseudo: string): Promise<{ jar: Jar; id: string }> {
  const jar = newJar();
  const person = await signUpPerson(pseudo, jar);
  return { jar, id: person.id };
}

async function stateOf(code: string, jar?: Jar): Promise<Record<string, unknown>> {
  const response = await get(`/api/invitations/${code}`, jar);
  expect(response.status).toBe(200);
  return (await response.json()) as Record<string, unknown>;
}

async function friendRows(): Promise<string[]> {
  return (await rows("SELECT user_id, friend_id FROM friendships ORDER BY user_id")).map(
    (row) => `${row.user_id}>${row.friend_id}`,
  );
}

describe("POST /api/invitations", () => {
  it("201 { id, code, expiresAt }: a 22-character code, only its SHA-256 in D1, 7 days", async () => {
    const zoe = await account("Zoé");
    const before = Date.now();
    const response = await post("/api/invitations", {}, { jar: zoe.jar });
    expect(response.status).toBe(201);
    console.log(`create link: x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    const link = (await response.json()) as { id: string; code: string; expiresAt: number };
    expect(link.code).toMatch(CODE_RE);
    expect(link.id).toMatch(CODE_RE);
    expect(link.id).not.toBe(link.code);
    expect(link.expiresAt).toBeGreaterThanOrEqual(before + INVITE_TTL_MS);
    expect(link.expiresAt).toBeLessThanOrEqual(Date.now() + INVITE_TTL_MS);

    const stored = await rows("SELECT * FROM invitations WHERE inviter_id = ?", zoe.id);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      code_hash: await sha256Url(link.code),
      id: link.id,
      kind: "link",
      expires_at: link.expiresAt,
      used_at: null,
      used_by: null,
    });
    // The code itself is nowhere in D1.
    expect(JSON.stringify(await rows("SELECT * FROM invitations"))).not.toContain(link.code);
  });

  it("needs a session (401), our Origin (403) and a JSON body (415)", async () => {
    const zoe = await account("Zoé");
    expect((await post("/api/invitations", {})).status).toBe(401);
    expect((await post("/api/invitations", {}, { jar: zoe.jar, origin: null })).status).toBe(403);
    expect(
      (await post("/api/invitations", {}, { jar: zoe.jar, origin: "https://evil.test" })).status,
    ).toBe(403);
    expect(
      (await post("/api/invitations", "{}", { jar: zoe.jar, contentType: "text/plain" })).status,
    ).toBe(415);
    expect((await post("/api/invitations", { x: 1 }, { jar: zoe.jar })).status).toBe(400);
    expect(await rows("SELECT * FROM invitations")).toHaveLength(0);
  });

  it("the 11th pending link is refused (409 limit); used and expired links do not count", async () => {
    const zoe = await account("Zoé");
    const links = [];
    for (let i = 0; i < 10; i++) links.push(await createLink(zoe.jar));
    const eleventh = await post("/api/invitations", {}, { jar: zoe.jar });
    expect(eleventh.status).toBe(409);
    expect(await eleventh.json()).toEqual({ error: "limit" });

    // One used and one expired: two more can be made, then the limit again.
    await rows("UPDATE invitations SET used_at = ? WHERE id = ?", Date.now(), links[0]?.id);
    await rows("UPDATE invitations SET expires_at = ? WHERE id = ?", Date.now() - 1, links[1]?.id);
    await createLink(zoe.jar);
    await createLink(zoe.jar);
    expect((await post("/api/invitations", {}, { jar: zoe.jar })).status).toBe(409);

    // Another account has its own ten.
    const yann = await account("Yann");
    await createLink(yann.jar);
  });

  it("parallel creations never pass 10 pending links", async () => {
    const zoe = await account("Zoé");
    const answers = await Promise.all(
      Array.from({ length: 16 }, () => post("/api/invitations", {}, { jar: zoe.jar })),
    );
    const statuses = answers.map((answer) => answer.status).sort();
    expect(statuses.filter((status) => status === 201)).toHaveLength(10);
    expect(statuses.filter((status) => status === 409)).toHaveLength(6);
    expect(await rows("SELECT id FROM invitations WHERE inviter_id = ?", zoe.id)).toHaveLength(10);
  });
});

describe("GET /api/invitations", () => {
  it("the caller's pending links only, newest first, without their codes", async () => {
    const zoe = await account("Zoé");
    const yann = await account("Yann");
    const a = await createLink(zoe.jar);
    const b = await createLink(zoe.jar);
    const used = await createLink(zoe.jar);
    const expired = await createLink(zoe.jar);
    await createLink(yann.jar);
    await rows("UPDATE invitations SET created_at = 1000 WHERE id = ?", a.id);
    await rows("UPDATE invitations SET created_at = 2000 WHERE id = ?", b.id);
    await rows("UPDATE invitations SET used_at = 3 WHERE id = ?", used.id);
    await rows("UPDATE invitations SET expires_at = 3 WHERE id = ?", expired.id);

    const response = await get("/api/invitations", zoe.jar);
    expect(response.status).toBe(200);
    const list = (await response.json()) as unknown[];
    expect(list).toEqual([
      { id: b.id, createdAt: 2000, expiresAt: b.expiresAt },
      { id: a.id, createdAt: 1000, expiresAt: a.expiresAt },
    ]);
    expect(JSON.stringify(list)).not.toContain(a.code);
  });

  it("401 signed out; the test invitations (no inviter) are nobody's", async () => {
    expect((await get("/api/invitations")).status).toBe(401);
    const zoe = await account("Zoé");
    expect(await (await get("/api/invitations", zoe.jar)).json()).toEqual([]);
  });
});

describe("DELETE /api/invitations/:id", () => {
  it("one's own pending link: 204, its code then answers unknown", async () => {
    const zoe = await account("Zoé");
    const link = await createLink(zoe.jar);
    const response = await del(`/api/invitations/${link.id}`, { jar: zoe.jar });
    expect(response.status).toBe(204);
    console.log(`disable link: x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    expect(await stateOf(link.code)).toEqual({ state: "unknown" });
    expect(await (await get("/api/invitations", zoe.jar)).json()).toEqual([]);
  });

  it("another account's link: 404 and it stays; a used link: 404; bad ids: 404", async () => {
    const zoe = await account("Zoé");
    const yann = await account("Yann");
    const link = await createLink(zoe.jar);
    expect((await del(`/api/invitations/${link.id}`, { jar: yann.jar })).status).toBe(404);
    expect((await stateOf(link.code)).state).toBe("ok");
    const used = await createLink(zoe.jar);
    await rows("UPDATE invitations SET used_at = 3 WHERE id = ?", used.id);
    expect((await del(`/api/invitations/${used.id}`, { jar: zoe.jar })).status).toBe(404);
    expect((await del("/api/invitations/short", { jar: zoe.jar })).status).toBe(404);
  });

  it("needs our Origin (403) and a session (401)", async () => {
    const zoe = await account("Zoé");
    const link = await createLink(zoe.jar);
    expect((await del(`/api/invitations/${link.id}`, { jar: zoe.jar, origin: null })).status).toBe(
      403,
    );
    expect((await del(`/api/invitations/${link.id}`)).status).toBe(401);
    expect((await stateOf(link.code)).state).toBe("ok");
  });
});

describe("GET /api/invitations/:code", () => {
  it("signed out: ok with the inviter's pseudo and the expiry, then used or expired", async () => {
    const zoe = await account("Zoé");
    const link = await createLink(zoe.jar);
    expect(await stateOf(link.code)).toEqual({
      state: "ok",
      inviter: "Zoé",
      expiresAt: link.expiresAt,
    });
    const expired = await createLink(zoe.jar);
    await rows("UPDATE invitations SET expires_at = 3 WHERE id = ?", expired.id);
    expect(await stateOf(expired.code)).toEqual({ state: "expired", inviter: "Zoé" });
    await rows("UPDATE invitations SET used_at = 3 WHERE id = ?", link.id);
    expect(await stateOf(link.code)).toEqual({ state: "used", inviter: "Zoé" });
  });

  it("signed in: own for the inviter, friend for a friend, ok for anyone else", async () => {
    const zoe = await account("Zoé");
    const first = await createLink(zoe.jar);
    const xavier = newJar();
    await signUpWith(first.code, "Xavier", xavier);
    const yann = await account("Yann");

    const link = await createLink(zoe.jar);
    expect(await stateOf(link.code, zoe.jar)).toEqual({
      state: "own",
      inviter: "Zoé",
      expiresAt: link.expiresAt,
    });
    expect(await stateOf(link.code, xavier)).toEqual({
      state: "friend",
      inviter: "Zoé",
      expiresAt: link.expiresAt,
    });
    expect(await stateOf(link.code, yann.jar)).toEqual({
      state: "ok",
      inviter: "Zoé",
      expiresAt: link.expiresAt,
    });
    // Used stays used whoever asks.
    expect(await stateOf(first.code, zoe.jar)).toEqual({ state: "used", inviter: "Zoé" });
  });
});

describe("POST /api/invitations/:code/accept", () => {
  it("someone else's valid link: 200 { friend }, two friendship rows, the link used", async () => {
    const zoe = await account("Zoé");
    const yann = await account("Yann");
    const link = await createLink(zoe.jar);
    const before = Date.now();
    const response = await post(`/api/invitations/${link.code}/accept`, {}, { jar: yann.jar });
    expect(response.status).toBe(200);
    console.log(`accept link: x-toc-d1 ${response.headers.get("x-toc-d1")}`);
    const body = (await response.json()) as { friend: { id: string; pseudo: string; since: number } };
    expect(body).toEqual({ friend: { id: zoe.id, pseudo: "Zoé", since: body.friend.since } });
    expect(body.friend.since).toBeGreaterThanOrEqual(before);
    expect(await friendRows()).toEqual([`${yann.id}>${zoe.id}`, `${zoe.id}>${yann.id}`].sort());
    const [row] = await rows("SELECT used_at, used_by FROM invitations WHERE id = ?", link.id);
    expect(row?.used_by).toBe(yann.id);
    expect(row?.used_at).toBeGreaterThanOrEqual(before);
    expect(await stateOf(link.code)).toEqual({ state: "used", inviter: "Zoé" });

    // Single use: a third person gets 410 used.
    const ana = await account("Ana");
    const again = await post(`/api/invitations/${link.code}/accept`, {}, { jar: ana.jar });
    expect(again.status).toBe(410);
    expect(await again.json()).toEqual({ error: "used" });
  });

  it("one's own link: 409 own and not spent", async () => {
    const zoe = await account("Zoé");
    const link = await createLink(zoe.jar);
    const response = await post(`/api/invitations/${link.code}/accept`, {}, { jar: zoe.jar });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "own" });
    expect((await stateOf(link.code)).state).toBe("ok");
    expect(await friendRows()).toEqual([]);
  });

  it("already friends: 200 { already: true, friend } and not spent", async () => {
    const zoe = await account("Zoé");
    const first = await createLink(zoe.jar);
    const xavier = newJar();
    const x = await signUpWith(first.code, "Xavier", xavier);
    const [since] = await rows(
      "SELECT created_at FROM friendships WHERE user_id = ? AND friend_id = ?",
      x.id,
      zoe.id,
    );
    const link = await createLink(zoe.jar);
    const response = await post(`/api/invitations/${link.code}/accept`, {}, { jar: xavier });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      already: true,
      friend: { id: zoe.id, pseudo: "Zoé", since: since?.created_at },
    });
    expect((await stateOf(link.code)).state).toBe("ok");
    expect(await friendRows()).toHaveLength(2);
  });

  it("used, expired and unknown codes: 410 with that state", async () => {
    const zoe = await account("Zoé");
    const yann = await account("Yann");
    const used = await createLink(zoe.jar);
    const expired = await createLink(zoe.jar);
    await rows("UPDATE invitations SET used_at = 3 WHERE id = ?", used.id);
    await rows("UPDATE invitations SET expires_at = 3 WHERE id = ?", expired.id);
    const cases: [string, string][] = [
      [used.code, "used"],
      [expired.code, "expired"],
      ["A".repeat(22), "unknown"],
      ["short", "unknown"],
    ];
    for (const [code, error] of cases) {
      const response = await post(`/api/invitations/${code}/accept`, {}, { jar: yann.jar });
      expect(response.status, code).toBe(410);
      expect(await response.json()).toEqual({ error });
    }
    // A test invitation has no inviter: nobody to befriend.
    const minted = (await (await post("/api/test/invitation", {})).json()) as { code: string };
    const orphan = await post(`/api/invitations/${minted.code}/accept`, {}, { jar: yann.jar });
    expect(orphan.status).toBe(410);
    expect(await friendRows()).toEqual([]);
  });

  it("needs our Origin (403), a JSON body (415) and a session (401)", async () => {
    const zoe = await account("Zoé");
    const yann = await account("Yann");
    const link = await createLink(zoe.jar);
    const path = `/api/invitations/${link.code}/accept`;
    expect((await post(path, {}, { jar: yann.jar, origin: null })).status).toBe(403);
    expect((await post(path, "{}", { jar: yann.jar, contentType: "text/plain" })).status).toBe(415);
    expect((await post(path, {})).status).toBe(401);
    expect((await get(path, yann.jar)).status).toBe(405);
    expect((await stateOf(link.code)).state).toBe("ok");
    expect(await friendRows()).toEqual([]);
  });
});

describe("sign-up through a player's link (D-06)", () => {
  it("the new account and the inviter are friends both ways, and the link is used", async () => {
    const zoe = await account("Zoé");
    const link = await createLink(zoe.jar);
    const lea = await signUpWith(link.code, "Léa");
    expect(await friendRows()).toEqual([`${lea.id}>${zoe.id}`, `${zoe.id}>${lea.id}`].sort());
    const [row] = await rows("SELECT used_by FROM invitations WHERE id = ?", link.id);
    expect(row?.used_by).toBe(lea.id);
    expect(await (await get("/api/invitations", zoe.jar)).json()).toEqual([]);
  });
});
