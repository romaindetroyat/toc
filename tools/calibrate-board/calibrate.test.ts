import path from "node:path";
import { describe, expect, it } from "vitest";
import layoutJson from "../../packages/board/layout.json" with { type: "json" };
import { calibrate } from "./calibrate.mjs";

type Pt = [number, number];
type Pieces = { stable: Pt[]; home: Pt[]; diamond: Pt; square: Pt };
type Calibration = {
  ring: Pt[];
  pieces: Record<string, Pieces>;
  checks: { exitsAndEntriesOk: boolean; pitchMin: number; pitchMax: number };
};

const ROOT = path.resolve(import.meta.dirname, "../..");
const SIZE = layoutJson.size;
const COLORS = ["bleu", "jaune", "rouge", "vert"] as const;
/** Quarter origins on the assembled board (jaune top-left, rouge top-right, bleu bottom-left, vert bottom-right). */
const ORIGIN: Record<(typeof COLORS)[number], Pt> = {
  jaune: [0, 0],
  rouge: [1280, 0],
  bleu: [0, 1280],
  vert: [1280, 1280],
};
const QUARTER = 1280;

const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0));
const denorm = (p: readonly number[]): Pt => [(p[0] ?? 0) * SIZE, (p[1] ?? 0) * SIZE];

function at<T>(list: readonly T[], i: number): T {
  const v = list[i];
  if (v === undefined) throw new Error(`missing item ${i}`);
  return v;
}

// The calibration reads the four 1280 px quarters and flood-fills them: a few seconds.
const result = (await calibrate(path.join(ROOT, "assets/plateau"))) as Calibration;

describe("calibrate(assets/plateau)", () => {
  it("finds the 72 ring cells, the diamonds and entry squares in place, with a regular pitch", () => {
    expect(result.ring).toHaveLength(72);
    expect(result.checks.exitsAndEntriesOk).toBe(true);
    expect(result.checks.pitchMin).toBeGreaterThanOrEqual(122);
    expect(result.checks.pitchMax).toBeLessThanOrEqual(145);
  });

  it("reproduces the committed packages/board/layout.json within 1.5 board units", () => {
    expect(layoutJson.ring).toHaveLength(72);
    result.ring.forEach((p, i) => {
      expect(dist(p, denorm(at(layoutJson.ring, i))), `ring[${i}]`).toBeLessThanOrEqual(1.5);
    });
    for (const color of COLORS) {
      const detected = result.pieces[color] as Pieces;
      const committed = layoutJson.pieces[color];
      const pairs: [string, Pt, Pt][] = [
        ["diamond", detected.diamond, denorm(committed.diamond)],
        ["square", detected.square, denorm(committed.square)],
      ];
      detected.stable.forEach((p, j) => {
        pairs.push([`stable[${j}]`, p, denorm(at(committed.stable, j))]);
      });
      detected.home.forEach((p, j) => {
        pairs.push([`home[${j}]`, p, denorm(at(committed.home, j))]);
      });
      expect(detected.stable).toHaveLength(4);
      expect(detected.home).toHaveLength(4);
      for (const [name, a, b] of pairs) {
        expect(dist(a, b), `${color} ${name}`).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it("matches the measured values of RESEARCH Appendix B within 2 units", () => {
    const ring: [number, Pt][] = [
      [0, [121, 1996]],
      [18, [557, 123]],
      [36, [2439, 560]],
      [54, [2004, 2432]],
    ];
    for (const [i, expected] of ring) {
      expect(dist(at(result.ring, i), expected), `ring[${i}]`).toBeLessThanOrEqual(2);
    }
    const stable0: Record<string, Pt> = {
      bleu: [94, 1826],
      jaune: [727, 95],
      rouge: [2466, 730],
      vert: [1833, 2461],
    };
    for (const color of COLORS) {
      const p = at((result.pieces[color] as Pieces).stable, 0);
      expect(dist(p, stable0[color] as Pt), `${color} stable[0]`).toBeLessThanOrEqual(2);
    }
  });

  it("keeps each quarter equal to the previous one turned 90 degrees clockwise (drift alarm, 12 px)", () => {
    // Quarter q (bleu, jaune, rouge, vert = turn order, clockwise on the board) holds ring cells
    // 61+18q .. 78+18q. Turning a quarter clockwise about its own centre must land on the next one.
    const half = QUARTER / 2;
    const local = (color: (typeof COLORS)[number], p: readonly number[]): Pt => [
      (p[0] ?? 0) - ORIGIN[color][0],
      (p[1] ?? 0) - ORIGIN[color][1],
    ];
    const turn = ([x, y]: Pt): Pt => [half - (y - half), half + (x - half)];

    let worst = 0;
    COLORS.forEach((color, q) => {
      const next = at(COLORS, (q + 1) % 4);
      for (let k = 0; k < 18; k++) {
        const from = local(color, at(result.ring, (61 + 18 * q + k) % 72));
        const to = local(next, at(result.ring, (61 + 18 * ((q + 1) % 4) + k) % 72));
        worst = Math.max(worst, dist(turn(from), to));
      }
      const a = result.pieces[color] as Pieces;
      const b = result.pieces[next] as Pieces;
      const pairs: [Pt, Pt][] = [
        [a.diamond, b.diamond],
        [a.square, b.square],
        ...a.stable.map((p, j): [Pt, Pt] => [p, at(b.stable, j)]),
        ...a.home.map((p, j): [Pt, Pt] => [p, at(b.home, j)]),
      ];
      for (const [p, r] of pairs) {
        worst = Math.max(worst, dist(turn(local(color, p)), local(next, r)));
      }
    });
    expect(worst).toBeLessThanOrEqual(12);
  });
});
