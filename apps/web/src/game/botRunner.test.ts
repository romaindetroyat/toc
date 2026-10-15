import {
  type BenchPosition,
  benchPositions,
  CHAMPION_BUDGET,
  chooseAction,
  createThinker,
} from "@toc/bots";
import { legalActions, type Rng } from "@toc/engine";
import { beforeAll, describe, expect, it } from "vitest";
import { createInlineRunner, syncRunner, ThinkCancelled } from "./botRunner.ts";

// The runners of a computer player's decision (BOT-05, 03-RESEARCH Pattern 8): the synchronous one of
// the tests and tools, and the inline one of the browser, which slices the search so the page never
// freezes, stops at its deadline, finishes at once in a hidden page and stops when cancelled.
// Real timers and Node's MessageChannel throughout.

const RNG: Rng = [7, 11, 13, 17];

let crowded: BenchPosition;
let simple: BenchPosition;

beforeAll(() => {
  const positions = benchPositions();
  // A hard 7 for the Champion: a long search over many candidates.
  crowded = positions.find((p) => p.label.includes("(7 :")) as BenchPosition;
  simple = positions.find((p) => !p.label.includes("(7 :")) as BenchPosition;
  expect(crowded).toBeDefined();
  expect(simple).toBeDefined();
}, 60_000);

/** A clock that moves 1 ms each time it is read, and logs every read and every visibility check. */
function countingClock() {
  const log: ("now" | "hidden")[] = [];
  let t = 0;
  return {
    log,
    now: () => {
      log.push("now");
      return t++;
    },
    isHidden: (hidden = false) => {
      log.push("hidden");
      return hidden;
    },
  };
}

describe("syncRunner", () => {
  it("resolves with the same Thought as chooseAction", async () => {
    for (const level of [1, 3, 5] as const) {
      const { view, seat } = level === 5 ? crowded : simple;
      const expected = chooseAction(view, seat, level, RNG);
      await expect(
        syncRunner.think({ view, seat, level, rng: RNG, deadline: null }),
      ).resolves.toEqual(expected);
    }
  });
});

describe("createInlineRunner", () => {
  it("yields to the event loop between slices of the Champion's search", async () => {
    // Two deterministic proofs, rather than racing a setTimeout(0): Node delivers up to 1000 messages
    // of one MessagePort in a single event-loop turn before it runs timers, so a timer can lose that
    // race to any MessageChannel yield under load. (In the browser each message is its own task; the
    // bench's « Plus longue image figée » in banc.spec.ts measures that the page keeps painting.)
    // 1. The stack unwinds between two slices: a microtask queued at one slice boundary has run by
    //    the next one, which a synchronous loop could never do.
    // 2. Each yield is a macrotask: one MessageChannel message posted per slice boundary.
    let checks = 0;
    let unwound = 0;
    let pending = false;
    const runner = createInlineRunner({
      now: () => performance.now(),
      isHidden: () => {
        checks++;
        if (checks > 1 && !pending) unwound++;
        pending = true;
        queueMicrotask(() => {
          pending = false;
        });
        return false;
      },
    });
    const Native = globalThis.MessageChannel;
    let posted = 0;
    globalThis.MessageChannel = class extends Native {
      constructor() {
        super();
        const post = this.port2.postMessage.bind(this.port2);
        this.port2.postMessage = (message: unknown) => {
          posted++;
          post(message);
        };
      }
    };
    const { view, seat } = crowded;
    let thought: Awaited<ReturnType<typeof runner.think>>;
    try {
      thought = await runner.think({ view, seat, level: 5, rng: RNG, deadline: null });
    } finally {
      globalThis.MessageChannel = Native;
    }
    expect(checks).toBeGreaterThanOrEqual(2);
    expect(unwound).toBe(checks - 1);
    expect(posted).toBe(checks);
    // Slicing never changes the move: the same decision as in one go.
    expect(thought).toEqual(chooseAction(view, seat, 5, RNG));
  }, 30_000);

  it("ends each slice once about 8 ms of its clock have passed", async () => {
    const clock = countingClock();
    const runner = createInlineRunner({ now: clock.now, isHidden: () => clock.isHidden() });
    const { view, seat } = crowded;
    await runner.think({ view, seat, level: 5, rng: RNG, deadline: null });
    // Between two visibility checks (slice boundaries): the slice's start and 8 more reads.
    const slices = clock.log.join(",").split("hidden").slice(0, -1);
    expect(slices.length).toBeGreaterThanOrEqual(2);
    for (const reads of slices) {
      expect(reads.split("now").length - 1).toBe(9);
    }
  }, 30_000);

  it("stops at its deadline with the best move so far: legal, and short of its budget", async () => {
    const clock = countingClock();
    const runner = createInlineRunner({ now: clock.now, isHidden: () => clock.isHidden() });
    const { view, seat } = crowded;
    const thought = await runner.think({ view, seat, level: 5, rng: RNG, deadline: 30 });
    // The clock was read up to the deadline, then no more.
    expect(clock.log.filter((e) => e === "now")).toHaveLength(31);
    expect(thought.units).toBeLessThan(CHAMPION_BUDGET.plies);
    expect(legalActions(view, seat)).toContainEqual(thought.action);
    // It is the anytime result of the same search at that point.
    const full = chooseAction(view, seat, 5, RNG);
    expect(full.units).toBeGreaterThan(thought.units);
  }, 30_000);

  it("finishes at once, without a yield, while the page is hidden", async () => {
    let checks = 0;
    const runner = createInlineRunner({
      now: () => performance.now(),
      isHidden: () => {
        checks++;
        return true;
      },
      sliceMs: 0,
    });
    let timerRan = false;
    setTimeout(() => {
      timerRan = true;
    }, 0);
    const { view, seat } = crowded;
    let resolved = false;
    const pending = runner.think({ view, seat, level: 5, rng: RNG, deadline: null });
    void pending.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(true);
    expect(timerRan).toBe(false);
    expect(checks).toBe(1);
    expect(await pending).toEqual(chooseAction(view, seat, 5, RNG));
  }, 30_000);

  it("settles a think when cancelled and stops its work", async () => {
    const clock = countingClock();
    const runner = createInlineRunner({ now: clock.now, isHidden: () => clock.isHidden() });
    const { view, seat } = crowded;
    // A budget far too large to finish before the cancel.
    const budget = { plies: 1_000_000 };
    const pending = runner.think({ view, seat, level: 5, rng: RNG, budget, deadline: null });
    const outcome = pending.then(
      () => "resolved",
      (error: unknown) => error,
    );
    // Let a few slices run, then leave.
    await new Promise((resolve) => setTimeout(resolve, 0));
    runner.cancel();
    const reads = clock.log.length;
    expect(await outcome).toBeInstanceOf(ThinkCancelled);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(clock.log.length).toBe(reads);
    // A cancel with nothing in progress is harmless, and the runner thinks again afterwards.
    runner.cancel();
    const after = await runner.think({
      view: simple.view,
      seat: simple.seat,
      level: 3,
      rng: RNG,
      deadline: null,
    });
    expect(after).toEqual(chooseAction(simple.view, simple.seat, 3, RNG));
  }, 30_000);

  it("thinks levels 1 to 4 in one step, as chooseAction", async () => {
    const runner = createInlineRunner({ now: () => performance.now(), isHidden: () => false });
    for (const level of [1, 2, 3, 4] as const) {
      const { view, seat } = simple;
      const thinker = createThinker(view, seat, level, RNG);
      expect(thinker.step(1)).toBe(true);
      await expect(runner.think({ view, seat, level, rng: RNG, deadline: null })).resolves.toEqual(
        chooseAction(view, seat, level, RNG),
      );
    }
  });
});
