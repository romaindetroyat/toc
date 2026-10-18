// « C’est ton tour » (plan 04-07, CONTEXT addendum, 04-RESEARCH Pattern 10): a seated person with an
// account whose seat goes missing during a game is told NOTIFY_AFTER_MS later if they are still
// missing; a saved game resumed without them tells them at once. Nobody at the table is told; a
// return, a hand-over to the computer or a save cancels the notice. Every case gives its clock.

import type { Rng } from "@toc/engine";
import { describe, expect, it } from "vitest";
import {
  copyTable,
  createTable,
  NOTIFY_AFTER_MS,
  nextDeadline,
  notifyMsOf,
  personOf,
  type Reduced,
  reduce,
  type Table,
  type TurnNotice,
} from "./index.ts";

const ID = "abcdefghijklmnopqrstuv";
const ctx = (now: number) => ({ now, seed: (): Rng => [11, 22, 33, 44] });

type Command = Parameters<typeof reduce>[1];
type ClientFrameOf = Extract<Command, { t: "client" }>["frame"];
const client = (who: string, frame: ClientFrameOf): Command => ({ t: "client", who, frame });
const tick: Command = { t: "tick", retry: false };

/** Ana (creator, bleu) and Ben (jaune) have accounts; Clo (rouge) is a guest; vert is a computer. */
const ANA = "who-ana";
const BEN = "who-ben";
const CLO = "who-clo";
const ANA_ACCOUNT = { id: "acct-ana-0123456789abcd", pseudo: "Ana" };
const BEN_ACCOUNT = { id: "acct-ben-0123456789abcd", pseudo: "Ben" };

function run(table: Table, commands: Command[], now: number): Reduced {
  let result: Reduced = { table, out: [], log: [] };
  for (const command of commands) result = reduce(result.table, command, ctx(now));
  return result;
}

/** The game started at 2000; `test` adds test options (notifyMs, pauseMs). */
function started(test: { notifyMs?: number; pauseMs?: number } = {}): Table {
  const lobby = run(
    createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8], test: { pace: "zero", ...test } }),
    [
      { t: "hello", who: ANA, name: "Ana", account: ANA_ACCOUNT },
      { t: "hello", who: BEN, name: "Ben", account: BEN_ACCOUNT },
      { t: "hello", who: CLO, name: "Clo" },
      client(ANA, { t: "sit", seat: "bleu" }),
      client(BEN, { t: "sit", seat: "jaune" }),
      client(CLO, { t: "sit", seat: "rouge" }),
    ],
    1000,
  ).table;
  return reduce(lobby, client(ANA, { t: "start" }), ctx(2000)).table;
}

/** Ben's socket closed at 3000: the game is paused for him. */
const benGone = (test: { notifyMs?: number; pauseMs?: number } = {}) =>
  reduce(started(test), { t: "gone", who: BEN }, ctx(3000));

const turnFor = (over: Partial<TurnNotice>): TurnNotice => ({
  account: BEN_ACCOUNT.id,
  kind: "turn",
  from: "Ana",
  own: false,
  resumed: false,
  key: `${ID}:3000`,
  ...over,
});

/** Every notice of a step goes to an account whose person is not at the table. */
function nobodyHere(result: Reduced): void {
  for (const notice of result.notify ?? []) {
    const person = result.table.people.find((each) => each.account === notice.account);
    expect(person?.online, JSON.stringify(notice)).toBe(false);
  }
}

describe("the notice is scheduled when an account's seat goes missing", () => {
  it("NOTIFY_AFTER_MS is 30 s, and the test option shortens it", () => {
    expect(NOTIFY_AFTER_MS).toBe(30_000);
    expect(notifyMsOf(started())).toBe(30_000);
    expect(notifyMsOf(started({ notifyMs: 2000 }))).toBe(2000);
  });

  it("Ben gone during play: the pause, and his notice 30 s after his departure", () => {
    const { table, notify } = benGone();
    expect(table.status).toBe("paused");
    expect(table.notifyAt).toEqual({ jaune: 3000 + NOTIFY_AFTER_MS });
    expect(table.deadlines.notify).toEqual({ at: 33_000 });
    // The sweep (every 30 s since the start) may come first.
    expect(nextDeadline(table)).toBeLessThanOrEqual(33_000);
    expect(notify).toBeUndefined();
  });

  it("a guest's seat gets no notice", () => {
    const { table } = reduce(started(), { t: "gone", who: CLO }, ctx(3000));
    expect(table.status).toBe("paused");
    expect(table.notifyAt).toEqual({});
    expect(table.deadlines.notify).toBeUndefined();
  });

  it("a second account seat missing 10 s later gets its own time, 30 s after its own departure", () => {
    const both = reduce(benGone().table, { t: "gone", who: ANA }, ctx(13_000));
    expect(both.table.pause?.missing).toEqual(["jaune", "bleu"]);
    expect(both.table.notifyAt).toEqual({ jaune: 33_000, bleu: 43_000 });
    expect(both.table.deadlines.notify).toEqual({ at: 33_000 });

    const first = reduce(both.table, tick, ctx(33_000));
    expect(first.notify).toEqual([turnFor({})]);
    expect(first.table.deadlines.notify).toEqual({ at: 43_000 });

    const second = reduce(first.table, tick, ctx(43_000));
    // Ana is the creator: « Ta table t’attend ».
    expect(second.notify).toEqual([turnFor({ account: ANA_ACCOUNT.id, own: true })]);
    expect(second.table.deadlines.notify).toBeUndefined();
    nobodyHere(first);
    nobodyHere(second);
  });
});

describe("the notice is sent at exactly its time, once", () => {
  it("not before its time; at it (now equal to it), the notice and the entry done", () => {
    const gone = benGone().table;
    const early = reduce(gone, tick, ctx(32_999));
    expect(early.notify).toBeUndefined();
    expect(early.table.deadlines.notify).toEqual({ at: 33_000 });

    const due = reduce(early.table, tick, ctx(33_000));
    expect(due.notify).toEqual([turnFor({})]);
    expect(due.table.notifyAt).toEqual({ jaune: null });
    expect(due.table.deadlines.notify).toBeUndefined();
    expect(nextDeadline(due.table)).not.toBe(33_000);
    nobodyHere(due);

    // Never a second time for the same absence.
    const later = reduce(due.table, tick, ctx(63_000));
    expect(later.notify).toBeUndefined();
    expect(later.table.deadlines.notify).toBeUndefined();
  });

  it("a frame after the time does not send it: only the alarm's tick does", () => {
    const gone = benGone().table;
    const chat = reduce(gone, client(CLO, { t: "chat", msg: "bravo" }), ctx(40_000));
    expect(chat.notify).toBeUndefined();
    expect(chat.table.deadlines.notify).toEqual({ at: 33_000 });
    expect(reduce(chat.table, tick, ctx(40_001)).notify).toEqual([turnFor({})]);
  });

  it("an alarm that fires late still sends it once", () => {
    const due = reduce(benGone().table, tick, ctx(50_000));
    expect(due.notify).toEqual([turnFor({})]);
  });
});

describe("a return, a hand-over or a save cancels the notice", () => {
  it("Ben comes back before the time: no notice, no entry, no deadline", () => {
    const back = reduce(
      benGone().table,
      { t: "hello", who: BEN, name: "Ben", account: BEN_ACCOUNT },
      ctx(10_000),
    );
    expect(back.table.status).toBe("playing");
    expect(back.table.notifyAt).toEqual({});
    expect(back.table.deadlines.notify).toBeUndefined();
    expect(reduce(back.table, tick, ctx(33_000)).notify).toBeUndefined();
  });

  it("the seat handed over to the computer: no notice", () => {
    const gone = benGone({ pauseMs: 1000 }).table;
    const choosing = reduce(gone, tick, ctx(4000)).table;
    expect(choosing.pause?.choosing).toBe(true);
    const handed = reduce(choosing, client(ANA, { t: "pause", choice: "bot" }), ctx(5000));
    expect(handed.table.status).toBe("playing");
    expect(handed.table.notifyAt).toEqual({});
    expect(handed.table.deadlines.notify).toBeUndefined();
    expect(reduce(handed.table, tick, ctx(33_000)).notify).toBeUndefined();
  });

  it("« Attendre encore » keeps the notice where it was", () => {
    const gone = benGone({ pauseMs: 1000 }).table;
    const choosing = reduce(gone, tick, ctx(4000)).table;
    const waiting = reduce(choosing, client(ANA, { t: "pause", choice: "wait" }), ctx(5000));
    expect(waiting.table.notifyAt).toEqual({ jaune: 33_000 });
    expect(waiting.table.deadlines.notify).toEqual({ at: 33_000 });
  });

  it("the game saved: no notice", () => {
    const saved = reduce(benGone().table, client(ANA, { t: "stop" }), ctx(5000));
    expect(saved.table.status).toBe("saved");
    expect(saved.table.notifyAt).toEqual({});
    expect(saved.table.deadlines.notify).toBeUndefined();
    expect(reduce(saved.table, tick, ctx(33_000)).notify).toBeUndefined();
  });
});

describe("a saved game resumed without them tells them at once", () => {
  it("« Reprendre la partie » with Ben missing: his notice now, resumed, and no 30 s entry", () => {
    const saved = reduce(benGone().table, client(ANA, { t: "stop" }), ctx(5000)).table;
    const resumed = reduce(saved, client(ANA, { t: "resume" }), ctx(50_000));
    expect(resumed.table.status).toBe("paused");
    expect(resumed.notify).toEqual([turnFor({ resumed: true, key: `${ID}:50000` })]);
    expect(resumed.table.notifyAt).toEqual({ jaune: null });
    expect(resumed.table.deadlines.notify).toBeUndefined();
    nobodyHere(resumed);
    expect(reduce(resumed.table, tick, ctx(80_000)).notify).toBeUndefined();
  });

  it("resumed by Ben himself with everyone else here: nobody is told", () => {
    const table = started();
    const saved = reduce(table, client(ANA, { t: "stop" }), ctx(3000)).table;
    const resumed = reduce(saved, client(ANA, { t: "resume" }), ctx(4000));
    expect(resumed.table.status).toBe("playing");
    expect(resumed.notify).toBeUndefined();
  });

  it("a guest missing at the resume is not told; an account missing is", () => {
    const gone = reduce(benGone().table, { t: "gone", who: CLO }, ctx(4000)).table;
    const saved = reduce(gone, client(ANA, { t: "stop" }), ctx(5000)).table;
    const resumed = reduce(saved, client(ANA, { t: "resume" }), ctx(6000));
    expect(resumed.table.pause?.missing).toEqual(["jaune", "rouge"]);
    expect(resumed.notify).toEqual([turnFor({ resumed: true, key: `${ID}:6000` })]);
  });
});

describe("older snapshots and server-only data", () => {
  it("a snapshot from before plan 04-07 loads with no notice", () => {
    const table = started() as Partial<Table>;
    delete table.notifyAt;
    const copy = copyTable(table as Table);
    expect(copy.notifyAt).toEqual({});
    expect(copy.deadlines.notify).toBeUndefined();
  });

  it("a creator without an account (a guest) is named by their first name", () => {
    const lobby = run(
      createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8], test: { pace: "zero" } }),
      [
        { t: "hello", who: CLO, name: "Clo" },
        { t: "hello", who: BEN, name: "Ben", account: BEN_ACCOUNT },
        client(CLO, { t: "sit", seat: "rouge" }),
        client(BEN, { t: "sit", seat: "jaune" }),
      ],
      1000,
    ).table;
    const playing = reduce(lobby, client(CLO, { t: "start" }), ctx(2000)).table;
    const gone = reduce(playing, { t: "gone", who: BEN }, ctx(3000)).table;
    expect(personOf(gone, CLO)?.account).toBeNull();
    expect(reduce(gone, tick, ctx(33_000)).notify).toEqual([turnFor({ from: "Clo" })]);
  });

  it("no frame carries the notice times", () => {
    const { out } = benGone();
    for (const each of out) expect(JSON.stringify(each.frame)).not.toContain("notifyAt");
  });
});
