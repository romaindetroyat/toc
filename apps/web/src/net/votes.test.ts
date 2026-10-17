import type { Color } from "@toc/engine";
import type { RematchVote } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { discLabel, voteLine, voteState } from "./votes.ts";

// The vote line and the discs of the online end plank (02-UI-SPEC « End plank (online) »).

const NAMES: Record<Color, string> = {
  bleu: "Toi",
  jaune: "Bruno",
  rouge: "Éclair",
  vert: "Céline",
};

const votes = (over: Partial<Record<Color, RematchVote>>): Record<Color, RematchVote> => ({
  bleu: "no",
  jaune: "no",
  rouge: "bot",
  vert: "no",
  ...over,
});

describe("voteState", () => {
  it("nobody yet, mine only, someone else first, waiting, all agree", () => {
    expect(voteState(votes({}), "bleu")).toEqual({ kind: "nobody" });
    expect(voteState(votes({ bleu: "yes" }), "bleu")).toEqual({
      kind: "mine",
      waiting: ["jaune", "vert"],
    });
    expect(voteState(votes({ jaune: "yes" }), "bleu")).toEqual({
      kind: "others",
      agreed: ["jaune"],
    });
    expect(voteState(votes({ jaune: "yes", vert: "yes" }), "bleu")).toEqual({
      kind: "others",
      agreed: ["jaune", "vert"],
    });
    expect(voteState(votes({ bleu: "yes", jaune: "yes", vert: "yes" }), "bleu")).toEqual({
      kind: "all",
    });
  });

  it("an offline person is not waited for; computers always agree", () => {
    expect(voteState(votes({ bleu: "yes", jaune: "offline" }), "bleu")).toEqual({
      kind: "mine",
      waiting: ["vert"],
    });
    expect(voteState(votes({ bleu: "yes", jaune: "offline", vert: "bot" }), "bleu")).toEqual({
      kind: "all",
    });
  });
});

describe("voteLine", () => {
  it("words each state as the copy table says", () => {
    expect(voteLine(votes({}), "bleu", NAMES)).toBe(
      "Revanche : il faut l’accord de tout le monde.",
    );
    expect(voteLine(votes({ bleu: "yes" }), "bleu", NAMES)).toBe(
      "Tu es d’accord. En attente de Bruno et Céline…",
    );
    expect(voteLine(votes({ bleu: "yes", vert: "yes" }), "bleu", NAMES)).toBe(
      "Tu es d’accord. En attente de Bruno…",
    );
    expect(voteLine(votes({ jaune: "yes" }), "bleu", NAMES)).toBe("Bruno veut une revanche.");
    expect(voteLine(votes({ jaune: "yes", vert: "yes" }), "bleu", NAMES)).toBe(
      "Bruno et Céline veulent une revanche.",
    );
    expect(voteLine(votes({ bleu: "yes", jaune: "yes", vert: "yes" }), "bleu", NAMES)).toBe(
      "Tout le monde est d’accord : nouvelle partie !",
    );
  });

  it("elides « de » before a vowel (« En attente d’Ana… »)", () => {
    const names = { ...NAMES, jaune: "Ana" };
    expect(voteLine(votes({ bleu: "yes", vert: "offline" }), "bleu", names)).toBe(
      "Tu es d’accord. En attente d’Ana…",
    );
  });

  it("the starting line wins over the votes (the server already reset them)", () => {
    expect(voteLine(null, "bleu", NAMES)).toBe("Tout le monde est d’accord : nouvelle partie !");
  });
});

describe("discLabel", () => {
  it("names each disc with its state", () => {
    expect(discLabel("Bruno", "yes")).toBe("Bruno, d’accord");
    expect(discLabel("Bruno", "no")).toBe("Bruno, pas encore");
    expect(discLabel("Bruno", "offline")).toBe("Bruno, hors ligne");
    expect(discLabel("Éclair", "bot")).toBe("Éclair (ordinateur), d’accord");
  });
});
