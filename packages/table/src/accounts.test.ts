// The account at the table (plan 04-04, D-05, D-12; 04-RESEARCH Pattern 4 « Person identity with
// accounts »). The Durable Object hashes the ids (device, guest, account) and the pure core picks the
// person with the four rules, links seats to accounts and lists the members rows to write; no frame
// ever carries an account id. Every case gives its clock explicitly.

import type { Rng } from "@toc/engine";
import type { ServerFrame } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import {
  copyTable,
  createTable,
  type Out,
  personOf,
  type Reduced,
  reduce,
  resolveWho,
  type Table,
  tablePublic,
  welcomeFor,
} from "./index.ts";
import { frameProblems, personSecrets } from "./oracle.ts";

const ID = "abcdefghijklmnopqrstuv";
const ctx = (now: number) => ({ now, seed: (): Rng => [11, 22, 33, 44] });

type Command = Parameters<typeof reduce>[1];
type ClientFrameOf = Extract<Command, { t: "client" }>["frame"];
const client = (who: string, frame: ClientFrameOf): Command => ({ t: "client", who, frame });

/** Léa's ids at this table: her phone (device and guest hashes), her account. */
const PHONE = "who-phone";
const PHONE_GUEST = "who-phone-guest";
const LAPTOP = "who-laptop";
const LAPTOP_GUEST = "who-laptop-guest";
const LEA = { id: "acct-lea-0123456789abcd", pseudo: "Léonie" };
const LEA_WHO = "who-acct-lea";
const PAUL = { id: "acct-paul-123456789abcd", pseudo: "Paulo" };
const PAUL_WHO = "who-acct-paul";
const BEN = "who-ben";

function run(table: Table, commands: Command[], now: number): Reduced & { all: Out[] } {
  let result: Reduced = { table, out: [], log: [] };
  const all: Out[] = [];
  for (const command of commands) {
    result = reduce(result.table, command, ctx(now));
    all.push(...result.out);
  }
  return { ...result, all };
}

const fresh = () =>
  createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8], test: { pace: "zero" } });

/** Léa as a guest on her phone, seated bleu (creator); Ben seated jaune. */
function guestLobby(): Table {
  return run(
    fresh(),
    [
      { t: "hello", who: PHONE, name: "Léo" },
      { t: "hello", who: BEN, name: "Ben" },
      client(PHONE, { t: "sit", seat: "bleu" }),
      client(BEN, { t: "sit", seat: "jaune" }),
    ],
    1000,
  ).table;
}

/** The phone signs in: its hello carries Léa's account (rule 2). */
function linkedLobby(): Table {
  const table = guestLobby();
  return reduce(table, { t: "hello", who: PHONE, name: "Léo", account: LEA }, ctx(2000)).table;
}

describe("resolveWho, the four rules of 04-RESEARCH Pattern 4", () => {
  const ids = (device: string, guest: string, account: { id: string; who: string } | null) => ({
    device,
    guest,
    account,
  });

  it("rule 1: an account with a linked person gets that person, whatever the device", () => {
    const table = linkedLobby();
    expect(resolveWho(table, ids(LAPTOP, LAPTOP_GUEST, { id: LEA.id, who: LEA_WHO }))).toBe(PHONE);
    expect(resolveWho(table, ids(PHONE, PHONE_GUEST, { id: LEA.id, who: LEA_WHO }))).toBe(PHONE);
  });

  it("rule 2: an account and the device's unlinked person → the device person, to be linked", () => {
    const table = guestLobby();
    expect(resolveWho(table, ids(PHONE, PHONE_GUEST, { id: LEA.id, who: LEA_WHO }))).toBe(PHONE);
  });

  it("rule 3: an account with no person here, or a device person linked to someone else → a new person", () => {
    expect(resolveWho(guestLobby(), ids(LAPTOP, LAPTOP_GUEST, { id: LEA.id, who: LEA_WHO }))).toBe(
      LEA_WHO,
    );
    // Paul signs in on Léa's phone: the phone's person is Léa's, so Paul gets his own.
    expect(resolveWho(linkedLobby(), ids(PHONE, PHONE_GUEST, { id: PAUL.id, who: PAUL_WHO }))).toBe(
      PAUL_WHO,
    );
  });

  it("rule 4: a signed-out device whose person is linked comes in as a new guest", () => {
    expect(resolveWho(linkedLobby(), ids(PHONE, PHONE_GUEST, null))).toBe(PHONE_GUEST);
  });

  it("a guest device keeps the phase-2 person", () => {
    expect(resolveWho(guestLobby(), ids(PHONE, PHONE_GUEST, null))).toBe(PHONE);
    expect(resolveWho(guestLobby(), ids(LAPTOP, LAPTOP_GUEST, null))).toBe(LAPTOP);
  });
});

describe("the hello links a person to an account", () => {
  it("rule 2: same who, same seat, still the creator, the name is now the pseudo", () => {
    const before = guestLobby();
    const result = reduce(before, { t: "hello", who: PHONE, name: "Léo", account: LEA }, ctx(2000));
    const person = personOf(result.table, PHONE);
    expect(person).toMatchObject({ who: PHONE, seat: "bleu", name: "Léonie", account: LEA.id });
    expect(result.table.creator).toBe(PHONE);
    expect(result.table.seats.bleu).toEqual({ kind: "human", who: PHONE });
    expect(result.members).toEqual([{ account: LEA.id, seat: "bleu" }]);
    const welcome = result.out.find((each) => each.to === PHONE)?.frame;
    expect(welcome).toMatchObject({ t: "welcome", you: { seat: "bleu" } });
    expect(tablePublic(result.table).seats.bleu.name).toBe("Léonie");
  });

  it("a linked person's name follows the pseudo, never hello.name", () => {
    const table = linkedLobby();
    const renamed = reduce(
      table,
      { t: "hello", who: PHONE, name: "Autre", account: { id: LEA.id, pseudo: "Léa" } },
      ctx(3000),
    ).table;
    expect(personOf(renamed, PHONE)?.name).toBe("Léa");
    // A hello without an account never renames a linked person (the Durable Object's rule 4 keeps
    // such a socket off this person; the core holds the line too).
    const guest = reduce(table, { t: "hello", who: PHONE, name: "Intrus" }, ctx(3000));
    expect(personOf(guest.table, PHONE)).toMatchObject({ name: "Léonie", account: LEA.id });
    expect(guest.members).toBeUndefined();
  });

  it("never relinks a person linked to another account", () => {
    const table = linkedLobby();
    const result = reduce(
      table,
      { t: "hello", who: PHONE, name: "Paulo", account: PAUL },
      ctx(3000),
    );
    expect(personOf(result.table, PHONE)).toMatchObject({ account: LEA.id, name: "Léonie" });
    expect(result.members).toBeUndefined();
  });

  it("rule 3: a new person named by the pseudo, linked, unseated; sitting writes its row", () => {
    const table = guestLobby();
    const hello = reduce(
      table,
      { t: "hello", who: LEA_WHO, name: "ignored", account: LEA },
      ctx(2000),
    );
    expect(personOf(hello.table, LEA_WHO)).toEqual({
      who: LEA_WHO,
      name: "Léonie",
      seat: null,
      online: true,
      account: LEA.id,
    });
    expect(hello.members).toEqual([{ account: LEA.id, seat: null }]);
    const sat = reduce(hello.table, client(LEA_WHO, { t: "sit", seat: "rouge" }), ctx(2100));
    expect(sat.members).toEqual([{ account: LEA.id, seat: "rouge" }]);
  });

  it("a guest's hello stays the phase-2 one: no account, no members", () => {
    const result = reduce(fresh(), { t: "hello", who: BEN, name: "Ben" }, ctx(1000));
    expect(personOf(result.table, BEN)).toEqual({
      who: BEN,
      name: "Ben",
      seat: null,
      online: true,
      account: null,
    });
    expect(result.members).toBeUndefined();
  });

  it("a hello that links nothing new writes no members row (rule 1 on another device)", () => {
    const table = linkedLobby();
    const again = reduce(table, { t: "hello", who: PHONE, name: "x", account: LEA }, ctx(3000));
    expect(again.members).toBeUndefined();
  });
});

describe("the members outbox", () => {
  it("lists a linked person who sits, stands, is moved or leaves; never a guest", () => {
    const table = linkedLobby();
    const stood = reduce(table, client(PHONE, { t: "stand" }), ctx(3000));
    expect(stood.members).toEqual([{ account: LEA.id, seat: null }]);
    const sat = reduce(stood.table, client(PHONE, { t: "sit", seat: "rouge" }), ctx(3100));
    expect(sat.members).toEqual([{ account: LEA.id, seat: "rouge" }]);
    // The creator moves herself to vert.
    const moved = reduce(
      sat.table,
      client(PHONE, { t: "move", who: "rouge", to: "vert" }),
      ctx(3200),
    );
    expect(moved.members).toEqual([{ account: LEA.id, seat: "vert" }]);
    // Ben (a guest) moves: nothing to write.
    const benMoved = reduce(
      moved.table,
      client(PHONE, { t: "move", who: "jaune", to: "rouge" }),
      ctx(3300),
    );
    expect(benMoved.members).toBeUndefined();
    const left = reduce(benMoved.table, client(PHONE, { t: "leave" }), ctx(3400));
    expect(left.members).toEqual([{ account: LEA.id, seat: null }]);
  });

  it("lists a linked person who leaves the waiting room for good", () => {
    // Paul (not the creator) is linked and seated; « Quitter la table » removes him.
    const table = run(
      linkedLobby(),
      [
        { t: "hello", who: PAUL_WHO, name: "x", account: PAUL },
        client(PAUL_WHO, { t: "sit", seat: "vert" }),
      ],
      3000,
    ).table;
    const left = reduce(table, client(PAUL_WHO, { t: "leave" }), ctx(3100));
    expect(personOf(left.table, PAUL_WHO)).toBeUndefined();
    expect(left.members).toEqual([{ account: PAUL.id, seat: null }]);
  });
});

describe("older snapshots and frames", () => {
  it("copyTable gives every person of an older snapshot account null", () => {
    const table = guestLobby();
    const old = JSON.parse(JSON.stringify(table)) as Table;
    for (const person of old.people) delete (person as { account?: unknown }).account;
    const copy = copyTable(old);
    expect(copy.people.map((person) => person.account)).toEqual([null, null]);
    // An older snapshot's guest still signs in by rule 2.
    const linked = reduce(old, { t: "hello", who: PHONE, name: "Léo", account: LEA }, ctx(2000));
    expect(personOf(linked.table, PHONE)?.account).toBe(LEA.id);
  });

  it("no frame carries an account id, and the oracle refuses one that does", () => {
    const table = linkedLobby();
    const steps = run(
      table,
      [
        { t: "hello", who: PAUL_WHO, name: "x", account: PAUL },
        client(PAUL_WHO, { t: "sit", seat: "vert" }),
        client(PHONE, { t: "sit", seat: "rouge" }),
        client(PHONE, { t: "start" }),
      ],
      3000,
    );
    const secrets = personSecrets(steps.table);
    expect(secrets).toEqual(expect.arrayContaining([LEA.id, PAUL.id, PHONE, PAUL_WHO]));
    const texts = [
      ...steps.all.map((each) => JSON.stringify(each.frame)),
      JSON.stringify(welcomeFor(steps.table, PHONE)),
      JSON.stringify(tablePublic(steps.table)),
    ];
    for (const text of texts) {
      expect(text).not.toContain(LEA.id);
      expect(text).not.toContain(PAUL.id);
    }
    const welcome = welcomeFor(steps.table, PHONE);
    expect(frameProblems(welcome, steps.table.game, "rouge", secrets)).toEqual([]);
    const leaky = { ...welcome, table: { ...welcome.table, creatorName: LEA.id } };
    expect(frameProblems(leaky, steps.table.game, "rouge", secrets)).not.toEqual([]);
    // A key named account is refused whatever its value.
    const keyed = { ...welcome, account: "x" } as unknown as ServerFrame;
    expect(frameProblems(keyed, steps.table.game, "rouge")).toContain(
      "forbidden key frame.account",
    );
  });
});

describe("rule 4 in the reducer: a signed-out device cannot take a linked seat", () => {
  it("comes in as a new unseated guest; the game stays paused for the seat", () => {
    const lobby = run(linkedLobby(), [client(PHONE, { t: "start" })], 3000).table;
    expect(lobby.status).toBe("playing");
    const gone = reduce(lobby, { t: "gone", who: PHONE }, ctx(4000)).table;
    expect(gone.status).toBe("paused");
    expect(gone.pause?.missing).toEqual(["bleu"]);
    // The phone, signed out, says hello: the Durable Object resolved it to its guest id.
    const who = resolveWho(gone, { device: PHONE, guest: PHONE_GUEST, account: null });
    const result = reduce(gone, { t: "hello", who, name: "Léo" }, ctx(5000));
    expect(personOf(result.table, PHONE_GUEST)).toMatchObject({ seat: null, account: null });
    expect(result.table.seats.bleu).toEqual({ kind: "human", who: PHONE });
    expect(result.table.status).toBe("paused");
    expect(result.table.pause?.missing).toEqual(["bleu"]);
    const welcome = result.out.find((each) => each.to === PHONE_GUEST)?.frame;
    expect(welcome).toMatchObject({ t: "welcome", you: { seat: null } });
    expect(result.members).toBeUndefined();
    // Signed in again (rule 1), the account's person is back on bleu and the game goes on.
    const back = resolveWho(result.table, {
      device: PHONE,
      guest: PHONE_GUEST,
      account: { id: LEA.id, who: LEA_WHO },
    });
    expect(back).toBe(PHONE);
    const resumed = reduce(
      result.table,
      { t: "hello", who: back, name: "Léo", account: LEA },
      ctx(6000),
    );
    expect(resumed.table.status).toBe("playing");
  });
});
