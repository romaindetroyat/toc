// « Mes résultats » on the server (plan 05-01, HIST-02, D-01 to D-04, D-12, D-13; 05-RESEARCH Patterns
// 1, 3 and 4), in workerd with real sockets and the tests' D1 (0003_results.sql applied). A finished
// online game with accounts at the table writes, in the record's one batch, the unchanged legacy games
// row, one played row and one game_seats row per account seat; GET /api/me/results answers the
// signed-in player's games with every seat as me, account, guest or bot, never another account's id.

import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { tableHash } from "../src/record.ts";
import {
  type Client,
  connect,
  connectAs,
  createTable,
  get,
  type Jar,
  NEAR_END,
  newJar,
  ORIGIN,
  type Person,
  resetAccounts,
  rows,
  signUpPerson,
  token,
  untilRows,
} from "./helpers.ts";

beforeEach(resetAccounts);

/** The pseudo of a test account: unique enough, at most 20 characters. */
const pseudo = (base: string) => `${base}${Math.floor(Math.random() * 1e6)}`;

type Seated = {
  id: string;
  a: { person: Person; jar: Jar; client: Client };
  b: { person: Person; jar: Jar; client: Client };
  guest: Client;
};

/** A socket's hello and seat, waiting for the welcome that shows it seated. */
async function sit(client: Client, letter: string, name: string, seat: string): Promise<void> {
  client.send({ t: "hello", v: 6, token: token(letter), name });
  await client.next("welcome");
  client.send({ t: "sit", seat });
  await client.next("welcome", (frame) => frame.you.seat === seat);
}

/**
 * A (an account, creator) bleu, B (an account) jaune, the guest « Mamie » rouge, vert a computer
 * (Pur-sang), at a near-end table where A's 5 wins for bleu-rouge; started.
 */
async function twoAccounts(): Promise<Seated> {
  const id = await createTable({ pace: "zero", before: NEAR_END, levels: { vert: 4 } });
  const aJar = newJar();
  const aPerson = await signUpPerson(pseudo("Anaïs"), aJar);
  const bJar = newJar();
  const bPerson = await signUpPerson(pseudo("Bruno"), bJar);
  const aClient = await connectAs(id, { jar: aJar });
  await sit(aClient, "a", "Anaïs", "bleu");
  const bClient = await connectAs(id, { jar: bJar });
  await sit(bClient, "b", "Bruno", "jaune");
  const guest = await connect(id);
  await sit(guest, "m", "Mamie", "rouge");
  aClient.send({ t: "start" });
  await aClient.next("events");
  return {
    id,
    a: { person: aPerson, jar: aJar, client: aClient },
    b: { person: bPerson, jar: bJar, client: bClient },
    guest,
  };
}

async function win(a: Client): Promise<void> {
  a.send({ t: "act", base: a.seq(), action: { t: "move", card: "5S", pawn: "bleu3" } });
  await a.next("table", (frame) => frame.table.status === "finished");
}

function closeAll(seated: Seated): void {
  for (const client of [seated.a.client, seated.b.client, seated.guest])
    client.ws.close(1000, "bye");
}

type HistorySeatAnswer = {
  colour: string;
  kind: string;
  name: string;
  level: number | null;
  handedOver: boolean;
  captured: number;
  lost: number;
  home: number;
};

type HistoryAnswer = {
  games: {
    id: string;
    kind: string;
    endedAt: number;
    winner: string;
    mine: string;
    seats: HistorySeatAnswer[];
    ranked: boolean;
    creator: string | null;
  }[];
  next: string | null;
};

describe("a finished online game with two accounts in D1", () => {
  it("writes played and one game_seats row per account seat, beside the unchanged games row", async () => {
    const seated = await twoAccounts();
    const { id, a, b } = seated;
    await win(a.client);
    const hash = await tableHash(id);
    const gameId = `${hash}:1`;
    const [played] = await untilRows(1, "SELECT * FROM played WHERE id = ?", gameId);
    expect(played?.kind).toBe("online");
    expect(played?.accounts).toBe(2);
    expect(played?.winner).toBe("bleu-rouge");
    expect(played?.creator).toBe(a.person.pseudo);
    const playedSeats = JSON.parse(String(played?.seats)) as { colour: string; kind: string }[];
    expect(playedSeats.map((seat) => [seat.colour, seat.kind])).toEqual([
      ["bleu", "account"],
      ["jaune", "account"],
      ["rouge", "guest"],
      ["vert", "bot"],
    ]);

    const seats = await untilRows(
      2,
      "SELECT * FROM game_seats WHERE game_id = ? ORDER BY colour",
      gameId,
    );
    const bleu = seats.find((seat) => seat.colour === "bleu");
    const jaune = seats.find((seat) => seat.colour === "jaune");
    expect(bleu).toMatchObject({ user_id: a.person.id, won: 1, ranked: 1, solo: 0, home: 4 });
    expect(jaune).toMatchObject({ user_id: b.person.id, won: 0, ranked: 1, solo: 0, home: 0 });
    expect(bleu?.ended_at).toBe(played?.ended_at);
    // The guest and the computer have no row of their own.
    expect(seats.map((seat) => seat.colour).sort()).toEqual(["bleu", "jaune"]);

    // The legacy games row: the 02-09 columns and seat fields only, no account id.
    const [game] = await rows("SELECT * FROM games WHERE game_id = ?", gameId);
    expect(Object.keys(game ?? {}).sort()).toEqual(
      [
        "captures",
        "deals",
        "ended_at",
        "game_id",
        "game_no",
        "seats",
        "started_at",
        "table_hash",
        "winner",
      ].sort(),
    );
    const legacy = JSON.parse(String(game?.seats)) as Record<string, unknown>[];
    for (const seat of legacy) {
      expect(Object.keys(seat).sort()).toEqual(["colour", "handedOver", "kind", "level", "name"]);
    }
    const text = JSON.stringify(game);
    expect(text).not.toContain(a.person.id);
    expect(text).not.toContain(b.person.id);
    closeAll(seated);
  }, 60_000);

  it("GET /api/me/results answers the game to A as A sees it, without B's id; 401 signed out", async () => {
    const seated = await twoAccounts();
    const { id, a, b } = seated;
    await win(a.client);
    const gameId = `${await tableHash(id)}:1`;
    await untilRows(2, "SELECT * FROM game_seats WHERE game_id = ?", gameId);

    const answer = await get("/api/me/results", a.jar);
    expect(answer.status).toBe(200);
    expect(answer.headers.get("cache-control")).toBe("no-store");
    const text = await answer.text();
    expect(text).not.toContain(b.person.id);
    expect(text).not.toContain(a.person.id);
    const page = JSON.parse(text) as HistoryAnswer;
    expect(page.next).toBeNull();
    expect(page.games).toHaveLength(1);
    const [game] = page.games;
    expect(game?.id).toBe(gameId);
    expect(game?.kind).toBe("online");
    expect(game?.mine).toBe("bleu");
    expect(game?.winner).toBe("bleu-rouge");
    expect(game?.ranked).toBe(true);
    expect(game?.creator).toBe(a.person.pseudo);
    expect(game?.seats.map((seat) => [seat.colour, seat.kind])).toEqual([
      ["bleu", "me"],
      ["jaune", "account"],
      ["rouge", "guest"],
      ["vert", "bot"],
    ]);
    expect(game?.seats[0]).toMatchObject({ name: a.person.pseudo, home: 4, level: null });
    expect(game?.seats[1]).toMatchObject({ name: b.person.pseudo, home: 0 });
    expect(game?.seats[2]).toMatchObject({ name: "Mamie", home: 4 });
    expect(game?.seats[3]).toMatchObject({ level: 4, home: 0 });

    // B sees it from jaune.
    const forB = (await (await get("/api/me/results", b.jar)).json()) as HistoryAnswer;
    expect(forB.games[0]?.mine).toBe("jaune");
    expect(forB.games[0]?.seats[0]?.kind).toBe("account");
    expect(forB.games[0]?.seats[1]?.kind).toBe("me");

    // Signed out: 401, and only GET or HEAD.
    const out = await get("/api/me/results");
    expect(out.status).toBe(401);
    expect(await out.json()).toEqual({ error: "signed-out" });
    const posted = await SELF.fetch(`${ORIGIN}/api/me/results`, { method: "POST" });
    expect(posted.status).toBe(405);
    closeAll(seated);
  }, 60_000);
});
