import { COLORS } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { type MarkShape, markPath, SEAT_MARKS } from "./marks.ts";

const SHAPES: MarkShape[] = ["round", "triangle", "square", "star"];

/** The end points of every command of a path (M, L and the end of each A), and whether it closes. */
function pointsOf(d: string): { points: [number, number][]; closed: boolean } {
  const tokens = d.match(/[MLAZ]|-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? [];
  const points: [number, number][] = [];
  let i = 0;
  let closed = false;
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === "Z") {
      closed = true;
      continue;
    }
    if (command === "M" || command === "L") {
      points.push([Number(tokens[i]), Number(tokens[i + 1])]);
      i += 2;
    } else if (command === "A") {
      points.push([Number(tokens[i + 5]), Number(tokens[i + 6])]);
      i += 7;
    } else {
      throw new Error(`unexpected token ${command} in ${d}`);
    }
  }
  return { points, closed };
}

describe("the seat marks (D-11, D-14)", () => {
  it("gives each seat the glyph of seats.ts: round, triangle, square, star, never a diamond", () => {
    expect(SEAT_MARKS).toEqual({
      bleu: "round",
      jaune: "triangle",
      rouge: "square",
      vert: "star",
    });
    expect(new Set(COLORS.map((c) => SEAT_MARKS[c])).size).toBe(4);
    expect(Object.values(SEAT_MARKS)).not.toContain("diamond");
  });

  it("draws every shape as one closed path inside its 2r box", () => {
    for (const shape of SHAPES) {
      for (const [cx, cy, r] of [
        [55, 152, 20],
        [1024.37, 1238.9, 32.1],
        [0, 0, 1],
      ] as const) {
        const d = markPath(shape, cx, cy, r);
        expect(d.startsWith("M"), `${shape} ${d}`).toBe(true);
        const { points, closed } = pointsOf(d);
        expect(closed, shape).toBe(true);
        expect(d.match(/M/g), shape).toHaveLength(1);
        for (const [x, y] of points) {
          expect(Math.abs(x - cx), `${shape} x`).toBeLessThanOrEqual(r + 1e-3);
          expect(Math.abs(y - cy), `${shape} y`).toBeLessThanOrEqual(r + 1e-3);
        }
      }
    }
  });

  it("is symmetric about the vertical line through its centre, so the mirrored knight shows it the same", () => {
    for (const shape of SHAPES) {
      for (const [cx, cy, r] of [
        [55, 152, 20],
        [0, 0, 10],
        [-3, 7, 4],
      ] as const) {
        const { points } = pointsOf(markPath(shape, cx, cy, r));
        const key = ([x, y]: [number, number]) => `${x.toFixed(6)} ${y.toFixed(6)}`;
        const mirrored = points.map(([x, y]) => [2 * cx - x + 0, y] as [number, number]);
        const found = (p: [number, number]) =>
          points.some(([x, y]) => Math.abs(x - p[0]) < 1e-9 && Math.abs(y - p[1]) < 1e-9);
        for (const p of mirrored) expect(found(p), `${shape} ${key(p)}`).toBe(true);
      }
    }
  });

  it("has a five-point star with one point straight up, a triangle point up, a four-corner square", () => {
    const star = pointsOf(markPath("star", 0, 0, 10)).points;
    expect(star).toHaveLength(10);
    const top = star.reduce((a, b) => (b[1] < a[1] ? b : a));
    expect(top[0]).toBeCloseTo(0, 9);
    // Five outer points (the farthest from the centre of the five) and five inner ones alternate.
    const dist = star.map(([x, y]) => Math.hypot(x, y - (10 - 10 * Math.cos(Math.PI / 5)) / 2));
    const outer = dist.filter((d) => d > 7);
    expect(outer).toHaveLength(5);
    for (let i = 0; i < 10; i++) expect((dist[i] as number) > 7).toBe(i % 2 === 0);

    const triangle = pointsOf(markPath("triangle", 0, 0, 10)).points;
    expect(triangle).toHaveLength(3);
    const apex = triangle.reduce((a, b) => (b[1] < a[1] ? b : a));
    expect(apex[0]).toBeCloseTo(0, 9);
    expect(triangle.filter(([, y]) => y > apex[1] + 1)).toHaveLength(2);

    const square = pointsOf(markPath("square", 0, 0, 10)).points;
    expect(square).toHaveLength(4);
    // Axis-aligned (a turned square would be the exit's losange).
    expect(new Set(square.map(([x]) => x)).size).toBe(2);
    expect(new Set(square.map(([, y]) => y)).size).toBe(2);
  });
});
