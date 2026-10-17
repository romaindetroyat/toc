// The Champion's think cut into slices and resumed from a JSON checkpoint (D-11, plan 02-03): the online
// table runs level 5 over several alarm invocations of its Durable Object, which may forget everything
// in memory between two of them. The checkpoint goes through JSON at every boundary, as it does through
// SQLite; the resumed think must end on exactly the decision of chooseAction in one go.

import { type Action, type Color, newGame, type PlayerView, type Rng, viewFor } from "@toc/engine";
import { describe, expect, it, vi } from "vitest";
import { type BenchPosition, benchPositions } from "./bench.ts";
import * as evaluate from "./evaluate.ts";
import type { BotLevel } from "./levels.ts";
import { decodeAction, encodeAction } from "./search.ts";
import { chooseAction, createThinker, type ThinkerCheckpoint, type Thought } from "./thinker.ts";

// Every call of scoreCandidates is recorded with its view, so the test can tell the root scoring (the
// search's own view object) from the rollouts' policy calls (views of imagined deals).
const scoredViews: PlayerView[] = [];
vi.mock("./evaluate.ts", async (importOriginal) => {
  const real = await importOriginal<typeof import("./evaluate.ts")>();
  return {
    ...real,
    scoreCandidates: (view: PlayerView, seat: Color) => {
      scoredViews.push(view);
      return real.scoreCandidates(view, seat);
    },
  };
});

const SLICES = [1, 7, 30, 64] as const;
/** The checkpoint stored with the table stays small (the table row is written at every slice). */
const CHECKPOINT_MAX_BYTES = 4096;
/** 40 whole Champion decisions twice (one go, then sliced): a few seconds, more in slices of 1. */
const SLICED_TIMEOUT_MS = 120_000;

const positions: BenchPosition[] = benchPositions();

function rngOf(i: number): Rng {
  return [i * 7919 + 1, i * 104_729 + 3, i + 5, 0x9e3779b9];
}

/** True when `value` holds only numbers, strings, booleans, null, arrays and plain objects. */
function jsonSafe(value: unknown): boolean {
  if (value === null) return true;
  switch (typeof value) {
    case "number":
      return Number.isFinite(value);
    case "string":
    case "boolean":
      return true;
    case "object":
      if (Array.isArray(value)) return value.every(jsonSafe);
      if (Object.getPrototypeOf(value) !== Object.prototype) return false;
      return Object.values(value as Record<string, unknown>).every(jsonSafe);
    default:
      return false;
  }
}

/**
 * Steps a level-5 think `slice` units at a time, forgetting the thinker at every boundary: the checkpoint
 * goes through JSON and a new thinker resumes from it. Returns the final thought and every checkpoint.
 */
function sliced(
  view: PlayerView,
  seat: Color,
  rng: Rng,
  slice: number,
): { thought: Thought; checkpoints: ThinkerCheckpoint[] } {
  let from: ThinkerCheckpoint = null;
  const checkpoints: ThinkerCheckpoint[] = [];
  for (let guard = 0; guard < 10_000; guard++) {
    const thinker = createThinker(view, seat, 5, rng, undefined, from);
    const done = thinker.step(slice);
    const checkpoint = thinker.checkpoint();
    checkpoints.push(checkpoint);
    if (done) return { thought: thinker.result(), checkpoints };
    from = JSON.parse(JSON.stringify(checkpoint)) as ThinkerCheckpoint;
  }
  throw new Error("the sliced think never finished");
}

describe("the Champion's think resumed from a JSON checkpoint", () => {
  it("the bench holds 40 play-phase positions", () => {
    expect(positions).toHaveLength(40);
    for (const { view } of positions) expect(view.phase).toBe("play");
  });

  for (const slice of SLICES) {
    it(
      `gives the one-go decision on every bench position, in slices of ${slice} units`,
      () => {
        for (const [i, { view, seat, label }] of positions.entries()) {
          const rng = rngOf(i);
          const before = JSON.stringify(view);
          const whole = chooseAction(view, seat, 5, rng);
          const { thought, checkpoints } = sliced(view, seat, rng, slice);
          expect(thought, label).toEqual(whole);
          expect(rng).toEqual(rngOf(i));
          expect(JSON.stringify(view)).toBe(before);
          for (const checkpoint of checkpoints) {
            expect(checkpoint, label).not.toBeNull();
            expect(jsonSafe(checkpoint), label).toBe(true);
            expect(JSON.stringify(checkpoint).length, label).toBeLessThan(CHECKPOINT_MAX_BYTES);
          }
        }
      },
      SLICED_TIMEOUT_MS,
    );
  }

  it("a resume does no root work: the search's own view is never scored again", () => {
    for (const [i, { view, seat, label }] of positions.entries()) {
      const rng = rngOf(i);
      const first = createThinker(view, seat, 5, rng);
      first.step(7);
      const from = JSON.parse(JSON.stringify(first.checkpoint())) as ThinkerCheckpoint;
      scoredViews.length = 0;
      const resumed = createThinker(view, seat, 5, rng, undefined, from);
      expect(scoredViews, label).toEqual([]);
      resumed.step(30);
      expect(
        scoredViews.some((scored) => scored === view),
        label,
      ).toBe(false);
      // The first think did score the root: the spy sees it.
      scoredViews.length = 0;
      createThinker(view, seat, 5, rng);
      expect(scoredViews.some((scored) => scored === view)).toBe(true);
    }
  });

  it("the spy wraps the real scoring", () => {
    const { view, seat } = positions[0] as BenchPosition;
    expect(evaluate.scoreCandidates(view, seat).length).toBeGreaterThan(1);
  });

  it("a checkpoint resumed after the budget is spent stays on the same decision", () => {
    const { view, seat } = positions[3] as BenchPosition;
    const rng = rngOf(3);
    const whole = chooseAction(view, seat, 5, rng);
    const thinker = createThinker(view, seat, 5, rng);
    while (!thinker.step(64)) {
      // to the end of the budget
    }
    const from = JSON.parse(JSON.stringify(thinker.checkpoint())) as ThinkerCheckpoint;
    const resumed = createThinker(view, seat, 5, rng, undefined, from);
    expect(resumed.result()).toEqual(whole);
    expect(resumed.step(64)).toBe(true);
    expect(resumed.result()).toEqual(whole);
  });
});

describe("the compact actions of a checkpoint", () => {
  it("every action shape goes to a string and back unchanged", () => {
    const actions: Action[] = [
      { t: "give", card: "7H" },
      { t: "exit", card: "1S", pawn: "bleu0" },
      { t: "move", card: "4D", pawn: "vert3" },
      { t: "swap", card: "11C", pawn: "jaune2", target: "rouge1" },
      {
        t: "seven",
        card: "7C",
        plan: [
          { pawn: "bleu0", steps: 3 },
          { pawn: "bleu1", steps: 4 },
        ],
      },
      { t: "discard" },
    ];
    for (const action of actions) {
      expect(JSON.stringify(decodeAction(encodeAction(action)))).toBe(JSON.stringify(action));
    }
    expect(() => decodeAction("z 7H")).toThrow();
  });
});

describe("levels 1 to 4 and the exchange have nothing to resume", () => {
  it("checkpoint() is null and a null `from` is ignored", () => {
    const { view, seat } = positions[5] as BenchPosition;
    for (const level of [1, 2, 3, 4] as BotLevel[]) {
      const thinker = createThinker(view, seat, level, [9, 8, 7, 6]);
      expect(thinker.checkpoint()).toBeNull();
      thinker.step(1);
      expect(thinker.checkpoint()).toBeNull();
      const again = createThinker(view, seat, level, [9, 8, 7, 6], undefined, null);
      again.step(1);
      expect(again.result()).toEqual(chooseAction(view, seat, level, [9, 8, 7, 6]));
    }
    const exchange = newGame({ firstDealer: "bleu" }, [3, 1, 4, 1]);
    expect(exchange.phase).toBe("exchange");
    const giving = viewFor(exchange, "jaune");
    for (const level of [1, 2, 3, 4, 5] as BotLevel[]) {
      const thinker = createThinker(giving, "jaune", level, [5, 6, 7, 8], undefined, null);
      expect(thinker.step(1)).toBe(true);
      expect(thinker.checkpoint()).toBeNull();
      expect(thinker.result()).toEqual(chooseAction(giving, "jaune", level, [5, 6, 7, 8]));
    }
  });

  it("a level-5 checkpoint given to a lower level or the exchange is ignored", () => {
    const { view, seat } = positions[5] as BenchPosition;
    const champion = createThinker(view, seat, 5, [1, 2, 3, 4]);
    champion.step(30);
    const from = JSON.parse(JSON.stringify(champion.checkpoint())) as ThinkerCheckpoint;
    const lower = createThinker(view, seat, 3, [1, 2, 3, 4], undefined, from);
    expect(lower.step(1)).toBe(true);
    expect(lower.result()).toEqual(chooseAction(view, seat, 3, [1, 2, 3, 4]));
  });
});
