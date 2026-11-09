// The per-seat tally of a game (plan 05-01, HIST-03 support; 05-RESEARCH Pattern 1, « Code Examples »):
// foldTally reads the engine's events. A capture is credited to the seat that played the card (a
// finished player moving the partner's knights, G7, credits the player); the eaten knight's colour
// loses one. Pure: the input tally is never changed.

import { describe, expect, it } from "vitest";
import { emptyTally, foldTally, type GameEvent, type PawnId, type Tally } from "../src/index.ts";

const capture = (by: PawnId, victim: PawnId): GameEvent => ({
  t: "pawnCaptured",
  by,
  victim,
  at: { z: "ring", cell: 10 },
  atStep: 0,
});

describe("foldTally", () => {
  it("starts at zero for the four seats", () => {
    expect(emptyTally()).toEqual({
      bleu: { captured: 0, lost: 0 },
      jaune: { captured: 0, lost: 0 },
      rouge: { captured: 0, lost: 0 },
      vert: { captured: 0, lost: 0 },
    });
  });

  it("credits the seat that played the card and debits the eaten knight's colour", () => {
    const events: GameEvent[] = [
      { t: "cardPlayed", seat: "bleu", card: "5S" },
      capture("bleu0", "jaune2"),
    ];
    const tally = foldTally(emptyTally(), events);
    expect(tally.bleu).toEqual({ captured: 1, lost: 0 });
    expect(tally.jaune).toEqual({ captured: 0, lost: 1 });
    expect(tally.rouge).toEqual({ captured: 0, lost: 0 });
  });

  it("a finished player moving the partner's knight (G7) is credited, not the knight's colour", () => {
    const events: GameEvent[] = [
      { t: "cardPlayed", seat: "bleu", card: "7H" },
      capture("rouge1", "vert0"),
      capture("rouge1", "jaune3"),
    ];
    const tally = foldTally(emptyTally(), events);
    expect(tally.bleu.captured).toBe(2);
    expect(tally.rouge.captured).toBe(0);
    expect(tally.vert.lost).toBe(1);
    expect(tally.jaune.lost).toBe(1);
  });

  it("without a card played in the batch, the capturing knight's colour is credited", () => {
    const tally = foldTally(emptyTally(), [capture("vert2", "rouge0")]);
    expect(tally.vert.captured).toBe(1);
    expect(tally.rouge.lost).toBe(1);
  });

  it("adds to the tally it is given and never changes it", () => {
    const start: Tally = foldTally(emptyTally(), [
      { t: "cardPlayed", seat: "jaune", card: "9C" },
      capture("jaune0", "bleu1"),
    ]);
    const frozen = JSON.stringify(start);
    const next = foldTally(start, [
      { t: "cardPlayed", seat: "jaune", card: "8C" },
      capture("jaune0", "bleu2"),
    ]);
    expect(JSON.stringify(start)).toBe(frozen);
    expect(next.jaune.captured).toBe(2);
    expect(next.bleu.lost).toBe(2);
    expect(next).not.toBe(start);
  });

  it("ignores every other event", () => {
    const tally = foldTally(emptyTally(), [
      { t: "turn", seat: "bleu" },
      { t: "pawnExited", pawn: "bleu0", to: { z: "ring", cell: 0 } },
      { t: "gameWon", team: "bleu-rouge" },
    ]);
    expect(tally).toEqual(emptyTally());
  });
});
