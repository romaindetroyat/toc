import { describe, expect, it } from "vitest";
import {
  COLORS,
  ENTRY,
  EXIT,
  forwardCells,
  nextColor,
  PARTNER,
  RING,
  ringIndex,
  teamOf,
} from "./topology.ts";

describe("topology constants", () => {
  it("puts the exits on the diamonds 0, 18, 36 and 54", () => {
    expect(EXIT).toEqual({ bleu: 0, jaune: 18, rouge: 36, vert: 54 });
  });

  it("puts each entry square two cells before its exit, modulo 72", () => {
    for (const color of COLORS) {
      expect(ENTRY[color]).toBe((EXIT[color] - 2 + RING) % RING);
    }
    expect(ENTRY).toEqual({ bleu: 70, jaune: 16, rouge: 34, vert: 52 });
  });

  it("makes partners symmetric, face to face, and on the same team", () => {
    for (const color of COLORS) {
      expect(PARTNER[PARTNER[color]]).toBe(color);
      expect(PARTNER[color]).not.toBe(color);
      expect(teamOf(PARTNER[color])).toBe(teamOf(color));
      // face to face: half a ring apart
      expect(Math.abs(EXIT[PARTNER[color]] - EXIT[color])).toBe(RING / 2);
    }
  });

  it("cycles clockwise bleu, jaune, rouge, vert, bleu", () => {
    expect(nextColor("bleu")).toBe("jaune");
    expect(nextColor("jaune")).toBe("rouge");
    expect(nextColor("rouge")).toBe("vert");
    expect(nextColor("vert")).toBe("bleu");
  });
});

describe("ringIndex", () => {
  it("starts on the colour's exit and wraps forward", () => {
    expect(ringIndex("bleu", 0)).toBe(0);
    expect(ringIndex("jaune", 0)).toBe(18);
    expect(ringIndex("vert", 20)).toBe(2);
  });

  it("accepts negative progress (backward 4 from the exit)", () => {
    expect(ringIndex("bleu", -4)).toBe(68);
    expect(ringIndex("jaune", -20)).toBe(70);
  });

  it("accepts progress beyond 71 (a pawn that keeps lapping)", () => {
    expect(ringIndex("bleu", 72)).toBe(0);
    expect(ringIndex("bleu", 75)).toBe(3);
    expect(ringIndex("rouge", 144 + 5)).toBe(41);
  });
});

describe("forwardCells", () => {
  it("lists the ring places crossed, in order", () => {
    expect(forwardCells("jaune", 0, 3)).toEqual([
      { z: "ring", cell: 19 },
      { z: "ring", cell: 20 },
      { z: "ring", cell: 21 },
    ]);
  });

  it("wraps across cell 71 to cell 0", () => {
    expect(forwardCells("bleu", 70, 3).map((p) => (p.z === "ring" ? p.cell : -1))).toEqual([
      71, 0, 1,
    ]);
  });

  it("returns no place for a zero-step move", () => {
    expect(forwardCells("vert", 5, 0)).toEqual([]);
  });
});
