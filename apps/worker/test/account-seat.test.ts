// The account at the table (plan 04-04, D-05, D-12; 04-RESEARCH Pattern 4, T-04-02, T-04-08,
// T-04-13), in workerd with real sockets, real SQLite and the tests' D1. The Worker reads the session
// cookie on the upgrade and forwards x-toc-account / x-toc-pseudo, which it alone sets; the GameRoom
// resolves the person with the four rules and writes table_members after the commit. A guest keeps
// the phase-2 path.

import { env, runInDurableObject } from "cloudflare:test";
import { type ServerFrame, toBase64Url } from "@toc/protocol";
import type { Table } from "@toc/table";
import { beforeEach, describe, expect, it } from "vitest";
import { writeMembers } from "../src/members.ts";
import { load } from "../src/storage.ts";
import {
  type Client,
  connect,
  connectAs,
  createTable,
  del,
  get,
  type Jar,
  newJar,
  type Person,
  resetAccounts,
  rows,
  signUpPerson,
  token,
  untilRows,
  upgrade,
} from "./helpers.ts";

beforeEach(resetAccounts);

const stubOf = (id: string) => env.GAME_ROOM.getByName(id);

async function readTable(id: string): Promise<Table> {
  const table = await runInDurableObject(stubOf(id), (_room, state) => load(state.storage.sql));
  if (table === null) throw new Error("no table");
  return table;
}

const MEMBERS = "SELECT user_id, table_id, seat FROM table_members ORDER BY user_id";

/** A socket's hello, and the welcome that answers it. */
async function hello(client: Client, letter: string, name: string) {
  client.send({ t: "hello", v: 6, token: token(letter), name });
  return client.next("welcome");
}

/** The pseudo of a test account: unique enough, at most 20 characters. */
const pseudo = (base: string) => `${base}${Math.floor(Math.random() * 1e6)}`;

/** Léa played as a guest on her phone (token a), seated bleu; then she signed up on that phone. */
async function leaSignsUpAtHerSeat(): Promise<{ id: string; lea: Person; jar: Jar }> {
  const id = await createTable();
  const guest = await connect(id);
  await hello(guest, "a", "Léo");
  guest.send({ t: "sit", seat: "bleu" });
  await guest.next("welcome", (frame) => frame.you.seat === "bleu");
  // The page goes (its close event reaches the test side only with the next ping: not awaited).
  guest.ws.close(1000);
  const jar = newJar();
  const lea = await signUpPerson(pseudo("Léonie"), jar);
  return { id, lea, jar };
}

/** Every raw frame of these sockets: no account id, ever (T-04-42). */
function expectNoAccountIn(clients: Client[], ids: string[]): void {
  for (const client of clients) {
    for (const text of client.raw) for (const id of ids) expect(text).not.toContain(id);
  }
}

describe("the Worker forwards the account on the upgrade", () => {
  it("rule 2: the device's guest seat becomes the account's, under its pseudo, and D1 knows it", async () => {
    const { id, lea, jar } = await leaSignsUpAtHerSeat();
    const phone = await connectAs(id, { jar });
    const welcome = await hello(phone, "a", "Léo");
    expect(welcome.you.seat).toBe("bleu");
    expect(welcome.you.host).toBe(true);
    expect(welcome.table.seats.bleu.name).toBe(lea.pseudo);
    const members = await untilRows(1, MEMBERS);
    expect(members).toEqual([{ user_id: lea.id, table_id: id, seat: "bleu" }]);
    const table = await readTable(id);
    expect(table.people).toHaveLength(1);
    expect(table.people[0]).toMatchObject({ seat: "bleu", account: lea.id, name: lea.pseudo });
    expectNoAccountIn([phone], [lea.id]);
  });

  it("rule 1: another device of the account takes the seat; the older socket is told 4001", async () => {
    const { id, lea, jar } = await leaSignsUpAtHerSeat();
    const phone = await connectAs(id, { jar });
    await hello(phone, "a", "Léo");
    const laptop = await connectAs(id, { jar: { ...jar } });
    const welcome = await hello(laptop, "b", "Ordinateur");
    expect(welcome.you.seat).toBe("bleu");
    expect(welcome.table.seats.bleu.name).toBe(lea.pseudo);
    expect((await phone.closed).code).toBe(4001);
    expect((await readTable(id)).people).toHaveLength(1);
    expectNoAccountIn([phone, laptop], [lea.id]);
  });

  it("rule 4: the signed-out phone comes in as a new guest without a seat; bleu stays Léa's", async () => {
    const { id, lea, jar } = await leaSignsUpAtHerSeat();
    const phone = await connectAs(id, { jar });
    await hello(phone, "a", "Léo");
    await untilRows(1, MEMBERS);
    phone.ws.close(1000);
    const signedOut = await connect(id);
    const welcome = await hello(signedOut, "a", "Léo");
    expect(welcome.you.seat).toBeNull();
    expect(welcome.table.seats.bleu).toMatchObject({ kind: "human", name: lea.pseudo });
    expect(welcome.table.unseated).toEqual(["Léo"]);
    const table = await readTable(id);
    const bleu = table.seats.bleu;
    expect(bleu.kind).toBe("human");
    const holder = table.people.find((person) => bleu.kind === "human" && person.who === bleu.who);
    expect(holder?.account).toBe(lea.id);
    expect(table.people.find((person) => person.seat === null)?.account).toBeNull();
    // Nothing more for D1: a guest has no row.
    expect(await rows(MEMBERS)).toEqual([{ user_id: lea.id, table_id: id, seat: "bleu" }]);
  });

  it("rule 3: an account with no person here is a new person named by its pseudo; sitting writes its row", async () => {
    const { id, lea, jar } = await leaSignsUpAtHerSeat();
    const phone = await connectAs(id, { jar });
    await hello(phone, "a", "Léo");
    const paulJar = newJar();
    const paul = await signUpPerson(pseudo("Paulo"), paulJar);
    const paulSocket = await connectAs(id, { jar: paulJar });
    const welcome = await hello(paulSocket, "c", "Peu importe");
    expect(welcome.you.seat).toBeNull();
    expect(welcome.table.unseated).toEqual([paul.pseudo]);
    paulSocket.send({ t: "sit", seat: "vert" });
    const sat = await paulSocket.next("welcome", (frame) => frame.you.seat === "vert");
    expect(sat.table.seats.vert.name).toBe(paul.pseudo);
    const members = await untilRows(
      1,
      "SELECT seat FROM table_members WHERE user_id = ? AND seat IS NOT NULL",
      paul.id,
    );
    expect(members).toEqual([{ seat: "vert" }]);
    expectNoAccountIn([phone, paulSocket], [lea.id, paul.id]);
  });
});

describe("only the Worker sets the account headers (T-04-08)", () => {
  it("a client-sent x-toc-account without a cookie is dropped: the socket is a guest", async () => {
    const { id, lea, jar } = await leaSignsUpAtHerSeat();
    const phone = await connectAs(id, { jar });
    await hello(phone, "a", "Léo");
    const forger = await connectAs(id, {
      headers: { "x-toc-account": lea.id, "x-toc-pseudo": "Faux" },
    });
    const welcome = await hello(forger, "d", "Intrus");
    expect(welcome.you.seat).toBeNull();
    expect(welcome.table.unseated).toEqual(["Intrus"]);
    expect(phone.closeCode()).toBeNull();
    const table = await readTable(id);
    expect(table.people.filter((person) => person.account === lea.id)).toHaveLength(1);
    expect(table.people.find((person) => person.name === "Intrus")?.account).toBeNull();
  });

  it("with Paul's cookie, a forged x-toc-account naming Léa still makes Paul", async () => {
    const { id, lea, jar } = await leaSignsUpAtHerSeat();
    const phone = await connectAs(id, { jar });
    await hello(phone, "a", "Léo");
    const paulJar = newJar();
    const paul = await signUpPerson(pseudo("Paulo"), paulJar);
    const forger = await connectAs(id, {
      jar: paulJar,
      headers: { "x-toc-account": lea.id, "x-toc-pseudo": encodeURIComponent(lea.pseudo) },
    });
    const welcome = await hello(forger, "e", "x");
    expect(welcome.you.seat).toBeNull();
    expect(welcome.table.unseated).toEqual([paul.pseudo]);
    expect(phone.closeCode()).toBeNull();
  });
});

describe("the Origin of a cookie-carrying upgrade (T-04-02)", () => {
  it("with a session cookie: no Origin, a null Origin or a foreign one → 403", async () => {
    const { id, jar } = await leaSignsUpAtHerSeat();
    for (const origin of [null, "null", "https://evil.test", "http://toc.test"]) {
      const response = await upgrade(id, { jar, origin });
      expect(response.status, String(origin)).toBe(403);
      expect(response.webSocket ?? null).toBeNull();
    }
    expect((await upgrade(id, { jar })).status).toBe(101);
  });

  it("a guest (no cookie) keeps the phase-2 rule: no Origin passes, a foreign one does not", async () => {
    const id = await createTable();
    expect((await upgrade(id, { origin: null })).status).toBe(101);
    expect((await upgrade(id)).status).toBe(101);
    expect((await upgrade(id, { origin: "https://evil.test" })).status).toBe(403);
  });
});

describe("GET and DELETE /api/me/tables (ACCT-02)", () => {
  it("lists the account's tables, newest first, at most 20; forgets one", async () => {
    const { id, lea, jar } = await leaSignsUpAtHerSeat();
    const phone = await connectAs(id, { jar });
    await hello(phone, "a", "Léo");
    await untilRows(1, MEMBERS);
    const listed = await get("/api/me/tables", jar);
    expect(listed.status).toBe(200);
    const [first] = (await listed.json()) as { tableId: string; seat: string; joinedAt: number }[];
    expect(first).toMatchObject({ tableId: id, seat: "bleu" });
    expect(typeof first?.joinedAt).toBe("number");

    // 25 older tables: the list keeps the 20 newest.
    const db = env.DB as D1Database;
    const others = Array.from({ length: 25 }, (_, i) => {
      const bytes = new Uint8Array(16);
      bytes[0] = i + 1;
      return toBase64Url(bytes);
    });
    await db.batch(
      others.map((other, i) =>
        db
          .prepare(
            "INSERT INTO table_members (user_id, table_id, seat, joined_at) VALUES (?, ?, NULL, ?)",
          )
          .bind(lea.id, other, 1000 + i),
      ),
    );
    const all = (await (await get("/api/me/tables", jar)).json()) as { tableId: string }[];
    expect(all).toHaveLength(20);
    expect(all[0]?.tableId).toBe(id);
    expect(all[1]?.tableId).toBe(others[24]);
    expect(all[19]?.tableId).toBe(others[6]);

    // Forget: Origin needed (403), then 204 and the row gone.
    expect((await del(`/api/me/tables/${id}`, { jar: { ...jar }, origin: null })).status).toBe(403);
    expect(
      (await del(`/api/me/tables/${id}`, { jar: { ...jar }, origin: "https://evil.test" })).status,
    ).toBe(403);
    const forgotten = await del(`/api/me/tables/${id}`, { jar });
    expect(forgotten.status).toBe(204);
    expect(await rows("SELECT * FROM table_members WHERE table_id = ?", id)).toEqual([]);
  });

  it("without a session: 401; another method: 405", async () => {
    const id = await createTable();
    expect((await get("/api/me/tables")).status).toBe(401);
    expect((await del(`/api/me/tables/${id}`)).status).toBe(401);
    expect((await del("/api/me/tables")).status).toBe(405);
  });

  it("one members row is one upsert (rows written per link, for the SUMMARY)", async () => {
    const { lea } = await leaSignsUpAtHerSeat();
    const id = await createTable();
    const first = await writeMembers(env.DB, id, [{ account: lea.id, seat: null }], 5000);
    const second = await writeMembers(env.DB, id, [{ account: lea.id, seat: "bleu" }], 6000);
    console.log(
      `table_members rows written: link ${first.rowsWritten}, seat change ${second.rowsWritten}`,
    );
    expect(first.outcome).toBe("written");
    expect(second.outcome).toBe("written");
    const [row] = await rows("SELECT seat, joined_at FROM table_members WHERE table_id = ?", id);
    // The join time stays the first one.
    expect(row).toEqual({ seat: "bleu", joined_at: 5000 });
    expect(await writeMembers(undefined, id, [{ account: lea.id, seat: null }], 7000)).toEqual({
      outcome: "skipped",
      rowsWritten: 0,
    });
  });
});

describe("frames at an account seat", () => {
  it("no frame of an account socket carries its id, through a started game", async () => {
    const { id, lea, jar } = await leaSignsUpAtHerSeat();
    const phone = await connectAs(id, { jar });
    await hello(phone, "a", "Léo");
    phone.send({ t: "start" });
    await phone.next("events");
    const frames: ServerFrame[] = phone.frames;
    expect(frames.some((frame) => frame.t === "events")).toBe(true);
    expectNoAccountIn([phone], [lea.id]);
  });
});
