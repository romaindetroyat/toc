import { leftClearance, SCENE } from "@toc/board";
import { type CardId, FULL_DECK } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { cardName, cardWithArticle } from "../i18n/fr/cards.ts";
import { botLine, describeAction } from "../i18n/fr/game.ts";
import { cardFace } from "./faces.ts";
import {
  CORNER_MARGIN,
  CORNER_SHIFT,
  CORNER_TOP,
  cardSize,
  cornerCard,
  cornerLayout,
  fanLayout,
  fanReach,
  fanSpread,
  visibleSlice,
} from "./fan.ts";

describe("cardFace", () => {
  it("labels ranks and colours suits", () => {
    expect(cardFace("1S")).toMatchObject({ rankLabel: "A", suitGlyph: "♠", colour: "#1A1A1A" });
    expect(cardFace("10H")).toMatchObject({ rankLabel: "10", suitGlyph: "♥", colour: "#A8140E" });
    expect(cardFace("11D")).toMatchObject({ rankLabel: "V", court: true });
    expect(cardFace("12C")).toMatchObject({ rankLabel: "D", suitGlyph: "♣" });
    expect(cardFace("13H")).toMatchObject({ rankLabel: "R", court: true });
    expect(cardFace("7D").court).toBe(false);
  });

  it("describes all 52 cards", () => {
    for (const card of FULL_DECK) {
      const face = cardFace(card);
      expect(face.rankLabel.length).toBeGreaterThan(0);
      expect(["#A8140E", "#1A1A1A"]).toContain(face.colour);
    }
  });
});

describe("card names", () => {
  it("names the cards of the UI-SPEC", () => {
    expect(cardName("1H")).toBe("As de cœur");
    expect(cardName("10C")).toBe("10 de trèfle");
    expect(cardName("11S")).toBe("Valet de pique");
    expect(cardName("12D")).toBe("Dame de carreau");
    expect(cardName("13H")).toBe("Roi de cœur");
  });

  it("puts the article for a sentence", () => {
    expect(cardWithArticle("12H")).toBe("la Dame de cœur");
    expect(cardWithArticle("1S")).toBe("l’As de pique");
    expect(cardWithArticle("13C")).toBe("le Roi de trèfle");
    expect(cardWithArticle("7D")).toBe("le 7 de carreau");
  });
});

describe("bot result line", () => {
  const dame: CardId = "12H";
  it("reads like the UI-SPEC example", () => {
    const events = [
      { t: "cardPlayed", seat: "jaune", card: dame },
      {
        t: "pawnMoved",
        pawn: "jaune0",
        from: { z: "ring", cell: 18 },
        path: Array.from({ length: 12 }, (_, i) => ({ z: "ring" as const, cell: 19 + i })),
        dir: 1,
      },
    ] as const;
    expect(botLine("Jappeloup", events)).toBe(
      "Jappeloup a joué la Dame de cœur : avance de 12 cases.",
    );
    expect(describeAction(events)).toBe("avance de 12 cases");
  });

  it("describes an exit and a capture", () => {
    const events = [
      { t: "cardPlayed", seat: "rouge", card: "1S" },
      { t: "pawnExited", pawn: "rouge0", to: { z: "ring", cell: 36 } },
      { t: "pawnCaptured", by: "rouge0", victim: "bleu1", at: { z: "ring", cell: 36 }, atStep: 0 },
    ] as const;
    expect(describeAction(events)).toBe("sort de l’écurie, mange un cheval bleu");
  });

  it("says the dead hand is laid down", () => {
    expect(botLine("Tornado", [{ t: "handDiscarded", seat: "vert", cards: ["2S"] }])).toBe(
      "Tornado pose ses cartes : aucune n’est jouable.",
    );
  });
});

describe("hand fan", () => {
  it("centres a single card without rotation", () => {
    expect(fanLayout(1, 288, 72)).toEqual([{ dx: 0, drop: 0, rotation: 0 }]);
  });

  it("follows the UI-SPEC formula", () => {
    const slots = fanLayout(5, 358, 72);
    expect(slots.map((s) => s.rotation)).toEqual([-8, -4, 0, 4, 8]);
    expect(slots.map((s) => s.drop)).toEqual([16, 4, 0, 4, 16]);
    expect(slots[1]?.dx).toBe(-56);
    expect(fanLayout(2, 358, 72).map((s) => s.rotation)).toEqual([-2, 2]);
  });

  it("keeps every visible slice at least 44 px wide on a 320 px screen", () => {
    for (let n = 2; n <= 5; n++) {
      expect(visibleSlice(n, 320 - 32, 72)).toBeGreaterThanOrEqual(44);
    }
    expect(visibleSlice(5, 320 - 32, 72)).toBe(54);
  });

  it("spreads the fan so that the turned outer cards stay on a 320 px screen", () => {
    const reach = fanReach(5, 72, 100);
    // On a 320 px screen the gutter is 16 px: the corners would stick out by about 6 px without it.
    expect(reach).toBeGreaterThan(21);
    expect(reach).toBeLessThan(23);
    const spread = fanSpread(5, 320 - 32, 72, 100);
    expect(spread).toBeLessThan(288);
    // The outer card's turned corner is back inside the 16 px gutter.
    const offset = Math.min(56, Math.floor((spread - 72) / 4));
    expect(offset).toBeGreaterThanOrEqual(44);
    const reachFromEdge = 16 + (288 - (spread - 72 + 72)) / 2 - reach;
    expect(reachFromEdge).toBeGreaterThanOrEqual(0);
    // Nothing to give back when the screen is wide, or the hand is one card.
    expect(fanSpread(5, 358, 72, 100)).toBeLessThanOrEqual(358);
    expect(fanReach(1, 72, 100)).toBe(0);
  });

  it("uses the regular card size from 600 px", () => {
    expect(cardSize(390, 844)).toEqual({ w: 72, h: 100 });
    expect(cardSize(1280, 800)).toEqual({ w: 106, h: 148 });
    expect(cardSize(480, 1000)).toEqual({ w: 72, h: 100 });
  });
});

describe("the compact mode's hand in the corner (plans 03-10 and 02-06b)", () => {
  /**
   * The strip of the compact mode at a window (Game.svelte: 60 px strips, 24 px row), the screen's
   * insets left and right (`insetX`, both together) and at the bottom (`insetY`) taken off first.
   */
  const stripAt = (width: number, height: number, insetX = 0, insetY = 0) => {
    const board = Math.min(width - 120 - insetX, (height - 24 - insetY) / 0.5);
    const h = height - insetY;
    return {
      width: (width - insetX - board) / 2,
      height: h,
      boardTop: (h - 24 - board / 2) / 2 + 24,
      boardWidth: board,
    };
  };
  const SIZES = [
    [844, 390, 0, 0],
    [750, 342, 0, 0],
    [667, 375, 0, 0],
    [568, 320, 0, 0],
    [480, 320, 0, 0],
    // iPhone 14 and iPhone 15 Pro held sideways: 47 and 59 px each side, 21 px at the bottom.
    [844, 390, 94, 21],
    [852, 393, 118, 21],
    // A small window, limited by its height: wider strips.
    [959, 400, 0, 0],
  ] as const;

  it("makes the tallest cards about 1.5 times the column's 52 x 73, 79 x 110 at 390 px", () => {
    expect(cornerCard(390)).toEqual({ w: 79, h: 110, slice: 58 });
    expect(cornerCard(342)).toEqual({ w: 67, h: 94, slice: 50 });
    expect(cornerCard(375)).toEqual({ w: 75, h: 105, slice: 55 });
    expect(cornerCard(320)).toEqual({ w: 61, h: 86, slice: 46 });
    // Never larger than 80 x 112, whatever the height.
    expect(cornerCard(800)).toEqual({ w: 80, h: 112, slice: 68 });
    // A lower strip keeps 44 px slices and smaller cards.
    expect(cornerCard(300).slice).toBe(44);
    expect(cornerCard(300).h).toBe(300 - CORNER_TOP - 4 * 44);
  });

  it("caps the card's width, 5:7 kept", () => {
    expect(cornerCard(390, 57)).toEqual({ w: 56, h: 79, slice: 51 });
    expect(cornerCard(342, 56)).toEqual({ w: 56, h: 78, slice: 51 });
    for (let max = 44; max <= 90; max++) {
      const card = cornerCard(342, max);
      expect(card.w, `${max}`).toBeLessThanOrEqual(max);
      expect(Math.abs(card.h / card.w - 7 / 5), `${max}`).toBeLessThan(0.03);
    }
  });

  it("shows the middle of every card: each slice passes its card's middle", () => {
    for (let height = 280; height <= 600; height++) {
      for (const max of [Number.POSITIVE_INFINITY, 56]) {
        const { h, slice } = cornerCard(height, max);
        expect(slice, `${height}`).toBeGreaterThanOrEqual(44);
        expect(slice, `${height}`).toBeGreaterThan(h / 2);
        expect(4 * slice + h, `${height}`).toBeLessThanOrEqual(height - CORNER_TOP);
      }
    }
  });

  it("stands the cards from the strip's bottom, a slice apart, under the info pill", () => {
    for (const [width, height, insetX, insetY] of SIZES) {
      const strip = stripAt(width, height, insetX, insetY);
      for (let n = 1; n <= 5; n++) {
        const { card, slots } = cornerLayout(n, strip, leftClearance, SCENE.width);
        expect(slots).toHaveLength(n);
        expect((slots[n - 1]?.y ?? 0) + card.h).toBe(strip.height);
        for (let i = 1; i < n; i++) {
          expect((slots[i]?.y ?? 0) - (slots[i - 1]?.y ?? 0)).toBe(card.slice);
          expect(card.slice).toBeGreaterThanOrEqual(44);
        }
        expect(slots[0]?.y ?? 0).toBeGreaterThanOrEqual(CORNER_TOP);
      }
    }
  });

  it("stands every card in one straight column inside the strip (« la carte du bas est décalée »)", () => {
    for (const [width, height, insetX, insetY] of SIZES) {
      const strip = stripAt(width, height, insetX, insetY);
      const five = cornerLayout(5, strip, leftClearance, SCENE.width);
      for (let n = 1; n <= 5; n++) {
        const { card, slots } = cornerLayout(n, strip, leftClearance, SCENE.width);
        // One size and one left edge, whatever the number of cards: nothing jumps when one leaves.
        expect(card).toEqual(five.card);
        for (const { x } of slots) {
          expect(x, `${width} x ${height}`).toBe(five.slots[0]?.x);
          // Never left of the strip, so never under an iPhone's Dynamic Island.
          expect(x, `${width} x ${height}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("keeps every card, moved or not, off the cells, the knights and the dots", () => {
    for (const [width, height, insetX, insetY] of SIZES) {
      const strip = stripAt(width, height, insetX, insetY);
      const { card, slots } = cornerLayout(5, strip, leftClearance, SCENE.width);
      const scale = strip.boardWidth / SCENE.width;
      for (const { x, y } of slots) {
        const right = x + card.w + CORNER_SHIFT + CORNER_MARGIN;
        const y0 = (y - strip.boardTop) / scale;
        const y1 = (Math.min(y + card.h, strip.height) - strip.boardTop) / scale;
        expect(right).toBeLessThanOrEqual(strip.width + leftClearance(y0, y1) * scale + 1e-9);
      }
    }
  });

  it("makes the cards the largest that fit: 56 x 79 by a 60 px strip, the tallest where the strip is wider", () => {
    const sizeAt = (width: number, height: number, insetX = 0, insetY = 0) => {
      const strip = stripAt(width, height, insetX, insetY);
      const { card, slots } = cornerLayout(5, strip, leftClearance, SCENE.width);
      const bigger = cornerCard(strip.height, card.w + 1);
      const scale = strip.boardWidth / SCENE.width;
      // One pixel wider would not fit (or is the tallest card already).
      const top = strip.height - bigger.h - 4 * bigger.slice;
      const room =
        strip.width +
        leftClearance((top - strip.boardTop) / scale, (strip.height - strip.boardTop) / scale) *
          scale -
        CORNER_MARGIN -
        CORNER_SHIFT;
      if (bigger.w > card.w) expect(bigger.w).toBeGreaterThan(room);
      return { ...card, x: slots[0]?.x };
    };
    expect(sizeAt(844, 390)).toEqual({ w: 56, h: 79, slice: 51, x: 1 });
    expect(sizeAt(750, 342)).toEqual({ w: 56, h: 79, slice: 51, x: 0 });
    expect(sizeAt(480, 320)).toEqual({ w: 54, h: 75, slice: 49, x: 0 });
    expect(sizeAt(844, 390, 94, 21)).toEqual({ w: 56, h: 79, slice: 51, x: 0 });
    // A window limited by its height leaves strips wide enough for the 03-10 card.
    expect(sizeAt(959, 400)).toMatchObject({ w: 80, h: 112 });
    for (const [width, height, insetX, insetY] of SIZES) {
      const { w } = sizeAt(width, height, insetX, insetY);
      expect(w).toBeGreaterThanOrEqual(44);
    }
  });

  it("lays out nothing for no card or no board", () => {
    expect(cornerLayout(0, stripAt(844, 390), leftClearance, SCENE.width).slots).toEqual([]);
    expect(
      cornerLayout(3, { ...stripAt(844, 390), boardWidth: 0 }, leftClearance, SCENE.width).slots,
    ).toEqual([]);
  });
});
