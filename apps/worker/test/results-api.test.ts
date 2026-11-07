// « Mes chiffres », the friends ranking and the solo report on the server (plan 05-05, HIST-03,
// HIST-04, D-01, D-02, D-13; 05-RESEARCH Patterns 2 and 4), in workerd with the tests' D1. The rows
// are seeded as the GameRoom's record writes them (test/results.test.ts plays the real game); every
// answer is read through the strict schemas of @toc/protocol and holds no account id.

import { SELF } from "cloudflare:test";
import { parseStatsAnswer } from "@toc/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import {
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
