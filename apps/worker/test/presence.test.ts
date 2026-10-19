// The app's own socket to its PlayerHub and the presence it gives (plan 04-06, D-07, D-08;
// 04-RESEARCH Pattern 6, Pitfall 1, T-04-49, T-04-51), in workerd with real hibernatable sockets and
// the tests' D1. GET /ws/me needs a session cookie and our own non-null Origin; the Worker forwards
// the account it read from the cookie, never the client's. The hub, not the browser, decides who is
// present: an open socket that said hi, whose last vis was visible and whose last sign of life (a
// frame, or a ping answered by the runtime) is under 45 s old. notify answers notice (and sends the
// frame to the visible sockets), away or dup (the same invite within 10 minutes, the same turn key).

import { env, runInDurableObject } from "cloudflare:test";
import { CLOSE_VERSION, HUB_VERSION } from "@toc/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type HubClient,
  hubUpgrade,
  type Jar,
  newJar,
  openHub,
  resetAccounts,
  signUpPerson,
} from "./helpers.ts";

beforeEach(resetAccounts);

const MINUTE = 60_000;
const TABLE = "abcdefghijklmnopqrstuv";
const OTHER_TABLE = "ABCDEFGHIJKLMNOPQRSTUV";

type Account = { jar: Jar; id: string; pseudo: string };

/** The pseudo of a test account: unique enough, at most 20 characters. */
const pseudo = (base: string) => `${base}${Math.floor(Math.random() * 1e6)}`;

async function account(base: string): Promise<Account> {
  const jar = newJar();
  const person = await signUpPerson(pseudo(base), jar);
  return { jar, id: person.id, pseudo: person.pseudo };
}

const hubOf = (id: string) => env.PLAYER_HUB.getByName(id);

type Seen = { hi?: boolean; visible?: boolean; seenAt?: number };

/** The hub's sockets' attachments, read inside the object. */
function attachments(id: string): Promise<Seen[]> {
  return runInDurableObject(hubOf(id), (_hub, state) =>
    state.getWebSockets().map((ws) => (ws.deserializeAttachment() ?? {}) as Seen),
  );
}

/** Waits (wall time) until the hub's sockets pass `check`. */
async function until(id: string, check: (seen: Seen[]) => boolean): Promise<Seen[]> {
  const deadline = Date.now() + 10_000;
  let seen: Seen[] = [];
  while (Date.now() < deadline) {
    seen = await attachments(id);
    if (check(seen)) return seen;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`hub sockets never matched: ${JSON.stringify(seen)}`);
}

/** A hub socket of `who` that said hi and reported `visible`, once the hub has read both. */
async function present(who: Account, visible = true): Promise<HubClient> {
  const matching = (seen: Seen[]) =>
    seen.filter((one) => one.hi === true && one.visible === visible).length;
  const before = await attachments(who.id);
  const hub = await openHub({ jar: who.jar });
  hub.send({ t: "hi", v: HUB_VERSION });
  hub.send({ t: "vis", visible });
  await until(
    who.id,
    (seen) => seen.length === before.length + 1 && matching(seen) === matching(before) + 1,
  );
  return hub;
}

/** Waits for every hub socket of `id` that said hi to have reported these visibilities. */
async function settled(id: string, visible: boolean[]): Promise<void> {
  const want = [...visible].sort().join();
  await until(
    id,
    (seen) =>
      seen
        .filter((one) => one.hi === true)
        .map((one) => one.visible === true)
        .sort()
        .join() === want,
  );
}

const invite = (from = "Romain", key = `sender:${TABLE}`, now?: number) => ({
  kind: "invite" as const,
  table: TABLE,
  from,
  key,
  ...(now === undefined ? {} : { now }),
});

/** No frame came to `hub` within a short wait (the frames of notify are sent before it answers). */
async function quiet(hub: HubClient): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(hub.frames).toEqual([]);
}

describe("GET /ws/me", () => {
  it("426 without Upgrade, 401 without a session, 403 without our non-null Origin, else 101", async () => {
    const who = await account("Lou");
    expect((await hubUpgrade({ jar: who.jar, upgrade: false })).status).toBe(426);
    expect((await hubUpgrade({})).status).toBe(401);
    expect((await hubUpgrade({ jar: { cookie: "toc_session=nope" } })).status).toBe(401);
    expect((await hubUpgrade({ jar: who.jar, origin: null })).status).toBe(403);
    expect((await hubUpgrade({ jar: who.jar, origin: "null" })).status).toBe(403);
    expect((await hubUpgrade({ jar: who.jar, origin: "https://evil.test" })).status).toBe(403);
    const opened = await hubUpgrade({ jar: who.jar });
    expect(opened.status).toBe(101);
    opened.webSocket?.accept();
    opened.webSocket?.close(1000);
  });

  it("the hub is the cookie's account: a forged x-toc-account reaches nobody else", async () => {
    const mallory = await account("Mal");
    const victim = await account("Vic");
    const hub = await openHub({ jar: mallory.jar, headers: { "x-toc-account": victim.id } });
    hub.send({ t: "hi", v: HUB_VERSION });
    hub.send({ t: "vis", visible: true });
    await settled(mallory.id, [true]);
    expect(await attachments(victim.id)).toEqual([]);
    expect(await hubOf(victim.id).notify(invite())).toBe("away");
    expect(await hubOf(mallory.id).notify(invite())).toBe("notice");
    hub.ws.close(1000);
  });
});

describe("the hub's socket", () => {
  it("a hi of another version is closed with 4002", async () => {
    const who = await account("Ver");
    const hub = await openHub({ jar: who.jar });
    hub.send({ t: "hi", v: HUB_VERSION + 1 });
    expect((await hub.closed).code).toBe(CLOSE_VERSION);
  });

  it("frames before hi are ignored; vis then sets the socket's visibility and its time", async () => {
    const who = await account("Avant");
    const hub = await openHub({ jar: who.jar });
    hub.send({ t: "vis", visible: true });
    hub.send("not json");
    hub.send({ t: "vis", visible: "yes" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await hubOf(who.id).notify(invite())).toBe("away");
    const before = Date.now();
    hub.send({ t: "hi", v: HUB_VERSION });
    hub.send({ t: "vis", visible: true });
    const [seen] = await until(who.id, (all) => all[0]?.visible === true);
    expect(seen?.hi).toBe(true);
    expect(seen?.seenAt).toBeGreaterThanOrEqual(before);
    expect(hub.frames).toEqual([]);
    hub.ws.close(1000);
  });
});

describe("presence and notify", () => {
  it("visible: notice, and the socket receives the frame (the table, the pseudo, the kind)", async () => {
    const who = await account("Sœur");
    const hub = await present(who);
    const before = Date.now();
    expect(await hubOf(who.id).notify(invite("Romain"))).toBe("notice");
    const frame = await hub.next();
    expect(frame).toEqual({
      t: "notice",
      kind: "invite",
      table: TABLE,
      from: "Romain",
      at: expect.any(Number),
    });
    expect(frame.at as number).toBeGreaterThanOrEqual(before);
    // Nothing else crosses: no account id, no key.
    expect(JSON.stringify(frame)).not.toContain(who.id);
    expect(JSON.stringify(frame)).not.toContain("sender:");
    hub.ws.close(1000);
  });

  it("a turn carries own and resumed when given", async () => {
    const who = await account("Tour");
    const hub = await present(who);
    const answer = await hubOf(who.id).notify({
      kind: "turn",
      table: TABLE,
      from: "Romain",
      own: true,
      resumed: true,
      key: `${TABLE}:pause-1`,
    });
    expect(answer).toBe("notice");
    expect(await hub.next()).toMatchObject({ t: "notice", kind: "turn", own: true, resumed: true });
    hub.ws.close(1000);
  });

  it("hidden: away and no frame; visible again: notice", async () => {
    const who = await account("Cache");
    const hub = await present(who, false);
    expect(await hubOf(who.id).notify(invite("A", "a:1"))).toBe("away");
    await quiet(hub);
    hub.send({ t: "vis", visible: true });
    await settled(who.id, [true]);
    expect(await hubOf(who.id).notify(invite("B", "b:1"))).toBe("notice");
    expect(await hub.next()).toMatchObject({ from: "B" });
    hub.send({ t: "vis", visible: false });
    await settled(who.id, [false]);
    expect(await hubOf(who.id).notify(invite("C", "c:1"))).toBe("away");
    hub.ws.close(1000);
  });

  it("no socket: away; a closed socket: away", async () => {
    const who = await account("Parti");
    expect(await hubOf(who.id).notify(invite())).toBe("away");
    const hub = await present(who);
    hub.ws.close(1000);
    await until(who.id, (seen) => seen.length === 0);
    expect(await hubOf(who.id).notify(invite("Autre", "autre:1"))).toBe("away");
  });

  it("a visible socket silent for more than 45 s is away; at 45 s it is still present", async () => {
    const who = await account("Muet");
    const hub = await present(who);
    const [seen] = await attachments(who.id);
    const seenAt = seen?.seenAt ?? 0;
    expect(await hubOf(who.id).notify(invite("A", "a:1", seenAt + 45_000))).toBe("notice");
    expect(await hubOf(who.id).notify(invite("B", "b:1", seenAt + 45_001 + 1_000))).toBe("away");
    hub.ws.close(1000);
  });

  it("a ping answered by the runtime counts as a sign of life", async () => {
    const who = await account("Ping");
    const hub = await present(who);
    // The socket's last frame is made old; the runtime's pong is the only recent sign of life.
    await runInDurableObject(hubOf(who.id), (_hub, state) => {
      for (const ws of state.getWebSockets()) {
        const seen = ws.deserializeAttachment() as Seen;
        ws.serializeAttachment({ ...seen, seenAt: Date.now() - 10 * MINUTE });
      }
    });
    expect(await hubOf(who.id).notify(invite("A", "a:1"))).toBe("away");
    await hub.ping();
    expect(await hubOf(who.id).notify(invite("B", "b:1"))).toBe("notice");
    expect(await hub.next()).toMatchObject({ from: "B" });
    hub.ws.close(1000);
  });

  it("two sockets, one visible: notice to the visible one only", async () => {
    const who = await account("Deux");
    const shown = await present(who, true);
    const hidden = await present(who, false);
    await settled(who.id, [true, false]);
    expect(await hubOf(who.id).notify(invite())).toBe("notice");
    expect(await shown.next()).toMatchObject({ t: "notice", kind: "invite" });
    await quiet(hidden);
    shown.ws.close(1000);
    hidden.ws.close(1000);
  });
});

describe("dedupe", () => {
  it("the same invite (sender, table) within 10 minutes: dup and no frame; after: sent again", async () => {
    const who = await account("Dup");
    const hub = await present(who);
    const t0 = Date.now();
    expect(await hubOf(who.id).notify(invite("R", "s1:t", t0))).toBe("notice");
    await hub.next();
    expect(await hubOf(who.id).notify(invite("R", "s1:t", t0 + 9 * MINUTE))).toBe("dup");
    // Another sender, or another table, is another invite.
    expect(await hubOf(who.id).notify(invite("S", "s2:t", t0 + 10))).toBe("notice");
    await hub.next();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(hub.frames).toHaveLength(2);
    // Ten minutes after the first: sent again (as a notice when the app is there, else away).
    const later = t0 + 10 * MINUTE + 1;
    expect(await hubOf(who.id).notify(invite("R", "s1:t", later))).not.toBe("dup");
    hub.ws.close(1000);
  });

  it("an invite while away is remembered too (the push of 04-07 is not sent twice)", async () => {
    const who = await account("Loin");
    expect(await hubOf(who.id).notify(invite("R", "s1:t"))).toBe("away");
    expect(await hubOf(who.id).notify(invite("R", "s1:t"))).toBe("dup");
  });

  it("a turn with the same table and pause key twice: dup; another pause: notice", async () => {
    const who = await account("Pause");
    const hub = await present(who);
    const turn = (key: string, table = TABLE) => ({ kind: "turn" as const, table, from: "R", key });
    expect(await hubOf(who.id).notify(turn(`${TABLE}:p1`))).toBe("notice");
    expect(await hubOf(who.id).notify(turn(`${TABLE}:p1`))).toBe("dup");
    expect(await hubOf(who.id).notify(turn(`${TABLE}:p2`))).toBe("notice");
    expect(await hubOf(who.id).notify(turn(`${OTHER_TABLE}:p1`, OTHER_TABLE))).toBe("notice");
    // An invite with the same key is another kind: not a dup of the turn.
    expect(await hubOf(who.id).notify({ ...invite("R", `${TABLE}:p1`) })).toBe("notice");
    hub.ws.close(1000);
  });
});
