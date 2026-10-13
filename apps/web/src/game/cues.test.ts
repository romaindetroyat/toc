import { captureBeat, hopTimeline, MOTION } from "@toc/board";
import type { GameEvent, Place } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { type Cue, cuesFor } from "./cues.ts";

const ring = (cell: number): Place => ({ z: "ring", cell });
const path = (n: number): Place[] => Array.from({ length: n }, (_, i) => ring(20 + i));

const moved = (n: number, dir: 1 | -1 = 1): GameEvent => ({
  t: "pawnMoved",
  pawn: "bleu0",
  from: ring(19),
  path: path(n),
  dir,
});
const captured = (atStep: number): GameEvent => ({
  t: "pawnCaptured",
  by: "bleu0",
  victim: "rouge1",
  at: ring(20 + atStep),
  atStep,
});
const home = (homeCount: number): GameEvent => ({
  t: "pawnEnteredHome",
  pawn: "bleu0",
  path: path(3),
  slot: 0,
  homeCount,
});

const ids = (cues: Cue[]) => cues.map((c) => c.id);
const only = (cues: Cue[], id: Cue["id"]) => cues.filter((c) => c.id === id);

describe("cuesFor (D-23)", () => {
  it("a stable exit neighs at take-off", () => {
    const event: GameEvent = { t: "pawnExited", pawn: "bleu0", to: ring(18) };
    expect(cuesFor(event, { mode: "normal" })).toEqual([{ id: "hennissement-sortie", atMs: 0 }]);
    expect(cuesFor(event, { mode: "fast" })).toEqual([{ id: "hennissement-sortie", atMs: 0 }]);
  });

  it("a move clops on the hop timeline, nothing else", () => {
    const timeline = hopTimeline(4);
    const cues = cuesFor(moved(4), { mode: "normal", timeline });
    expect(ids(cues).every((id) => id === "sabot")).toBe(true);
    expect(cues.map((c) => c.atMs)).toEqual(timeline.clops);
  });

  it("a backward 4 clops after the 120 ms volte-face", () => {
    const timeline = hopTimeline(4);
    const cues = cuesFor(moved(4, -1), { mode: "normal", timeline });
    expect(cues.map((c) => c.atMs)).toEqual(timeline.clops.map((t) => t + MOTION.volteFace));
  });

  it("reduced motion keeps exactly one clop per move", () => {
    const timeline = hopTimeline(4, "reduced");
    expect(cuesFor(moved(4), { mode: "reduced", timeline })).toEqual([{ id: "sabot", atMs: 180 }]);
    expect(only(cuesFor(moved(4, -1), { mode: "reduced", timeline }), "sabot")).toHaveLength(1);
  });

  it("a capture on the final cell snorts at arrival and whinnies at the ejection start", () => {
    const timeline = hopTimeline(4);
    const cues = cuesFor(captured(3), { mode: "normal", timeline, isFinalCapture: true });
    expect(cues).toEqual([
      { id: "hennissement-ruade", atMs: timeline.total },
      { id: "hennissement-plainte", atMs: timeline.total + MOTION.rearUp + MOTION.rearDown },
    ]);
  });

  it("the arrival of a capture can be given (volte-face, exit)", () => {
    const cues = cuesFor(captured(0), { mode: "normal", arrivalMs: 600, isFinalCapture: true });
    expect(cues.map((c) => c.atMs)).toEqual([600, 1100]);
  });

  it("fast mode scales the offsets of the capture", () => {
    const timeline = hopTimeline(4, "fast");
    const [ruade, plainte] = cuesFor(captured(3), { mode: "fast", timeline, isFinalCapture: true });
    expect(ruade?.atMs).toBeCloseTo(timeline.total, 9);
    expect(plainte?.atMs).toBeCloseTo(timeline.total + 500 * 0.4, 9);
  });

  it("a capture with the 7 whinnies when the attacker passes the cell", () => {
    const n = 7;
    const timeline = hopTimeline(n);
    for (const k of [0, 2, 5]) {
      expect(cuesFor(captured(k), { mode: "normal", timeline, isFinalCapture: false })).toEqual([
        { id: "hennissement-plainte", atMs: captureBeat(n, k, "normal") },
      ]);
    }
  });

  it("with reduced motion a capture has no snort, the whinny comes with the fade", () => {
    const timeline = hopTimeline(4, "reduced");
    expect(cuesFor(captured(3), { mode: "reduced", timeline, isFinalCapture: true })).toEqual([
      { id: "hennissement-plainte", atMs: 180 },
    ]);
  });

  it("a Valet swap is a surprised neigh at take-off", () => {
    const event: GameEvent = {
      t: "pawnsSwapped",
      a: "bleu0",
      b: "vert1",
      aTo: ring(40),
      bTo: ring(30),
    };
    expect(cuesFor(event, { mode: "normal" })).toEqual([{ id: "hennissement-surpris", atMs: 0 }]);
  });

  it("entering home neighs joyfully at the settle, the fourth knight with the long neigh", () => {
    const timeline = hopTimeline(3);
    const third = cuesFor(home(3), { mode: "normal", timeline });
    expect(only(third, "hennissement-joyeux")).toEqual([
      { id: "hennissement-joyeux", atMs: timeline.total },
    ]);
    expect(only(third, "hennissement-fete")).toEqual([]);
    expect(only(third, "sabot").map((c) => c.atMs)).toEqual(timeline.clops);

    const fourth = cuesFor(home(4), { mode: "normal", timeline });
    expect(only(fourth, "hennissement-fete")).toEqual([
      { id: "hennissement-fete", atMs: timeline.total },
    ]);
    expect(only(fourth, "hennissement-joyeux")).toEqual([]);
  });

  it("card events map to the card sounds (scheduled by the card animations)", () => {
    expect(cuesFor({ t: "cardPlayed", seat: "bleu", card: "5H" }, { mode: "normal" })).toEqual([
      { id: "carte-pose", atMs: 0 },
    ]);
    expect(
      cuesFor({ t: "dealt", dealer: "bleu", dealIndex: 0, size: 5 }, { mode: "normal" }),
    ).toEqual([{ id: "carte-donne", atMs: 0 }]);
    expect(
      cuesFor(
        { t: "cardsExchanged", received: { bleu: null, jaune: null, rouge: null, vert: null } },
        { mode: "normal" },
      ),
    ).toEqual([{ id: "carte-echange", atMs: 0 }]);
  });

  it("a dead hand laid on the felt gives one card-down sound", () => {
    expect(
      cuesFor({ t: "handDiscarded", seat: "bleu", cards: ["2S", "4S"] }, { mode: "normal" }),
    ).toEqual([{ id: "carte-pose", atMs: 0 }]);
  });

  it("events with no sound give no cue", () => {
    expect(cuesFor({ t: "turn", seat: "bleu" }, { mode: "normal" })).toEqual([]);
    expect(
      cuesFor(
        { t: "pawnSentHome", pawn: "rouge1", to: { z: "stable", color: "rouge", slot: 1 } },
        { mode: "normal" },
      ),
    ).toEqual([]);
  });
});
