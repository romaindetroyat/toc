import type { GameEvent, Place } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { hopTimeline } from "./hopTimeline.ts";
import {
  captureBeat,
  cardPlayDuration,
  cardsDuration,
  eventDuration,
  eventsDuration,
  exchangeDuration,
  MAX_DEAL_CARDS,
  MOTION,
  REDUCED,
  scaleFor,
} from "./motion.ts";

const ring = (cell: number): Place => ({ z: "ring", cell });
const stable = (slot: 0 | 1 | 2 | 3): Place => ({ z: "stable", color: "bleu", slot });

const exited: GameEvent = { t: "pawnExited", pawn: "bleu0", to: ring(18) };
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
const swapped: GameEvent = {
  t: "pawnsSwapped",
  a: "bleu0",
  b: "vert1",
  aTo: ring(40),
  bTo: ring(30),
};

describe("MOTION table (UI-SPEC Motion Contract)", () => {
  it("carries the contract values", () => {
    expect(MOTION.exit).toBe(600);
    expect(MOTION.volteFace).toBe(120);
    expect([MOTION.rearUp, MOTION.rearDown]).toEqual([220, 280]);
    expect([MOTION.eject, MOTION.ejectBounce, MOTION.ejectPeak]).toEqual([700, 150, 0.35]);
    expect(MOTION.swap).toBe(900);
    expect(MOTION.homeSettle).toBe(150);
    expect([MOTION.partyRear, MOTION.partyBurst, MOTION.partyParticles]).toEqual([500, 700, 8]);
    expect(MOTION.winHop).toBe(600);
    expect([MOTION.landingSquash, MOTION.lastHopSettle]).toEqual([0.08, 80]);
    expect([MOTION.dealCard, MOTION.dealStagger]).toEqual([300, 55]);
    expect([MOTION.deadCard, MOTION.deadStagger]).toEqual([350, 60]);
    expect([MOTION.cardPlay, MOTION.exchangeCross, MOTION.banner]).toEqual([300, 300, 1200]);
    expect(REDUCED.cards).toBe(150);
    expect(REDUCED.move).toBe(180);
    expect([REDUCED.captureFadeOut, REDUCED.captureFadeIn, REDUCED.swapFade]).toEqual([
      150, 150, 150,
    ]);
  });

  it("scales durations: normal 1, fast 0.4, reduced 1 (its own table)", () => {
    expect(scaleFor("normal")).toBe(1);
    expect(scaleFor("fast")).toBe(0.4);
    expect(scaleFor("reduced")).toBe(1);
  });
});

describe("eventDuration", () => {
  it("an exit is one 600 ms bound, 240 ms fast, 180 ms reduced", () => {
    expect(eventDuration(exited, "normal")).toBe(600);
    expect(eventDuration(exited, "fast")).toBeCloseTo(240, 9);
    expect(eventDuration(exited, "reduced")).toBe(180);
  });

  it("a move is hopTimeline(n).total, with a 120 ms volte-face before a backward 4", () => {
    expect(eventDuration(moved(1), "normal")).toBe(400);
    expect(eventDuration(moved(4), "normal")).toBe(799);
    expect(eventDuration(moved(13), "normal")).toBe(1996);
    expect(eventDuration(moved(4, -1), "normal")).toBe(120 + 799);
    expect(eventDuration(moved(4, -1), "fast")).toBeCloseTo((120 + 799) * 0.4, 9);
    expect(eventDuration(moved(4), "fast")).toBeCloseTo(hopTimeline(4, "fast").total, 9);
    expect(eventDuration(moved(4), "reduced")).toBe(180);
    expect(eventDuration(moved(4, -1), "reduced")).toBe(180);
  });

  it("a capture on the final cell is a rear (220 + 280) then the ejection (700 + 150)", () => {
    expect(eventDuration(captured(3), "normal", { pathLength: 4 })).toBe(220 + 280 + 700 + 150);
    // Without a path length the capture is taken as a final-cell one.
    expect(eventDuration(captured(0), "normal")).toBe(1350);
    expect(eventDuration(captured(3), "fast", { pathLength: 4 })).toBeCloseTo(1350 * 0.4, 9);
    expect(eventDuration(captured(3), "reduced", { pathLength: 4 })).toBe(300);
  });

  it("a capture in the middle of a 7 only adds what outlasts the move", () => {
    const n = 7;
    const beat = hopTimeline(n).landings[1] as number;
    const total = hopTimeline(n).total;
    expect(eventDuration(captured(1), "normal", { pathLength: n })).toBeCloseTo(
      Math.max(0, beat + 850 - total),
      9,
    );
    // The first cell of a long move is early enough for the ejection to finish inside the move.
    expect(eventDuration(captured(0), "normal", { pathLength: 13 })).toBe(0);
  });

  it("a swap is 900 ms, 150 ms reduced", () => {
    expect(eventDuration(swapped, "normal")).toBe(900);
    expect(eventDuration(swapped, "fast")).toBeCloseTo(360, 9);
    expect(eventDuration(swapped, "reduced")).toBe(150);
  });

  it("entering home adds the settle, the fourth knight the party", () => {
    const home = (homeCount: number): GameEvent => ({
      t: "pawnEnteredHome",
      pawn: "bleu0",
      path: path(3),
      slot: 0,
      homeCount,
    });
    const total = hopTimeline(3).total;
    expect(eventDuration(home(2), "normal")).toBe(total + 150);
    expect(eventDuration(home(4), "normal")).toBe(total + 700);
    expect(eventDuration(home(4), "reduced")).toBe(180);
  });

  it("events without a knight on screen take no time", () => {
    expect(eventDuration({ t: "turn", seat: "bleu" }, "normal")).toBe(0);
    expect(eventDuration({ t: "pawnSentHome", pawn: "rouge1", to: stable(1) }, "normal")).toBe(0);
  });

  it("a whole play sums its events, the captures knowing the move they belong to", () => {
    const events = [moved(4), captured(3), { t: "pawnSentHome", pawn: "rouge1", to: stable(1) }];
    expect(eventsDuration(events as GameEvent[], "normal")).toBe(799 + 1350);
    expect(eventsDuration([], "normal")).toBe(0);
  });
});

describe("the cards", () => {
  it("a deal of 20 cards lasts 300 ms for the first and a 55 ms stagger for each next one", () => {
    expect(cardsDuration(20, "deal", "normal")).toBe(300 + 19 * 55);
    expect(cardsDuration(20, "deal", "normal")).toBe(1345);
    expect(cardsDuration(16, "deal", "normal")).toBe(300 + 15 * 55);
    expect(cardsDuration(1, "deal", "normal")).toBe(300);
    expect(cardsDuration(0, "deal", "normal")).toBe(0);
  });

  it("a dead hand lays 350 ms per card with a 60 ms stagger", () => {
    expect(cardsDuration(3, "dead", "normal")).toBe(350 + 2 * 60);
  });

  it("never counts more than the 20 cards of a deal", () => {
    expect(MAX_DEAL_CARDS).toBe(20);
    expect(cardsDuration(500, "deal", "normal")).toBe(cardsDuration(20, "deal", "normal"));
  });

  it("fast mode multiplies every card motion by 0.4", () => {
    expect(cardsDuration(20, "deal", "fast")).toBeCloseTo((300 + 19 * 55) * 0.4, 9);
    expect(cardsDuration(20, "deal", "fast")).toBeCloseTo(538, 9);
    expect(cardPlayDuration("normal")).toBe(300);
    expect(cardPlayDuration("fast")).toBeCloseTo(120, 9);
    expect(exchangeDuration("normal")).toBe(300);
    expect(exchangeDuration("fast")).toBeCloseTo(120, 9);
  });

  it("reduced motion makes every card motion one 150 ms fade or slide, all at once", () => {
    expect(cardsDuration(20, "deal", "reduced")).toBe(150);
    expect(cardsDuration(3, "dead", "reduced")).toBe(150);
    expect(cardPlayDuration("reduced")).toBe(150);
    expect(exchangeDuration("reduced")).toBe(150);
  });

  it("card events take their time on screen, the hands of a deal flying with the dealt event", () => {
    const hand = { t: "handDealt", seat: "bleu", size: 1, cards: ["1S"] } as GameEvent;
    expect(eventDuration({ t: "dealt", dealer: "bleu", dealIndex: 0, size: 5 }, "normal")).toBe(
      300 + 19 * 55,
    );
    expect(eventDuration({ t: "dealt", dealer: "bleu", dealIndex: 1, size: 4 }, "normal")).toBe(
      300 + 15 * 55,
    );
    expect(eventDuration(hand, "normal")).toBe(0);
    expect(eventDuration({ t: "cardPlayed", seat: "bleu", card: "5H" }, "normal")).toBe(300);
    expect(
      eventDuration({ t: "handDiscarded", seat: "bleu", cards: ["2S", "4S", "11S"] }, "normal"),
    ).toBe(470);
    const none = { bleu: null, jaune: null, rouge: null, vert: null };
    expect(eventDuration({ t: "cardsExchanged", received: none }, "fast")).toBeCloseTo(120, 9);
  });
});

describe("captureBeat", () => {
  it("is the landing of the attacker on the captured cell", () => {
    for (const mode of ["normal", "fast"] as const) {
      for (const n of [2, 4, 7, 13]) {
        for (let k = 0; k < n; k++) {
          expect(captureBeat(n, k, mode)).toBe(hopTimeline(n, mode).landings[k]);
        }
      }
    }
  });

  it("falls on the end of the single slide when motion is reduced", () => {
    expect(captureBeat(7, 3, "reduced")).toBe(180);
  });
});
