import { type CardId, FULL_DECK } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { cardName, cardWithArticle } from "../i18n/fr/cards.ts";
import { botLine, describeAction } from "../i18n/fr/game.ts";
import { cardFace } from "./faces.ts";
import { cardSize, fanLayout, visibleSlice } from "./fan.ts";

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

  it("uses the regular card size from 600 px", () => {
    expect(cardSize(390, 844)).toEqual({ w: 72, h: 100 });
    expect(cardSize(1280, 800)).toEqual({ w: 88, h: 124 });
    expect(cardSize(480, 1000)).toEqual({ w: 72, h: 100 });
  });
});
