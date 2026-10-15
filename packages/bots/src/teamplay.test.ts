// The team play of levels 2 to 5 (D-08, D-09, BOT-03) on fixed positions: the best-scored move is the
// capture, the escape of a threatened knight, the exact entry into the home and the 4 backward from just
// past the exit; eating the partner is never preferred; a finished seat advances its partner's knights
// (R-15); the exchange card helps the partner, judged on the board and the bot's own hand only (D-10);
// and the levels 2 to 4 miss a clearly best move less and less often (D-05).

import {
  ALL_PAWNS,
  type CardId,
  type Color,
  type PawnSpec,
  type PlayerView,
  pawnColor,
  type Rng,
  scenarioState,
  teamOf,
  viewFor,
} from "@toc/engine";
import { describe, expect, it } from "vitest";
import { evaluate, handBonus, knightValue, scoreCandidates } from "./evaluate.ts";
import { giveScores } from "./exchange.ts";
import type { BotLevel } from "./levels.ts";
import { chooseAction } from "./thinker.ts";

type Pawns = Partial<Record<Color, [PawnSpec, PawnSpec, PawnSpec, PawnSpec]>>;

/** bleu's view of a play-phase position, bleu to play. */
function playView(pawns: Pawns, hand: CardId[]): PlayerView {
  return viewFor(
    scenarioState({ pawns, hands: { bleu: hand, jaune: ["9S"] }, turn: "bleu" }, [1, 2, 3, 4]),
    "bleu",
  );
}

/** bleu's view of an exchange-phase position; `partnerHand` is rouge's hidden hand. */
function exchangeView(pawns: Pawns, hand: CardId[], partnerHand: CardId[]): PlayerView {
  return viewFor(
    scenarioState(
      {
        pawns,
        hands: {
          bleu: hand,
          jaune: ["2C", "3H", "5S", "8C"],
          rouge: partnerHand,
          vert: ["6H", "8D", "9H", "12S"],
        },
        turn: "bleu",
        phase: "exchange",
      },
      [1, 2, 3, 4],
    ),
    "bleu",
  );
}

const best = (view: PlayerView) => scoreCandidates(view, "bleu")[0];

describe("scoreCandidates (the team evaluation, D-08)", () => {
  it("lists every candidate once, best first", () => {
    const scored = scoreCandidates(
      playView({ bleu: [{ p: 5 }, { p: 30 }, "S", "S"] }, ["5H", "2S"]),
      "bleu",
    );
    expect(scored.length).toBe(4);
    for (let i = 1; i < scored.length; i++) {
      expect((scored[i - 1] as { score: number }).score).toBeGreaterThanOrEqual(
        (scored[i] as { score: number }).score,
      );
    }
  });

  it("manger: of two moves of the same length, the one that lands on an opponent comes first", () => {
    // bleu0 at cell 5, bleu1 at cell 30; jaune0 at cell 10 (jaune progress 64). The 5 eats it from bleu0.
    const view = playView(
      { bleu: [{ p: 5 }, { p: 30 }, "S", "S"], jaune: [{ p: 64 }, "S", "S", "S"] },
      ["5H"],
    );
    expect(best(view)?.action).toEqual({ t: "move", card: "5H", pawn: "bleu0" });
    expect(best(view)?.captured).toEqual(["jaune0"]);
  });

  it("se protéger: the Dame takes the threatened knight out of reach rather than the safe one", () => {
    // bleu0 at cell 25 with jaune0 three cells behind it (cell 22); bleu1 at cell 45, nobody behind.
    // The Dame puts bleu0 15 cells ahead of jaune0, out of reach; on bleu1 it leaves bleu0 exposed.
    const view = playView(
      { bleu: [{ p: 25 }, { p: 45 }, "S", "S"], jaune: [{ p: 4 }, "S", "S", "S"] },
      ["12H"],
    );
    const scored = scoreCandidates(view, "bleu");
    expect(scored.map((s) => s.action)).toEqual([
      { t: "move", card: "12H", pawn: "bleu0" },
      { t: "move", card: "12H", pawn: "bleu1" },
    ]);
    expect((scored[0]?.score ?? 0) - (scored[1]?.score ?? 0)).toBeGreaterThan(0);
  });

  it("rentrer: the exact count into an empty home slot beats an advance elsewhere", () => {
    // bleu0 three steps before its carré 16 (progress 67): the 5 enters it in slot 1.
    const view = playView({ bleu: [{ p: 67 }, { p: 20 }, "S", "S"] }, ["5H"]);
    const top = best(view);
    expect(top?.action).toEqual({ t: "move", card: "5H", pawn: "bleu0" });
    expect(top?.pawns.bleu0).toEqual({ zone: "home", slot: 1 });
  });

  it("the trick of the 4: backing 4 from just past the exit beats a 2 elsewhere", () => {
    // bleu0 one cell past its exit: the 4 backward leaves it 1 step from its carré 16 (G14).
    const view = playView({ bleu: [{ p: 1 }, { p: 30 }, "S", "S"] }, ["4H", "2S"]);
    const top = best(view);
    expect(top?.action).toEqual({ t: "move", card: "4H", pawn: "bleu0" });
    expect(top?.pawns.bleu0).toEqual({ zone: "ring", progress: -3 });
  });

  it("aider le partenaire: a move that eats the partner's knight is never ranked first", () => {
    // bleu0 at cell 5; rouge0 (the partner) at cell 8, then at cell 14.
    const cases: { rouge: number; hand: CardId[]; eats: CardId }[] = [
      { rouge: 44, hand: ["3H", "2S"], eats: "3H" },
      { rouge: 50, hand: ["9H", "2S"], eats: "9H" },
      { rouge: 50, hand: ["9H", "2S", "5D"], eats: "9H" },
    ];
    for (const { rouge, hand, eats } of cases) {
      const view = playView(
        { bleu: [{ p: 5 }, "S", "S", "S"], rouge: [{ p: rouge }, "S", "S", "S"] },
        hand,
      );
      const scored = scoreCandidates(view, "bleu");
      expect(scored.some((s) => s.captured.includes("rouge0"))).toBe(true);
      expect(scored[0]?.captured).toEqual([]);
      expect(scored[0]?.action).not.toMatchObject({ card: eats });
    }
  });

  it("R-15: a seat whose four knights are home advances its partner's knights", () => {
    const view = playView(
      {
        bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
        rouge: [{ p: 10 }, { p: 30 }, "S", "S"],
      },
      ["5S"],
    );
    const top = best(view);
    expect(top?.action).toMatchObject({ t: "move", card: "5S" });
    expect(top?.action.t === "move" && top.action.pawn.startsWith("rouge")).toBe(true);
    for (const level of [2, 3, 4, 5] as const) {
      const thought = chooseAction(view, "bleu", level, [1, 2, 3, 4]);
      expect(thought.action.t === "move" && thought.action.pawn.startsWith("rouge")).toBe(true);
    }
  });
});

describe("the risk and hand terms", () => {
  it("a knight protected on its own exit carries no risk, an exposed one does", () => {
    const rules = playView({}, ["2S"]).rules;
    /** The board without any risk: own and partner knights minus the opponents'. */
    const plain = (view: PlayerView) =>
      ALL_PAWNS.reduce(
        (sum, id) =>
          sum + (teamOf(pawnColor(id)) === "bleu-rouge" ? 1 : -1) * knightValue(id, view.pawns[id]),
        0,
      );
    // bleu0 at cell 25 with jaune0 three cells behind it: exposed.
    const exposed = playView(
      { bleu: [{ p: 25 }, "S", "S", "S"], jaune: [{ p: 4 }, "S", "S", "S"] },
      ["2S"],
    );
    expect(evaluate(exposed.pawns, rules, "bleu-rouge")).toBeLessThan(plain(exposed));
    // bleu0 on its own exit with jaune0 three cells behind it: protected, no risk.
    const guarded = playView(
      { bleu: [{ p: 0 }, "S", "S", "S"], jaune: [{ p: 51 }, "S", "S", "S"] },
      ["2S"],
    );
    expect(evaluate(guarded.pawns, rules, "bleu-rouge")).toBeCloseTo(plain(guarded));
    // An opponent knight exactly 4 cells ahead (here protected on its own exit) threatens with the 4.
    const ahead = playView({ bleu: [{ p: 14 }, "S", "S", "S"], jaune: [{ p: 0 }, "S", "S", "S"] }, [
      "2S",
    ]);
    expect(evaluate(ahead.pawns, rules, "bleu-rouge")).toBeLessThan(plain(ahead));
    // On an opponent's exit while that opponent has knights in its stable: the As and the Roi eat.
    const onExit = playView({ bleu: [{ p: 18 }, "S", "S", "S"] }, ["2S"]);
    expect(evaluate(onExit.pawns, rules, "bleu-rouge")).toBeLessThan(plain(onExit));
  });

  it("keeps an As or a Roi while knights wait in the stable, and a 4 for the trick", () => {
    const view = playView({ bleu: [{ p: 1 }, "S", "S", "S"] }, ["2S"]);
    expect(handBonus(["1S"], view.pawns, "bleu")).toBeGreaterThan(0);
    expect(handBonus(["13S"], view.pawns, "bleu")).toBeGreaterThan(0);
    expect(handBonus(["4S"], view.pawns, "bleu")).toBeGreaterThan(0);
    expect(handBonus(["9S"], view.pawns, "bleu")).toBe(0);
    const out = playView({ bleu: [{ p: 30 }, { p: 40 }, { p: 50 }, { p: 60 }] }, ["2S"]);
    expect(handBonus(["1S", "13S", "4S"], out.pawns, "bleu")).toBe(0);
  });
});

describe("the exchange card (D-09)", () => {
  const giveOf = (view: PlayerView, level: BotLevel) =>
    chooseAction(view, "bleu", level, [7, 7, 7, 7]).action;

  it("gives the As to a partner whose knights all wait in the stable", () => {
    const pawns: Pawns = { bleu: [{ p: 10 }, { p: 30 }, "S", "S"] };
    const view = exchangeView(pawns, ["1S", "9S", "6D", "3C"], ["2H", "5H", "8H", "10H"]);
    const scores = giveScores(view, "bleu");
    expect(scores.map((s) => s.card)).toEqual(["1S", "9S", "6D", "3C"]);
    const top = [...scores].sort((a, b) => b.score - a.score)[0];
    expect(top?.card).toBe("1S");
    expect(giveOf(view, 5)).toEqual({ t: "give", card: "1S" });
  });

  it("gives the Roi in the same position when it holds no As", () => {
    const view = exchangeView(
      { bleu: [{ p: 10 }, { p: 30 }, "S", "S"] },
      ["13S", "9S", "6D", "3C"],
      ["2H", "5H", "8H", "10H"],
    );
    expect(giveOf(view, 5)).toEqual({ t: "give", card: "13S" });
  });

  it("gives the 4 to a partner whose knight sits just past its exit", () => {
    const view = exchangeView(
      { bleu: [{ p: 10 }, { p: 30 }, "S", "S"], rouge: [{ p: 1 }, "S", "S", "S"] },
      ["4H", "6S", "9D", "10C"],
      ["2H", "5H", "8H", "12H"],
    );
    expect(giveOf(view, 5)).toEqual({ t: "give", card: "4H" });
  });

  it("gives the same card whatever the partner's hidden hand (same view, D-10)", () => {
    const pawns: Pawns = {
      bleu: [{ p: 10 }, { p: 30 }, "S", "S"],
      rouge: [{ p: 1 }, "S", "S", "S"],
    };
    const hand: CardId[] = ["4H", "6S", "9D", "10C"];
    const a = exchangeView(pawns, hand, ["2H", "5H", "8H", "12H"]);
    const b = exchangeView(pawns, hand, ["1D", "13D", "7D", "4D"]);
    expect(b).toEqual(a);
    expect(giveScores(b, "bleu")).toEqual(giveScores(a, "bleu"));
    for (const level of [2, 3, 4, 5] as const) {
      for (let s = 1; s <= 5; s++) {
        const rng: Rng = [s, s * 3, s * 5, s * 7];
        expect(chooseAction(b, "bleu", level, rng)).toEqual(chooseAction(a, "bleu", level, rng));
      }
    }
  });

  it("levels 2 to 4 pick the give through their noise, always among the hand", () => {
    const view = exchangeView(
      { bleu: [{ p: 10 }, { p: 30 }, "S", "S"] },
      ["1S", "9S", "6D", "3C"],
      ["2H", "5H", "8H", "10H"],
    );
    const seen = new Set<string>();
    let rng: Rng = [3, 1, 4, 1];
    for (let i = 0; i < 100; i++) {
      const thought = chooseAction(view, "bleu", 2, rng);
      rng = thought.rng;
      expect(thought.action.t).toBe("give");
      if (thought.action.t === "give") seen.add(thought.action.card);
    }
    expect(seen.size).toBeGreaterThan(1);
    for (const card of seen) expect(["1S", "9S", "6D", "3C"]).toContain(card);
  });
});

describe("fewer and fewer mistakes (D-05)", () => {
  it("over 200 draws the clearly best move is found more often from level 2 to level 4", () => {
    // The 5 eats jaune0 from bleu0; every other candidate is a plain advance.
    const view = playView(
      { bleu: [{ p: 5 }, { p: 30 }, { p: 50 }, "S"], jaune: [{ p: 64 }, "S", "S", "S"] },
      ["5H", "2S", "3D"],
    );
    const scored = scoreCandidates(view, "bleu");
    const top = scored[0];
    expect((top?.score ?? 0) - (scored[1]?.score ?? 0)).toBeGreaterThanOrEqual(30);
    const frequency = (level: BotLevel): number => {
      let hits = 0;
      let rng: Rng = [42, 43, 44, 45];
      for (let i = 0; i < 200; i++) {
        const thought = chooseAction(view, "bleu", level, rng);
        rng = thought.rng;
        if (JSON.stringify(thought.action) === JSON.stringify(top?.action)) hits++;
      }
      return hits / 200;
    };
    const [two, three, four] = [frequency(2), frequency(3), frequency(4)];
    expect(four).toBeGreaterThanOrEqual(three);
    expect(three).toBeGreaterThanOrEqual(two);
    expect(two).toBeLessThan(1);
    expect(two).toBeGreaterThan(1 / scored.length);
  });
});
