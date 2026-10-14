import { quarterTurnsFor, SCENE, sceneXY } from "@toc/board";
import { COLORS, type Color, EXIT, type Place } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { anchorOf, facingFor, placeKey, screenDelta } from "./geometry.ts";

const places: Place[] = [
  { z: "ring", cell: 0 },
  { z: "ring", cell: 37 },
  { z: "ring", cell: 71 },
  ...COLORS.flatMap((color) =>
    ([0, 1, 2, 3] as const).flatMap((slot): Place[] => [
      { z: "stable", color, slot },
      { z: "home", color, slot },
    ]),
  ),
];

describe("anchorOf", () => {
  it("is sceneXY(place, k) for ring, stable and home places and the four seats", () => {
    for (const k of [0, 1, 2, 3]) {
      for (const place of places) expect(anchorOf(place, k)).toEqual(sceneXY(place, k));
    }
  });

  it("puts each colour's exit in the lower half and its partner's in the upper half", () => {
    const partnerOf = (c: Color): Color => COLORS[(COLORS.indexOf(c) + 2) % 4] as Color;
    for (const color of COLORS) {
      const k = quarterTurnsFor(color);
      expect(anchorOf({ z: "ring", cell: EXIT[color] }, k)[1]).toBeGreaterThan(SCENE.height / 2);
      expect(anchorOf({ z: "ring", cell: EXIT[partnerOf(color)] }, k)[1]).toBeLessThan(
        SCENE.height / 2,
      );
    }
  });
});

describe("screenDelta", () => {
  it("is b minus a", () => {
    expect(screenDelta([10, 20], [15, 12])).toEqual([5, -8]);
  });
});

describe("facingFor", () => {
  it("faces right for a rightward hop and left for a leftward hop", () => {
    expect(facingFor("left", 120, 0)).toBe("right");
    expect(facingFor("right", -120, 0)).toBe("left");
    expect(facingFor("right", 100, 60)).toBe("right");
    expect(facingFor("left", -100, -60)).toBe("left");
  });

  it("keeps the previous facing on a near-vertical hop (|dx| < 0.35 * |dy|)", () => {
    expect(facingFor("left", 30, 120)).toBe("left");
    expect(facingFor("right", -30, -120)).toBe("right");
    expect(facingFor("right", 0, 120)).toBe("right");
    expect(facingFor("left", 0, -120)).toBe("left");
  });

  it("turns as soon as the horizontal part reaches 0.35 of the vertical one", () => {
    expect(facingFor("left", 0.35 * 100, 100)).toBe("right");
    expect(facingFor("right", -0.35 * 100, 100)).toBe("left");
    expect(facingFor("left", 0.34 * 100, 100)).toBe("left");
  });

  it("keeps the previous facing when the hop goes nowhere", () => {
    expect(facingFor("left", 0, 0)).toBe("left");
    expect(facingFor("right", 0, 0)).toBe("right");
  });
});

describe("placeKey", () => {
  it("writes ring, stable and home places", () => {
    expect(placeKey({ z: "ring", cell: 22 })).toBe("ring:22");
    expect(placeKey({ z: "stable", color: "vert", slot: 3 })).toBe("stable:vert:3");
    expect(placeKey({ z: "home", color: "jaune", slot: 0 })).toBe("home:jaune:0");
  });
});
