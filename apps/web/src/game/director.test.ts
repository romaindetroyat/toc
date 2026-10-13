import { type HopTimeline, hopTimeline, type Point } from "@toc/board";
import { randomLegal } from "@toc/bots";
import {
  type Action,
  apply,
  COLORS,
  type Color,
  forwardCells,
  type GameEvent,
  type GameState,
  type PawnId,
  type Place,
  type PlayerView,
  type RenderState,
  type Rng,
  renderOf,
  scenarioState,
  startGame,
  viewFor,
} from "@toc/engine";
import { describe, expect, it, vi } from "vitest";
import { FakeBackend } from "../audio/backend.ts";
import { createAudioEngine } from "../audio/engine.ts";
import { anchorOf, type Facing } from "../board/geometry.ts";
import { createDirector, type DirectorMode, LEAD_S } from "./director.ts";

// ---------------------------------------------------------------------------------------------
// Fakes

type HopCall = {
  pawn: PawnId;
  points: Point[];
  timeline: HopTimeline;
  leadMs: number;
  facings: Facing[];
  done: () => void;
  fail: (error: Error) => void;
};

type Commit = { pawn: PawnId; place: Place; facing: Facing };

type FakeDocument = {
  hidden: boolean;
  fire(): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

function fakeDocument(): FakeDocument {
  const listeners = new Set<() => void>();
  return {
    hidden: false,
    fire() {
      for (const listener of [...listeners]) listener();
    },
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
}

type Options = {
  mode?: () => DirectorMode;
  initial?: PlayerView;
  /** Hops stay pending until the test calls done(). */
  hold?: boolean;
  quarterTurns?: number;
  document?: FakeDocument;
};

function harness(options: Options = {}) {
  const hops: HopCall[] = [];
  const commits: Commit[] = [];
  const clops: { offsets: number[]; t0: number }[] = [];
  const finished: PawnId[] = [];
  const audio = {
    now: () => 10,
    scheduleClops: (offsets: number[], t0: number) => clops.push({ offsets, t0 }),
    pauseAmbience: vi.fn(),
    resumeAmbience: vi.fn(),
  };
  const director = createDirector({
    animator: {
      hop(pawn, points, timeline, leadMs, facings) {
        return new Promise<void>((resolve, reject) => {
          const call: HopCall = {
            pawn,
            points,
            timeline,
            leadMs,
            facings,
            done: resolve,
            fail: reject,
          };
          hops.push(call);
          if (options.hold !== true) resolve();
        });
      },
      finish(pawn) {
        finished.push(pawn);
        for (const call of hops) if (call.pawn === pawn) call.done();
      },
    },
    audio,
    quarterTurns: options.quarterTurns ?? 0,
    facingOf: () => "right",
    commit: (pawn, place, facing) => commits.push({ pawn, place, facing }),
    getMode: options.mode,
    initial: options.initial,
    document: options.document,
  });
  const renders: RenderState[] = [];
  director.onRender((state) => renders.push(state));
  return { director, hops, commits, clops, finished, audio, renders };
}

/** Lets the director's promise chain run. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// ---------------------------------------------------------------------------------------------
// A small board: bleu has knights at progress 5 and 10, a 5 in hand.

const SEED: Rng = [3, 1, 4, 1];

function smallState(): GameState {
  return scenarioState(
    {
      pawns: { bleu: [{ p: 5 }, { p: 10 }, "S", "S"], vert: [{ p: 30 }, "S", "S", "S"] },
      hands: { bleu: ["5H", "6H"], jaune: ["2S"], rouge: ["3S"], vert: ["4S"] },
      turn: "bleu",
    },
    SEED,
  );
}

const cell = (n: number): Place => ({ z: "ring", cell: n });

function moved(pawn: PawnId, progress: number, steps: number, color: Color = "bleu"): GameEvent {
  const path = forwardCells(color, progress, steps);
  return {
    t: "pawnMoved",
    pawn,
    from: forwardCells(color, progress - 1, 1)[0] as Place,
    path,
    dir: 1,
  };
}

describe("Director: order and animation", () => {
  it("processes events strictly one at a time, in order", async () => {
    const h = harness({ hold: true, initial: viewFor(smallState(), "bleu") });
    h.director.enqueue([moved("bleu0", 5, 3), moved("bleu1", 10, 2)]);
    await tick();
    expect(h.hops.map((c) => c.pawn)).toEqual(["bleu0"]);
    expect(h.commits).toHaveLength(0);

    h.hops[0]?.done();
    await tick();
    expect(h.commits.map((c) => c.pawn)).toEqual(["bleu0"]);
    expect(h.hops.map((c) => c.pawn)).toEqual(["bleu0", "bleu1"]);

    h.hops[1]?.done();
    await h.director.idle();
    expect(h.commits.map((c) => c.pawn)).toEqual(["bleu0", "bleu1"]);
    // The render state followed the same order, one notification per event.
    expect(h.renders).toHaveLength(2);
    expect(h.renders[0]?.pawns.bleu0).toEqual(cell(8));
    expect(h.renders[0]?.pawns.bleu1).toEqual(cell(10));
    expect(h.renders[1]?.pawns.bleu1).toEqual(cell(12));
  });

  it("hops one pawn with one timeline shared by the animation and the clops", async () => {
    const h = harness({ initial: viewFor(smallState(), "bleu"), quarterTurns: 1 });
    const event = moved("bleu0", 5, 3);
    h.director.enqueue([event]);
    await h.director.idle();

    const call = h.hops[0] as HopCall;
    const path = (event as Extract<GameEvent, { t: "pawnMoved" }>).path;
    const from = (event as Extract<GameEvent, { t: "pawnMoved" }>).from;
    expect(call.points).toEqual([from, ...path].map((p) => anchorOf(p, 1)));
    expect(call.timeline).toEqual(hopTimeline(3, "normal"));
    expect(call.leadMs).toBeCloseTo(LEAD_S * 1000);
    expect(call.facings).toHaveLength(3);
    expect(h.clops).toEqual([{ offsets: call.timeline.clops, t0: 10 + LEAD_S }]);
    expect(h.commits).toEqual([
      { pawn: "bleu0", place: path[2], facing: call.facings[2] as Facing },
    ]);
  });

  it("follows the speed mode: fast, reduced and test", async () => {
    let mode: DirectorMode = "fast";
    const h = harness({ initial: viewFor(smallState(), "bleu"), mode: () => mode });
    h.director.enqueue([moved("bleu0", 5, 4)]);
    await h.director.idle();
    expect(h.hops[0]?.timeline).toEqual(hopTimeline(4, "fast"));

    mode = "reduced";
    h.director.enqueue([moved("bleu0", 9, 4)]);
    await h.director.idle();
    expect(h.hops[1]?.points).toHaveLength(2);
    expect(h.hops[1]?.timeline).toEqual(hopTimeline(1, "reduced"));

    mode = "test";
    h.director.enqueue([moved("bleu0", 13, 4)]);
    await h.director.idle();
    expect(h.hops).toHaveLength(2);
    expect(h.clops).toHaveLength(2);
    // Skipped animation still lands the pawn.
    expect(h.commits).toHaveLength(3);
    expect(h.director.renderState?.pawns.bleu0).toEqual(cell(17));
  });

  it("animates a pawn entering its home from where the render state has it", async () => {
    const h = harness({ initial: viewFor(smallState(), "bleu") });
    const home: Place = { z: "home", color: "bleu", slot: 0 };
    h.director.enqueue([
      { t: "pawnEnteredHome", pawn: "bleu0", path: [cell(70), home], slot: 0, homeCount: 1 },
    ]);
    await h.director.idle();
    expect(h.hops).toHaveLength(1);
    expect(h.hops[0]?.points[0]).toEqual(anchorOf(cell(5), 0));
    expect(h.hops[0]?.timeline).toEqual(hopTimeline(2, "normal"));
    expect(h.director.renderState?.pawns.bleu0).toEqual(home);
    expect(h.director.renderState?.homeCounts.bleu).toBe(1);
  });

  it("lands an entering pawn without animation when it has no render state to start from", async () => {
    const h = harness();
    const home: Place = { z: "home", color: "bleu", slot: 0 };
    h.director.enqueue([
      { t: "pawnEnteredHome", pawn: "bleu0", path: [cell(70), home], slot: 0, homeCount: 1 },
    ]);
    await h.director.idle();
    expect(h.hops).toHaveLength(0);
    expect(h.commits).toEqual([{ pawn: "bleu0", place: home, facing: "right" }]);
    expect(h.director.renderState).toBeNull();
  });

  it("applies every other event at once, without motion or sound", async () => {
    const h = harness({ initial: viewFor(smallState(), "bleu") });
    h.director.enqueue([
      { t: "cardPlayed", seat: "bleu", card: "5H" },
      { t: "pawnExited", pawn: "bleu2", to: cell(0) },
      { t: "turn", seat: "jaune" },
    ]);
    await h.director.idle();
    expect(h.hops).toHaveLength(0);
    expect(h.clops).toHaveLength(0);
    const state = h.director.renderState as RenderState;
    expect(state.handSizes.bleu).toBe(1);
    expect(state.lastPlayed.bleu).toBe("5H");
    expect(state.pawns.bleu2).toEqual(cell(0));
    expect(state.turn).toBe("jaune");
  });

  it("keeps going when an animation fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = harness({ hold: true, initial: viewFor(smallState(), "bleu") });
    h.director.enqueue([moved("bleu0", 5, 2), moved("bleu1", 10, 2)]);
    await tick();
    h.hops[0]?.fail(new Error("pawn bleu0 is not mounted"));
    await tick();
    h.hops[1]?.done();
    await h.director.idle();
    expect(error).toHaveBeenCalled();
    expect(h.director.renderState?.pawns.bleu0).toEqual(cell(7));
    expect(h.director.renderState?.pawns.bleu1).toEqual(cell(12));
    error.mockRestore();
  });

  it("resolves idle() at once when nothing is queued, and after the last event otherwise", async () => {
    const h = harness({ hold: true, initial: viewFor(smallState(), "bleu") });
    await h.director.idle();
    h.director.enqueue([moved("bleu0", 5, 2)]);
    let resolved = false;
    const idle = h.director.idle().then(() => {
      resolved = true;
    });
    await tick();
    expect(resolved).toBe(false);
    h.hops[0]?.done();
    await idle;
    expect(resolved).toBe(true);
  });

  it("reset() replaces the render state and drops what was queued", async () => {
    const h = harness({ hold: true, initial: viewFor(smallState(), "bleu") });
    h.director.enqueue([moved("bleu0", 5, 2), moved("bleu1", 10, 2)]);
    await tick();
    const fresh = viewFor(smallState(), "vert");
    h.director.reset(fresh);
    h.hops[0]?.done();
    await h.director.idle();
    expect(h.director.renderState).toEqual(renderOf(fresh));
    expect(h.hops).toHaveLength(1);
  });
});

describe("Director: snapToEnd and hidden tabs (Pitfall 11)", () => {
  it("snapToEnd finishes the running animation and folds the rest at once, silently", async () => {
    const h = harness({ hold: true, initial: viewFor(smallState(), "bleu") });
    h.director.enqueue([
      moved("bleu0", 5, 3),
      moved("bleu1", 10, 2),
      { t: "cardPlayed", seat: "bleu", card: "5H" },
      { t: "turn", seat: "jaune" },
    ]);
    await tick();
    expect(h.hops).toHaveLength(1);

    await h.director.snapToEnd();

    expect(h.finished).toEqual(["bleu0"]);
    // One animation and one set of clops: the running event's. Nothing for the skipped ones.
    expect(h.hops).toHaveLength(1);
    expect(h.clops).toHaveLength(1);
    expect(h.commits.map((c) => c.pawn)).toEqual(["bleu0", "bleu1"]);
    const state = h.director.renderState as RenderState;
    expect(state.pawns.bleu0).toEqual(cell(8));
    expect(state.pawns.bleu1).toEqual(cell(12));
    expect(state.lastPlayed.bleu).toBe("5H");
    expect(state.turn).toBe("jaune");
    expect(h.renders).toHaveLength(4);

    // Back to normal afterwards.
    h.director.enqueue([moved("bleu0", 8, 2)]);
    await tick();
    expect(h.hops).toHaveLength(2);
    h.hops[1]?.done();
    await h.director.idle();
  });

  it("snapToEnd with nothing running or queued changes nothing", async () => {
    const h = harness({ initial: viewFor(smallState(), "bleu") });
    await h.director.snapToEnd();
    expect(h.renders).toHaveLength(0);
    h.director.enqueue([moved("bleu0", 5, 2)]);
    await h.director.idle();
    expect(h.hops).toHaveLength(1);
  });

  it("a hidden tab finishes the running move, pauses the ambience and plays the rest silently", async () => {
    const doc = fakeDocument();
    const h = harness({ hold: true, initial: viewFor(smallState(), "bleu"), document: doc });
    h.director.enqueue([moved("bleu0", 5, 3), moved("bleu1", 10, 2)]);
    await tick();

    doc.hidden = true;
    doc.fire();
    await h.director.idle();
    expect(h.finished).toEqual(["bleu0"]);
    expect(h.audio.pauseAmbience).toHaveBeenCalledTimes(1);
    expect(h.hops).toHaveLength(1);
    expect(h.director.renderState?.pawns.bleu1).toEqual(cell(12));

    // Events that arrive while the tab is hidden are applied at once.
    h.director.enqueue([moved("bleu1", 12, 2)]);
    await h.director.idle();
    expect(h.hops).toHaveLength(1);
    expect(h.clops).toHaveLength(1);
    expect(h.director.renderState?.pawns.bleu1).toEqual(cell(14));

    doc.hidden = false;
    doc.fire();
    expect(h.audio.resumeAmbience).toHaveBeenCalledTimes(1);
    h.director.enqueue([moved("bleu1", 14, 2)]);
    await tick();
    expect(h.hops).toHaveLength(2);
    h.hops[1]?.done();
    await h.director.idle();
  });

  it("makes no sound at all while the tab is hidden", async () => {
    const backend = new FakeBackend();
    const engine = createAudioEngine({
      backend,
      render: async () => ({ duration: 0.1 }),
      random: () => 0.5,
    });
    engine.unlock();
    await engine.whenReady();
    const doc = fakeDocument();
    const director = createDirector({
      animator: { hop: async () => {} },
      audio: engine,
      quarterTurns: 0,
      facingOf: () => "right",
      commit: () => {},
      initial: viewFor(smallState(), "bleu"),
      document: doc,
    });

    doc.hidden = true;
    doc.fire();
    const before = backend.plays.length;
    director.enqueue([moved("bleu0", 5, 5), moved("bleu1", 10, 5)]);
    await director.idle();
    expect(backend.plays.length).toBe(before);
    expect(director.renderState?.pawns.bleu0).toEqual(cell(10));

    // Visible again: the same move now makes the hoof sounds.
    doc.hidden = false;
    doc.fire();
    director.enqueue([moved("bleu0", 10, 3)]);
    await director.idle();
    expect(backend.plays.length).toBeGreaterThan(before);
    director.dispose();
  });

  it("stops listening to the document once disposed", () => {
    const doc = fakeDocument();
    const h = harness({ document: doc });
    h.director.dispose();
    doc.hidden = true;
    doc.fire();
    expect(h.audio.pauseAmbience).not.toHaveBeenCalled();
  });
});

describe("Director: the render state equals the view projection", () => {
  type Step = { state: GameState; events: GameEvent[] };

  /** Four random bots play `max` actions from a fresh deal; every step is kept. */
  function game(seed: Rng, max: number): { first: GameState; steps: Step[] } {
    const first = startGame({ firstDealer: "bleu" }, seed).state;
    const steps: Step[] = [];
    let state = first;
    let rng: Rng = [seed[3] ^ 0x5bd1e995, seed[2], seed[1], seed[0] + 1];
    while (steps.length < max && state.phase !== "won") {
      const seat: Color =
        state.phase === "exchange"
          ? (COLORS.find((c) => state.given[c] === null) as Color)
          : state.turn;
      let action: Action;
      [action, rng] = randomLegal(viewFor(state, seat), seat, rng);
      const result = apply(state, seat, action);
      steps.push({ state: result.state, events: result.events });
      state = result.state;
    }
    return { first, steps };
  }

  for (const [label, mode] of [
    ["without animation", "test"],
    ["with animation", "normal"],
  ] as const) {
    it(`after idle(), renderState is renderOf(viewFor(state, human)) ${label}`, async () => {
      const human: Color = "jaune";
      const { first, steps } = game([9, 8, 7, 6], 320);
      const h = harness({ initial: viewFor(first, human), mode: () => mode });
      let checked = 0;
      for (const [i, step] of steps.entries()) {
        h.director.enqueue(step.events);
        if (i % 16 === 15 || i === steps.length - 1) {
          await h.director.idle();
          expect(h.director.renderState).toEqual(renderOf(viewFor(step.state, human)));
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(15);
    });
  }

  it("matches after a snap in the middle of a batch", async () => {
    const human: Color = "rouge";
    const { first, steps } = game([5, 5, 5, 5], 200);
    const h = harness({ initial: viewFor(first, human), hold: true });
    for (const step of steps) h.director.enqueue(step.events);
    await tick();
    await h.director.snapToEnd();
    const last = steps[steps.length - 1] as Step;
    expect(h.director.renderState).toEqual(renderOf(viewFor(last.state, human)));
  });
});
