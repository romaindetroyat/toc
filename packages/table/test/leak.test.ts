// No frame of the pure table core carries a card its reader may not know (RULE-19, SC2, T-02-08).
// Unit cases pin the oracle down (it must catch a copied hand and must not cry wolf on a reshuffle
// batch); then a fast-check property plays hundreds of random tables (1 to 4 humans, 0 to 2 unseated
// people) through reduce() with random disconnects and reconnects, stale and illegal acts, and runs
// the oracle on every frame that leaves the reducer, as the Durable Object would send it (JSON text).

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomLegal } from "@toc/bots";
import {
  type Action,
  type CardId,
  COLORS,
  type Color,
  FULL_DECK,
  type GameEvent,
  type GameState,
  next,
  PARTNER,
  type Rng,
  viewFor,
} from "@toc/engine";
import type { ServerFrame } from "@toc/protocol";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  createTable,
  dueBot,
  hostOf,
  type Out,
  reduce,
  type Table,
  welcomeFor,
} from "../src/index.ts";
import {
  canonical,
  cardIdsIn,
  frameProblems,
  leakedCards,
  sameJson,
  structuralProblems,
} from "../src/oracle.ts";

const TABLE_ID = "abcdefghijklmnopqrstuv";
const GAMES = 200;
const COMMAND_CAP = 400;
const NAMES = ["Ana", "Ben", "Clo", "Dan", "Eve", "Flo"];

/** A table with Ana (bleu, creator) and Ben (jaune), started: the game after the first deal. */
function startedTable(): { table: Table; out: Out[] } {
  let table = createTable({
    tableId: TABLE_ID,
    now: 0,
    seed: [5, 6, 7, 8],
    test: { pace: "zero" },
  });
  const ctx = { now: 1, seed: (): Rng => [11, 22, 33, 44] };
  for (const command of [
    { t: "hello", who: "who-ana", name: "Ana" },
    { t: "hello", who: "who-ben", name: "Ben" },
    { t: "client", who: "who-ana", frame: { t: "sit", seat: "bleu" } },
    { t: "client", who: "who-ben", frame: { t: "sit", seat: "jaune" } },
  ] as const) {
    table = reduce(table, command, ctx).table;
  }
  return reduce(table, { t: "client", who: "who-ana", frame: { t: "start" } }, ctx);
}

function gameOf(table: Table): GameState {
  if (table.game === null) throw new Error("no game");
  return table.game;
}

describe("the leak oracle", () => {
  it("is a test instrument: no server source imports it", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
    const sources = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sources(path);
        return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
      });
    const files = [
      ...sources(join(root, "packages", "table", "src")),
      ...sources(join(root, "apps", "worker", "src")),
    ];
    expect(files.length).toBeGreaterThan(5);
    const importers = files.filter((file) =>
      /from\s+["'][^"']*oracle(\.ts)?["']/.test(readFileSync(file, "utf8")),
    );
    expect(importers).toEqual([]);
  });

  it("reads card ids in a text, and nothing else", () => {
    expect(cardIdsIn('{"hand":["1S","13H","10D","7C"],"pawn":"bleu1","cell":13}')).toEqual([
      "1S",
      "13H",
      "10D",
      "7C",
    ]);
    expect(cardIdsIn('{"name":"Ana","seq":12,"pawn":"rouge3","x":"14S","y":"0H"}')).toEqual([]);
  });

  it("catches a frame that copies another seat's hand", () => {
    const game = gameOf(startedTable().table);
    const frame = { t: "events", seq: 1, events: [], view: viewFor(game, "bleu") };
    const copied = JSON.stringify({ ...frame, extra: game.hands.rouge });
    expect(leakedCards(copied, null, game, "bleu").sort()).toEqual([...game.hands.rouge].sort());
    // The unseated reader may know no hand at all.
    expect(leakedCards(JSON.stringify(frame), null, game, null).sort()).toEqual(
      [...game.hands.bleu].sort(),
    );
  });

  it("finds nothing in a welcome built by welcomeFor, nor in the start frames", () => {
    const { table, out } = startedTable();
    const game = gameOf(table);
    expect(leakedCards(JSON.stringify(welcomeFor(table, "who-ana")), null, game, "bleu")).toEqual(
      [],
    );
    expect(leakedCards(JSON.stringify(welcomeFor(table, "who-ben")), null, game, "jaune")).toEqual(
      [],
    );
    for (const { to, frame } of out) {
      const seat = to === "who-ana" ? "bleu" : "jaune";
      expect(leakedCards(JSON.stringify(frame), null, game, seat)).toEqual([]);
      expect(frameProblems(JSON.parse(JSON.stringify(frame)), game, seat, ["who-"])).toEqual([]);
    }
  });

  it("accepts a reshuffle batch whose played card already sits in another seat's new hand", () => {
    const game = gameOf(startedTable().table);
    // Rouge holds X after the batch; the frame announces X as played by bleu before the reshuffle.
    const x = game.hands.rouge[0] as CardId;
    const events: GameEvent[] = [
      { t: "cardPlayed", seat: "bleu", card: x },
      { t: "reshuffled", dealer: "jaune" },
    ];
    const frame = JSON.stringify({ t: "events", seq: 9, events, view: viewFor(game, "bleu") });
    expect(leakedCards(frame, null, game, "bleu")).toEqual([]);
    // The same card anywhere else in the frame is a leak.
    const elsewhere = JSON.stringify({
      t: "events",
      seq: 9,
      events: [{ t: "reshuffled", dealer: "jaune" }],
      view: { ...viewFor(game, "bleu"), note: x },
    });
    expect(leakedCards(elsewhere, null, game, "bleu")).toEqual([x]);
  });

  it("knows a seat's own give after the cards crossed, and no one else's", () => {
    const game = gameOf(startedTable().table);
    const crossed: GameState = {
      ...game,
      phase: "play",
      received: { bleu: "1S", jaune: "2S", rouge: "3S", vert: "4S" },
    };
    // Bleu gave rouge's received card (3S); jaune's (2S, given by vert) stays hidden from bleu.
    const text = JSON.stringify({ t: "events", seq: 3, events: [], view: { a: "3S", b: "2S" } });
    expect(leakedCards(text, null, crossed, "bleu")).toEqual(["2S"]);
    expect(PARTNER.bleu).toBe("rouge");
  });

  it("flags every structural problem the plan lists", () => {
    const { table } = startedTable();
    const game = gameOf(table);
    const view = viewFor(game, "bleu");
    const dealt = (seat: Color): GameEvent => ({
      t: "handDealt",
      seat,
      size: 5,
      cards: game.hands[seat].slice(),
    });
    const events = (list: unknown[]) => ({ t: "events", seq: 1, events: list, view });
    const problems = (frame: unknown, seat: Color | null = "bleu") =>
      frameProblems(frame, game, seat, ["who-ana", "who-ben"]);

    expect(problems(events([dealt("bleu")]))).toEqual([]);
    expect(problems(events([dealt("rouge")]))).toContain("handDealt shows the cards of rouge");
    expect(
      problems(
        events([
          { t: "cardsExchanged", received: { bleu: "1S", jaune: "2S", rouge: null, vert: null } },
        ]),
      ),
    ).toContain("cardsExchanged shows the card received by jaune");
    expect(problems({ ...events([]), hands: game.hands })).toContain("forbidden key frame.hands");
    expect(problems({ ...events([]), talon: game.talon })).toContain("forbidden key frame.talon");
    expect(problems({ ...events([]), rng: game.rng })).toContain("forbidden key frame.rng");
    expect(problems({ ...events([]), extra: game })).toContain("a GameState at frame.extra");
    expect(problems({ ...events([]), extra: { given: game.given } })).toContain(
      "per-seat given record at frame.extra.given",
    );
    expect(problems({ t: "table", table: { name: "who-ben" } })).toContain(
      "a person id or token is in the frame",
    );
    expect(problems({ t: "error", code: "illegal", detail: "x" })).toContain(
      "error frame is not exactly { t, code }: code,detail,t",
    );
    expect(problems({ t: "error", code: "IllegalActionError: move 13S" })).toContain(
      "an error text is in the frame",
    );
    expect(problems({ ...events([]), view: viewFor(game, "jaune") })).toContain(
      "view of jaune sent to bleu",
    );
    expect(problems({ ...events([]), view: { ...view, hand: [] } })).toContain(
      "view differs from viewFor(state, seat)",
    );
    expect(
      problems({ t: "welcome", you: { seat: null, host: false }, table: {}, view, seq: 1 }, null),
    ).toContain("a view where none is due");
    expect(
      problems(
        { t: "welcome", you: { seat: null, host: false }, table: {}, view: null, seq: 1 },
        null,
      ),
    ).toEqual([]);
    expect(problems({ t: "error", code: "stale" })).toEqual([]);
    expect(structuralProblems({ t: "secret" }, "bleu")).toEqual(["not a known server frame"]);
    expect(canonical({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(canonical({ a: [{ c: 2, d: 1 }], b: 1 }));
    expect(sameJson({ b: 1, a: [{ d: 1, c: 2 }] }, { a: [{ c: 2, d: 1 }], b: 1 })).toBe(true);
    expect(sameJson({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(sameJson({ a: 1 }, { a: 1, b: null })).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------
// The property.

type Person = { who: string; name: string; seat: Color | null };

/** What the property exercised, so it cannot pass vacuously. */
const seen = {
  games: 0,
  commands: 0,
  frames: 0,
  wins: 0,
  humanActs: 0,
  botTicks: 0,
  staleActs: 0,
  illegalActs: 0,
  /** A seated person left (gone) and said hello again during a game. */
  reconnects: 0,
  /** Events frames whose batch reshuffled the deck. */
  reshuffleBatches: 0,
  /** Welcome frames to an unseated person during a game (their view is null). */
  unseatedWelcomes: 0,
  /** Error frames checked. */
  errors: 0,
  /** Games paused because a seated person went (plan 02-06). */
  pauses: 0,
  /** The host's choices after the minute: wait, hand over, save; and resumes of a saved game. */
  waits: 0,
  handOvers: 0,
  saves: 0,
  resumes: 0,
};

/** A uniform integer in [0, n) from the walk's own stream. */
function pick(rng: Rng, n: number): [number, Rng] {
  const [u, after] = next(rng);
  return [Math.floor(u * n), after];
}

/** A card that is not in the seat's hand (an illegal act for sure). */
function notInHand(game: GameState, seat: Color): CardId {
  return FULL_DECK.find((card) => !game.hands[seat].includes(card)) as CardId;
}

/** Runs one command and checks every frame it produces, as text, against the oracle. */
function step(
  table: Table,
  command: Parameters<typeof reduce>[1],
  now: number,
  seed: Rng,
  ids: readonly string[],
): Table {
  const result = reduce(table, command, { now, seed: () => seed });
  seen.commands += 1;
  const before = table.game;
  const after = result.table.game;
  for (const { to, frame } of result.out) {
    const seat = result.table.people.find((person) => person.who === to)?.seat ?? null;
    const text = JSON.stringify(frame);
    const received = JSON.parse(text) as ServerFrame;
    seen.frames += 1;
    const leaks = leakedCards(text, before, after, seat);
    const problems = frameProblems(received, after, seat, ids);
    if (leaks.length > 0 || problems.length > 0) {
      throw new Error(
        `frame to ${seat ?? "unseated"} after ${JSON.stringify(command)}: leaks ${leaks.join(",")}; ${problems.join("; ")}\n${text}`,
      );
    }
    if (received.t === "error") seen.errors += 1;
    if (received.t === "events" && received.events.some((event) => event.t === "reshuffled")) {
      seen.reshuffleBatches += 1;
    }
    if (received.t === "welcome" && after !== null) {
      if (seat === null) {
        expect(received.view).toBeNull();
        seen.unseatedWelcomes += 1;
      } else {
        expect(sameJson(received.view, viewFor(after, seat))).toBe(true);
      }
    }
  }
  return result.table;
}

/** One random table and a random walk of commands, every frame checked. */
function playOne(config: {
  seed: number;
  humans: number;
  unseated: number;
  order: Color[];
  noise: number;
}): void {
  seen.games += 1;
  let rng: Rng = [config.seed, 0x9e3779b9, config.humans * 7 + config.unseated, 12345];
  let now = 1;
  const deck = (): Rng => [config.seed ^ 0x5bd1e995, now, 77, 99];
  let table = createTable({
    tableId: TABLE_ID,
    now: 0,
    seed: [config.seed, 1, 2, 3],
    test: { pace: "zero" },
  });
  const people: Person[] = [];
  for (let i = 0; i < config.humans + config.unseated; i++) {
    const seat = i < config.humans ? (config.order[i] as Color) : null;
    people.push({ who: `who-${config.seed}-${i}`, name: NAMES[i] as string, seat });
  }
  const ids = people.map((person) => person.who);
  const run = (command: Parameters<typeof reduce>[1]) => {
    now += 1;
    table = step(table, command, now, deck(), ids);
  };
  const online = (person: Person) =>
    table.people.find((each) => each.who === person.who)?.online === true;

  // Hellos: the first human is the creator; then everyone else, then the seats.
  for (const person of people) run({ t: "hello", who: person.who, name: person.name });
  for (const person of people) {
    if (person.seat !== null)
      run({ t: "client", who: person.who, frame: { t: "sit", seat: person.seat } });
  }
  const creator = people[0] as Person;
  // A taken seat and a start by someone else are refused (error frames).
  const second = people[1];
  if (second !== undefined) {
    run({ t: "client", who: second.who, frame: { t: "sit", seat: creator.seat as Color } });
    run({ t: "client", who: second.who, frame: { t: "start" } });
    // The waiting room's own commands (plan 02-05): a stand and a sit back, a move by someone else.
    if (second.seat !== null) {
      run({ t: "client", who: second.who, frame: { t: "stand" } });
      run({ t: "client", who: second.who, frame: { t: "sit", seat: second.seat } });
      run({ t: "client", who: second.who, frame: { t: "move", who: second.seat, to: "vert" } });
    }
  }
  // The host sets the strength of a free seat.
  const free = COLORS.find((color) => table.seats[color].kind === "free");
  if (free !== undefined) {
    run({ t: "client", who: creator.who, frame: { t: "level", seat: free, level: 4 } });
  }
  run({ t: "client", who: creator.who, frame: { t: "start" } });
  const absent = new Set<string>();

  for (let i = 0; i < COMMAND_CAP; i++) {
    const game = gameOf(table);
    if (game.phase === "won") {
      seen.wins += 1;
      return;
    }
    let roll: number;
    [roll, rng] = pick(rng, 100);
    if (roll < config.noise) {
      // Noise: a disconnect, a reconnect, a stale act, an illegal act, a sit during the game, a tick.
      let kind: number;
      [kind, rng] = pick(rng, 6);
      let who: number;
      [who, rng] = pick(rng, people.length);
      const person = people[who] as Person;
      if (kind === 0 && online(person)) {
        const wasPlaying = table.status === "playing";
        run({ t: "gone", who: person.who });
        absent.add(person.who);
        if (wasPlaying && table.status === "paused") seen.pauses += 1;
      } else if (kind === 1 || (kind === 0 && !online(person))) {
        run({ t: "hello", who: person.who, name: person.name });
        if (absent.delete(person.who) && person.seat !== null) seen.reconnects += 1;
      } else if (kind === 2 && person.seat !== null) {
        // An act on an older base (a double tap, a replay after a reconnect): refused before apply.
        const action: Action = { t: "discard" };
        run({ t: "client", who: person.who, frame: { t: "act", base: table.seq - 1, action } });
        seen.staleActs += 1;
      } else if (kind === 3) {
        const seat = person.seat ?? "bleu";
        const action: Action = { t: "move", card: notInHand(game, seat), pawn: `${seat}0` };
        run({ t: "client", who: person.who, frame: { t: "act", base: table.seq, action } });
        seen.illegalActs += 1;
      } else if (kind === 4) {
        // A waiting-room command during the game: refused (started).
        const lobbyFrames = [
          { t: "sit", seat: "vert" },
          { t: "stand" },
          { t: "move", who: "bleu", to: "vert" },
          { t: "level", seat: "vert", level: 5 },
        ] as const;
        run({ t: "client", who: person.who, frame: lobbyFrames[i % lobbyFrames.length] as never });
      } else {
        run({ t: "tick", retry: false });
      }
      continue;
    }
    // The pause (plan 02-06): the minute passes and the host chooses, someone comes back, or the
    // host resumes a saved game; a choice by someone else is refused (an error frame, checked too).
    if (table.status === "paused" || table.status === "saved") {
      const host = people.find((person) => person.who === hostOf(table));
      const other = people.find((person) => person.who !== host?.who && online(person));
      let kind: number;
      [kind, rng] = pick(rng, 6);
      if (other !== undefined && kind === 5) {
        run({ t: "client", who: other.who, frame: { t: "pause", choice: "save" } });
        continue;
      }
      if (table.status === "saved") {
        const back = people.find((person) => person.seat !== null && !online(person));
        if (host !== undefined && (kind < 3 || back === undefined)) {
          run({ t: "client", who: host.who, frame: { t: "resume" } });
          seen.resumes += 1;
        } else {
          if (back === undefined) throw new Error("saved with everyone online and no host");
          run({ t: "hello", who: back.who, name: back.name });
          absent.delete(back.who);
        }
        continue;
      }
      const pause = table.pause;
      if (pause === null) throw new Error("paused without a pause");
      if (!pause.choosing && kind < 4) {
        // The minute is over: the alarm's tick.
        now = Math.max(now, pause.choiceAt - 1);
        run({ t: "tick", retry: false });
        continue;
      }
      if (pause.choosing && host !== undefined && kind < 4) {
        const choice = (["wait", "bot", "bot", "save"] as const)[kind] as "wait" | "bot" | "save";
        const level = choice === "bot" ? (((i % 5) + 1) as 1 | 2 | 3 | 4 | 5) : undefined;
        run({
          t: "client",
          who: host.who,
          frame: level === undefined ? { t: "pause", choice } : { t: "pause", choice, level },
        });
        if (choice === "wait") seen.waits += 1;
        else if (choice === "bot") seen.handOvers += 1;
        else seen.saves += 1;
        continue;
      }
      const missing = pause.missing[0] as Color;
      const back = people.find((person) => person.seat === missing) as Person;
      run({ t: "hello", who: back.who, name: back.name });
      if (absent.delete(back.who)) seen.reconnects += 1;
      continue;
    }
    // Progress: the computer due plays, else the human due acts (after coming back if away).
    if (dueBot(table) !== null) {
      run({ t: "tick", retry: false });
      seen.botTicks += 1;
      continue;
    }
    const seat =
      game.phase === "exchange"
        ? (COLORS.find((color) => game.given[color] === null) as Color)
        : game.turn;
    const person = people.find((each) => each.seat === seat) as Person;
    if (!online(person)) {
      run({ t: "hello", who: person.who, name: person.name });
      if (absent.delete(person.who)) seen.reconnects += 1;
      continue;
    }
    let action: Action;
    [action, rng] = randomLegal(viewFor(game, seat), seat, rng);
    run({ t: "client", who: person.who, frame: { t: "act", base: table.seq, action } });
    seen.humanActs += 1;
  }
}

describe("no frame carries a hidden card (pure core, random games with reconnects)", () => {
  it(`holds over ${GAMES} random tables`, () => {
    fc.assert(
      fc.property(
        fc.record({
          seed: fc.integer({ min: 1, max: 0x7fffffff }),
          humans: fc.integer({ min: 1, max: 4 }),
          unseated: fc.integer({ min: 0, max: 2 }),
          order: fc.shuffledSubarray([...COLORS], { minLength: 4, maxLength: 4 }),
          noise: fc.integer({ min: 5, max: 35 }),
        }),
        (config) => {
          playOne(config);
        },
      ),
      { numRuns: GAMES, seed: 20261017, endOnFailure: true },
    );
    if (process.env.TOC_LEAK_STATS === "1") process.stdout.write(`${JSON.stringify(seen)}\n`);
    expect(seen.games).toBeGreaterThanOrEqual(GAMES);
    for (const [key, count] of Object.entries(seen)) {
      expect(count, key).toBeGreaterThan(0);
    }
  }, 300_000);
});
