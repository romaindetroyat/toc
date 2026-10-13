import { COLORS, nextColor, PARTNER } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { LAST_CARD_SLOT, LAYOUT, type Point } from "./layout.ts";
import { quarterTurnsFor, rotatePoint, screenSideOf } from "./rotate.ts";

const close = (p: Point, q: Point) => {
  expect(p[0]).toBeCloseTo(q[0], 6);
  expect(p[1]).toBeCloseTo(q[1], 6);
};

describe("quarterTurnsFor", () => {
  it("follows the UI-SPEC table: Bleu 0, Vert +90, Rouge 180, Jaune -90 (clockwise quarter turns)", () => {
    expect(quarterTurnsFor("bleu")).toBe(0);
    expect(quarterTurnsFor("vert")).toBe(1);
    expect(quarterTurnsFor("rouge")).toBe(2);
    expect(quarterTurnsFor("jaune")).toBe(3);
  });
});

describe("rotatePoint", () => {
  it("applies (x, y) -> (2560 - y, x) per clockwise quarter turn", () => {
    close(rotatePoint([100, 400], 1), [2160, 100]);
    close(rotatePoint([100, 400], 2), [2460, 2160]);
    close(rotatePoint([100, 400], 3), [400, 2460]);
    close(rotatePoint([100, 400], 0), [100, 400]);
  });

  it("four quarter turns give the identity, and k wraps modulo 4", () => {
    for (const p of [...LAYOUT.ring, [12.5, 2500]] as Point[]) {
      let q = p;
      for (let i = 0; i < 4; i++) q = rotatePoint(q, 1);
      close(q, p);
      close(rotatePoint(p, 5), rotatePoint(p, 1));
      close(rotatePoint(p, -1), rotatePoint(p, 3));
    }
  });
});

describe("rotation toward the human", () => {
  it("brings the human's last-card slot to the bottom and the partner's to the top", () => {
    for (const human of COLORS) {
      const k = quarterTurnsFor(human);
      close(rotatePoint(LAST_CARD_SLOT[human], k), [1280, 1570]);
      close(rotatePoint(LAST_CARD_SLOT[PARTNER[human]], k), [1280, 990]);
    }
  });

  it("puts the human's four stables in the lower half of the screen", () => {
    for (const human of COLORS) {
      const k = quarterTurnsFor(human);
      const cells = LAYOUT.pieces[human].stable.map((p) => rotatePoint(p, k));
      const cy = cells.reduce((sum, p) => sum + p[1], 0) / cells.length;
      expect(cy).toBeGreaterThan(1280);
    }
  });
});

describe("screenSideOf", () => {
  it("is bottom for the human, top for the partner, left for the next seat, right for the previous", () => {
    for (const human of COLORS) {
      expect(screenSideOf(human, human)).toBe("bottom");
      expect(screenSideOf(PARTNER[human], human)).toBe("top");
      expect(screenSideOf(nextColor(human), human)).toBe("left");
      expect(screenSideOf(nextColor(PARTNER[human]), human)).toBe("right");
    }
  });

  it("matches the UI-SPEC examples", () => {
    expect(screenSideOf("jaune", "bleu")).toBe("left");
    expect(screenSideOf("rouge", "bleu")).toBe("top");
    expect(screenSideOf("vert", "bleu")).toBe("right");
    expect(screenSideOf("bleu", "vert")).toBe("left");
    expect(screenSideOf("jaune", "vert")).toBe("top");
    expect(screenSideOf("rouge", "vert")).toBe("right");
  });

  it("agrees with where the seat's last-card slot lands after the rotation", () => {
    const side = (p: Point) => {
      const dx = p[0] - 1280;
      const dy = p[1] - 1280;
      if (Math.abs(dy) > Math.abs(dx)) return dy > 0 ? "bottom" : "top";
      return dx > 0 ? "right" : "left";
    };
    for (const human of COLORS) {
      for (const seat of COLORS) {
        const landed = rotatePoint(LAST_CARD_SLOT[seat], quarterTurnsFor(human));
        expect(screenSideOf(seat, human)).toBe(side(landed));
      }
    }
  });
});
