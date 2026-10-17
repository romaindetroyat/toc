// The end of an online game and the rematch (plan 02-09, D-08, PLAY-07; 02-RESEARCH Pattern 11, A6).
// A game won is announced to everyone (status finished, the winning team in every table frame); the
// seated people vote; when every seated person online agrees, a new game starts at the same table with
// the same seats, teams and computer strengths, a fresh deck seed and the next first dealer. Someone
// offline at that moment is replaced by the computer (Galopeur) until they come back.

import { type Color, type GameEvent, nextColor, type Rng } from "@toc/engine";
import type {
  EventsFrame,
  ServerFrame,
  TableFrame,
  TablePublic,
  WelcomeFrame,
} from "@toc/protocol";
import { describe, expect, it } from "vitest";
import {
  createTable,
  gameRecordOf,
  nextDeadline,
  type Out,
  reduce,
  summary,
  type Table,
} from "./index.ts";

const ID = "abcdefghijklmnopqrstuv";
const ANA = "who-ana";
const BEN = "who-ben";
/** At the table without a seat. */
const DAN = "who-dan";
const SEED: Rng = [11, 22, 33, 44];
const NEW_SEED: Rng = [91, 92, 93, 94];

type Command = Parameters<typeof reduce>[1];
type ClientFrameOf = Extract<Command, { t: "client" }>["frame"];

const client = (who: string, frame: ClientFrameOf): Command => ({ t: "client", who, frame });
const ctx = (now: number, seed: Rng = SEED) => ({ now, seed: (): Rng => seed });

/**
 * Bleu brings its last knight home with the 5: the eighth of bleu-rouge (R-16.1, from bleu's side).
 * The dealer is the seat before bleu: vert.
 */
const NEAR_END = {
  pawns: {
    bleu: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 66 }],
    rouge: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
  },
  hands: { bleu: ["5S"] },
  turn: "bleu",
} as const;

const to = (out: Out[], who: string): ServerFrame[] =>
  out.filter((each) => each.to === who).map((each) => each.frame);

/** The last public table sent to `who` (a table frame or a welcome). */
function seen(out: Out[], who: string): TablePublic {
  const frames = to(out, who).filter(
    (frame): frame is TableFrame | WelcomeFrame => frame.t === "table" || frame.t === "welcome",
  );
  const last = frames[frames.length - 1];
  if (last === undefined) throw new Error(`no table for ${who}`);
  return last.table;
}

/** Ana (creator, bleu) and Ben (jaune) with two computers, started at 2000 from the near-end position. */
function nearEnd(): Table {
  let table = createTable({
    tableId: ID,
    now: 1000,
    seed: [5, 6, 7, 8],
    test: { pace: "zero", levels: { vert: 4 }, before: NEAR_END as never },
  });
  for (const command of [
    { t: "hello", who: ANA, name: "Ana" },
    { t: "hello", who: BEN, name: "Ben" },
    { t: "hello", who: DAN, name: "Dan" },
    client(ANA, { t: "sit", seat: "bleu" }),
    client(BEN, { t: "sit", seat: "jaune" }),
  ] as Command[]) {
    table = reduce(table, command, ctx(1000)).table;
  }
  return reduce(table, client(ANA, { t: "start" }), ctx(2000)).table;
}

/** Ana plays the winning 5 at 3000. */
function won(): { table: Table; out: Out[] } {
  const table = nearEnd();
  return reduce(
    table,
    client(ANA, {
      t: "act",
      base: table.seq,
      action: { t: "move", card: "5S", pawn: "bleu3" },
    }),
    ctx(3000),
  );
}

const vote = (table: Table, who: string, agree: boolean, now = 4000, seed = NEW_SEED) =>
  reduce(table, client(who, { t: "rematch", agree }), ctx(now, seed));

describe("the test start position (test mode only, T-02-39)", () => {
  it("starts from the before block: no opening deal, the hands and knights as given", () => {
    const table = nearEnd();
    const game = table.game;
    expect(game?.phase).toBe("play");
    expect(game?.turn).toBe("bleu");
    expect(game?.hands.bleu).toEqual(["5S"]);
    expect(game?.dealer).toBe("vert");
    expect(game?.dealsPlayed).toBe(0);
    expect(table.status).toBe("playing");
    expect(table.gameNo).toBe(1);
  });

  it("is ignored by a table created without it: a normal deal", () => {
    let table = createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8], test: { pace: "zero" } });
    table = reduce(table, { t: "hello", who: ANA, name: "Ana" }, ctx(1000)).table;
    table = reduce(table, client(ANA, { t: "sit", seat: "bleu" }), ctx(1000)).table;
    const started = reduce(table, client(ANA, { t: "start" }), ctx(2000));
    expect(started.table.game?.phase).toBe("exchange");
    const events = to(started.out, ANA).find((frame): frame is EventsFrame => frame.t === "events");
    expect(events?.events.some((event) => event.t === "handDealt")).toBe(true);
  });
});

describe("the end of a game is announced to everyone (PLAY-07)", () => {
  it("a play that ends in gameWon makes the table finished with the winner in every table frame", () => {
    const { table, out } = won();
    expect(table.status).toBe("finished");
    expect(table.game?.phase).toBe("won");
    for (const who of [ANA, BEN, DAN]) {
      const pub = seen(out, who);
      expect(pub.status).toBe("finished");
      expect(pub.winner).toBe("bleu-rouge");
    }
    // Each seated person gets the winning batch from their side; the unseated person no events.
    for (const who of [ANA, BEN]) {
      const events = to(out, who).find((frame): frame is EventsFrame => frame.t === "events");
      expect(events?.events.some((event) => event.t === "gameWon")).toBe(true);
    }
    expect(to(out, DAN).some((frame) => frame.t === "events")).toBe(false);
  });

  it("clears the computers' deadline and keeps the game's start and end times", () => {
    const { table } = won();
    expect(table.deadlines.bot).toBeUndefined();
    expect(table.thinking).toBeNull();
    expect(table.startedAt).toBe(2000);
    expect(table.endedAt).toBe(3000);
    expect(table.firstDealer).toBe("vert");
  });

  it("every vote starts as « no » for the people online and « bot » for the computers", () => {
    const { out } = won();
    expect(seen(out, BEN).rematch).toEqual({ bleu: "no", jaune: "no", rouge: "bot", vert: "bot" });
  });

  it("a hello after the end gets the finished table and the final view", () => {
    const { table } = won();
    const back = reduce(table, { t: "hello", who: BEN, name: "Ben" }, ctx(3500));
    const welcome = to(back.out, BEN).find((frame): frame is WelcomeFrame => frame.t === "welcome");
    expect(welcome?.table.status).toBe("finished");
    expect(welcome?.view?.phase).toBe("won");
  });

  it("the summary says « finished »; stop is refused", () => {
    const { table } = won();
    expect(summary(table).status).toBe("finished");
    const stopped = reduce(table, client(ANA, { t: "stop" }), ctx(3500));
    expect(to(stopped.out, ANA)).toEqual([{ t: "error", code: "refused" }]);
  });
});

describe("the rematch vote (D-08, T-02-38)", () => {
  it("is refused before the end and from someone without a seat", () => {
    const early = vote(nearEnd(), ANA, true);
    expect(to(early.out, ANA)).toEqual([{ t: "error", code: "refused" }]);
    const unseated = vote(won().table, DAN, true);
    expect(to(unseated.out, DAN)).toEqual([{ t: "error", code: "refused" }]);
    expect(unseated.table.gameNo).toBe(1);
  });

  it("a seated person's vote is set, seen by everyone, and withdrawn by a second tap", () => {
    const yes = vote(won().table, ANA, true);
    expect(yes.table.status).toBe("finished");
    expect(seen(yes.out, BEN).rematch).toEqual({
      bleu: "yes",
      jaune: "no",
      rouge: "bot",
      vert: "bot",
    });
    expect(seen(yes.out, DAN).rematch?.bleu).toBe("yes");
    const no = vote(yes.table, ANA, false);
    expect(seen(no.out, BEN).rematch?.bleu).toBe("no");
    // The same vote twice changes nothing.
    expect(vote(yes.table, ANA, true).out).toEqual([]);
  });

  it("does not start while someone online has not agreed", () => {
    const yes = vote(won().table, ANA, true);
    expect(yes.table.gameNo).toBe(1);
    expect(yes.table.status).toBe("finished");
  });
});

describe("the rematch starts when every seated person online agrees", () => {
  function rematch(): { before: Table; table: Table; out: Out[] } {
    const before = won().table;
    const first = vote(before, ANA, true).table;
    const { table, out } = vote(first, BEN, true, 5000);
    return { before, table, out };
  }

  it("is a new game at the same table: gameNo + 1, the same seats, names and levels", () => {
    const { before, table } = rematch();
    expect(table.status).toBe("playing");
    expect(table.gameNo).toBe(2);
    expect(table.seats).toEqual(before.seats);
    expect(table.levels).toEqual(before.levels);
    expect(table.levels.vert).toBe(4);
    expect(table.game?.phase).toBe("exchange");
    expect(table.startedAt).toBe(5000);
    expect(table.endedAt).toBeNull();
  });

  it("deals from the new seed, with the seat after the previous first dealer dealing (A6)", () => {
    const { table } = rematch();
    expect(table.firstDealer).toBe(nextColor("vert"));
    expect(table.game?.dealer).toBe("bleu");
    // The hands are those of a game started from the seed the context gave (crypto in the object).
    const again = rematch().table;
    expect(again.game?.hands).toEqual(table.game?.hands);
    const other = vote(vote(won().table, ANA, true).table, BEN, true, 5000, [1, 2, 3, 4]).table;
    expect(other.game?.hands).not.toEqual(table.game?.hands);
  });

  it("sends each seated person one events frame with their own new hand only", () => {
    const { table, out } = rematch();
    for (const [who, seat] of [
      [ANA, "bleu"],
      [BEN, "jaune"],
    ] as [string, Color][]) {
      const frames = to(out, who).filter((frame): frame is EventsFrame => frame.t === "events");
      expect(frames).toHaveLength(1);
      const dealt = (frames[0] as EventsFrame).events.filter(
        (event): event is Extract<GameEvent, { t: "handDealt" }> => event.t === "handDealt",
      );
      expect(dealt.length).toBe(4);
      for (const event of dealt) {
        if (event.seat === seat) expect(event.cards).toEqual(table.game?.hands[seat]);
        else expect(event.cards).toBeNull();
      }
      expect((frames[0] as EventsFrame).view.seat).toBe(seat);
    }
    expect(to(out, DAN).some((frame) => frame.t === "events")).toBe(false);
  });

  it("the table frame comes before the events, with the votes reset and no winner", () => {
    const { out } = rematch();
    const frames = to(out, ANA);
    const tableAt = frames.findIndex((frame) => frame.t === "table");
    const eventsAt = frames.findIndex((frame) => frame.t === "events");
    expect(tableAt).toBeGreaterThanOrEqual(0);
    expect(tableAt).toBeLessThan(eventsAt);
    const pub = seen(out, DAN);
    expect(pub.status).toBe("playing");
    expect(pub.gameNo).toBe(2);
    expect(pub.winner).toBeNull();
    expect(pub.rematch).toBeNull();
  });

  it("the computers play the new game (their deadline is armed)", () => {
    const { table } = rematch();
    expect(table.deadlines.bot).toBeDefined();
    expect(nextDeadline(table)).not.toBeNull();
  });

  it("a later rematch moves the first dealer on again", () => {
    let { table } = rematch();
    expect(table.firstDealer).toBe("bleu");
    // Fast-forward: mark the second game won by hand and vote again.
    if (table.game === null) throw new Error("no game");
    table = {
      ...table,
      status: "finished",
      endedAt: 9000,
      game: { ...table.game, phase: "won", winner: "jaune-vert" },
    };
    table = vote(vote(table, ANA, true, 9100).table, BEN, true, 9200).table;
    expect(table.gameNo).toBe(3);
    expect(table.firstDealer).toBe("jaune");
  });
});

describe("someone offline at the end (UI-SPEC « à confirmer »)", () => {
  it("is shown offline; the others' votes alone start the rematch, their seat played by Galopeur", () => {
    const end = won().table;
    const away = reduce(end, { t: "gone", who: BEN }, ctx(3500));
    expect(away.table.status).toBe("finished");
    expect(seen(away.out, ANA).rematch?.jaune).toBe("offline");
    const { table, out } = vote(away.table, ANA, true);
    expect(table.status).toBe("playing");
    expect(table.gameNo).toBe(2);
    expect(table.seats.jaune).toEqual({ kind: "human", who: BEN, handedOver: 3 });
    expect(seen(out, ANA).seats.jaune.handedOver).toBe(3);
    // Ben comes back: the seat is his again.
    const back = reduce(table, { t: "hello", who: BEN, name: "Ben" }, ctx(6000));
    expect(back.table.seats.jaune).toEqual({ kind: "human", who: BEN, handedOver: null });
    const welcome = to(back.out, BEN).find((frame): frame is WelcomeFrame => frame.t === "welcome");
    expect(welcome?.regained).toBe(true);
    expect(welcome?.view?.seat).toBe("jaune");
  });

  it("going offline after agreeing withdraws the vote; leaving starts it for the others", () => {
    const end = won().table;
    const benYes = vote(end, BEN, true).table;
    const benGone = reduce(benYes, { t: "gone", who: BEN }, ctx(4100)).table;
    expect(benGone.status).toBe("finished");
    const back = reduce(benGone, { t: "hello", who: BEN, name: "Ben" }, ctx(4200));
    expect(seen(back.out, ANA).rematch?.jaune).toBe("no");
    // Ana agreed, then Ben leaves the table from the plank: the rematch starts without him.
    const anaYes = vote(back.table, ANA, true, 4300).table;
    const left = reduce(anaYes, client(BEN, { t: "leave" }), ctx(4400, NEW_SEED));
    expect(left.table.gameNo).toBe(2);
    expect(left.table.seats.jaune).toEqual({ kind: "human", who: BEN, handedOver: 3 });
  });

  it("when everyone is gone the table stays finished, waiting for the 30-day expiry", () => {
    const end = won().table;
    const one = reduce(end, client(ANA, { t: "leave" }), ctx(3500)).table;
    const two = reduce(one, { t: "gone", who: BEN }, ctx(3600)).table;
    const three = reduce(two, { t: "gone", who: DAN }, ctx(3700)).table;
    expect(three.status).toBe("finished");
    expect(three.gameNo).toBe(1);
    expect(three.deadlines.expire).toBeDefined();
  });
});

describe("the record of a finished game (plan 02-09 Task 2, HIST-01, D-14)", () => {
  it("the winning step carries one record: game, times, winner, seats, deals, captures", () => {
    const result = won();
    expect(result.records).toEqual([
      {
        gameNo: 1,
        startedAt: 2000,
        endedAt: 3000,
        winner: "bleu-rouge",
        seats: [
          { colour: "bleu", kind: "human", name: "Ana", level: null, handedOver: false },
          { colour: "jaune", kind: "human", name: "Ben", level: null, handedOver: false },
          {
            colour: "rouge",
            kind: "bot",
            name: (result.table.seats.rouge as { name: string }).name,
            level: 3,
            handedOver: false,
          },
          {
            colour: "vert",
            kind: "bot",
            name: (result.table.seats.vert as { name: string }).name,
            level: 4,
            handedOver: false,
          },
        ],
        deals: 0,
        captures: { "bleu-rouge": 0, "jaune-vert": 0 },
      },
    ]);
    expect(result.table.records).toEqual(result.records);
  });

  it("holds no table id, person id, token or card", () => {
    const text = JSON.stringify(won().records);
    expect(text).not.toContain(ID);
    expect(text).not.toContain("who-");
    expect(text).not.toMatch(/"(1[0-3]|[1-9])[SHDC]"/);
  });

  it("is pending until recorded, with the d1Retry deadline a minute later", () => {
    const { table } = won();
    expect(table.deadlines.d1Retry).toEqual({ at: 3000 + 60_000, attempt: 1 });
    expect(nextDeadline(table)).toBe(3000 + 60_000);
    const done = reduce(table, { t: "recorded", gameNo: 1 }, ctx(3100));
    expect(done.table.records).toEqual([]);
    expect(done.table.deadlines.d1Retry).toBeUndefined();
    expect(done.out).toEqual([]);
    expect(done.records).toBeUndefined();
    // Recorded twice, or another number: nothing changes.
    expect(reduce(done.table, { t: "recorded", gameNo: 1 }, ctx(3200)).table).toBe(done.table);
    expect(reduce(table, { t: "recorded", gameNo: 7 }, ctx(3200)).table.records).toHaveLength(1);
  });

  it("only the winning step carries it; a vote, a hello or a tick before the deadline do not", () => {
    const { table } = won();
    expect(vote(table, ANA, true).records).toBeUndefined();
    expect(reduce(table, { t: "hello", who: BEN, name: "Ben" }, ctx(3100)).records).toBeUndefined();
    expect(reduce(table, { t: "tick", retry: false }, ctx(3100)).records).toBeUndefined();
  });

  it("a failed write is retried by the alarm after 1 minute, then 10, then 60, then every 60", () => {
    let table = won().table;
    let at = 3000 + 60_000;
    for (const delay of [600_000, 3_600_000, 3_600_000]) {
      const tick = reduce(table, { t: "tick", retry: false }, ctx(at));
      expect(tick.records?.map((record) => record.gameNo)).toEqual([1]);
      expect(tick.table.deadlines.d1Retry?.at).toBe(at + delay);
      expect(tick.out).toEqual([]);
      table = tick.table;
      at += delay;
    }
    // The snapshot is plain JSON: the pending record survives an eviction.
    const reread = JSON.parse(JSON.stringify(table)) as Table;
    expect(reduce(reread, { t: "tick", retry: false }, ctx(at)).records).toHaveLength(1);
    const done = reduce(table, { t: "recorded", gameNo: 1 }, ctx(at));
    expect(done.table.deadlines.d1Retry).toBeUndefined();
  });

  it("a rematch won before the first record was written keeps both pending", () => {
    const first = won().table;
    let table = vote(vote(first, ANA, true).table, BEN, true, 5000).table;
    if (table.game === null) throw new Error("no game");
    // The second game is won by hand (a real play is in the property tests).
    table = reduce(
      {
        ...table,
        game: {
          ...table.game,
          phase: "play",
          turn: "bleu",
          hands: { ...table.game.hands, bleu: ["5S"] },
          pawns: {
            ...table.game.pawns,
            bleu0: { zone: "home", slot: 1 },
            bleu1: { zone: "home", slot: 2 },
            bleu2: { zone: "home", slot: 3 },
            bleu3: { zone: "ring", progress: 66 },
            rouge0: { zone: "home", slot: 0 },
            rouge1: { zone: "home", slot: 1 },
            rouge2: { zone: "home", slot: 2 },
            rouge3: { zone: "home", slot: 3 },
          },
        },
      },
      client(ANA, { t: "act", base: table.seq, action: { t: "move", card: "5S", pawn: "bleu3" } }),
      ctx(8000),
    ).table;
    expect(table.status).toBe("finished");
    expect(table.records.map((record) => record.gameNo)).toEqual([1, 2]);
    const one = reduce(table, { t: "recorded", gameNo: 1 }, ctx(8100)).table;
    expect(one.records.map((record) => record.gameNo)).toEqual([2]);
    expect(one.deadlines.d1Retry).toBeDefined();
  });

  it("a seat handed to the computer is recorded with its level", () => {
    const end = won().table;
    const away = reduce(end, { t: "gone", who: BEN }, ctx(3500)).table;
    const table = vote(away, ANA, true).table;
    expect(table.seats.jaune).toEqual({ kind: "human", who: BEN, handedOver: 3 });
    // Fast-forward to the end of that game.
    if (table.game === null) throw new Error("no game");
    const record = gameRecordOf({
      ...table,
      status: "finished",
      endedAt: 9000,
      game: { ...table.game, phase: "won", winner: "jaune-vert" },
    });
    expect(record.seats[1]).toEqual({
      colour: "jaune",
      kind: "human",
      name: "Ben",
      level: 3,
      handedOver: true,
    });
    expect(record.winner).toBe("jaune-vert");
  });
});
