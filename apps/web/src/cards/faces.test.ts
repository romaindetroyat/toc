import { FULL_DECK, rankOf } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { COURT_FIGURES, cardFace } from "./faces.ts";

// The committed figures are SVG files (option svg-cards of assets/cartes/CHOIX.md); the file-content
// checks below follow that format.
const files = import.meta.glob<string>("../assets/cartes/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
});
const sourceOf = (card: string) =>
  Object.entries(files).find(([name]) => name.endsWith(`/${card}.svg`))?.[1];

describe("court figures", () => {
  const courtCards = FULL_DECK.filter((card) => rankOf(card) >= 11);

  it("has the 12 Valets, Dames and Rois of the four suits", () => {
    expect(courtCards).toHaveLength(12);
    for (const card of courtCards) {
      expect(COURT_FIGURES[card], `figure of ${card}`).toBeTruthy();
    }
  });

  it("maps every court card to an existing standalone SVG file", () => {
    for (const card of courtCards) {
      const source = sourceOf(card);
      expect(source, `file of ${card}`).toBeDefined();
      expect(source).toMatch(/^<\?xml[^>]*\?>\s*<svg\b/);
      expect(source).toContain("viewBox=");
    }
    expect(Object.keys(files)).toHaveLength(12);
  });

  it("gives each court card its own file", () => {
    const urls = courtCards.map((card) => COURT_FIGURES[card]);
    expect(new Set(urls).size).toBe(12);
  });

  it("gives no figure to a pip card or an As, which the code draws", () => {
    for (const card of FULL_DECK.filter((c) => rankOf(c) < 11)) {
      expect(COURT_FIGURES[card], `figure of ${card}`).toBeUndefined();
      expect(cardFace(card).court).toBe(false);
    }
  });

  it("runs no script and loads nothing from outside (the figures are shown in an <img>)", () => {
    for (const card of courtCards) {
      const source = sourceOf(card) ?? "";
      expect(source, card).not.toMatch(
        /<script|<foreignObject|<image|<text|\son[a-z]+=|href="(?!#)/i,
      );
    }
  });

  it("keeps the licence text next to the figures", () => {
    const licences = import.meta.glob<string>("../assets/cartes/*.txt", {
      eager: true,
      query: "?raw",
      import: "default",
    });
    const texts = Object.values(licences);
    expect(texts.length).toBeGreaterThanOrEqual(1);
    expect(texts.some((text) => /GNU LESSER GENERAL PUBLIC LICENSE|licen[cs]e/i.test(text))).toBe(
      true,
    );
  });
});
