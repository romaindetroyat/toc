import { type CardId, FULL_DECK } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { cardName, cardWithArticle } from "../i18n/fr/cards.ts";
import { botLine, describeAction } from "../i18n/fr/game.ts";
import { cardFace } from "./faces.ts";
import {
  COLUMN_CARD,
  COLUMN_SHIFT,
  COLUMN_STEP,
  cardSize,
  columnHeight,
  columnLayout,
  fanLayout,
  fanReach,
  fanSpread,
  visibleSlice,
} from "./fan.ts";

describe("cardFace", () => {
  it("labels ranks and colours suits", () => {
    expect(cardFace("1S")).toMatchObject({ rankLabel: "A", suitGlyph: "♠", colour: "#1A1A1A" });
    expect(cardFace("10H")).toMatchObject({ rankLabel: "10", suitGlyph: "♥", colour: "#C0201A" });
    expect(cardFace("11D")).toMatchObject({ rankLabel: "V", court: true });
    expect(cardFace("12C")).toMatchObject({ rankLabel: "D", suitGlyph: "♣" });
    expect(cardFace("13H")).toMatchObject({ rankLabel: "R", court: true });
    expect(cardFace("7D").court).toBe(false);
  });

  it("describes all 52 cards", () => {
    for (const card of FULL_DECK) {
      const face = cardFace(card);
      expect(face.rankLabel.length).toBeGreaterThan(0);
      expect(["#C0201A", "#1A1A1A"]).toContain(face.colour);
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
    expect(cardSize(1280, 800)).toEqual({ w: 88, h: 124 });
    expect(cardSize(480, 1000)).toEqual({ w: 72, h: 100 });
  });
});

describe("the compact mode's hand column (plan 01-47)", () => {
  it("fits five 52 x 73 cards in 249 px, bottom-aligned", () => {
    expect(COLUMN_CARD).toEqual({ w: 52, h: 73 });
    expect(columnHeight(5)).toBe(249);
    const slots = columnLayout(5, 249);
    expect(slots).toHaveLength(5);
    expect(slots[0]?.y).toBe(0);
    // The last card is whole: its bottom is the box's bottom edge.
    expect((slots[4]?.y ?? 0) + COLUMN_CARD.h).toBe(249);
  });

  it("puts every card at least 44 px under the one before, so its index shows", () => {
    expect(COLUMN_STEP).toBeGreaterThanOrEqual(44);
    for (let n = 2; n <= 5; n++) {
      const slots = columnLayout(n, 249);
      for (let i = 1; i < slots.length; i++) {
        expect((slots[i]?.y ?? 0) - (slots[i - 1]?.y ?? 0)).toBeGreaterThanOrEqual(44);
      }
      // Bottom-aligned in a taller box: the last card ends on its bottom edge.
      expect((slots[n - 1]?.y ?? 0) + COLUMN_CARD.h).toBe(249);
    }
  });

  it("takes one card's height for one card, and nothing for none", () => {
    expect(columnHeight(1)).toBe(73);
    expect(columnLayout(1, 73)).toEqual([{ y: 0 }]);
    expect(columnLayout(1, 249)).toEqual([{ y: 176 }]);
    expect(columnLayout(0, 249)).toEqual([]);
    expect(columnHeight(0)).toBe(0);
  });

  it("moves the selected card 6 px toward the board, inside a 60 px strip", () => {
    expect(COLUMN_SHIFT).toBe(6);
    expect(COLUMN_CARD.w + COLUMN_SHIFT).toBeLessThanOrEqual(60);
  });
});
