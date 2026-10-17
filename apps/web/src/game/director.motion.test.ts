import { captureBeat, hopTimeline, MOTION, type Mode, type Point } from "@toc/board";
import {
  forwardCells,
  type GameEvent,
  type PawnId,
  type Place,
  type Rng,
  scenarioState,
  viewFor,
} from "@toc/engine";
import { describe, expect, it } from "vitest";
import { ENABLED_SOUNDS, type SoundId } from "../audio/sounds.ts";
import { anchorOf, type Facing } from "../board/geometry.ts";
import { cuesFor } from "./cues.ts";
import { createDirector, type DirectorMode, LEAD_S, type SwapLeg } from "./director.ts";

// What the Director asks of the animator and of the audio for each knight event: which motion, with
// which delay, and which sound at which time on the audio clock. The pictures themselves are checked
// in e2e/animations.spec.ts.

const SEED: Rng = [3, 1, 4, 1];
const NOW = 10;
const T0 = NOW + LEAD_S;
const LEAD = LEAD_S * 1000;

const cell = (n: number): Place => ({ z: "ring", cell: n });
const stable = (color: "bleu" | "jaune" | "rouge" | "vert", slot: 0 | 1 | 2 | 3): Place => ({
  z: "stable",
  color,
  slot,
});

function start() {
  return viewFor(
    scenarioState(
      {
        pawns: {
          bleu: [{ p: 5 }, { p: 20 }, "S", "S"],
          jaune: [{ p: 62 }, "S", "S", "S"],
          vert: [{ p: 40 }, "S", "S", "S"],
        },
        hands: { bleu: ["5H"] },
        turn: "bleu",
      },
      SEED,
    ),
    "bleu",
  );
}

type Call = { name: string; pawn: string; lead: number; mode?: Mode; extra?: unknown };

function rig(mode: () => DirectorMode = () => "normal") {
  const calls: Call[] = [];
  const cues: { id: SoundId; at: number }[] = [];
  const clops: { offsets: number[]; t0: number }[] = [];
  const commits: { pawn: PawnId; place: Place }[] = [];
  const finished: PawnId[] = [];
  const begun: PawnId[][] = [];
  const note = (name: string, pawn: string, lead: number, m?: Mode, extra?: unknown) =>
    calls.push({ name, pawn, lead, mode: m, extra });
  const done = (): Promise<void> => Promise.resolve();
  const director = createDirector({
    animator: {
      begin: (pawns) => begun.push(pawns),
      hop: (pawn, points, timeline, lead, facings, m) => {
        note("hop", pawn, lead, m, { points, timeline, facings });
        return done();
      },
      finish: (pawn) => finished.push(pawn),
      exit: (pawn, from, to, lead, facing, m) => {
        note("exit", pawn, lead, m, { from, to, facing });
        return done();
      },
      turn: (pawn, from, to, lead, m) => {
        note("turn", pawn, lead, m, { from, to });
        return done();
      },
      rear: (pawn, lead, m) => {
        note("rear", pawn, lead, m);
        return done();
      },
      eject: (pawn, from, to, lead, facing, m) => {
        note("eject", pawn, lead, m, { from, to, facing });
        return done();
      },
      swap: (a: SwapLeg, b: SwapLeg, lead, m) => {
        note("swap", a.pawn, lead, m, { a, b });
        return done();
      },
      settle: (pawn, lead, m) => {
        note("settle", pawn, lead, m);
        return done();
      },
      party: (pawn, at, lead, m) => {
        note("party", pawn, lead, m, { at });
        return done();
      },
      winHop: (pawns, lead, m) => {
        note("winHop", pawns.join(","), lead, m, { pawns });
        return done();
      },
    },
    audio: {
      now: () => NOW,
      scheduleClops: (offsets, t0) => clops.push({ offsets, t0 }),
      cue: (id, at) => cues.push({ id, at: at ?? NOW }),
    },
    quarterTurns: 0,
    facingOf: () => "right" as Facing,
    commit: (pawn, place) => commits.push({ pawn, place }),
    getMode: mode,
    initial: start(),
  });
  return { director, calls, cues, clops, commits, finished, begun };
}

const named = (calls: Call[], name: string) => calls.filter((c) => c.name === name);

function moved(pawn: PawnId, progress: number, steps: number, dir: 1 | -1 = 1): GameEvent {
  const color = pawn.slice(0, -1) as "bleu";
  return {
    t: "pawnMoved",
    pawn,
    from: forwardCells(color, progress, 1)[0] as Place,
    path: forwardCells(color, progress, steps),
    dir,
  };
}

const eaten = (atStep: number, at: Place): GameEvent[] => [
  { t: "pawnCaptured", by: "bleu0", victim: "jaune0", at, atStep },
  { t: "pawnSentHome", pawn: "jaune0", to: stable("jaune", 0) },
];

describe("stable exit", () => {
  it("is one bound with a clop on landing, and no neigh (only the hooves sound since 2026-10-15)", async () => {
    const h = rig();
    const to = cell(0);
    h.director.enqueue([{ t: "pawnExited", pawn: "bleu2", to }]);
    await h.director.idle();
    const call = named(h.calls, "exit")[0] as Call;
    expect(call).toMatchObject({ pawn: "bleu2", lead: LEAD, mode: "normal" });
    expect((call.extra as { from: Point }).from).toEqual(anchorOf(stable("bleu", 2), 0));
    expect((call.extra as { to: Point }).to).toEqual(anchorOf(to, 0));
    // The neigh at take-off (cuesFor) is silenced: Romain, 2026-10-15, « que les sabots ».
    expect(h.cues).toEqual([]);
    expect(h.clops).toEqual([{ offsets: [MOTION.exit], t0: T0 }]);
    expect(h.commits).toEqual([{ pawn: "bleu2", place: to }]);
    expect(h.director.renderState?.pawns.bleu2).toEqual(to);
  });

  it("goes fast at 240 ms and reduced as a 180 ms slide", async () => {
    for (const [mode, total] of [
      ["fast", 240],
      ["reduced", 180],
    ] as const) {
      const h = rig(() => mode);
      h.director.enqueue([{ t: "pawnExited", pawn: "bleu2", to: cell(0) }]);
      await h.director.idle();
      expect(h.clops[0]?.offsets[0]).toBeCloseTo(total, 9);
      expect(named(h.calls, "exit")[0]?.mode).toBe(mode);
    }
  });
});

describe("backward 4", () => {
  it("turns the head for 120 ms, then hops; the clops follow the turn", async () => {
    const h = rig();
    h.director.enqueue([moved("bleu1", 20, 4, -1)]);
    await h.director.idle();
    const turn = named(h.calls, "turn")[0] as Call;
    const hop = named(h.calls, "hop")[0] as Call;
    expect(turn.lead).toBe(LEAD);
    expect(hop.lead).toBe(LEAD + MOTION.volteFace);
    const timeline = hopTimeline(4);
    expect(h.clops[0]?.offsets).toEqual(timeline.clops.map((t) => t + MOTION.volteFace));
  });

  it("a forward move has no turn; reduced motion has none either", async () => {
    const h = rig();
    h.director.enqueue([moved("bleu1", 20, 4)]);
    await h.director.idle();
    expect(named(h.calls, "turn")).toHaveLength(0);
    const r = rig(() => "reduced");
    r.director.enqueue([moved("bleu1", 20, 4, -1)]);
    await r.director.idle();
    expect(named(r.calls, "turn")).toHaveLength(0);
    expect(named(r.calls, "hop")[0]?.lead).toBe(LEAD);
  });
});

describe("capture on the final cell (D-12)", () => {
  const play = [moved("bleu0", 5, 3), ...eaten(2, cell(8))];

  it("rears at arrival, then throws the victim back; the snort and the whinny are silenced", async () => {
    const h = rig();
    h.director.enqueue(play);
    await h.director.idle();
    const total = hopTimeline(3).total;
    expect(named(h.calls, "rear")[0]).toMatchObject({ pawn: "bleu0", lead: LEAD + total });
    const eject = named(h.calls, "eject")[0] as Call;
    expect(eject).toMatchObject({ pawn: "jaune0", lead: LEAD + total + 500 });
    expect((eject.extra as { from: Point }).from).toEqual(anchorOf(cell(8), 0));
    expect((eject.extra as { to: Point }).to).toEqual(anchorOf(stable("jaune", 0), 0));
    // The snort and the whinny (cuesFor) are silenced since 2026-10-15: only the clops sound.
    expect(h.cues).toEqual([]);
    // One set of clops for the move, one t0 for everything.
    expect(h.clops).toEqual([{ offsets: hopTimeline(3).clops, t0: T0 }]);
    expect(h.begun).toEqual([["bleu0", "jaune0"]]);
  });

  it("folds the three events in order and lands both knights", async () => {
    const h = rig();
    h.director.enqueue(play);
    await h.director.idle();
    expect(h.director.renderState?.pawns.bleu0).toEqual(cell(8));
    expect(h.director.renderState?.pawns.jaune0).toEqual(stable("jaune", 0));
    expect(h.director.renderState?.captures["bleu-rouge"]).toBe(1);
    expect(h.commits).toEqual([
      { pawn: "bleu0", place: cell(8) },
      { pawn: "jaune0", place: stable("jaune", 0) },
    ]);
  });

  it("fast mode scales the rear and the throw; reduced motion has no rear and fades at once", async () => {
    const fast = rig(() => "fast");
    fast.director.enqueue(play);
    await fast.director.idle();
    const total = hopTimeline(3, "fast").total;
    expect(named(fast.calls, "eject")[0]?.lead).toBeCloseTo(LEAD + total + 200, 9);
    expect(named(fast.calls, "rear")[0]?.lead).toBeCloseTo(LEAD + total, 9);

    const reduced = rig(() => "reduced");
    reduced.director.enqueue(play);
    await reduced.director.idle();
    expect(named(reduced.calls, "rear")).toHaveLength(0);
    expect(named(reduced.calls, "eject")[0]?.lead).toBe(LEAD + 180);
    expect(reduced.cues).toEqual([]); // the whinny is silenced since 2026-10-15
  });
});

describe("the 7 (D-12): eaten as the attacker passes", () => {
  it("throws the victim back at the landing of its cell, during the hops, with no rear", async () => {
    const h = rig();
    // Seven cells from progress 5: the Jaune knight on cell 8 is the third cell of the move.
    h.director.enqueue([moved("bleu0", 5, 7), ...eaten(2, cell(8))]);
    await h.director.idle();
    const beat = captureBeat(7, 2, "normal");
    const eject = named(h.calls, "eject")[0] as Call;
    expect(eject.lead).toBeCloseTo(LEAD + beat, 9);
    expect(beat).toBeLessThan(hopTimeline(7).total);
    expect(named(h.calls, "rear")).toHaveLength(0);
    expect(h.cues).toEqual([]); // the whinny at the beat is silenced since 2026-10-15
  });

  it("two captures on one move are two throws at their own moments", async () => {
    const h = rig();
    h.director.enqueue([
      moved("bleu0", 5, 7),
      { t: "pawnCaptured", by: "bleu0", victim: "jaune0", at: cell(8), atStep: 2 },
      { t: "pawnSentHome", pawn: "jaune0", to: stable("jaune", 0) },
      { t: "pawnCaptured", by: "bleu0", victim: "vert0", at: cell(10), atStep: 4 },
      { t: "pawnSentHome", pawn: "vert0", to: stable("vert", 0) },
    ]);
    await h.director.idle();
    const throws = named(h.calls, "eject");
    expect(throws.map((c) => c.pawn)).toEqual(["jaune0", "vert0"]);
    expect(throws[1]?.lead).toBeCloseTo(LEAD + captureBeat(7, 4, "normal"), 9);
    expect(h.director.renderState?.pawns.vert0).toEqual(stable("vert", 0));
    expect(h.commits.map((c) => c.pawn)).toEqual(["bleu0", "jaune0", "vert0"]);
  });
});

describe("the Valet (D-13)", () => {
  const swap: GameEvent = {
    t: "pawnsSwapped",
    a: "bleu0",
    b: "jaune0",
    aTo: cell(8),
    bTo: cell(5),
  };

  it("crosses the two knights at once; the surprised neigh is silenced", async () => {
    const h = rig();
    h.director.enqueue([swap]);
    await h.director.idle();
    const call = named(h.calls, "swap")[0] as Call;
    expect(call.lead).toBe(LEAD);
    const { a, b } = call.extra as { a: SwapLeg; b: SwapLeg };
    expect([a.pawn, b.pawn]).toEqual(["bleu0", "jaune0"]);
    expect(a.from).toEqual(anchorOf(cell(5), 0));
    expect(a.to).toEqual(anchorOf(cell(8), 0));
    expect(b.to).toEqual(anchorOf(cell(5), 0));
    expect(h.cues).toEqual([]); // the surprised neigh is silenced since 2026-10-15
    expect(h.director.renderState?.pawns.bleu0).toEqual(cell(8));
    expect(h.director.renderState?.pawns.jaune0).toEqual(cell(5));
    expect(h.commits.map((c) => c.pawn)).toEqual(["bleu0", "jaune0"]);
  });
});

describe("the home (D-14)", () => {
  const home = (homeCount: number): GameEvent => ({
    t: "pawnEnteredHome",
    pawn: "bleu0",
    path: [cell(68), cell(69), cell(70), { z: "home", color: "bleu", slot: 0 }],
    slot: 0,
    homeCount,
  });

  it("the first three knights settle for 150 ms; the joyful neigh is silenced", async () => {
    const h = rig();
    h.director.enqueue([home(2)]);
    await h.director.idle();
    const total = hopTimeline(4).total;
    expect(named(h.calls, "settle")[0]).toMatchObject({ pawn: "bleu0", lead: LEAD + total });
    expect(named(h.calls, "party")).toHaveLength(0);
    expect(h.cues).toEqual([]); // the joyful neigh is silenced since 2026-10-15
  });

  it("the fourth knight rears and bursts; the long neigh is silenced", async () => {
    const h = rig();
    h.director.enqueue([home(4)]);
    await h.director.idle();
    const total = hopTimeline(4).total;
    const call = named(h.calls, "party")[0] as Call;
    expect(call).toMatchObject({ pawn: "bleu0", lead: LEAD + total });
    expect((call.extra as { at: Point }).at).toEqual(
      anchorOf({ z: "home", color: "bleu", slot: 0 }, 0),
    );
    expect(named(h.calls, "settle")).toHaveLength(0);
    expect(h.cues).toEqual([]); // the long neigh is silenced since 2026-10-15
  });

  it("reduced motion neither settles nor bursts, and the neigh is silenced like the others", async () => {
    const h = rig(() => "reduced");
    h.director.enqueue([home(4)]);
    await h.director.idle();
    expect(named(h.calls, "party")).toHaveLength(0);
    expect(named(h.calls, "settle")).toHaveLength(0);
    expect(h.cues).toEqual([]); // silenced since 2026-10-15
    expect(h.clops[0]?.offsets).toEqual([180]);
  });
});

describe("the win", () => {
  it("the eight knights of the winning team hop once before the game is folded as won", async () => {
    const h = rig();
    h.director.enqueue([{ t: "gameWon", team: "bleu-rouge" }]);
    await h.director.idle();
    const call = named(h.calls, "winHop")[0] as Call;
    const pawns = (call.extra as { pawns: PawnId[] }).pawns;
    expect(pawns).toHaveLength(8);
    expect(new Set(pawns.map((p) => p.slice(0, -1)))).toEqual(new Set(["bleu", "rouge"]));
    expect(h.director.renderState?.phase).toBe("won");
  });
});

describe("only the hooves (ENABLED_SOUNDS, Romain 2026-10-15: « Oui, que les sabots »)", () => {
  it("keeps the neighs in the cue plan but never sends them; the clops still go out", async () => {
    expect([...ENABLED_SOUNDS]).toEqual(["sabot"]);
    // The plan of cues.ts is unchanged, so the neighs can come back with the switch.
    const exit: GameEvent = { t: "pawnExited", pawn: "bleu2", to: cell(0) };
    expect(cuesFor(exit, { mode: "normal" }).map((c) => c.id)).toEqual(["hennissement-sortie"]);
    const h = rig();
    h.director.enqueue([exit, moved("bleu0", 5, 3), ...eaten(2, cell(8))]);
    await h.director.idle();
    expect(h.cues).toEqual([]);
    expect(h.clops.length).toBeGreaterThan(0);
  });
});

describe("silent and instant paths", () => {
  it("test mode applies the same events with no motion and no sound", async () => {
    const h = rig(() => "test");
    h.director.enqueue([
      { t: "pawnExited", pawn: "bleu2", to: cell(0) },
      moved("bleu0", 5, 3),
      ...eaten(2, cell(8)),
      { t: "pawnsSwapped", a: "bleu1", b: "vert0", aTo: cell(40 + 54 - 72), bTo: cell(20) },
      { t: "gameWon", team: "bleu-rouge" },
    ]);
    await h.director.idle();
    expect(h.calls).toHaveLength(0);
    expect(h.cues).toHaveLength(0);
    expect(h.clops).toHaveLength(0);
    expect(h.director.renderState?.pawns.jaune0).toEqual(stable("jaune", 0));
    expect(h.director.renderState?.phase).toBe("won");
  });

  it("snapToEnd finishes every knight of the running step, the victim too", async () => {
    const calls: PawnId[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const director = createDirector({
      animator: {
        hop: () => gate,
        eject: () => gate,
        rear: () => gate,
        finish: (pawn) => {
          calls.push(pawn);
          release();
        },
      },
      audio: { now: () => NOW, scheduleClops: () => {} },
      quarterTurns: 0,
      facingOf: () => "right",
      commit: () => {},
      initial: start(),
    });
    director.enqueue([moved("bleu0", 5, 3), ...eaten(2, cell(8))]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await director.snapToEnd();
    expect(calls.sort()).toEqual(["bleu0", "jaune0"]);
    expect(director.renderState?.pawns.jaune0).toEqual(stable("jaune", 0));
  });
});
