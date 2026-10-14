import { describe, expect, it } from "vitest";
import { artSvg, boardArt } from "./art.ts";
import { LAYOUTS } from "./scene.ts";

const KS = [0, 1, 2, 3];

describe("boardArt", () => {
  for (const layout of LAYOUTS) {
    it(`draws exactly one shape per ring cell on the ${layout} plateau`, () => {
      for (const k of KS) {
        const cells = boardArt(k, layout).shapes.filter(
          (x) => (x.role === "cell" || x.role === "exit" || x.role === "entry") && !x.detail,
        );
        expect(cells).toHaveLength(72);
        expect(new Set(cells.map((x) => x.cell)).size).toBe(72);
      }
    });
  }
});

describe("artSvg", () => {
  it("is a complete SVG document over the art's scene", () => {
    const svg = artSvg(boardArt(0, "landscape"), { width: 800, height: 400, fontFamily: "Nunito" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="0 0 3200 1600"');
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).not.toContain("NaN");
  });
});
