import { COLORS, type Color, ENTRY, EXIT } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { type ArtRole, type ArtShape, artSvg, boardArt } from "./art.ts";
import type { Point } from "./layout.ts";
import { PALETTE, SCENE, sceneXY } from "./scene.ts";

const KS = [0, 1, 2, 3];
const ROLES: ArtRole[] = [
  "board",
  "rim",
  "band",
  "band-edge",
  "felt",
  "link",
  "rail",
  "arrow",
  "stable",
  "hole",
  "lane",
  "cell",
  "exit",
  "entry",
  "label",
];

/** Centre of a shape in scene units (rects are centred on their translate when transformed). */
function centre(shape: ArtShape): Point {
  const t = shape.transform?.translate ?? [0, 0];
  switch (shape.kind) {
    case "circle":
      return [t[0] + shape.cx, t[1] + shape.cy];
    case "rect":
      return [t[0] + shape.x + shape.w / 2, t[1] + shape.y + shape.h / 2];
    case "text":
      return [t[0] + shape.x, t[1] + shape.y];
    default:
      throw new Error(`no centre for ${shape.kind}`);
  }
}

const objects = (shapes: ArtShape[], role: ArtRole) =>
  shapes.filter((x) => x.role === role && !x.detail);

const colorOfExit = (cell: number): Color | undefined =>
  COLORS.find((c) => EXIT[c] === ((cell % 72) + 72) % 72);

describe("boardArt", () => {
  it("draws one shape per ring cell: 4 losanges, 4 carrés and 64 numbered discs", () => {
    for (const k of KS) {
      const art = boardArt(k);
      const cells = art.filter(
        (x) => (x.role === "cell" || x.role === "exit" || x.role === "entry") && !x.detail,
      );
      expect(cells).toHaveLength(72);
      expect(new Set(cells.map((x) => x.cell)).size).toBe(72);
      for (const shape of cells) {
        const cell = shape.cell as number;
        const at = sceneXY({ z: "ring", cell }, k);
        const c = centre(shape);
        expect(c[0]).toBeCloseTo(at[0], 6);
        expect(c[1]).toBeCloseTo(at[1], 6);
      }
      expect(objects(art, "cell")).toHaveLength(64);
      expect(objects(art, "exit")).toHaveLength(4);
      expect(objects(art, "entry")).toHaveLength(4);
    }
  });

  it("numbers the ordinary cells 1 to 17 after each losange, without 16", () => {
    const art = boardArt(0);
    const labels = objects(art, "label");
    expect(labels).toHaveLength(72);
    for (const shape of objects(art, "cell")) {
      const cell = shape.cell as number;
      const label = labels.find((x) => x.cell === cell);
      expect(label?.kind).toBe("text");
      const text = label?.kind === "text" ? label.text : "";
      expect(text).toBe(String(cell % 18));
      expect(Number(text)).toBeGreaterThanOrEqual(1);
      expect(Number(text)).toBeLessThanOrEqual(17);
      expect(text).not.toBe("16");
    }
  });

  it("puts a losange « 18 » in its colour on each exit and a carré « 16 » on each entry", () => {
    for (const k of KS) {
      const art = boardArt(k);
      const labels = objects(art, "label");
      const textOf = (cell: number) => {
        const l = labels.find((x) => x.cell === cell);
        return l?.kind === "text" ? l.text : undefined;
      };
      for (const c of COLORS) {
        const exit = objects(art, "exit").find((x) => x.cell === EXIT[c]);
        expect(exit?.color).toBe(c);
        expect(exit?.fill).toBe(PALETTE.hex[c]);
        expect(textOf(EXIT[c])).toBe("18");
        const entry = objects(art, "entry").find((x) => x.cell === ENTRY[c]);
        expect(colorOfExit(ENTRY[c] + 2)).toBe(c);
        expect(entry?.color).toBe(c);
        expect(entry?.fill).toBe(PALETTE.hex[c]);
        expect(textOf(ENTRY[c])).toBe("16");
      }
    }
  });

  it("holds the homes, stables, links, rails, arrows and the felt, and no other object", () => {
    for (const k of KS) {
      const art = boardArt(k);
      expect(objects(art, "lane")).toHaveLength(16);
      expect(objects(art, "stable")).toHaveLength(4);
      expect(objects(art, "hole")).toHaveLength(16);
      expect(objects(art, "link")).toHaveLength(4);
      expect(objects(art, "rail")).toHaveLength(4);
      expect(objects(art, "arrow")).toHaveLength(4);
      expect(objects(art, "felt")).toHaveLength(1);
      expect(objects(art, "board")).toHaveLength(1);
      expect(objects(art, "rim")).toHaveLength(1);
      expect(objects(art, "band")).toHaveLength(1);
      expect(objects(art, "band-edge")).toHaveLength(1);
      // No rule-reminder frame or any shape outside the C+ roles.
      for (const shape of art) expect(ROLES).toContain(shape.role);
      // Each colour has four lanes, four holes and one stable, in its own tint and colour.
      for (const c of COLORS) {
        const lanes = objects(art, "lane").filter((x) => x.color === c);
        expect(lanes).toHaveLength(4);
        for (const l of lanes) {
          expect(l.fill).toBe(PALETTE.tint[c]);
          expect(l.stroke).toBe(PALETTE.hex[c]);
        }
        expect(objects(art, "hole").filter((x) => x.color === c)).toHaveLength(4);
        expect(objects(art, "stable").filter((x) => x.color === c)).toHaveLength(1);
      }
    }
  });

  it("paints the board first and the cell labels last", () => {
    const art = boardArt(0);
    expect(art[0]?.role).toBe("board");
    expect(art[art.length - 1]?.role).toBe("label");
    const first = (role: ArtRole) => art.findIndex((x) => x.role === role);
    expect(first("band")).toBeLessThan(first("felt"));
    expect(first("felt")).toBeLessThan(first("stable"));
    expect(first("stable")).toBeLessThan(first("hole"));
    expect(first("lane")).toBeLessThan(first("cell"));
  });
});

describe("artSvg", () => {
  it("is a complete SVG document over the scene's viewBox", () => {
    const svg = artSvg(boardArt(1), { width: 600, height: 900, fontFamily: "Nunito" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="0 0 2000 3000"');
    expect(svg).toContain('width="600"');
    expect(svg).toContain('height="900"');
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).not.toContain("NaN");
    expect(SCENE.width).toBe(2000);
  });

  it("escapes text content and attribute values", () => {
    const svg = artSvg(
      [{ kind: "text", role: "label", x: 1, y: 2, text: "<b>&\"'", size: 10, weight: 800 }],
      { width: 10, height: 10, fontFamily: 'A"B' },
    );
    expect(svg).toContain("&lt;b&gt;&amp;&quot;&#39;");
    expect(svg).not.toContain("<b>");
    expect(svg).toContain('font-family="A&quot;B"');
  });

  it("refuses a number that is not finite", () => {
    expect(() =>
      artSvg([{ kind: "circle", role: "hole", cx: Number.NaN, cy: 0, r: 1 }], {
        width: 10,
        height: 10,
        fontFamily: "x",
      }),
    ).toThrow();
  });
});
