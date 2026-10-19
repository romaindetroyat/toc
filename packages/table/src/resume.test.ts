// Coming back to a table (plan 02-07, NET-02, HIST-01, SC3, SC4, D-06, D-12; 02-RESEARCH Patterns
// 3, 5 and 9, Pitfall 7, A7). The welcome snapshot is the only resync: after a reconnect, a stop or
// days later it deep-equals viewFor of the stored game for the reader's seat. The chef de table stops
// the game at any moment; a person leaves a game (the others' pause); a table idle for 30 days is
// purged by its own deadline; and someone who began on another device gets their own seat back, only
// with the chef de table's yes.

import { type Color, type Rng, scenarioState, viewFor } from "@toc/engine";
import type { ServerFrame, TableFrame, TablePublic, WelcomeFrame } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import {
  copyTable,
  createTable,
  EXPIRY_MS,
  hostOf,
  nextDeadline,
  type Out,
  reduce,
  summary,
  type Table,
} from "./index.ts";

const ID = "abcdefghijklmnopqrstuv";
const ANA = "who-ana";
const BEN = "who-ben";
const CLO = "who-clo";
const DAN = "who-dan";
/** Someone who opens the link on another device (or another app) and types « Bruno ». */
const NEW = "who-new";
const DAY = 24 * 60 * 60 * 1000;
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

function welcomeOf(out: Out[], who: string): WelcomeFrame {
  const frame = to(out, who).find((each): each is WelcomeFrame => each.t === "welcome");
  if (frame === undefined) throw new Error(`no welcome for ${who}`);
  return frame;
}

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
 * the table without a seat.
 */
function started(): Table {
  const lobby = run(
    createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8], test: { pace: "zero" } }),
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

/** Ticks the computer until every computer seat has given and play has begun (people give too). */
function inPlay(): Table {
  let table = started();
  let now = 2000;
  for (let i = 0; i < 40 && table.game?.phase === "exchange"; i++) {
    const game = table.game;
    const giver = (["bleu", "jaune", "rouge"] as const).find((c) => game.given[c] === null);
    if (giver !== undefined) {
      const who = { bleu: ANA, jaune: BEN, rouge: CLO }[giver];
      const card = game.hands[giver][0];
      if (card === undefined) throw new Error("no card");
      table = reduce(
        table,
        client(who, { t: "act", base: table.seq, action: { t: "give", card } }),
        ctx(now),
      ).table;
      continue;
    }
    now = Math.max(now, nextDeadline(table) ?? now);
    table = reduce(table, { t: "tick", retry: false }, ctx(now)).table;
  }
  if (table.game?.phase !== "play") throw new Error("not in play");
  return table;
}

const gameOf = (table: Table) => {
  if (table.game === null) throw new Error("no game");
  return table.game;
};

describe("the welcome snapshot is the only resync (NET-02, SC3)", () => {
  it("after a reconnect the welcome deep-equals viewFor of the stored game for that seat", () => {
    const table = inPlay();
    const gone = reduce(table, { t: "gone", who: BEN }, ctx(5000)).table;
    const back = reduce(gone, { t: "hello", who: BEN, name: "Ben" }, ctx(6000));
    const welcome = welcomeOf(back.out, BEN);
    expect(welcome.you.seat).toBe("jaune");
    expect(welcome.view).toEqual(viewFor(gameOf(back.table), "jaune"));
    // The same game as before the reconnect: hand, deal, knights, whose turn.
    expect(welcome.view).toEqual(viewFor(gameOf(table), "jaune"));
    expect(welcome.seq).toBe(table.seq);
    expect(back.table.status).toBe("playing");
    // Nothing is replayed: one welcome, no events frame.
    expect(to(back.out, BEN).filter((frame) => frame.t === "events")).toEqual([]);
  });

  it("a stopped game read again three days later gives the same view, then resumes exactly", () => {
    const table = inPlay();
    const views = {
      bleu: viewFor(gameOf(table), "bleu"),
      jaune: viewFor(gameOf(table), "jaune"),
    };
    let stopped = reduce(table, client(ANA, { t: "stop" }), ctx(7000)).table;
    stopped = run(
      stopped,
      [
        { t: "gone", who: ANA },
        { t: "gone", who: BEN },
        { t: "gone", who: CLO },
        { t: "gone", who: DAN },
      ],
      8000,
    ).table;
    const later = 7000 + 3 * DAY;
    const ana = reduce(stopped, { t: "hello", who: ANA, name: "Ana" }, ctx(later));
    expect(welcomeOf(ana.out, ANA).view).toEqual(views.bleu);
    expect(welcomeOf(ana.out, ANA).table.status).toBe("saved");
    const ben = reduce(ana.table, { t: "hello", who: BEN, name: "Ben" }, ctx(later + 1));
    expect(welcomeOf(ben.out, BEN).view).toEqual(views.jaune);
    const clo = reduce(ben.table, { t: "hello", who: CLO, name: "Clo" }, ctx(later + 2)).table;
    const resumed = reduce(clo, client(ANA, { t: "resume" }), ctx(later + 3)).table;
    expect(resumed.status).toBe("playing");
    expect(resumed.game).toEqual(table.game);
    expect(resumed.seq).toBe(table.seq);
  });
});

describe("« Arrêter la partie »: the chef de table stops at any moment (SC4, D-06)", () => {
  it("saves the game for everyone, in the exchange too", () => {
    const table = started();
    expect(gameOf(table).phase).toBe("exchange");
    const { table: stopped, out } = reduce(table, client(ANA, { t: "stop" }), ctx(3000));
    expect(stopped.status).toBe("saved");
    expect(stopped.pause).toBeNull();
    expect(stopped.thinking).toBeNull();
    expect(stopped.deadlines.bot).toBeUndefined();
    expect(stopped.game).toEqual(table.game);
    for (const who of [ANA, BEN, CLO, DAN]) expect(seen(out, who).status).toBe("saved");
  });

  it("saves a paused game too", () => {
    const paused = reduce(inPlay(), { t: "gone", who: BEN }, ctx(5000)).table;
    expect(paused.status).toBe("paused");
    const { table } = reduce(paused, client(ANA, { t: "stop" }), ctx(6000));
    expect(table.status).toBe("saved");
    expect(table.deadlines.pauseChoice).toBeUndefined();
  });

  it("refuses a stop from anyone but the chef de table, in the waiting room and once saved", () => {
    const table = inPlay();
    for (const who of [BEN, DAN]) {
      const refused = reduce(table, client(who, { t: "stop" }), ctx(5000));
      expect(to(refused.out, who)).toEqual([{ t: "error", code: "not-host" }]);
      expect(refused.table).toBe(table);
    }
    const saved = reduce(table, client(ANA, { t: "stop" }), ctx(5000)).table;
    const again = reduce(saved, client(ANA, { t: "stop" }), ctx(5001));
    expect(to(again.out, ANA)).toEqual([{ t: "error", code: "refused" }]);
    const lobby = run(
      createTable({ tableId: ID, now: 0, seed: [5, 6, 7, 8] }),
      [{ t: "hello", who: ANA, name: "Ana" }],
      0,
    ).table;
    const early = reduce(lobby, client(ANA, { t: "stop" }), ctx(1));
    expect(to(early.out, ANA)).toEqual([{ t: "error", code: "refused" }]);
  });

  it("lets the next chef de table stop while the creator is away", () => {
    const table = reduce(inPlay(), { t: "gone", who: ANA }, ctx(5000)).table;
    expect(hostOf(table)).toBe(BEN);
    expect(reduce(table, client(BEN, { t: "stop" }), ctx(6000)).table.status).toBe("saved");
  });
});

describe("« Quitter la table » during a game", () => {
  it("takes the person offline: the game pauses for the others", () => {
    const table = inPlay();
    const { table: left, out } = reduce(table, client(BEN, { t: "leave" }), ctx(5000));
    expect(left.people.find((p) => p.who === BEN)).toMatchObject({ seat: "jaune", online: false });
    expect(left.seats.jaune).toMatchObject({ kind: "human", who: BEN });
    expect(left.status).toBe("paused");
    expect(left.pause?.missing).toEqual(["jaune"]);
    expect(seen(out, ANA).status).toBe("paused");
    // The socket's close that follows changes nothing more.
    expect(reduce(left, { t: "gone", who: BEN }, ctx(5001)).table).toBe(left);
    // Back with the same link: the same seat, the game goes on.
    const back = reduce(left, { t: "hello", who: BEN, name: "Ben" }, ctx(9000));
    expect(back.table.status).toBe("playing");
    expect(welcomeOf(back.out, BEN).you.seat).toBe("jaune");
  });

  it("lets someone without a seat go as before", () => {
    const { table } = reduce(inPlay(), client(DAN, { t: "leave" }), ctx(5000));
    expect(table.people.find((p) => p.who === DAN)).toBeUndefined();
    expect(table.status).toBe("playing");
  });
});

describe("the 30-day expiry (D-06)", () => {
  it("is armed with the table at createdAt + 30 days", () => {
    expect(EXPIRY_MS).toBe(30 * DAY);
    const table = createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8] });
    expect(table.deadlines.expire).toEqual({ at: 1000 + EXPIRY_MS });
    expect(nextDeadline(table)).toBe(1000 + EXPIRY_MS);
  });

  it("counts a client command or a hello as activity, never a tick or a socket gone", () => {
    const table = inPlay();
    const hello = reduce(table, { t: "hello", who: DAN, name: "Dan" }, ctx(50_000)).table;
    expect(hello.lastActivity).toBe(50_000);
    const stopped = reduce(hello, client(ANA, { t: "stop" }), ctx(60_000)).table;
    expect(stopped.lastActivity).toBe(60_000);
    const gone = reduce(stopped, { t: "gone", who: CLO }, ctx(70_000)).table;
    expect(gone.lastActivity).toBe(60_000);
    const ticked = reduce(gone, { t: "tick", retry: false }, ctx(80_000)).table;
    expect(ticked.lastActivity).toBe(60_000);
  });

  it("a computer's move on a tick is no activity", () => {
    const table = started();
    expect(table.thinking).not.toBeNull();
    const ticked = reduce(table, { t: "tick", retry: false }, ctx(2500));
    expect(ticked.log).toHaveLength(1);
    expect(ticked.table.lastActivity).toBe(table.lastActivity);
  });

  it("re-arms at lastActivity + 30 days when it fires early; resumes at 29 days, purges at 31", () => {
    // Stopped on day 1, everyone gone.
    let table = reduce(inPlay(), client(ANA, { t: "stop" }), ctx(DAY)).table;
    table = run(
      table,
      [
        { t: "gone", who: ANA },
        { t: "gone", who: BEN },
        { t: "gone", who: CLO },
        { t: "gone", who: DAN },
      ],
      DAY,
    ).table;
    expect(table.deadlines.expire?.at).toBe(1000 + EXPIRY_MS);
    // It fires at day 30 after the creation: the last activity was on day 1, so not yet.
    const early = reduce(table, { t: "tick", retry: false }, ctx(1000 + EXPIRY_MS));
    expect(early.purge).toBeUndefined();
    expect(early.table.deadlines.expire).toEqual({ at: DAY + EXPIRY_MS });
    expect(nextDeadline(early.table)).toBe(DAY + EXPIRY_MS);
    expect(early.table.game).toEqual(table.game);
    // 29 days after the last activity: Ana, Ben and Clo come back and Ana resumes.
    const day30 = DAY + 29 * DAY;
    const back = run(
      early.table,
      [
        { t: "hello", who: ANA, name: "Ana" },
        { t: "hello", who: BEN, name: "Ben" },
        { t: "hello", who: CLO, name: "Clo" },
        client(ANA, { t: "resume" }),
      ],
      day30,
    ).table;
    expect(back.status).toBe("playing");
    expect(back.game).toEqual(table.game);
    // 31 days after the last activity (nobody came back): purged.
    const late = reduce(early.table, { t: "tick", retry: false }, ctx(DAY + 31 * DAY));
    expect(late.purge).toBe(true);
    expect(late.out).toEqual([]);
    // Exactly 30 days is the end.
    expect(reduce(early.table, { t: "tick", retry: false }, ctx(DAY + EXPIRY_MS)).purge).toBe(true);
  });

  it("pushes the date back with any activity before it", () => {
    let table = reduce(inPlay(), client(ANA, { t: "stop" }), ctx(DAY)).table;
    table = reduce(table, { t: "hello", who: BEN, name: "Ben" }, ctx(20 * DAY)).table;
    const fired = reduce(table, { t: "tick", retry: false }, ctx(1000 + EXPIRY_MS));
    expect(fired.purge).toBeUndefined();
    expect(fired.table.deadlines.expire).toEqual({ at: 20 * DAY + EXPIRY_MS });
  });

  it("gives a snapshot from before plan 02-07 its expiry on the next change", () => {
    const table = inPlay();
    const old = JSON.parse(JSON.stringify(table)) as Table;
    delete old.deadlines.expire;
    const next = reduce(old, { t: "hello", who: DAN, name: "Dan" }, ctx(9000)).table;
    expect(next.deadlines.expire).toEqual({ at: table.lastActivity + EXPIRY_MS });
  });
});

describe("the reclaim of one's own seat, with the chef de table's yes (D-12, A7, T-02-28)", () => {
  /** Ben's socket closed in play; Bruno opened the link on another device. */
  function asked() {
    let table = reduce(inPlay(), { t: "gone", who: BEN }, ctx(5000)).table;
    table = reduce(table, { t: "hello", who: NEW, name: "Bruno" }, ctx(6000)).table;
    return reduce(table, client(NEW, { t: "reclaim", seat: "jaune" }), ctx(7000));
  }

  it("asks the chef de table with the typed first name, and only them", () => {
    const { table, out } = asked();
    expect(to(out, ANA)).toEqual([{ t: "reclaimRequest", seat: "jaune", name: "Bruno" }]);
    expect(to(out, NEW)).toEqual([]);
    expect(to(out, CLO)).toEqual([]);
    expect(to(out, DAN)).toEqual([]);
    expect(table.reclaims.jaune).toEqual({ who: NEW, name: "Bruno", since: 7000 });
    expect(table.seats.jaune).toMatchObject({ kind: "human", who: BEN });
  });

  it("refuses a second request for the same seat while one is pending", () => {
    const { table } = asked();
    const second = reduce(table, client(DAN, { t: "reclaim", seat: "jaune" }), ctx(8000));
    expect(to(second.out, DAN)).toEqual([{ t: "reclaimResult", accepted: false }]);
    expect(to(second.out, ANA)).toEqual([]);
    expect(second.table.reclaims.jaune?.who).toBe(NEW);
  });

  it("refuses a request for an online seat, by a seated person, or in the waiting room", () => {
    const table = reduce(inPlay(), { t: "hello", who: NEW, name: "Bruno" }, ctx(6000)).table;
    const online = reduce(table, client(NEW, { t: "reclaim", seat: "jaune" }), ctx(7000));
    expect(to(online.out, NEW)).toEqual([{ t: "reclaimResult", accepted: false }]);
    expect(to(online.out, ANA)).toEqual([]);
    const gone = reduce(table, { t: "gone", who: BEN }, ctx(7000)).table;
    const seated = reduce(gone, client(CLO, { t: "reclaim", seat: "jaune" }), ctx(8000));
    expect(to(seated.out, CLO)).toEqual([{ t: "reclaimResult", accepted: false }]);
    expect(to(seated.out, ANA)).toEqual([]);
    const bot = reduce(gone, client(NEW, { t: "reclaim", seat: "vert" }), ctx(8000));
    expect(to(bot.out, NEW)).toEqual([{ t: "reclaimResult", accepted: false }]);
    const lobby = run(
      createTable({ tableId: ID, now: 0, seed: [5, 6, 7, 8] }),
      [
        { t: "hello", who: ANA, name: "Ana" },
        { t: "hello", who: BEN, name: "Ben" },
        client(BEN, { t: "sit", seat: "jaune" }),
        { t: "gone", who: BEN },
        { t: "hello", who: NEW, name: "Bruno" },
      ],
      0,
    ).table;
    const early = reduce(lobby, client(NEW, { t: "reclaim", seat: "jaune" }), ctx(1));
    expect(to(early.out, NEW)).toEqual([{ t: "reclaimResult", accepted: false }]);
    expect(to(early.out, ANA)).toEqual([]);
  });

  it("« Rendre sa place »: the new device plays the seat, the old token no longer does", () => {
    const { table } = asked();
    const paused = table.status;
    expect(paused).toBe("paused");
    const { table: given, out } = reduce(
      table,
      client(ANA, { t: "reclaimAnswer", seat: "jaune", accept: true }),
      ctx(8000),
    );
    expect(given.seats.jaune).toEqual({ kind: "human", who: NEW, handedOver: null });
    expect(given.reclaims.jaune).toBeUndefined();
    expect(given.people.find((p) => p.who === BEN)).toBeUndefined();
    expect(to(out, NEW)[0]).toEqual({ t: "reclaimResult", accepted: true });
    const welcome = welcomeOf(out, NEW);
    expect(welcome.you.seat).toBe("jaune");
    expect(welcome.view).toEqual(viewFor(gameOf(given), "jaune"));
    // Jaune is back: the pause is over.
    expect(given.status).toBe("playing");
    expect(seen(out, ANA).seats.jaune).toMatchObject({ name: "Bruno", online: true });
    // The old device comes back: no seat any more.
    const old = reduce(given, { t: "hello", who: BEN, name: "Ben" }, ctx(9000));
    expect(welcomeOf(old.out, BEN).you.seat).toBeNull();
    expect(welcomeOf(old.out, BEN).view).toBeNull();
    // Its acts are not jaune's.
    const act = reduce(
      old.table,
      client(BEN, { t: "act", base: old.table.seq, action: { t: "discard" } }),
      ctx(9001),
    );
    expect(act.table.seq).toBe(old.table.seq);
  });

  it("« Refuser »: the requester only reads the refusal, and may ask again", () => {
    const { table } = asked();
    const { table: refused, out } = reduce(
      table,
      client(ANA, { t: "reclaimAnswer", seat: "jaune", accept: false }),
      ctx(8000),
    );
    expect(to(out, NEW)).toEqual([{ t: "reclaimResult", accepted: false }]);
    expect(out.filter((each) => each.to !== NEW)).toEqual([]);
    expect(refused.seats.jaune).toMatchObject({ kind: "human", who: BEN });
    expect(refused.reclaims.jaune).toBeUndefined();
    const again = reduce(refused, client(NEW, { t: "reclaim", seat: "jaune" }), ctx(9000));
    expect(to(again.out, ANA)).toEqual([{ t: "reclaimRequest", seat: "jaune", name: "Bruno" }]);
  });

  it("refuses an answer from anyone but the chef de table, or with nothing pending", () => {
    const { table } = asked();
    const answer = { t: "reclaimAnswer", seat: "jaune", accept: true } as const;
    for (const who of [CLO, DAN, NEW]) {
      const refused = reduce(table, client(who, answer), ctx(8000));
      expect(to(refused.out, who)).toEqual([{ t: "error", code: "not-host" }]);
      expect(refused.table).toBe(table);
    }
    const none = reduce(
      table,
      client(ANA, { t: "reclaimAnswer", seat: "rouge", accept: true }),
      ctx(8000),
    );
    expect(to(none.out, ANA)).toEqual([{ t: "error", code: "refused" }]);
  });

  it("drops the request when the seat's player comes back; the answer is then refused", () => {
    const { table } = asked();
    const back = reduce(table, { t: "hello", who: BEN, name: "Ben" }, ctx(8000));
    expect(back.table.reclaims.jaune).toBeUndefined();
    expect(to(back.out, NEW)).toContainEqual({ t: "reclaimResult", accepted: false });
    const late = reduce(
      back.table,
      client(ANA, { t: "reclaimAnswer", seat: "jaune", accept: true }),
      ctx(9000),
    );
    expect(to(late.out, ANA)).toEqual([{ t: "error", code: "refused" }]);
    expect(late.table.seats.jaune).toMatchObject({ who: BEN });
  });

  it("sends a pending request again to the chef de table who says hello", () => {
    const { table } = asked();
    const gone = reduce(table, { t: "gone", who: ANA }, ctx(8000)).table;
    const back = reduce(gone, { t: "hello", who: ANA, name: "Ana" }, ctx(9000));
    expect(to(back.out, ANA)).toContainEqual({
      t: "reclaimRequest",
      seat: "jaune",
      name: "Bruno",
    });
  });

  it("gives back a handed-over seat (regained) and the creator's role with the creator's seat", () => {
    // Ana (the creator) is gone and her seat handed over; Ben is chef de table meanwhile.
    let table = reduce(inPlay(), { t: "gone", who: ANA }, ctx(5000)).table;
    table = reduce(table, { t: "tick", retry: false }, ctx(5000 + 60_000)).table;
    table = reduce(table, client(BEN, { t: "pause", choice: "bot" }), ctx(66_000)).table;
    expect(table.seats.bleu).toMatchObject({ who: ANA, handedOver: 3 });
    table = reduce(table, { t: "hello", who: NEW, name: "Ana" }, ctx(67_000)).table;
    const asking = reduce(table, client(NEW, { t: "reclaim", seat: "bleu" }), ctx(68_000));
    expect(to(asking.out, BEN)).toEqual([{ t: "reclaimRequest", seat: "bleu", name: "Ana" }]);
    const { table: given, out } = reduce(
      asking.table,
      client(BEN, { t: "reclaimAnswer", seat: "bleu", accept: true }),
      ctx(69_000),
    );
    expect(given.seats.bleu).toEqual({ kind: "human", who: NEW, handedOver: null });
    expect(welcomeOf(out, NEW).regained).toBe(true);
    expect(given.creator).toBe(NEW);
    expect(hostOf(given)).toBe(NEW);
  });

  it("refuses at once when there is no chef de table to ask", () => {
    let table = inPlay();
    table = run(
      table,
      [
        { t: "gone", who: ANA },
        { t: "gone", who: BEN },
        { t: "gone", who: CLO },
      ],
      5000,
    ).table;
    table = reduce(table, { t: "hello", who: NEW, name: "Bruno" }, ctx(6000)).table;
    expect(hostOf(table)).toBeNull();
    const asked = reduce(table, client(NEW, { t: "reclaim", seat: "jaune" }), ctx(7000));
    expect(to(asked.out, NEW)).toEqual([{ t: "reclaimResult", accepted: false }]);
    expect(asked.table.reclaims.jaune).toBeUndefined();
  });
});

describe("the summary names the missing colours (« En pause : on t’attend »)", () => {
  it("lists the missing seats while paused, none otherwise", () => {
    const table = inPlay();
    expect(summary(table).missing).toEqual([]);
    const paused = run(
      table,
      [
        { t: "gone", who: BEN },
        { t: "gone", who: CLO },
      ],
      5000,
    ).table;
    expect(summary(paused).status).toBe("paused");
    expect(summary(paused).missing).toEqual(["jaune", "rouge"] satisfies Color[]);
    const saved = reduce(paused, client(ANA, { t: "stop" }), ctx(6000)).table;
    expect(summary(saved).missing).toEqual([]);
  });
});

describe("a snapshot saved before G18 (plan 04-14)", () => {
  it("copyTable fills the protection switch and writes the default flag on the ring knights", () => {
    const game = scenarioState(
      {
        pawns: { bleu: [{ p: 0 }, { p: 72 }, "S", "S"], rouge: [{ p: 0 }, "S", "S", "S"] },
        hands: { bleu: ["2S"] },
        turn: "bleu",
      },
      [1, 2, 3, 4],
    );
    // As stored before G18: no flag, no switch.
    const stored = JSON.parse(JSON.stringify(game));
    for (const pawn of Object.values(stored.pawns) as { zone: string; justOut?: boolean }[]) {
      delete pawn.justOut;
    }
    delete stored.rules.EXIT_ONLY_PROTECTION;
    const table: Table = {
      ...createTable({ tableId: ID, now: 1000, seed: [1, 2, 3, 4] }),
      status: "playing",
      game: stored,
    };
    const copy = copyTable(JSON.parse(JSON.stringify(table)));
    expect(copy.game?.rules.EXIT_ONLY_PROTECTION).toBe(true);
    expect(copy.game?.pawns.bleu0).toEqual({ zone: "ring", progress: 0, justOut: true });
    expect(copy.game?.pawns.bleu1).toEqual({ zone: "ring", progress: 72, justOut: false });
    expect(copy.game?.pawns.rouge0).toEqual({ zone: "ring", progress: 0, justOut: true });
    // And the view sent to a seat carries the flag.
    const view = viewFor(copy.game as NonNullable<Table["game"]>, "bleu");
    expect(view.pawns.bleu1).toEqual({ zone: "ring", progress: 72, justOut: false });
  });
});

describe("a computer's decision stored before G18 (plan 04-14)", () => {
  it("is dropped by copyTable, so the computer decides again under the new rule", () => {
    const game = scenarioState(
      { pawns: { bleu: [{ p: 72 }, "S", "S", "S"] }, hands: { jaune: ["2H"] }, turn: "jaune" },
      [1, 2, 3, 4],
    );
    const stored = JSON.parse(JSON.stringify(game));
    delete stored.rules.EXIT_ONLY_PROTECTION;
    const thinking: NonNullable<Table["thinking"]> = {
      seat: "jaune",
      base: 3,
      level: 3,
      dueAt: 900,
      waitMs: 0,
      checkpoint: null,
      slices: 1,
      thought: {
        action: { t: "discard" },
        rng: [5, 6, 7, 8],
        candidates: 1,
        worlds: 0,
        close: false,
        broad: false,
      } as unknown as NonNullable<NonNullable<Table["thinking"]>["thought"]>,
      playAt: 1200,
      fallback: false,
    } as NonNullable<Table["thinking"]>;
    const table: Table = {
      ...createTable({ tableId: ID, now: 1000, seed: [1, 2, 3, 4] }),
      status: "playing",
      game: stored,
      thinking,
    };
    const copy = copyTable(JSON.parse(JSON.stringify(table)));
    expect(copy.thinking?.thought).toBeNull();
    expect(copy.thinking?.checkpoint).toBeNull();
    expect(copy.thinking?.playAt).toBeNull();
    expect(copy.thinking?.seat).toBe("jaune");
    // An up-to-date table keeps its decision.
    const again = copyTable(copy);
    const decided = { ...again, thinking: { ...thinking } };
    expect(copyTable(decided).thinking?.thought).not.toBeNull();
  });
});
