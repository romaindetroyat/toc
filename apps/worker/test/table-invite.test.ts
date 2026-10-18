// « Inviter » a friend to one's table in one call (plan 04-06, D-07, ACCT-04; 04-RESEARCH Pattern 10,
// T-04-09, T-04-50), in workerd with real sockets, the tests' D1 and real hubs. POST
// /api/tables/:id/invite { friendId }: a session and our Origin; only to a friend; only by a person of
// that table; only while it waits in its lobby; 30 invites an hour per sender. The friend's hub sends
// the notice when their app is open and visible (else « away », the push of 04-07). The same invite
// within 10 minutes is answered « sent » again without a second notice. The D1 rows of one invite are
// logged (x-toc-d1) for the SUMMARY.

import { env, runInDurableObject } from "cloudflare:test";
import { HUB_VERSION } from "@toc/protocol";
import type { Table } from "@toc/table";
import { beforeEach, describe, expect, it } from "vitest";
import { commit, load } from "../src/storage.ts";
import {
  type Client,
  connectAs,
  createTable,
  get,
  type HubClient,
  type Jar,
  newJar,
  openHub,
  post,
  resetAccounts,
  rows,
  signUpPerson,
  token,
} from "./helpers.ts";

beforeEach(resetAccounts);

type Account = { jar: Jar; id: string; pseudo: string };

const pseudo = (base: string) => `${base}${Math.floor(Math.random() * 1e5)}`;

async function account(base: string): Promise<Account> {
  const jar = newJar();
  const person = await signUpPerson(pseudo(base), jar);
  return { jar, id: person.id, pseudo: person.pseudo };
}

/** A friendship written directly (both rows). */
async function befriend(a: Account, b: Account): Promise<void> {
  const at = Date.now();
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

/** `who` at table `id` with their account (a hello on a socket carrying their cookie). */
async function atTable(id: string, who: Account, letter: string): Promise<Client> {
  const client = await connectAs(id, { jar: who.jar });
  client.send({ t: "hello", v: 5, token: token(letter), name: who.pseudo });
  await client.next("welcome");
  return client;
}

/** The hub socket of `who`, visible, once the hub has read hi and vis. */
async function visibleHub(who: Account): Promise<HubClient> {
  const hub = await openHub({ jar: who.jar });
  hub.send({ t: "hi", v: HUB_VERSION });
  hub.send({ t: "vis", visible: true });
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const seen = await runInDurableObject(env.PLAYER_HUB.getByName(who.id), (_hub, state) =>
      state.getWebSockets().map((ws) => ws.deserializeAttachment() as { visible?: boolean }),
    );
    if (seen.some((one) => one.visible === true)) return hub;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("the hub never saw the socket visible");
}

const invite = (
  id: string,
  friendId: string,
  from: Account,
  options: { origin?: string | null } = {},
) => post(`/api/tables/${id}/invite`, { friendId }, { jar: from.jar, ...options });

/** No new frame on `hub` after a short wait. */
async function quiet(hub: HubClient, count: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(hub.frames).toHaveLength(count);
}

/** A lobby table where A sits (by account), B is A's friend with the app open. */
async function scene() {
  const a = await account("Romain");
  const b = await account("Sœur");
  await befriend(a, b);
  const id = await createTable();
  const aSocket = await atTable(id, a, "a");
  const bHub = await visibleHub(b);
  return { a, b, id, aSocket, bHub };
}

/** The table's snapshot with another status (paused, finished: hard to reach through play). */
async function setStatus(id: string, status: Table["status"]): Promise<void> {
  await runInDurableObject(env.GAME_ROOM.getByName(id), (room, state) => {
    const table = load(state.storage.sql);
    if (table === null) throw new Error("no table");
    commit(state.storage.sql, { ...table, status }, [], Date.now());
    (room as unknown as { cached: unknown }).cached = undefined;
  });
}

describe("POST /api/tables/:id/invite", () => {
  it("a friend with the app open gets the notice at once; the same invite again sends nothing", async () => {
    const { a, b, id, aSocket, bHub } = await scene();
    const sent = await invite(id, b.id, a);
    expect(sent.status).toBe(200);
    expect(await sent.json()).toEqual({ state: "sent" });
    const frame = await bHub.next();
    expect(frame).toEqual({
      t: "notice",
      kind: "invite",
      table: id,
      from: a.pseudo,
      at: expect.any(Number),
    });
    // Nothing but the table, the pseudo and the kind: no account id.
    expect(JSON.stringify(frame)).not.toContain(a.id);
    expect(JSON.stringify(frame)).not.toContain(b.id);
    // D1: the session and the friendship are read, nothing is written (logged for the SUMMARY).
    console.log(`D1 rows of one table invite: ${sent.headers.get("x-toc-d1")}`);
    expect(sent.headers.get("x-toc-d1")).toMatch(/^w=0;/);

    const again = await invite(id, b.id, a);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ state: "sent" });
    await quiet(bHub, 1);
    aSocket.ws.close(1000);
    bHub.ws.close(1000);
  });

  it("a friend whose app is closed: sent all the same (the hub knows they are away)", async () => {
    const a = await account("Romain");
    const b = await account("Loin");
    await befriend(a, b);
    const id = await createTable();
    const aSocket = await atTable(id, a, "a");
    const sent = await invite(id, b.id, a);
    expect(sent.status).toBe(200);
    expect(await sent.json()).toEqual({ state: "sent" });
    // The hub remembered it: the same invite now is a dup, not a second push.
    expect(
      await env.PLAYER_HUB.getByName(b.id).notify({
        kind: "invite",
        table: id,
        from: a.pseudo,
        key: `${a.id}:${id}`,
      }),
    ).toBe("dup");
    aSocket.ws.close(1000);
  });

  it("not a friend: 403 not-friend, and the other gets nothing", async () => {
    const { a, id, aSocket } = await scene();
    const c = await account("Inconnu");
    const cHub = await visibleHub(c);
    const refused = await invite(id, c.id, a);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: "not-friend" });
    // Oneself is no friend either; nor is an id of no one.
    expect((await invite(id, a.id, a)).status).toBe(403);
    expect((await invite(id, "x".repeat(22), a)).status).toBe(403);
    await quiet(cHub, 0);
    aSocket.ws.close(1000);
    cHub.ws.close(1000);
  });

  it("the sender is not a person of the table: 403 not-here", async () => {
    const { b, bHub, id, aSocket } = await scene();
    const c = await account("Cousin");
    await befriend(c, b);
    const refused = await invite(id, b.id, c);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: "not-here" });
    await quiet(bHub, 0);
    aSocket.ws.close(1000);
    bHub.ws.close(1000);
  });

  it("a table playing, paused, saved or finished: 409 started, nothing sent", async () => {
    const { a, b, id, aSocket, bHub } = await scene();
    aSocket.send({ t: "sit", seat: "bleu" });
    await aSocket.next("welcome", (frame) => frame.you.seat === "bleu");
    aSocket.send({ t: "start" });
    await aSocket.next("table", (frame) => frame.table.status === "playing");
    const playing = await invite(id, b.id, a);
    expect(playing.status).toBe(409);
    expect(await playing.json()).toEqual({ error: "started" });
    aSocket.send({ t: "stop" });
    await aSocket.next("table", (frame) => frame.table.status === "saved");
    expect((await invite(id, b.id, a)).status).toBe(409);
    for (const status of ["paused", "finished"] as const) {
      await setStatus(id, status);
      const refused = await invite(id, b.id, a);
      expect(refused.status, status).toBe(409);
      expect(await refused.json()).toEqual({ error: "started" });
    }
    await quiet(bHub, 0);
    aSocket.ws.close(1000);
    bHub.ws.close(1000);
  });

  it("no such table: 404 (a malformed id too), nothing created", async () => {
    const { a, b, aSocket } = await scene();
    const unknown = await invite("Zz_unknown-invite-0000", b.id, a);
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "not-found" });
    expect((await invite("short", b.id, a)).status).toBe(404);
    expect(await env.GAME_ROOM.getByName("Zz_unknown-invite-0000").summary()).toBeNull();
    aSocket.ws.close(1000);
  });

  it("the friend is already at the table: 200 here, no notice", async () => {
    const { a, b, id, aSocket, bHub } = await scene();
    const bSocket = await atTable(id, b, "b");
    const here = await invite(id, b.id, a);
    expect(here.status).toBe(200);
    expect(await here.json()).toEqual({ state: "here" });
    await quiet(bHub, 0);
    aSocket.ws.close(1000);
    bSocket.ws.close(1000);
    bHub.ws.close(1000);
  });

  it("the 31st invite of a sender within an hour: 429 rate", async () => {
    const { a, b, id, aSocket, bHub } = await scene();
    for (let i = 0; i < 30; i++) {
      const sent = await invite(id, b.id, a);
      expect(sent.status, `invite ${i + 1}`).toBe(200);
    }
    const refused = await invite(id, b.id, a);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: "rate" });
    // One notice in all (the others were the same invite within 10 minutes).
    await quiet(bHub, 1);
    aSocket.ws.close(1000);
    bHub.ws.close(1000);
  });

  it("needs our Origin, JSON of the right shape and a session", async () => {
    const { a, b, id, aSocket } = await scene();
    expect((await invite(id, b.id, a, { origin: null })).status).toBe(403);
    expect((await invite(id, b.id, a, { origin: "https://evil.test" })).status).toBe(403);
    const form = await post(`/api/tables/${id}/invite`, `friendId=${b.id}`, {
      jar: a.jar,
      contentType: "application/x-www-form-urlencoded",
    });
    expect(form.status).toBe(415);
    expect((await post(`/api/tables/${id}/invite`, { friendId: 3 }, { jar: a.jar })).status).toBe(
      400,
    );
    expect(
      (await post(`/api/tables/${id}/invite`, { friendId: b.id, extra: 1 }, { jar: a.jar })).status,
    ).toBe(400);
    expect((await post(`/api/tables/${id}/invite`, { friendId: b.id })).status).toBe(401);
    expect((await get(`/api/tables/${id}/invite`, a.jar)).status).toBe(405);
    aSocket.ws.close(1000);
  });
});

describe("GameRoom.inviteInfo", () => {
  it("the status and who is there, from the people's accounts; null and nothing written for no table", async () => {
    const { a, b, id, aSocket } = await scene();
    const stub = env.GAME_ROOM.getByName(id);
    expect(await stub.inviteInfo({ sender: a.id, friend: b.id })).toEqual({
      status: "lobby",
      senderHere: true,
      friendHere: false,
    });
    expect(await stub.inviteInfo({ sender: b.id, friend: a.id })).toEqual({
      status: "lobby",
      senderHere: false,
      friendHere: true,
    });
    const none = env.GAME_ROOM.getByName("Zz_unknown-invite-0001");
    expect(await none.inviteInfo({ sender: a.id, friend: b.id })).toBeNull();
    const schema = await runInDurableObject(none, (_room, state) =>
      state.storage.sql.exec("SELECT name FROM sqlite_master").toArray(),
    );
    expect(schema.filter((row) => !String(row.name).startsWith("_"))).toEqual([]);
    aSocket.ws.close(1000);
  });
});
