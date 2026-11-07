import type { HistoryGame, HistorySeat } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { nameOf, rowOf } from "./format.ts";

// The wording of a game row in « Mes résultats » (plan 05-01 Task 3; 05-UI-SPEC Panel 1, « Typography »,
// D-03 with D-12): line 1 the result and the score (knights home, own team first), line 2 the partner
// and the opponents, the end date and time, and the accessible sentence. A guest is « Prénom (sans
// compte) », a computer its level name, never its horse name.

const NBSP = "\u00a0";

const seat = (
  colour: HistorySeat["colour"],
  kind: HistorySeat["kind"],
  name: string,
  home: number,
  level: HistorySeat["level"] = null,
): HistorySeat => ({ colour, kind, name, level, handedOver: false, captured: 0, lost: 0, home });

/** 25 October 2026, 21:14 local time. */
const ENDED = new Date(2026, 9, 25, 21, 14).getTime();
const NOW = new Date(2026, 10, 7, 12, 0).getTime();

function game(overrides: Partial<HistoryGame> = {}): HistoryGame {
  return {
    id: `${"A".repeat(43)}:1`,
    kind: "online",
    startedAt: ENDED - 43 * 60_000,
    endedAt: ENDED,
    winner: "bleu-rouge",
    mine: "bleu",
    seats: [
      seat("bleu", "me", "Anaïs", 4),
      seat("jaune", "account", "Paul", 3),
      seat("rouge", "account", "Marie", 4),
      seat("vert", "bot", "Ourasi", 2, 4),
    ],
    deals: 5,
    creator: "Anaïs",
    ranked: true,
    ...overrides,
  };
}

describe("rowOf", () => {
  it("a won online game: score own team first, partner, opponents, date, time, sentence", () => {
    const row = rowOf(game(), NOW);
    expect(row.icon).toBe("users");
    expect(row.line1).toBe("Victoire · 8 – 5");
    expect(row.line2).toBe("Avec Marie · contre Paul et Pur-sang");
    expect(row.date).toBe("25 oct.");
    expect(row.time).toBe(`21${NBSP}h${NBSP}14`);
    expect(row.label).toBe(
      `Victoire, 8 à 5, le 25 octobre à 21${NBSP}h${NBSP}14, en ligne, avec Marie, contre Paul et Pur-sang`,
    );
  });

  it("a lost game seen from jaune, with a guest partner", () => {
    const lost = game({
      mine: "jaune",
      seats: [
        seat("bleu", "account", "Paul", 4),
        seat("jaune", "me", "Anaïs", 3),
        seat("rouge", "account", "Marie", 4),
        seat("vert", "guest", "Mamie", 3),
      ],
    });
    const row = rowOf(lost, NOW);
    expect(row.line1).toBe("Défaite · 6 – 8");
    expect(row.line2).toBe("Avec Mamie (sans compte) · contre Paul et Marie");
    expect(row.label.startsWith("Défaite, 6 à 8, ")).toBe(true);
    expect(`${row.line2} ${row.label}`).not.toMatch(/invit/i);
  });

  it("two opponent computers of the same level, and a computer partner, by level name", () => {
    const row = rowOf(
      game({
        seats: [
          seat("bleu", "me", "Anaïs", 4),
          seat("jaune", "bot", "Ourasi", 1, 3),
          seat("rouge", "bot", "Jappeloup", 4, 2),
          seat("vert", "bot", "Ténor", 0, 3),
        ],
      }),
      NOW,
    );
    expect(row.line2).toBe("Avec Trotteur · contre deux ordinateurs Galopeur");
    for (const horse of ["Ourasi", "Jappeloup", "Ténor"]) expect(row.label).not.toContain(horse);
  });

  it("a solo game: the bot icon and « contre l’ordinateur » in the sentence", () => {
    const row = rowOf(
      game({
        kind: "solo",
        creator: null,
        ranked: false,
        seats: [
          seat("bleu", "me", "Anaïs", 4),
          seat("jaune", "bot", "Ourasi", 1, 5),
          seat("rouge", "bot", "Jappeloup", 4, 2),
          seat("vert", "bot", "Ténor", 0, 3),
        ],
      }),
      NOW,
    );
    expect(row.icon).toBe("bot");
    expect(row.line2).toBe("Avec Trotteur · contre Champion et Galopeur");
    expect(row.label).toContain("contre l’ordinateur");
    expect(row.label).not.toContain("en ligne");
  });

  it("the year is added when it is not the current one; minutes always two digits", () => {
    const old = new Date(2025, 11, 31, 9, 5).getTime();
    const row = rowOf(game({ endedAt: old }), NOW);
    expect(row.date).toBe("31 déc. 2025");
    expect(row.time).toBe(`9${NBSP}h${NBSP}05`);
    expect(row.label).toContain(`le 31 décembre 2025 à 9${NBSP}h${NBSP}05`);
  });

  it("a long pseudo stays whole in the sentence", () => {
    const long = "Marie-Christine Abcd";
    const row = rowOf(
      game({
        seats: [
          seat("bleu", "me", "Anaïs", 4),
          seat("jaune", "account", long, 3),
          seat("rouge", "guest", "Mamie", 4),
          seat("vert", "bot", "Ourasi", 2, 4),
        ],
      }),
      NOW,
    );
    expect(row.line2).toBe(`Avec Mamie (sans compte) · contre ${long} et Pur-sang`);
    expect(row.label).toContain(long);
  });
});

describe("nameOf", () => {
  it("an account by its pseudo, a guest « (sans compte) », a computer by its level", () => {
    expect(nameOf(seat("jaune", "account", "Paul", 0))).toBe("Paul");
    expect(nameOf(seat("jaune", "guest", "Mamie", 0))).toBe("Mamie (sans compte)");
    expect(nameOf(seat("jaune", "bot", "Ourasi", 0, 1))).toBe("Poulain");
  });
});
