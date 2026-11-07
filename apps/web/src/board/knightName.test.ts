import type { Color } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { knightName } from "./knightName.ts";

// Plan 05-10 (05-UI-SPEC « Knight names », APP-05): every knight, lit or not, is named with its colour,
// its letter, whose it is and where it stands; a lit knight adds « , jouable », a lesson's target
// « , à toucher ».

const NAMES: Record<Color, string> = {
  bleu: "Romain",
  jaune: "Paul",
  rouge: "Marie",
  vert: "Ourasi",
};

describe("knightName", () => {
  it("names one's own knight on the ring, how far from its exit", () => {
    expect(knightName("bleu0", { z: "ring", cell: 12 }, "bleu", NAMES)).toBe(
      "Cheval bleu A, à toi, à 12 cases de sa sortie",
    );
  });

  it("names the partner's knight with the partner's name", () => {
    expect(knightName("rouge2", { z: "stable", color: "rouge", slot: 2 }, "bleu", NAMES)).toBe(
      "Cheval rouge C, à ton partenaire Marie, à l’écurie",
    );
  });

  it("names an opponent's knight at home", () => {
    expect(knightName("jaune1", { z: "home", color: "jaune", slot: 0 }, "bleu", NAMES)).toBe(
      "Cheval jaune B, adversaire, à la maison",
    );
  });

  it("counts from each colour's own exit, one case in the singular", () => {
    // Jaune's exit is ring cell 18 (topology EXIT).
    expect(knightName("jaune3", { z: "ring", cell: 19 }, "bleu", NAMES)).toBe(
      "Cheval jaune D, adversaire, à 1 case de sa sortie",
    );
    expect(knightName("vert0", { z: "ring", cell: 54 }, "bleu", NAMES)).toBe(
      "Cheval vert A, adversaire, sur sa case de sortie",
    );
    // Past the ring's end: Vert's exit is 54, cell 3 is 21 cases on.
    expect(knightName("vert1", { z: "ring", cell: 3 }, "bleu", NAMES)).toBe(
      "Cheval vert B, adversaire, à 21 cases de sa sortie",
    );
  });

  it("follows the human's seat: the same knight is « à toi » for its owner", () => {
    expect(knightName("rouge0", { z: "ring", cell: 40 }, "rouge", NAMES)).toBe(
      "Cheval rouge A, à toi, à 4 cases de sa sortie",
    );
    expect(knightName("bleu0", { z: "ring", cell: 0 }, "rouge", NAMES)).toBe(
      "Cheval bleu A, à ton partenaire Romain, sur sa case de sortie",
    );
  });

  it("adds « , jouable » to a lit knight and « , à toucher » to a lesson's target", () => {
    const place = { z: "ring", cell: 12 } as const;
    expect(knightName("bleu0", place, "bleu", NAMES, { lit: true })).toBe(
      "Cheval bleu A, à toi, à 12 cases de sa sortie, jouable",
    );
    expect(knightName("bleu0", place, "bleu", NAMES, { target: true })).toBe(
      "Cheval bleu A, à toi, à 12 cases de sa sortie, à toucher",
    );
    expect(knightName("bleu0", place, "bleu", NAMES, { lit: true, target: true })).toBe(
      "Cheval bleu A, à toi, à 12 cases de sa sortie, jouable, à toucher",
    );
  });

  it("names a partner without a name by the word alone", () => {
    expect(
      knightName("rouge1", { z: "home", color: "rouge", slot: 1 }, "bleu", { ...NAMES, rouge: "" }),
    ).toBe("Cheval rouge B, à ton partenaire, à la maison");
  });
});
