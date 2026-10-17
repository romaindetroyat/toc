// Presence, the pause and the chef de table's three choices (plan 02-06, D-04, D-05, NET-03, NET-04;
// 02-RESEARCH Patterns 6 and 7). Every case gives its clock explicitly: the pause's minute is a
// deadline of the table, fired by the Durable Object's alarm as a tick.

import type { Rng } from "@toc/engine";
import type { ServerFrame, TableFrame, TablePublic, WelcomeFrame } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import {
  createTable,
  hostOf,
  nextDeadline,
  type Out,
  PAUSE_MS,
  reduce,
  SILENCE_MS,
  SWEEP_MS,
  type Table,
} from "./index.ts";

const ID = "abcdefghijklmnopqrstuv";
const ANA = "who-ana";
const BEN = "who-ben";
const CLO = "who-clo";
const DAN = "who-dan";
const ctx = (now: number) => ({ now, seed: (): Rng => [11, 22, 33, 44] });

type Command = Parameters<typeof reduce>[1];
type ClientFrameOf = Extract<Command, { t: "client" }>["frame"];

const client = (who: string, frame: ClientFrameOf): Command => ({ t: "client", who, frame });

function run(table: Table, commands: Command[], now: number) {
  let t = table;
  let out: Out[] = [];
  for (const command of commands) {
    const result = reduce(t, command, ctx(now));
    t = result.table;
    out = result.out;
  }
  return { table: t, out };
}

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

/**
 * Ana (creator, bleu), Ben (jaune) and Clo (rouge) started at 2000 with a computer on vert; Dan is at
 * the table without a seat. `pauseMs` is the test option of the pause's minute.
 */
function started(pauseMs?: number): Table {
  const test =
    pauseMs === undefined ? { pace: "zero" as const } : { pace: "zero" as const, pauseMs };
  const lobby = run(
    createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8], test }),
    [
      { t: "hello", who: ANA, name: "Ana" },
      { t: "hello", who: BEN, name: "Ben" },
      { t: "hello", who: CLO, name: "Clo" },
      client(ANA, { t: "sit", seat: "bleu" }),
      client(BEN, { t: "sit", seat: "jaune" }),
      client(CLO, { t: "sit", seat: "rouge" }),
    ],
    1000,
  ).table;
  const table = reduce(lobby, client(ANA, { t: "start" }), ctx(2000)).table;
  return reduce(table, { t: "hello", who: DAN, name: "Dan" }, ctx(2000)).table;
}

/** Ben's socket closed at 3000: the game is paused for him. */
function benGone(pauseMs?: number) {
  return reduce(started(pauseMs), { t: "gone", who: BEN }, ctx(3000));
}

describe("a seated person gone during the game pauses it for everyone (NET-03)", () => {
  it("pauses in the exchange, drops the computer's turn and arms the minute", () => {
    const before = started();
    expect(before.game?.phase).toBe("exchange");
    expect(before.thinking).not.toBeNull();
    const { table, out } = benGone();
    expect(table.status).toBe("paused");
    expect(table.pause).toEqual({
      missing: ["jaune"],
      since: 3000,
      choiceAt: 3000 + PAUSE_MS,
      choosing: false,
    });
    expect(table.deadlines.bot).toBeUndefined();
    expect(table.deadlines.pauseChoice).toEqual({ at: 3000 + PAUSE_MS });
    expect(table.thinking).toBeNull();
    expect(PAUSE_MS).toBe(60_000);
    for (const who of [ANA, CLO, DAN]) {
      const shown = seen(out, who);
      expect(shown.status).toBe("paused");
      expect(shown.pause).toEqual({
        missing: ["jaune"],
        since: 3000,
        choiceAt: 63_000,
        choosing: false,
      });
      expect(shown.seats.jaune).toMatchObject({
        kind: "human",
        name: "Ben",
        online: false,
        handedOver: null,
      });
      expect(shown.now).toBe(3000);
    }
    expect(to(out, BEN)).toEqual([]);
  });

  it("uses the test option's minute", () => {
    expect(benGone(2000).table.pause?.choiceAt).toBe(5000);
  });

  it("adds a second missing seat without moving the minute", () => {
    const { table } = reduce(benGone().table, { t: "gone", who: CLO }, ctx(10_000));
    expect(table.pause).toEqual({
      missing: ["jaune", "rouge"],
      since: 3000,
      choiceAt: 63_000,
      choosing: false,
    });
  });

  it("refuses every act while paused and changes nothing", () => {
    const paused = benGone().table;
    const refused = reduce(
      paused,
      client(ANA, { t: "act", base: paused.seq, action: { t: "discard" } }),
      ctx(4000),
    );
    expect(to(refused.out, ANA)).toEqual([{ t: "error", code: "paused" }]);
    expect(refused.table).toBe(paused);
  });

  it("plays no computer while paused, even on a tick", () => {
    const paused = benGone().table;
    const tick = reduce(paused, { t: "tick", retry: false }, ctx(30_000));
    expect(tick.log).toEqual([]);
    expect(tick.table.seq).toBe(paused.seq);
    expect(tick.table.deadlines.bot).toBeUndefined();
  });

  it("only marks a person offline in the waiting room (no pause)", () => {
    const lobby = run(
      createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8], test: { pace: "zero" } }),
      [
        { t: "hello", who: ANA, name: "Ana" },
        { t: "hello", who: BEN, name: "Ben" },
        client(BEN, { t: "sit", seat: "jaune" }),
      ],
      1000,
    ).table;
    const { table } = reduce(lobby, { t: "gone", who: BEN }, ctx(2000));
    expect(table.status).toBe("lobby");
    expect(table.pause).toBeNull();
    expect(table.people.find((p) => p.who === BEN)?.online).toBe(false);
  });

  it("does not pause for someone without a seat", () => {
    const { table } = reduce(started(), { t: "gone", who: DAN }, ctx(3000));
    expect(table.status).toBe("playing");
    expect(table.pause).toBeNull();
  });
});

describe("the minute, then the host's choice (NET-04, D-04)", () => {
  it("lets the host choose once the minute is over", () => {
    const paused = benGone().table;
    expect(nextDeadline(paused)).toBeLessThanOrEqual(63_000);
    const early = reduce(paused, { t: "tick", retry: false }, ctx(62_999));
    expect(early.table.pause?.choosing).toBe(false);
    const { table, out } = reduce(paused, { t: "tick", retry: false }, ctx(63_000));
    expect(table.pause?.choosing).toBe(true);
    expect(table.deadlines.pauseChoice).toBeUndefined();
    expect(seen(out, ANA).pause?.choosing).toBe(true);
    expect(seen(out, CLO).pause?.choosing).toBe(true);
  });

  it("saves the game by itself when nobody is online at the end of the minute", () => {
    let table = benGone().table;
    table = run(
      table,
      [
        { t: "gone", who: ANA },
        { t: "gone", who: CLO },
      ],
      4000,
    ).table;
    const due = reduce(table, { t: "tick", retry: false }, ctx(63_000));
    expect(due.table.status).toBe("saved");
    expect(due.table.pause).toBeNull();
    expect(due.table.deadlines.bot).toBeUndefined();
  });

  it("refuses a choice from anyone but the host, and before the minute is over", () => {
    const paused = benGone().table;
    const early = reduce(paused, client(ANA, { t: "pause", choice: "bot" }), ctx(4000));
    expect(to(early.out, ANA)).toEqual([{ t: "error", code: "refused" }]);
    const choosing = reduce(paused, { t: "tick", retry: false }, ctx(63_000)).table;
    for (const who of [CLO, DAN]) {
      const refused = reduce(choosing, client(who, { t: "pause", choice: "save" }), ctx(64_000));
      expect(to(refused.out, who)).toEqual([{ t: "error", code: "not-host" }]);
      expect(refused.table).toBe(choosing);
    }
    const playing = started();
    const notPaused = reduce(playing, client(ANA, { t: "pause", choice: "wait" }), ctx(4000));
    expect(to(notPaused.out, ANA)).toEqual([{ t: "error", code: "refused" }]);
  });

  it("« Attendre encore une minute » restarts the minute", () => {
    const choosing = reduce(benGone().table, { t: "tick", retry: false }, ctx(63_000)).table;
    const { table, out } = reduce(
      choosing,
      client(ANA, { t: "pause", choice: "wait" }),
      ctx(70_000),
    );
    expect(table.status).toBe("paused");
    expect(table.pause).toEqual({
      missing: ["jaune"],
      since: 3000,
      choiceAt: 130_000,
      choosing: false,
    });
    expect(table.deadlines.pauseChoice).toEqual({ at: 130_000 });
    expect(seen(out, CLO).pause?.choiceAt).toBe(130_000);
  });

  it("« Confier » gives every missing seat to the computer at the chosen level, and the game goes on", () => {
    let table = benGone().table;
    table = reduce(table, { t: "gone", who: CLO }, ctx(4000)).table;
    table = reduce(table, { t: "tick", retry: false }, ctx(63_000)).table;
    const { table: next, out } = reduce(
      table,
      client(ANA, { t: "pause", choice: "bot", level: 4 }),
      ctx(64_000),
    );
    expect(next.status).toBe("playing");
    expect(next.pause).toBeNull();
    expect(next.seats.jaune).toEqual({ kind: "human", who: BEN, handedOver: 4 });
    expect(next.seats.rouge).toEqual({ kind: "human", who: CLO, handedOver: 4 });
    expect(next.deadlines.pauseChoice).toBeUndefined();
    // The exchange: the first computer seat that has not given is due, a handed-over seat included.
    expect(next.thinking?.seat).toBe("jaune");
    expect(next.thinking?.level).toBe(4);
    expect(next.deadlines.bot).toBeDefined();
    const shown = seen(out, ANA);
    expect(shown.status).toBe("playing");
    expect(shown.seats.jaune.handedOver).toBe(4);
    expect(shown.thinking).toBe("jaune");
  });

  it("gives the seat at Galopeur when no level is sent, and the computer plays it", () => {
    let table = reduce(benGone().table, { t: "tick", retry: false }, ctx(63_000)).table;
    table = reduce(table, client(ANA, { t: "pause", choice: "bot" }), ctx(64_000)).table;
    expect(table.seats.jaune).toEqual({ kind: "human", who: BEN, handedOver: 3 });
    const given = table.game?.given.jaune ?? null;
    expect(given).toBeNull();
    // Ticks until jaune has given.
    let now = 64_000;
    for (let i = 0; i < 20 && table.game?.given.jaune === null; i++) {
      now = Math.max(now, nextDeadline(table) ?? now);
      table = reduce(table, { t: "tick", retry: false }, ctx(now)).table;
    }
    expect(table.game?.given.jaune).not.toBeNull();
  });

  it("« Sauvegarder et arrêter » saves: no computer plays, and a tick changes nothing", () => {
    const choosing = reduce(benGone().table, { t: "tick", retry: false }, ctx(63_000)).table;
    const { table, out } = reduce(
      choosing,
      client(ANA, { t: "pause", choice: "save" }),
      ctx(64_000),
    );
    expect(table.status).toBe("saved");
    expect(table.pause).toBeNull();
    expect(table.deadlines.bot).toBeUndefined();
    expect(table.deadlines.pauseChoice).toBeUndefined();
    expect(seen(out, CLO).status).toBe("saved");
    const tick = reduce(table, { t: "tick", retry: false }, ctx(200_000));
    expect(tick.log).toEqual([]);
    const act = reduce(
      table,
      client(ANA, { t: "act", base: table.seq, action: { t: "discard" } }),
      ctx(65_000),
    );
    expect(to(act.out, ANA)).toEqual([{ t: "error", code: "paused" }]);
  });
});

describe("a returning player gets the seat back at once", () => {
  it("ends the pause when nobody is missing any more", () => {
    const { table, out } = reduce(
      benGone().table,
      { t: "hello", who: BEN, name: "Ben" },
      ctx(5000),
    );
    expect(table.status).toBe("playing");
    expect(table.pause).toBeNull();
    expect(table.deadlines.pauseChoice).toBeUndefined();
    expect(table.thinking).not.toBeNull();
    const welcome = to(out, BEN)[0] as WelcomeFrame;
    expect(welcome).toMatchObject({
      t: "welcome",
      you: { seat: "jaune" },
      table: { status: "playing", pause: null },
    });
    expect(welcome.view).not.toBeNull();
    expect(welcome.regained).toBeUndefined();
    expect(seen(out, ANA).status).toBe("playing");
  });

  it("keeps the pause while another seat is still missing", () => {
    let table = benGone().table;
    table = reduce(table, { t: "gone", who: CLO }, ctx(4000)).table;
    table = reduce(table, { t: "hello", who: BEN, name: "Ben" }, ctx(5000)).table;
    expect(table.status).toBe("paused");
    expect(table.pause?.missing).toEqual(["rouge"]);
  });

  it("gives a handed-over seat back and drops the computer's pending move for it", () => {
    let table = reduce(benGone().table, { t: "tick", retry: false }, ctx(63_000)).table;
    table = reduce(table, client(ANA, { t: "pause", choice: "bot", level: 4 }), ctx(64_000)).table;
    expect(table.thinking?.seat).toBe("jaune");
    const { table: back, out } = reduce(table, { t: "hello", who: BEN, name: "Ben" }, ctx(64_001));
    expect(back.seats.jaune).toEqual({ kind: "human", who: BEN, handedOver: null });
    expect(back.thinking?.seat).not.toBe("jaune");
    expect(back.status).toBe("playing");
    expect(to(out, BEN)[0]).toMatchObject({ t: "welcome", regained: true, you: { seat: "jaune" } });
    expect(seen(out, ANA).seats.jaune).toMatchObject({ online: true, handedOver: null });
    // Ben may give at once.
    const view = (to(out, BEN)[0] as WelcomeFrame).view;
    const card = view?.hand[0];
    if (card === undefined) throw new Error("no card");
    const gave = reduce(
      back,
      client(BEN, { t: "act", base: back.seq, action: { t: "give", card } }),
      ctx(64_002),
    );
    expect(gave.log).toHaveLength(1);
  });

  it("a handed-over seat whose player is gone again does not pause the game", () => {
    let table = reduce(benGone().table, { t: "tick", retry: false }, ctx(63_000)).table;
    table = reduce(table, client(ANA, { t: "pause", choice: "bot" }), ctx(64_000)).table;
    // Ben was offline already: a gone of nobody online changes nothing.
    expect(reduce(table, { t: "gone", who: BEN }, ctx(65_000)).table.status).toBe("playing");
  });
});

describe("« Reprendre la partie » (resume)", () => {
  function saved(): Table {
    const choosing = reduce(benGone().table, { t: "tick", retry: false }, ctx(63_000)).table;
    return reduce(choosing, client(ANA, { t: "pause", choice: "save" }), ctx(64_000)).table;
  }

  it("is the host's, while saved only", () => {
    const table = reduce(saved(), { t: "hello", who: BEN, name: "Ben" }, ctx(70_000)).table;
    expect(table.status).toBe("saved");
    const byBen = reduce(table, client(BEN, { t: "resume" }), ctx(71_000));
    expect(to(byBen.out, BEN)).toEqual([{ t: "error", code: "not-host" }]);
    const playing = started();
    expect(to(reduce(playing, client(ANA, { t: "resume" }), ctx(4000)).out, ANA)).toEqual([
      { t: "error", code: "refused" },
    ]);
  });

  it("plays on when every seated person is online", () => {
    const table = reduce(saved(), { t: "hello", who: BEN, name: "Ben" }, ctx(70_000)).table;
    const { table: next, out } = reduce(table, client(ANA, { t: "resume" }), ctx(71_000));
    expect(next.status).toBe("playing");
    expect(next.deadlines.bot).toBeDefined();
    expect(seen(out, BEN).status).toBe("playing");
  });

  it("starts the pause flow at once with a fresh minute when someone is still missing", () => {
    const { table } = reduce(saved(), client(ANA, { t: "resume" }), ctx(80_000));
    expect(table.status).toBe("paused");
    expect(table.pause).toEqual({
      missing: ["jaune"],
      since: 80_000,
      choiceAt: 140_000,
      choosing: false,
    });
  });
});

describe("the chef de table (D-05): the creator, else the next person online clockwise", () => {
  it("is derived on every change and comes back to the creator", () => {
    const table = started();
    expect(hostOf(table)).toBe(ANA);
    const anaGone = reduce(table, { t: "gone", who: ANA }, ctx(3000));
    expect(hostOf(anaGone.table)).toBe(BEN);
    expect(seen(anaGone.out, BEN).host).toBe("jaune");
    expect(seen(anaGone.out, CLO).host).toBe("jaune");
    const benToo = reduce(anaGone.table, { t: "gone", who: BEN }, ctx(3500));
    expect(hostOf(benToo.table)).toBe(CLO);
    expect(seen(benToo.out, CLO).host).toBe("rouge");
    // Dan has no seat: never the host.
    const all = reduce(benToo.table, { t: "gone", who: CLO }, ctx(3600));
    expect(hostOf(all.table)).toBeNull();
    expect(seen(all.out, DAN).host).toBeNull();
    const back = reduce(all.table, { t: "hello", who: ANA, name: "Ana" }, ctx(4000));
    expect(hostOf(back.table)).toBe(ANA);
    expect(to(back.out, ANA)[0]).toMatchObject({ t: "welcome", you: { seat: "bleu", host: true } });
  });

  it("lets the next person choose while the creator is away", () => {
    let table = run(started(), [{ t: "gone", who: ANA }], 3000).table;
    table = reduce(table, { t: "tick", retry: false }, ctx(63_000)).table;
    expect(table.pause?.choosing).toBe(true);
    const byAna = reduce(table, client(CLO, { t: "pause", choice: "save" }), ctx(64_000));
    expect(to(byAna.out, CLO)).toEqual([{ t: "error", code: "not-host" }]);
    const byBen = reduce(table, client(BEN, { t: "pause", choice: "save" }), ctx(64_000));
    expect(byBen.table.status).toBe("saved");
  });
});

describe("the silence sweep", () => {
  it("names its thresholds", () => {
    expect([SWEEP_MS, SILENCE_MS]).toEqual([30_000, 75_000]);
  });

  it("is armed while a game runs or waits with someone online, and a tick only re-arms it", () => {
    const table = started();
    expect(table.deadlines.sweep).toEqual({ at: 2000 + SWEEP_MS });
    // Under the zero pace the computer is due at once; the sweep alone moves on its own tick.
    const quiet = {
      ...table,
      deadlines: { sweep: table.deadlines.sweep },
      thinking: null,
    } as Table;
    const { table: next, out, log } = reduce(quiet, { t: "tick", retry: false }, ctx(32_000));
    expect(next.deadlines.sweep).toEqual({ at: 32_000 + SWEEP_MS });
    expect(log).toEqual([]);
    expect(out.filter((each) => each.frame.t !== "table")).toEqual([]);
    expect(benGone().table.deadlines.sweep).toBeDefined();
  });

  it("is not armed in the waiting room nor once saved", () => {
    const lobby = reduce(
      createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8] }),
      { t: "hello", who: ANA, name: "Ana" },
      ctx(1000),
    ).table;
    expect(lobby.deadlines.sweep).toBeUndefined();
    const choosing = reduce(benGone().table, { t: "tick", retry: false }, ctx(63_000)).table;
    const saved = reduce(choosing, client(ANA, { t: "pause", choice: "save" }), ctx(64_000)).table;
    expect(saved.deadlines.sweep).toBeUndefined();
  });
});
