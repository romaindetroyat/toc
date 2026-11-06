// The exchange card of the strong levels (plan 04-15, a refinement of phase 3 D-09). Romain, 2026-11-06:
// « en mode intelligent, le partenaire ordinateur ne donne pas forcément systématiquement un as ou un
// roi s'il n'en a qu'un et qu'il faut qu'il sorte ses pions... Il doit pouvoir moduler ça en fonction de
// la stratégie. »
// Pur-sang and Champion (levels 4 and 5) weigh each card over the deal (dealGiveScores): what the bot's
// hand and its partner's imagined hand can do with and without it. Levels 2 and 3 keep the board give.

import {
  type CardId,
  type Color,
  FULL_DECK,
  type PawnSpec,
  type PlayerView,
  type Rng,
  rankOf,
  scenarioState,
  viewFor,
} from "@toc/engine";
import { describe, expect, it } from "vitest";
import { dealGiveScores, giveScores } from "./exchange.ts";
import type { BotLevel } from "./levels.ts";
import { chooseAction, chooseGive } from "./thinker.ts";

type Pawns = Partial<Record<Color, [PawnSpec, PawnSpec, PawnSpec, PawnSpec]>>;

const OPPONENT_A: CardId[] = ["2C", "3H", "5S", "8C", "10S", "12C", "6C"];
const OPPONENT_B: CardId[] = ["6H", "8D", "9H", "12S", "2D", "5D", "10D"];

/** bleu's view of the exchange; every seat holds as many cards as bleu; `partner` is rouge's hidden hand. */
function exchangeView(pawns: Pawns, hand: CardId[], partner: CardId[]): PlayerView {
  const size = hand.length;
  return viewFor(
    scenarioState(
      {
        pawns,
        hands: {
          bleu: hand,
          jaune: OPPONENT_A.slice(0, size),
          rouge: partner.slice(0, size),
          vert: OPPONENT_B.slice(0, size),
        },
        turn: "bleu",
        phase: "exchange",
      },
      [1, 2, 3, 4],
    ),
    "bleu",
  );
}

/** A partner hand of `size` cards without any exit card. */
const plainPartner = (size: number): CardId[] =>
  (["2H", "5H", "8H", "10H", "9C", "3S", "6S"] as CardId[]).slice(0, size);

/** The "rest of the hand": ordinary advancing cards, no exit card, no 4, 7 or Valet. */
const REST: CardId[] = ["9S", "6D", "3C", "8S", "10C", "12D"];

const STRONG: readonly BotLevel[] = [4, 5];
const isExit = (card: CardId): boolean => rankOf(card) === 1 || rankOf(card) === 13;

function giveOf(view: PlayerView, level: BotLevel, rng: Rng = [7, 11, 13, 17]): CardId {
  const thought = chooseAction(view, "bleu", level, rng);
  if (thought.action.t !== "give") throw new Error("expected a give");
  return thought.action.card;
}

const ALL_STABLE: [PawnSpec, PawnSpec, PawnSpec, PawnSpec] = ["S", "S", "S", "S"];
const TWO_OUT: [PawnSpec, PawnSpec, PawnSpec, PawnSpec] = [{ p: 10 }, { p: 30 }, "S", "S"];

describe("a lone exit card the bot needs is kept (Romain, 2026-11-06)", () => {
  for (const exit of ["1S", "13S"] as CardId[]) {
    for (let rest = 2; rest <= 6; rest++) {
      it(`${exit} with ${rest} other cards, own four in the stable, the partner with knights out`, () => {
        const hand = [exit, ...REST.slice(0, rest)];
        const view = exchangeView(
          { bleu: ALL_STABLE, rouge: TWO_OUT },
          hand,
          plainPartner(rest + 1),
        );
        for (const level of STRONG) {
          for (let s = 1; s <= 4; s++) {
            expect(giveOf(view, level, [s, s * 3, s * 5, s * 7])).not.toBe(exit);
          }
        }
      });
    }
  }

  for (const exit of ["1S", "13S"] as CardId[]) {
    it(`${exit} with 4 other cards at the start of the game (every knight in its stable)`, () => {
      const hand = [exit, ...REST.slice(0, 4)];
      const view = exchangeView({}, hand, plainPartner(5));
      for (const level of STRONG) {
        for (let s = 1; s <= 4; s++) {
          expect(giveOf(view, level, [s, s * 3, s * 5, s * 7])).not.toBe(exit);
        }
      }
    });
  }

  it("scores the lone exit card below the best other card", () => {
    const view = exchangeView(
      { bleu: ALL_STABLE, rouge: TWO_OUT },
      ["1S", "9S", "6D", "3C", "8S"],
      plainPartner(5),
    );
    const { scores } = dealGiveScores(view, "bleu", [5, 6, 7, 8]);
    const exit = scores.find((s) => s.card === "1S");
    const others = scores.filter((s) => s.card !== "1S").map((s) => s.score);
    expect(exit).toBeDefined();
    expect(Math.max(...others)).toBeGreaterThan(exit?.score ?? 0);
  });
});

describe("two exit cards: one may go", () => {
  it("own four and the partner's four in the stable: gives one exit card, keeps the other", () => {
    const hand: CardId[] = ["1S", "13D", "9S", "6D", "3C"];
    const view = exchangeView({}, hand, plainPartner(5));
    for (const level of STRONG) {
      for (let s = 1; s <= 4; s++) {
        expect(isExit(giveOf(view, level, [s, s * 3, s * 5, s * 7]))).toBe(true);
      }
    }
  });
});

describe("the As or the Roi still goes when it clearly helps", () => {
  for (const exit of ["1S", "13S"] as CardId[]) {
    it(`own knights out, the partner's four in the stable: gives the ${exit}`, () => {
      const hand: CardId[] = [exit, "9S", "6D", "3C"];
      const view = exchangeView({ bleu: TWO_OUT }, hand, plainPartner(4));
      for (const level of STRONG) {
        for (let s = 1; s <= 4; s++) {
          expect(giveOf(view, level, [s, s * 3, s * 5, s * 7])).toBe(exit);
        }
      }
    });
  }
});

describe("dealGiveScores reads the view only (D-10, BOT-04)", () => {
  const pawns: Pawns = { bleu: ALL_STABLE, rouge: TWO_OUT, jaune: [{ p: 20 }, "S", "S", "S"] };
  const hand: CardId[] = ["1S", "9S", "6D", "3C", "8S"];

  it("the partner's real hand never changes the scores or the give", () => {
    const base = exchangeView(pawns, hand, plainPartner(5));
    // Other partner hands drawn from the cards bleu cannot see, exit cards included.
    const seen = new Set<CardId>([...hand, ...OPPONENT_A.slice(0, 5), ...OPPONENT_B.slice(0, 5)]);
    const hidden = FULL_DECK.filter((card) => !seen.has(card));
    const partners: CardId[][] = [
      ["13H", "1D", "13C", "1H", "7D"],
      hidden.slice(0, 5),
      hidden.slice(-5),
      hidden.slice(10, 15),
    ];
    for (const partner of partners) {
      const view = exchangeView(pawns, hand, partner);
      expect(view).toEqual(base);
      for (let s = 1; s <= 3; s++) {
        const rng: Rng = [s, s * 3, s * 5, s * 7];
        expect(dealGiveScores(view, "bleu", rng)).toEqual(dealGiveScores(base, "bleu", rng));
        for (const level of [2, 3, 4, 5] as const) {
          expect(chooseAction(view, "bleu", level, rng)).toEqual(
            chooseAction(base, "bleu", level, rng),
          );
        }
      }
    }
  });

  it("the same view and rng give the same scores and rng; one score per rank, hand order", () => {
    const view = exchangeView(pawns, ["1S", "1D", "9S", "6D", "3C"], plainPartner(5));
    const a = dealGiveScores(view, "bleu", [9, 8, 7, 6]);
    const b = dealGiveScores(view, "bleu", [9, 8, 7, 6]);
    expect(b).toEqual(a);
    expect(a.scores.map((s) => s.card)).toEqual(["1S", "9S", "6D", "3C"]);
    expect(a.rng).not.toEqual([9, 8, 7, 6]);
    expect(a.units).toBeGreaterThan(0);
    for (const s of a.scores) expect(Number.isFinite(s.score)).toBe(true);
  });

  it("does not modify the view", () => {
    const view = exchangeView(pawns, hand, plainPartner(5));
    const copy = structuredClone(view);
    dealGiveScores(view, "bleu", [1, 2, 3, 4]);
    expect(view).toEqual(copy);
  });
});

describe("which levels weigh the deal", () => {
  const view = exchangeView(
    { bleu: ALL_STABLE, rouge: TWO_OUT },
    ["1S", "9S", "6D", "3C", "8S"],
    plainPartner(5),
  );

  it("levels 4 and 5 give through the deal, levels 2 and 3 through the board (D-09)", () => {
    for (let s = 1; s <= 5; s++) {
      const rng: Rng = [s, s * 3, s * 5, s * 7];
      for (const level of [2, 3] as const) {
        expect(chooseAction(view, "bleu", level, rng)).toEqual(
          chooseGive(view, "bleu", level, rng, "board"),
        );
      }
      for (const level of STRONG) {
        expect(chooseAction(view, "bleu", level, rng)).toEqual(
          chooseGive(view, "bleu", level, rng, "deal"),
        );
      }
    }
  });

  it("the board give is unchanged: giveScores still tops the As here, as before", () => {
    const top = [...giveScores(view, "bleu")].sort((a, b) => b.score - a.score)[0];
    expect(top?.card).toBe("9S");
    const start = exchangeView({}, ["1S", "9S", "6D", "3C", "8S"], plainPartner(5));
    const first = [...giveScores(start, "bleu")].sort((a, b) => b.score - a.score)[0];
    expect(first?.card).toBe("1S");
  });
});
