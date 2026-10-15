import type { Color } from "@toc/engine";

/** The four seats: name, glyph (never colour alone identifies a seat) and its screen-reader name. */
export const seats = {
  bleu: { name: "Bleu", glyph: "●", glyphName: "cercle" },
  jaune: { name: "Jaune", glyph: "▲", glyphName: "triangle" },
  rouge: { name: "Rouge", glyph: "■", glyphName: "carré" },
  vert: { name: "Vert", glyph: "★", glyphName: "étoile" },
} as const satisfies Record<Color, { name: string; glyph: string; glyphName: string }>;
