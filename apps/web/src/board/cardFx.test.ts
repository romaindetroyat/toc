import { LAST_CARD_SLOT, MAX_DEAL_CARDS, quarterTurnsFor } from "@toc/board";
import { COLORS } from "@toc/engine";
import { describe, expect, it } from "vitest";
import {
  dealFlights,
  exchangeFlights,
  type FlightSpec,
  layFlights,
  playFlight,
  posedSlots,
  seatEdge,
  seatSlot,
  tiltOf,
} from "./cardFx.ts";

// The specs of the card motions are pure data: how many cards fly, when each starts, how long it takes
// and where it ends. How they look is checked in e2e/animations.spec.ts.

const SEATS = [
  { seat: "jaune", count: 5 },
  { seat: "rouge", count: 5 },
  { seat: "vert", count: 5 },
  { seat: "bleu", count: 5 },
] as const;

const lastPose = (keyframes: Keyframe[]): string =>
  (keyframes[keyframes.length - 1] as Keyframe).transform as string;
const translation = (transform: string): [number, number] => {
  const found = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(transform);
  return [Number(found?.[1]), Number(found?.[2])];
};

describe("dealFlights", () => {
  it("flies 20 face-down cards, 250 ms each, 40 ms apart, round by round", () => {
    const flights = dealFlights(SEATS, 0, "normal");
    expect(flights).toHaveLength(20);
    expect(flights.every((f) => f.durationMs === 250 && f.card === null)).toBe(true);
    expect(flights.map((f) => f.delayMs)).toEqual(Array.from({ length: 20 }, (_, i) => i * 40));
    // The first four cards go to the four seats in dealing order.
    const firstRound = flights.slice(0, 4).map((f) => translation(lastPose(f.keyframes)));
    const edges = SEATS.map(({ seat }) => seatEdge(seat, 0));
    expect(firstRound).toEqual(edges);
  });

  it("deals 4 cards to each seat in the next deals: 16 cards", () => {
    const flights = dealFlights(
      SEATS.map(({ seat }) => ({ seat, count: 4 })),
      0,
      "normal",
    );
    expect(flights).toHaveLength(16);
  });

  it("never flies more than the cards of a deal", () => {
    const flights = dealFlights(
      SEATS.map(({ seat }) => ({ seat, count: 50 })),
      0,
      "normal",
    );
    expect(flights).toHaveLength(MAX_DEAL_CARDS);
  });

  it("fast mode multiplies the flight and the stagger by 0.4", () => {
    const flights = dealFlights(SEATS, 0, "fast");
    expect(flights[0]?.durationMs).toBeCloseTo(100, 9);
    expect(flights[1]?.delayMs).toBeCloseTo(16, 9);
  });

  it("reduced motion: one 150 ms fade per seat, all at once", () => {
    const flights = dealFlights(SEATS, 0, "reduced");
    expect(flights).toHaveLength(4);
    expect(flights.every((f) => f.durationMs === 150 && f.delayMs === 0)).toBe(true);
  });

  it("starts at the talon, turned with the board", () => {
    const [first] = dealFlights(SEATS, 1, "normal");
    const start = translation(((first as FlightSpec).keyframes[0] as Keyframe).transform as string);
    // k = 1: (1180, 1280) -> (2560 - 1280, 1180).
    expect(start).toEqual([1280, 1180]);
  });
});

describe("playFlight", () => {
  it("is a 300 ms flight from the edge of the seat to its felt slot, face up", () => {
    const flight = playFlight("bleu", "5H", 0, "normal");
    expect(flight.durationMs).toBe(300);
    expect(flight.card).toBe("5H");
    expect(translation((flight.keyframes[0] as Keyframe).transform as string)).toEqual(
      seatEdge("bleu", 0),
    );
    expect(translation(lastPose(flight.keyframes))).toEqual(LAST_CARD_SLOT.bleu);
    expect(lastPose(flight.keyframes)).toContain(`rotate(${tiltOf("5H")}deg)`);
  });

  it("the human's card leaves from below the board, whatever the colour he plays", () => {
    for (const colour of COLORS) {
      const [, y] = seatEdge(colour, quarterTurnsFor(colour));
      expect(y).toBeGreaterThan(2560);
    }
  });

  it("is 120 ms in fast mode and a 150 ms slide when motion is reduced", () => {
    expect(playFlight("rouge", "2S", 0, "fast").durationMs).toBeCloseTo(120, 9);
    const calm = playFlight("rouge", "2S", 0, "reduced");
    expect(calm.durationMs).toBe(150);
    // It slides in from a few steps away, not from the edge of the board.
    const [x, y] = translation((calm.keyframes[0] as Keyframe).transform as string);
    const [sx, sy] = seatSlot("rouge", 0);
    expect(Math.hypot(x - sx, y - sy)).toBeLessThan(100);
  });
});

describe("exchangeFlights", () => {
  it("crosses four face-down cards in 300 ms, each seat to its partner", () => {
    const flights = exchangeFlights(0, "normal");
    expect(flights).toHaveLength(4);
    expect(flights.every((f) => f.durationMs === 300 && f.delayMs === 0 && f.card === null)).toBe(
      true,
    );
    const ends = flights.map((f) => translation(lastPose(f.keyframes)));
    expect(ends).toEqual([
      seatSlot("rouge", 0),
      seatSlot("vert", 0),
      seatSlot("bleu", 0),
      seatSlot("jaune", 0),
    ]);
    expect(COLORS).toEqual(["bleu", "jaune", "rouge", "vert"]);
  });

  it("the two cards of a pair pass on either side of each other", () => {
    const [bleu, , rouge] = exchangeFlights(0, "normal");
    const middleOf = (keyframes: Keyframe[]) =>
      translation((keyframes.find((kf) => kf.offset === 0.5) as Keyframe).transform as string);
    const [bx] = middleOf((bleu as { keyframes: Keyframe[] }).keyframes);
    const [rx] = middleOf((rouge as { keyframes: Keyframe[] }).keyframes);
    expect(bx).not.toBe(rx);
    expect((bx - 1280) * (rx - 1280)).toBeLessThan(0);
  });

  it("is 120 ms in fast mode and 150 ms when motion is reduced", () => {
    expect(exchangeFlights(0, "fast")[0]?.durationMs).toBeCloseTo(120, 9);
    expect(exchangeFlights(0, "reduced").every((f) => f.durationMs === 150)).toBe(true);
  });
});

describe("layFlights", () => {
  it("lays a dead hand 350 ms per card, 60 ms apart, face up where the felt will show it", () => {
    const cards = ["2S", "4S", "11S"] as const;
    const flights = layFlights("bleu", cards, 0, "normal");
    expect(flights.map((f) => f.delayMs)).toEqual([0, 60, 120]);
    expect(flights.every((f) => f.durationMs === 350)).toBe(true);
    expect(flights.map((f) => f.card)).toEqual(cards);
    const slots = posedSlots("bleu", 3, 0);
    expect(flights.map((f) => translation(lastPose(f.keyframes)))).toEqual(slots);
  });

  it("fans the cards of a seat at the top in a row and of a seat at the side in a column", () => {
    const row = posedSlots("rouge", 3, 0);
    expect(new Set(row.map(([, y]) => y)).size).toBe(1);
    const column = posedSlots("jaune", 3, 0);
    expect(new Set(column.map(([x]) => x)).size).toBe(1);
    // Centred on the slot of the seat.
    const [cx, cy] = seatSlot("jaune", 0);
    expect(column[1]).toEqual([cx, cy]);
  });

  it("is a 150 ms fade for every card at once when motion is reduced, 0.4 times when fast", () => {
    const calm = layFlights("bleu", ["2S", "4S"], 0, "reduced");
    expect(calm.every((f) => f.durationMs === 150 && f.delayMs === 0)).toBe(true);
    const quick = layFlights("bleu", ["2S", "4S"], 0, "fast");
    expect(quick[1]?.delayMs).toBeCloseTo(24, 9);
    expect(quick[0]?.durationMs).toBeCloseTo(140, 9);
  });
});
