// « Mes chiffres », the friends ranking and the solo report on the server (plan 05-05, HIST-03,
// HIST-04, D-01, D-02, D-13; 05-RESEARCH Patterns 2 and 4), in workerd with the tests' D1. The rows
// are seeded as the GameRoom's record writes them (test/results.test.ts plays the real game); every
// answer is read through the strict schemas of @toc/protocol and holds no account id.

import { SELF } from "cloudflare:test";
import { parseRankingAnswer, parseStatsAnswer } from "@toc/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import {
  befriendRows,
  d1Of,
  get,
  type Jar,
  newJar,
  ORIGIN,
  type Person,
  resetAccounts,
  seedGame,
  signUpPerson,
} from "./helpers.ts";

beforeEach(resetAccounts);

/** The pseudo of a test account: unique enough, at most 20 characters. */
const pseudo = (base: string) => `${base}${Math.floor(Math.random() * 1e6)}`;

const HASH = "H".repeat(43);
const T0 = 1_800_000_000_000;

type Signed = { person: Person; jar: Jar };

async function account(base: string): Promise<Signed> {
  const jar = newJar();
  return { person: await signUpPerson(pseudo(base), jar), jar };
}

/** The three games of the plan: an online win with B, an online loss with a guest, a solo win. */
async function threeGames(a: Person, b: Person): Promise<void> {
  await seedGame({
    id: `${HASH}:1`,
    endedAt: T0 + 1000,
    winner: "bleu-rouge",
    seats: [
      { colour: "bleu", kind: "account", account: a.id, name: a.pseudo, home: 4, captured: 2 },
      { colour: "jaune", kind: "guest", name: "Mamie" },
      { colour: "rouge", kind: "account", account: b.id, name: b.pseudo, home: 4 },
      { colour: "vert", kind: "guest", name: "Papi" },
    ],
  });
  await seedGame({
    id: `${HASH}:2`,
    endedAt: T0 + 2000,
    winner: "bleu-rouge",
    seats: [
      { colour: "bleu", kind: "bot", name: "Ourasi", level: 2, home: 4 },
      { colour: "jaune", kind: "account", account: a.id, name: a.pseudo, home: 1, lost: 3 },
      { colour: "rouge", kind: "bot", name: "Jappeloup", level: 4, home: 4 },
      { colour: "vert", kind: "guest", name: "Mamie", home: 2 },
    ],
  });
  await seedGame({
    id: `solo:${a.id}:0c7e6f7a-1b2c-4d5e-8f90-1234567890ab`,
    kind: "solo",
    endedAt: T0 + 3000,
    winner: "bleu-rouge",
    seats: [
      { colour: "bleu", kind: "account", account: a.id, name: a.pseudo, home: 4, captured: 4 },
      { colour: "jaune", kind: "bot", level: 3 },
      { colour: "rouge", kind: "bot", level: 3, home: 4 },
      { colour: "vert", kind: "bot", level: 5 },
    ],
  });
}

describe("GET /api/me/stats", () => {
  it("answers the three filters at once, partners and levels, without any account id", async () => {
    const a = await account("Anaïs");
    const b = await account("Bruno");
    await threeGames(a.person, b.person);
    const answer = await get("/api/me/stats", a.jar);
    expect(answer.status).toBe(200);
    expect(answer.headers.get("cache-control")).toBe("no-store");
    console.log(`GET /api/me/stats, 3 games: ${answer.headers.get("x-toc-d1")}`);
    expect(d1Of(answer).written).toBe(0);
    const text = await answer.text();
    expect(text).not.toContain(a.person.id);
    expect(text).not.toContain(b.person.id);
    const stats = parseStatsAnswer(JSON.parse(text));
    expect(stats).not.toBeNull();
    expect(stats?.all).toMatchObject({ games: 3, wins: 2, captured: 6, lost: 3, home: 9 });
    expect(stats?.online).toMatchObject({ games: 2, wins: 1 });
    expect(stats?.solo).toMatchObject({ games: 1, wins: 1 });
    expect(stats?.all.partners).toEqual([
      { kind: "account", name: b.person.pseudo, level: null, games: 1, wins: 1 },
      { kind: "guests", name: null, level: null, games: 1, wins: 0 },
      { kind: "bot", name: null, level: 3, games: 1, wins: 1 },
    ]);
    expect(stats?.all.levels).toEqual([
      { level: 4, games: 1, wins: 0 },
      { level: 5, games: 1, wins: 1 },
    ]);

    // B sees only their own game, with A as partner.
    const forB = parseStatsAnswer(await (await get("/api/me/stats", b.jar)).json());
    expect(forB?.all).toMatchObject({ games: 1, wins: 1, home: 4 });
    expect(forB?.all.partners).toEqual([
      { kind: "account", name: a.person.pseudo, level: null, games: 1, wins: 1 },
    ]);
  });

  it("a player with no game: zeros and empty lists", async () => {
    const a = await account("Anaïs");
    const stats = parseStatsAnswer(await (await get("/api/me/stats", a.jar)).json());
    const empty = { games: 0, wins: 0, captured: 0, lost: 0, home: 0, partners: [], levels: [] };
    expect(stats).toEqual({ all: empty, online: empty, solo: empty });
  });

  it("50 games: the rows read", async () => {
    const a = await account("Anaïs");
    for (let i = 0; i < 50; i++) {
      await seedGame({
        id: `${HASH}:${100 + i}`,
        endedAt: T0 + i * 1000,
        winner: i % 2 === 0 ? "bleu-rouge" : "jaune-vert",
        seats: [
          { colour: "bleu", kind: "account", account: a.person.id, name: a.person.pseudo },
          { colour: "jaune", kind: "bot", level: (i % 5) + 1 },
          { colour: "rouge", kind: "guest", name: "Mamie" },
          { colour: "vert", kind: "bot", level: 2 },
        ],
      });
    }
    const answer = await get("/api/me/stats", a.jar);
    console.log(`GET /api/me/stats, 50 games: ${answer.headers.get("x-toc-d1")}`);
    const stats = parseStatsAnswer(await answer.json());
    expect(stats?.all).toMatchObject({ games: 50, wins: 25 });
    expect(stats?.all.levels.map((level) => level.level)).toEqual([2, 3, 4, 5]);
  });

  it("401 signed out, and only GET or HEAD", async () => {
    const out = await get("/api/me/stats");
    expect(out.status).toBe(401);
    expect(await out.json()).toEqual({ error: "signed-out" });
    expect(out.headers.get("x-toc-d1")).toMatch(/^w=\d+;r=\d+$/);
    const posted = await SELF.fetch(`${ORIGIN}/api/me/stats`, { method: "POST" });
    expect(posted.status).toBe(405);
  });
});

// --- Task 2: the friends ranking ---

let gameNo = 1000;

/**
 * A ranked online game (two accounts or more): `winners` sit bleu and rouge, `losers` jaune and vert;
 * a missing seat is a guest.
 */
async function ranked(winners: Person[], losers: Person[], ranking = true): Promise<void> {
  const seat = (colour: "bleu" | "jaune" | "rouge" | "vert", who: Person | undefined) =>
    who === undefined
      ? { colour, kind: "guest" as const, name: "Mamie" }
      : { colour, kind: "account" as const, account: who.id, name: who.pseudo };
  gameNo++;
  await seedGame({
    id: `${HASH}:${gameNo}`,
    endedAt: T0 + gameNo * 1000,
    winner: "bleu-rouge",
    seats: [
      seat("bleu", winners[0]),
      seat("jaune", losers[0]),
      seat("rouge", winners[1]),
      seat("vert", losers[1]),
    ],
    ranked: ranking,
  });
}

type RankingBody = {
  friends: number;
  ranked: { rank: number; pseudo: string; games: number; wins: number; me: boolean }[];
  unranked: { pseudo: string; games: number; me: boolean }[];
};

describe("GET /api/me/ranking", () => {
  it("the circle: the player and their friends, each with all their ranked games", async () => {
    const a = await account("Anaïs");
    const b = await account("Bruno");
    const c = await account("Chloé");
    const d = await account("David");
    await befriendRows(a.person.id, b.person.id);
    await befriendRows(a.person.id, c.person.id);
    // David is a friend of Bruno only: a friend of a friend never appears in A's ranking.
    await befriendRows(b.person.id, d.person.id);
    // A wins 4 of 6 with B; C plays with D (outside A's circle) and wins 2 of 2.
    for (let i = 0; i < 4; i++) await ranked([a.person], [b.person]);
    for (let i = 0; i < 2; i++) await ranked([b.person], [a.person]);
    for (let i = 0; i < 2; i++) await ranked([c.person], [d.person]);
    // Not ranked: a solo game of A, an online game where A was the only account.
    await seedGame({
      id: `solo:${a.person.id}:0c7e6f7a-1b2c-4d5e-8f90-1234567890ab`,
      kind: "solo",
      endedAt: T0 + 5,
      winner: "bleu-rouge",
      seats: [
        { colour: "bleu", kind: "account", account: a.person.id, name: a.person.pseudo },
        { colour: "jaune", kind: "bot", level: 1 },
        { colour: "rouge", kind: "bot", level: 1 },
        { colour: "vert", kind: "bot", level: 1 },
      ],
    });
    await ranked([a.person], [], false);

    const answer = await get("/api/me/ranking", a.jar);
    expect(answer.status).toBe(200);
    expect(answer.headers.get("cache-control")).toBe("no-store");
    expect(d1Of(answer).written).toBe(0);
    const text = await answer.text();
    for (const who of [a, b, c, d]) expect(text).not.toContain(who.person.id);
    expect(text).not.toContain(d.person.pseudo);
    const body = parseRankingAnswer(JSON.parse(text)) as RankingBody;
    expect(body).not.toBeNull();
    expect(body.friends).toBe(2);
    expect(body.ranked).toEqual([
      { rank: 1, pseudo: a.person.pseudo, games: 6, wins: 4, me: true },
      { rank: 2, pseudo: b.person.pseudo, games: 6, wins: 2, me: false },
    ]);
    expect(body.unranked).toEqual([{ pseudo: c.person.pseudo, games: 2, me: false }]);

    // B's circle is A, B and D: C is not B's friend.
    const forB = (await (await get("/api/me/ranking", b.jar)).json()) as RankingBody;
    expect(forB.friends).toBe(2);
    expect(forB.unranked.map((row) => row.pseudo)).toEqual([d.person.pseudo]);
    expect(JSON.stringify(forB)).not.toContain(c.person.pseudo);
  });

  it("a player without friends: friends 0, alone in the list", async () => {
    const a = await account("Anaïs");
    const body = (await (await get("/api/me/ranking", a.jar)).json()) as RankingBody;
    expect(body).toEqual({
      friends: 0,
      ranked: [],
      unranked: [{ pseudo: a.person.pseudo, games: 0, me: true }],
    });
  });

  it("a circle of 10 friends: the rows read", async () => {
    const a = await account("Anaïs");
    const friends: Person[] = [];
    for (let i = 0; i < 10; i++) {
      const friend = await account(`Ami${i}`);
      friends.push(friend.person);
      await befriendRows(a.person.id, friend.person.id);
    }
    for (let i = 0; i < 10; i++) {
      const one = friends[i] as Person;
      const two = friends[(i + 1) % 10] as Person;
      for (let g = 0; g < 3; g++) await ranked([a.person, one], [two]);
    }
    const answer = await get("/api/me/ranking", a.jar);
    console.log(`GET /api/me/ranking, 10 friends, 30 games: ${answer.headers.get("x-toc-d1")}`);
    const body = (await answer.json()) as RankingBody;
    expect(body.friends).toBe(10);
    expect(body.ranked[0]).toMatchObject({ rank: 1, pseudo: a.person.pseudo, games: 30, wins: 30 });
    expect(body.ranked).toHaveLength(11);
  });

  it("401 signed out, and only GET or HEAD", async () => {
    const out = await get("/api/me/ranking");
    expect(out.status).toBe(401);
    expect(await out.json()).toEqual({ error: "signed-out" });
    const posted = await SELF.fetch(`${ORIGIN}/api/me/ranking`, { method: "POST" });
    expect(posted.status).toBe(405);
  });
});
