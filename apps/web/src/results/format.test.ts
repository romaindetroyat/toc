import type { HistoryGame, HistorySeat } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import {
  countingLine,
  durationText,
  gameKey,
  gamesCount,
  groupByMonth,
  levelName,
  monthHeading,
  nameOf,
  partnerLine,
  partnerName,
  rate,
  rowOf,
  seatTags,
  sheetOf,
  sheetTitle,
  spanText,
} from "./format.ts";

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

// --- Plan 05-09 Task 1: the months, the detail sheet, the counting line (05-UI-SPEC Panel 1, « Game
// detail sheet », « Typography ») ---

const NNBSP = " ";

describe("monthHeading and groupByMonth", () => {
  it("« Novembre 2026 »: the month and the year, a capital first letter", () => {
    expect(monthHeading(new Date(2026, 10, 7, 9, 0).getTime())).toBe("Novembre 2026");
    expect(monthHeading(new Date(2025, 0, 31, 23, 59).getTime())).toBe("Janvier 2025");
  });

  it("groups newest first by month, keeping the order, one heading for a single game too", () => {
    const at = (month: number, day: number) => new Date(2026, month, day, 12, 0).getTime();
    const games = [
      game({ id: `${"A".repeat(43)}:4`, endedAt: at(10, 6) }),
      game({ id: `${"A".repeat(43)}:3`, endedAt: at(10, 2) }),
      game({ id: `${"A".repeat(43)}:2`, endedAt: at(9, 30) }),
    ];
    const groups = groupByMonth(games);
    expect(groups.map((group) => group.heading)).toEqual(["Novembre 2026", "Octobre 2026"]);
    expect(groups.map((group) => group.games.map((each) => each.id.slice(-1)))).toEqual([
      ["4", "3"],
      ["2"],
    ]);
    expect(groupByMonth([games[0] as HistoryGame]).map((group) => group.heading)).toEqual([
      "Novembre 2026",
    ]);
    expect(groupByMonth([])).toEqual([]);
  });

  it("the count said by the live region: « 25 parties », « 1 partie »", () => {
    expect(gamesCount(25)).toBe("25 parties");
    expect(gamesCount(1)).toBe("1 partie");
    expect(gamesCount(0)).toBe("0 partie");
  });
});

describe("the detail sheet's wording", () => {
  /** Saturday 24 October 2026, 20:31 to 21:14. */
  const START = new Date(2026, 9, 24, 20, 31).getTime();
  const END = new Date(2026, 9, 24, 21, 14).getTime();

  it("« Partie du samedi 24 octobre », the year added when it is not the current one", () => {
    expect(sheetTitle(END, NOW)).toBe("Partie du samedi 24 octobre");
    expect(sheetTitle(new Date(2025, 11, 31, 9, 5).getTime(), NOW)).toBe(
      "Partie du mercredi 31 décembre 2025",
    );
  });

  it("durations « 43 min », « 1 h 05 »; the span « De 20 h 31 à 21 h 14 (43 min) »", () => {
    expect(durationText(43 * 60_000)).toBe(`43${NNBSP}min`);
    expect(durationText(65 * 60_000)).toBe(`1${NBSP}h${NBSP}05`);
    expect(durationText(120 * 60_000 + 20_000)).toBe(`2${NBSP}h${NBSP}00`);
    expect(durationText(20_000)).toBe(`1${NNBSP}min`);
    expect(spanText(START, END)).toBe(
      `De 20${NBSP}h${NBSP}31 à 21${NBSP}h${NBSP}14 (43${NNBSP}min)`,
    );
  });

  it("the seat tags: « toi », « (sans compte) », « (ordinateur) », a seat the computer finished", () => {
    expect(seatTags(seat("bleu", "me", "Anaïs", 4))).toEqual(["toi"]);
    expect(seatTags(seat("jaune", "account", "Paul", 4))).toEqual([]);
    expect(seatTags(seat("rouge", "guest", "Mamie", 4))).toEqual(["(sans compte)"]);
    expect(seatTags(seat("vert", "bot", "Ourasi", 4, 4))).toEqual(["(ordinateur)"]);
    expect(seatTags({ ...seat("jaune", "account", "Paul", 4, 3), handedOver: true })).toEqual([
      "l’ordinateur a fini à sa place",
    ]);
    expect(seatTags({ ...seat("rouge", "guest", "Mamie", 4, 3), handedOver: true })).toEqual([
      "(sans compte)",
      "l’ordinateur a fini à sa place",
    ]);
  });

  it("the counting line: ranked, one account online, solo", () => {
    expect(countingLine(game())).toBe("Cette partie compte pour le classement entre amis.");
    expect(countingLine(game({ ranked: false }))).toBe(
      `Elle ne compte pas pour le classement${NBSP}: il faut au moins deux joueurs avec un compte.`,
    );
    expect(countingLine(game({ kind: "solo", ranked: false, creator: null }))).toBe(
      `Partie contre l’ordinateur${NBSP}: elle compte dans tes chiffres, pas au classement.`,
    );
  });

  it("an online game: the creator, the result, the two teams with their tags, the facts", () => {
    const sheet = sheetOf(
      game({
        startedAt: START,
        endedAt: END,
        deals: 6,
        creator: "Paul",
        seats: [
          { ...seat("bleu", "me", "Anaïs", 4), captured: 3, lost: 1 },
          { ...seat("jaune", "account", "Paul", 3), captured: 1, lost: 2 },
          { ...seat("rouge", "guest", "Mamie", 4), captured: 2, lost: 0, handedOver: true },
          { ...seat("vert", "bot", "Ourasi", 2, 4), captured: 0, lost: 3 },
        ],
      }),
      NOW,
    );
    expect(sheet.title).toBe("Partie du samedi 24 octobre");
    expect(sheet.kind).toBe("En ligne, à la table de Paul");
    expect(sheet.result).toBe("Victoire de ton équipe");
    expect(sheet.score).toBe(`Chevaux rentrés${NBSP}: ton équipe 8, l’équipe adverse 5`);
    expect(sheet.mine).toEqual([
      { colour: "bleu", name: "Anaïs", tags: ["toi"] },
      { colour: "rouge", name: "Mamie", tags: ["(sans compte)", "l’ordinateur a fini à sa place"] },
    ]);
    expect(sheet.theirs).toEqual([
      { colour: "jaune", name: "Paul", tags: [] },
      { colour: "vert", name: "Pur-sang", tags: ["(ordinateur)"] },
    ]);
    expect(sheet.span).toBe(`De 20${NBSP}h${NBSP}31 à 21${NBSP}h${NBSP}14 (43${NNBSP}min)`);
    expect(sheet.deals).toBe(`Donnes jouées${NBSP}: 6`);
    expect(sheet.eaten).toBe(`Chevaux mangés${NBSP}: ton équipe 5, l’équipe adverse 1`);
    expect(sheet.counting).toBe("Cette partie compte pour le classement entre amis.");
    expect(JSON.stringify(sheet)).not.toContain("Ourasi");
  });

  it("a lost solo game seen from vert: « Contre l’ordinateur », computers by level only", () => {
    const sheet = sheetOf(
      game({
        kind: "solo",
        creator: null,
        ranked: false,
        mine: "vert",
        winner: "bleu-rouge",
        seats: [
          seat("bleu", "bot", "", 4, 5),
          seat("jaune", "bot", "", 2, 2),
          seat("rouge", "bot", "", 4, 3),
          seat("vert", "me", "Anaïs", 1),
        ],
      }),
      NOW,
    );
    expect(sheet.kind).toBe("Contre l’ordinateur");
    expect(sheet.result).toBe("Défaite de ton équipe");
    expect(sheet.score).toBe(`Chevaux rentrés${NBSP}: ton équipe 3, l’équipe adverse 8`);
    expect(sheet.mine.map((each) => each.colour)).toEqual(["jaune", "vert"]);
    expect(sheet.mine[0]).toEqual({ colour: "jaune", name: "Trotteur", tags: ["(ordinateur)"] });
    expect(sheet.theirs.map((each) => each.name)).toEqual(["Champion", "Galopeur"]);
    expect(sheet.counting).toContain("pas au classement");
  });
});

describe("gameKey", () => {
  it("an online game keeps its id; a solo game drops the account part of its id", () => {
    expect(gameKey(game())).toBe(`${"A".repeat(43)}:1`);
    const uuid = "0f8e2c4a-1b2c-4d3e-8f90-123456789abc";
    expect(gameKey(game({ kind: "solo", id: `solo:${"u".repeat(22)}:${uuid}` }))).toBe(uuid);
  });
});

// --- Plan 05-09 Task 2: « Mes chiffres » (05-UI-SPEC Panel 2, « Typography ») ---

describe("the figures' wording", () => {
  it("a rate in French with Intl (U+202F before %), « – » without a game", () => {
    expect(rate(2, 3)).toBe(`67${NNBSP}%`);
    expect(rate(1, 1)).toBe(`100${NNBSP}%`);
    expect(rate(0, 4)).toBe(`0${NNBSP}%`);
    expect(rate(5, 8)).toBe(`63${NNBSP}%`);
    expect(rate(0, 0)).toBe("–");
  });

  it("a partner's or a level's line, singular for one", () => {
    expect(partnerLine(3, 2)).toBe(`3 parties · 2 victoires · 67${NNBSP}%`);
    expect(partnerLine(1, 1)).toBe(`1 partie · 1 victoire · 100${NNBSP}%`);
    expect(partnerLine(2, 0)).toBe(`2 parties · 0 victoire · 0${NNBSP}%`);
  });

  it("a partner by its pseudo, the guests together, the computers of a level", () => {
    expect(partnerName({ kind: "account", name: "Marie", level: null, games: 1, wins: 1 })).toBe(
      "Marie",
    );
    expect(partnerName({ kind: "guests", name: null, level: null, games: 1, wins: 1 })).toBe(
      "Joueurs sans compte",
    );
    expect(partnerName({ kind: "bot", name: null, level: 4, games: 1, wins: 1 })).toBe(
      "Pur-sang (ordinateur)",
    );
    expect(levelName(1)).toBe("Poulain");
    expect(levelName(5)).toBe("Champion");
  });
});
