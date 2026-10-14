import { COLORS, type Color, ENTRY, EXIT } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { type Art, type ArtRole, type ArtShape, artSvg, boardArt, feltPath } from "./art.ts";
import { MOCKUP, PALETTE, type Point, riderBox, SCENE, sceneXY } from "./scene.ts";

const KS = [0, 1, 2, 3];
const ROLES: ArtRole[] = [
  "rim",
  "board",
  "grain",
  "track",
  "felt",
  "felt-texture",
  "felt-rim",
  "stitch",
  "rider",
  "lane",
  "hole",
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

const objects = (art: Art, role: ArtRole) => art.shapes.filter((x) => x.role === role && !x.detail);
const textOf = (shape: ArtShape | undefined) => (shape?.kind === "text" ? shape.text : undefined);
const colorOfExit = (cell: number): Color | undefined =>
  COLORS.find((c) => EXIT[c] === ((cell % 72) + 72) % 72);
const tiltOf = (cell: number) => ((cell * 37) % 13) - 6;
// Painting order of the objects (a detail, like the outline's fine line drawn over its grain,
// follows its object where the mock-up draws it).
const first = (art: Art, role: ArtRole) =>
  art.shapes.findIndex((x) => x.role === role && !x.detail);
const last = (art: Art, role: ArtRole) =>
  art.shapes.length - 1 - [...art.shapes].reverse().findIndex((x) => x.role === role && !x.detail);

describe("boardArt", () => {
  it("draws one shape per ring cell: 4 losanges, 4 carrés, 64 discs", () => {
    for (const k of KS) {
      const art = boardArt(k);
      expect(art.width).toBe(SCENE.width);
      expect(art.height).toBe(SCENE.height);
      const cells = art.shapes.filter(
        (x) => (x.role === "cell" || x.role === "exit" || x.role === "entry") && !x.detail,
      );
      expect(cells).toHaveLength(72);
      expect(new Set(cells.map((x) => x.cell)).size).toBe(72);
      for (const shape of cells) {
        const at = sceneXY({ z: "ring", cell: shape.cell as number }, k);
        const c = centre(shape);
        expect(c[0]).toBeCloseTo(at[0], 6);
        expect(c[1]).toBeCloseTo(at[1], 6);
      }
      expect(objects(art, "cell")).toHaveLength(64);
      expect(objects(art, "exit")).toHaveLength(4);
      expect(objects(art, "entry")).toHaveLength(4);
    }
  });

  it("numbers the cells by hand: 1 to 17 without 16, « 18 » and « 16 »", () => {
    for (const k of KS) {
      const art = boardArt(k);
      const labels = objects(art, "label");
      expect(labels).toHaveLength(72);
      const labelOf = (cell: number) => labels.find((x) => x.cell === cell);
      for (const label of labels) {
        expect(label.kind).toBe("text");
        if (label.kind === "text") {
          expect(label.font).toBe("hand");
          expect(label.weight).toBe(700);
        }
      }
      for (const shape of objects(art, "cell")) {
        const cell = shape.cell as number;
        const label = labelOf(cell);
        const text = textOf(label);
        expect(text).toBe(String(cell % 18));
        expect(Number(text)).toBeGreaterThanOrEqual(1);
        expect(Number(text)).toBeLessThanOrEqual(17);
        expect(text).not.toBe("16");
        expect(shape.fill).toBe(PALETTE.cream);
        expect(shape.stroke).toBe(PALETTE.ink);
        expect(label?.fill).toBe(PALETTE.ink);
        expect(label?.transform?.rotate).toBe(tiltOf(cell));
      }
      for (const c of COLORS) {
        const exit = objects(art, "exit").find((x) => x.cell === EXIT[c]);
        expect(exit?.color).toBe(c);
        expect(exit?.fill).toBe(PALETTE.hex[c]);
        expect(exit?.stroke).toBe(PALETTE.ink);
        expect(exit?.transform?.rotate).toBe(45);
        expect(textOf(labelOf(EXIT[c]))).toBe("18");
        expect(labelOf(EXIT[c])?.fill).toBe(PALETTE.on[c]);
        // The losange's number stands upright.
        expect(labelOf(EXIT[c])?.transform?.rotate ?? 0).toBe(0);
        const entry = objects(art, "entry").find((x) => x.cell === ENTRY[c]);
        expect(colorOfExit(ENTRY[c] + 2)).toBe(c);
        expect(entry?.color).toBe(c);
        expect(entry?.fill).toBe(PALETTE.hex[c]);
        expect(textOf(labelOf(ENTRY[c]))).toBe("16");
        expect(labelOf(ENTRY[c])?.transform?.rotate).toBe(tiltOf(ENTRY[c]));
      }
    }
  });

  it("holds the galet's dots, riders, board and felt, and no other role", () => {
    for (const k of KS) {
      const art = boardArt(k);
      for (const shape of art.shapes) expect(ROLES).toContain(shape.role);
      expect(objects(art, "lane")).toHaveLength(16);
      expect(objects(art, "hole")).toHaveLength(16);
      expect(objects(art, "rider")).toHaveLength(4);
      for (const role of ["rim", "board", "grain", "track", "felt", "felt-texture"] as const) {
        expect(objects(art, role)).toHaveLength(1);
      }
      expect(objects(art, "felt-rim")).toHaveLength(1);
      expect(objects(art, "stitch")).toHaveLength(1);
      for (const c of COLORS) {
        const lanes = objects(art, "lane").filter((x) => x.color === c);
        expect(lanes).toHaveLength(4);
        for (const l of lanes) {
          expect(l.fill).toBe(PALETTE.cream);
          expect(l.stroke).toBe(PALETTE.hex[c]);
        }
        const holes = objects(art, "hole").filter((x) => x.color === c);
        expect(holes).toHaveLength(4);
        for (const h of holes) {
          const def = art.defs.find((d) => d.id === h.fillDef);
          expect(def?.kind).toBe("radial");
          if (def?.kind === "radial") {
            expect(def.stops.map((s) => s.color)).toEqual([PALETTE.light[c], PALETTE.hex[c]]);
            expect(def.stops.map((s) => s.offset)).toEqual([0, 0.62]);
          }
          expect(h.stroke).toBe(PALETTE.ink);
        }
        const riders = objects(art, "rider").filter((x) => x.color === c);
        expect(riders).toHaveLength(1);
        const rider = riders[0];
        expect(rider?.kind).toBe("image");
        expect(rider?.opacity).toBe(0.85);
        if (rider?.kind === "image") {
          expect({ x: rider.x, y: rider.y, w: rider.w, h: rider.h }).toEqual(riderBox(c, k));
        }
      }
      // The dots stand on the places of the knights.
      for (const shape of objects(art, "lane")) {
        if (shape.kind !== "circle" || !shape.color) throw new Error("a lane is a circle");
        const near = COLORS.flatMap(() =>
          [0, 1, 2, 3].map((slot) =>
            sceneXY({ z: "home", color: shape.color as Color, slot: slot as 0 }, k),
          ),
        ).some((p) => Math.hypot(p[0] - shape.cx, p[1] - shape.cy) < 1e-6);
        expect(near).toBe(true);
      }
    }
  });

  it("grains the outline and textures the felt, both clipped to their own outline", () => {
    const art = boardArt(0);
    const scene = SCENE;
    const def = (id: string | undefined) => art.defs.find((d) => d.id === id);
    const grain = objects(art, "grain")[0];
    expect(def(grain?.filter)?.kind).toBe("noise");
    const grainDef = def(grain?.filter);
    if (grainDef?.kind === "noise") {
      const [fx, fy] = MOCKUP.grain;
      expect(grainDef.frequency[0]).toBeCloseTo(fx / 2, 12);
      expect(grainDef.frequency[1]).toBeCloseTo(fy / 2, 12);
      expect(grainDef.octaves).toBe(3);
      expect(grainDef.seed).toBe(11);
    }
    const boardClip = def(grain?.clip);
    const board = objects(art, "board")[0];
    expect(boardClip?.kind).toBe("clip");
    expect(board?.kind).toBe("outline");
    expect(board?.fill).toBe(PALETTE.board);

    const felt = objects(art, "felt")[0];
    expect(felt?.kind).toBe("path");
    expect(def(felt?.fillDef)?.kind).toBe("radial");
    const texture = objects(art, "felt-texture")[0];
    const textureDef = def(texture?.filter);
    expect(textureDef?.kind).toBe("noise");
    if (textureDef?.kind === "noise") {
      expect(textureDef.frequency).toEqual([0.45, 0.45]);
      expect(textureDef.octaves).toBe(2);
      expect(textureDef.seed).toBe(3);
    }
    expect(texture?.opacity).toBe(0.5);
    const feltClip = def(texture?.clip);
    expect(feltClip?.kind).toBe("clip");
    if (feltClip?.kind === "clip" && felt?.kind === "path") {
      expect(feltClip.d).toBe(felt.d);
      expect(felt.d).toBe(feltPath(scene.feltShape));
    }
    expect(objects(art, "felt-rim")[0]?.stroke).toBe(PALETTE.feltRim);
    const stitch = objects(art, "stitch")[0];
    expect(stitch?.dash).toHaveLength(2);
    expect(stitch?.dash?.[0]).toBeCloseTo(0.16 * scene.step, 9);
    expect(stitch?.dash?.[1]).toBeCloseTo(0.12 * scene.step, 9);
    if (stitch?.kind === "path") expect(stitch.d).toBe(feltPath(scene.stitch));
  });

  it("refers only to declared defs, with « toc- » ids", () => {
    const art = boardArt(2);
    const ids = new Set(art.defs.map((d) => d.id));
    expect(ids.size).toBe(art.defs.length);
    for (const id of ids) expect(id).toMatch(/^toc-[a-z0-9-]+$/);
    for (const shape of art.shapes) {
      for (const ref of [shape.fillDef, shape.filter, shape.clip]) {
        if (ref !== undefined) expect(ids.has(ref)).toBe(true);
      }
    }
  });

  it("paints in the mock-up's order: board, felt, riders, dots, then the cells", () => {
    const art = boardArt(1);
    const order: ArtRole[] = ["rim", "board", "grain", "track", "felt", "felt-texture"];
    for (let i = 1; i < order.length; i++) {
      expect(first(art, order[i] as ArtRole)).toBeGreaterThan(last(art, order[i - 1] as ArtRole));
    }
    expect(first(art, "felt-rim")).toBeGreaterThan(last(art, "felt-texture"));
    expect(first(art, "stitch")).toBeGreaterThan(last(art, "felt-rim"));
    expect(first(art, "rider")).toBeGreaterThan(last(art, "stitch"));
    expect(first(art, "lane")).toBeGreaterThan(last(art, "rider"));
    expect(first(art, "hole")).toBeGreaterThan(last(art, "rider"));
    const cells = Math.min(first(art, "cell"), first(art, "exit"), first(art, "entry"));
    expect(cells).toBeGreaterThan(Math.max(last(art, "lane"), last(art, "hole")));
    expect(art.shapes[art.shapes.length - 1]?.role).toBe("label");
  });
});

describe("artSvg", () => {
  it("is a complete SVG document over the art's scene, its defs first", () => {
    const art = boardArt(1);
    const svg = artSvg(art, { width: 600, height: 300, fontFamily: "Nunito" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${art.width} ${art.height}"`);
    expect(svg).toContain('width="600"');
    expect(svg.indexOf("<defs>")).toBeLessThan(svg.indexOf("<polygon"));
    expect(svg).toContain('filter="url(#toc-grain)"');
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).not.toContain("NaN");
    // No href given: no image is written.
    expect(svg).not.toContain("<image");
  });

  it("writes an image only with a given href, escaped", () => {
    const art = boardArt(0);
    const svg = artSvg(art, {
      width: 10,
      height: 10,
      fontFamily: "x",
      images: { bleu: 'a"<b>.png' },
    });
    expect(svg.match(/<image /g)).toHaveLength(1);
    expect(svg).toContain('href="a&quot;&lt;b&gt;.png"');
  });

  it("escapes text content and attribute values", () => {
    const svg = artSvg(
      {
        width: 10,
        height: 10,
        defs: [],
        shapes: [
          {
            kind: "text",
            role: "label",
            x: 1,
            y: 2,
            text: "<b>&\"'",
            size: 10,
            weight: 800,
            font: "ui",
          },
        ],
      },
      { width: 10, height: 10, fontFamily: 'A"B' },
    );
    expect(svg).toContain("&lt;b&gt;&amp;&quot;&#39;");
    expect(svg).not.toContain("<b>");
    expect(svg).toContain('font-family="A&quot;B"');
  });

  it("refuses a number that is not finite and a reference to an undeclared def", () => {
    const art = (shape: ArtShape): Art => ({
      width: 10,
      height: 10,
      defs: [],
      shapes: [shape],
    });
    const options = { width: 10, height: 10, fontFamily: "x" };
    expect(() =>
      artSvg(art({ kind: "circle", role: "hole", cx: Number.NaN, cy: 0, r: 1 }), options),
    ).toThrow();
    expect(() =>
      artSvg(
        art({ kind: "circle", role: "hole", cx: 0, cy: 0, r: 1, fillDef: "toc-nowhere" }),
        options,
      ),
    ).toThrow();
  });
});
