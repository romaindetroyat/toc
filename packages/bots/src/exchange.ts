// The exchange card, judged on public information only (D-10). Two ways, chosen by level (levels.ts
// GIVE_METHOD):
//
// The board give (D-09, 03-RESEARCH Pattern 7; levels 2 and 3). For each card in hand (one per rank:
// two cards of a rank are worth the same), the score is
//   partnerGain − GIVE_OWN_LOSS × ownLoss
// where partnerGain is the best evaluation gain among the partner's moves of that card on the current
// board (movesForCard for PARTNER[seat], sevenOutcomes for a 7) and ownLoss the same for the bot itself.
// A card with no move gains nothing. movesForCard follows controlledPawns, so a partner who has finished
// is credited with moving the bot's own knights (R-15).
//
// The deal give (plan 04-15, Pur-sang and Champion). Romain, 2026-11-06: « en mode intelligent, le
// partenaire ordinateur ne donne pas forcément systématiquement un as ou un roi s'il n'en a qu'un et
// qu'il faut qu'il sorte ses pions... Il doit pouvoir moduler ça en fonction de la stratégie. » The board
// give sees one move: it cannot tell that a lone As unlocks the bot's whole deal, that the partner may
// already hold one, or what a card does for the rest of the hand. The deal give scores a card by what
// the two hands can do over the deal:
// - the partner's hand is imagined DEAL_HANDS times from the cards the bot cannot see (knowledge.ts
//   unknownCards, shuffled with the bot's own rng), in strata: by how many exit cards (As, Roi) it holds,
//   0, 1 or 2 and more, and whether the card it passes back is one of them, each stratum weighted by its
//   exact chance (hypergeometric, then k / size) and given its share of the hands; the bot knows
//   nothing of the partner's choice, so the passed card is any card of the imagined hand;
// - for each card c and each imagined hand, the bot's hand after the exchange (its cards less c, plus
//   the passed card) and the partner's (its imagined cards less the passed one, plus c) are each played
//   out alone on the current board (playOut): one card per turn, the best evaluate + handBonus of the
//   cards kept, the engine's movesForCard and, for the 7, one knight walking the whole 7 (applyPlan);
//   a hand with no legal move is laid down (R-14), the rest of it lost;
// - the score of c is the weighted mean, over the imagined hands, of the two play-outs' team gains.
// A lone As or Roi with four knights in the stable is the bot's whole deal: given away, its other cards
// are laid down. The same card gives the partner much only when its imagined hands lack one.
// The play-outs ignore the other seats' moves: they value hands, they never decide a move. Every
// legality decision is the engine's. The partner's real hand is never read.
// Pure, no I/O, erasable syntax only.

import {
  applyPlan,
  type Board,
  type CardId,
  COLORS,
  type Color,
  controlledPawns,
  movesForCard,
  PARTNER,
  type Pawn,
  type PawnId,
  type PlayerView,
  type Rng,
  type RuleSet,
  rankOf,
  resolveCandidate,
  resolveMove,
  sevenOutcomes,
  shuffle,
  type Team,
  teamOf,
} from "@toc/engine";
import { pawnsKey } from "./candidates.ts";
import { evaluate, handBonus } from "./evaluate.ts";
import { hiddenCounts, unknownCards } from "./knowledge.ts";

/** How much the bot's own use of a card weighs against the partner's (λ, the board give). */
export const GIVE_OWN_LOSS = 0.6;

export type GiveScore = { card: CardId; score: number };

/** The best evaluation gain for `team` among the moves of `card` by `mover` on `board`; 0 without any. */
function bestGain(board: Board, mover: Color, card: CardId, team: Team): number {
  const base = evaluate(board.pawns, board.rules, team);
  let best: number | null = null;
  if (rankOf(card) === 7) {
    for (const outcome of sevenOutcomes(board, mover, card)) {
      const gain = evaluate(outcome.pawns, board.rules, team) - base;
      if (best === null || gain > best) best = gain;
    }
  } else {
    for (const candidate of movesForCard(board, mover, card)) {
      const { pawns } = resolveMove(board, mover, candidate.action);
      const gain = evaluate(pawns, board.rules, team) - base;
      if (best === null || gain > best) best = gain;
    }
  }
  return best ?? 0;
}

/** The first card of each rank, in hand order, with its index. */
function firstOfEachRank(hand: readonly CardId[]): { card: CardId; index: number }[] {
  const ranks = new Set<number>();
  const out: { card: CardId; index: number }[] = [];
  hand.forEach((card, index) => {
    const rank = rankOf(card);
    if (ranks.has(rank)) return;
    ranks.add(rank);
    out.push({ card, index });
  });
  return out;
}

/**
 * The board give (levels 2 and 3): the score of each card `seat` may give, in hand order, the first card
 * of each rank only. Reads the view's board and hand, nothing else.
 */
export function giveScores(view: PlayerView, seat: Color): GiveScore[] {
  const team = teamOf(seat);
  const board: Board = { pawns: view.pawns, rules: view.rules };
  return firstOfEachRank(view.hand).map(({ card }) => {
    const partnerGain = bestGain(board, PARTNER[seat], card, team);
    const ownLoss = bestGain(board, seat, card, team);
    return { card, score: partnerGain - GIVE_OWN_LOSS * ownLoss };
  });
}

/**
 * Imagined partner hands of one deal give, shared out among the strata by weight (at least one each).
 * The strata answer the question Romain raised (does the partner already hold an exit card? does it
 * pass one back?) by exact weights, not by the luck of a few draws; the hands only average out the
 * other cards. Calibrated on 2026-11-06 (plan 04-15, 04-15-SUMMARY), `node tools/bench-bots.mjs
 * --exchange --level 5` on the 40 exchange decisions, this machine (level-4 play decision for scale:
 * p95 11.8 ms, max 18.1 ms; the old board give: p95 3.3 ms, max 24.7 ms):
 * - 8 hands: p95 7.3 ms, max 10.7 ms; 16 hands: p95 9.4 ms, max 15.5 ms; 24 hands: p95 12.4 to
 *   15.0 ms, max 17.3 ms; 32 hands: p95 15.5 to 17.9 ms, max 32.5 ms;
 * - the lone exit card at the start of the game (exchange.test.ts), 200 seeds, level 5: the As kept
 *   196 times and the Roi 193 at 16 hands (margin 12, spread 6.3), 200 and 199 at 24; every case with
 *   a wider margin kept or given 50 times out of 50 at 16.
 * 16 keeps the give inside the cost of a level-4 play decision, decided in one alarm tick online.
 */
export const DEAL_HANDS = 16;

export type DealGives = {
  /** One score per rank, first card of each rank in hand order, like giveScores. */
  scores: GiveScore[];
  /** The rng after the imagined hands were drawn. */
  rng: Rng;
  /** Boards expanded by the play-outs (a rank's moves from a board, computed once): the work. */
  units: number;
};

/** The ranks of a hand as a key: two hands with the same ranks play out the same. */
function ranksKey(hand: readonly CardId[]): string {
  return hand
    .map(rankOf)
    .sort((a, b) => a - b)
    .join(",");
}

const isExitCard = (card: CardId): boolean => rankOf(card) === 1 || rankOf(card) === 13;

/**
 * A board met in the play-outs of one decision: its evaluation for the bot's team, the boards each
 * mover's rank leads to from it (computed once), and the end of each play-out already run from it (the
 * greedy play-out depends only on the board, the mover and the ranks left, so every play-out that
 * reaches this board with the same cards left ends the same way).
 */
type Node = {
  pawns: Record<PawnId, Pawn>;
  value: number;
  next: Map<number, Node[]>;
  ends: Map<string, Node>;
};

/** The boards of a card other than the 7, one per candidate in the engine's order. */
function movesAfter(board: Board, mover: Color, card: CardId): Record<PawnId, Pawn>[] {
  return movesForCard(board, mover, card).map(
    (candidate) => resolveCandidate(board, candidate).pawns,
  );
}

/**
 * The 7 of a play-out: one controlled knight walks the whole 7, each plan checked by the engine's
 * applyPlan (G15, G16 included). A play-out values a hand; the splits of the 7 are the play decision's
 * (sevenOutcomes, candidates.ts), and enumerating them on every board met would cost a hard 7 per turn.
 */
function sevenAlone(board: Board, mover: Color, card: CardId): Record<PawnId, Pawn>[] {
  const out: Record<PawnId, Pawn>[] = [];
  for (const pawn of controlledPawns(board, mover)) {
    if (board.pawns[pawn].zone !== "ring") continue;
    const result = applyPlan(board, mover, card, [{ pawn, steps: 7 }]);
    if (result.ok) out.push(result.pawns);
  }
  return out;
}

/** The boards of one decision's play-outs, each evaluated once (pawnsKey). */
type Boards = {
  node(pawns: Record<PawnId, Pawn>): Node;
  after(from: Node, mover: Color, card: CardId): Node[];
  /** Board expansions so far: the work of the decision. */
  expanded(): number;
};

function newBoards(rules: RuleSet, team: Team): Boards {
  const nodes = new Map<string, Node>();
  let expansions = 0;
  const node = (pawns: Record<PawnId, Pawn>): Node => {
    const key = pawnsKey(pawns);
    let found = nodes.get(key);
    if (found === undefined) {
      found = { pawns, value: evaluate(pawns, rules, team), next: new Map(), ends: new Map() };
      nodes.set(key, found);
    }
    return found;
  };
  const after = (from: Node, mover: Color, card: CardId): Node[] => {
    const rank = rankOf(card);
    const key = COLORS.indexOf(mover) * 16 + rank;
    let found = from.next.get(key);
    if (found === undefined) {
      expansions++;
      const board: Board = { pawns: from.pawns, rules };
      const boards = rank === 7 ? sevenAlone(board, mover, card) : movesAfter(board, mover, card);
      found = boards.map(node);
      from.next.set(key, found);
    }
    return found;
  };
  return { node, after, expanded: () => expansions };
}

/**
 * `mover` plays `cards` (sorted by rank) alone from `at`, one card per turn, each turn the move with
 * the best evaluate + handBonus of the cards kept (ties to the lower rank, then the engine's order),
 * until the hand is played or has no legal move (laid down, R-14). Returns the last board.
 */
function playOut(boards: Boards, at: Node, mover: Color, cards: readonly CardId[]): Node {
  if (cards.length === 0) return at;
  const key = `${mover}|${ranksKey(cards)}`;
  const known = at.ends.get(key);
  if (known !== undefined) return known;
  let best: { score: number; node: Node; index: number } | null = null;
  for (const { card, index } of firstOfEachRank(cards)) {
    const kept = [...cards.slice(0, index), ...cards.slice(index + 1)];
    for (const node of boards.after(at, mover, card)) {
      const score = node.value + handBonus(kept, node.pawns, mover);
      if (best === null || score > best.score) best = { score, node, index };
    }
  }
  const end =
    best === null
      ? at
      : playOut(boards, best.node, mover, [
          ...cards.slice(0, best.index),
          ...cards.slice(best.index + 1),
        ]);
  at.ends.set(key, end);
  return end;
}

/** The number of ways to choose `k` among `n` (as a float; 0 outside 0 ≤ k ≤ n). */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let out = 1;
  for (let i = 1; i <= k; i++) out = (out * (n - k + i)) / i;
  return out;
}

/** One stratum of the partner's imagined hand: its exit cards, whether it passes one, its weight. */
type Stratum = { exits: number; passesExit: boolean; weight: number };

/**
 * The strata of the partner's imagined hand of `size` cards drawn from `exits` exit cards and `plain`
 * other cards: by the exit cards it holds (0, 1, and 2 standing for 2 or more), each weighted by its
 * hypergeometric chance, then by whether the card it passes back is one of them (k / size, the passed
 * card being any of its cards). Impossible strata are left out; the weights sum to 1.
 */
function strata(size: number, exits: number, plain: number): Stratum[] {
  const total = choose(exits + plain, size);
  if (size === 0 || total === 0) return [{ exits: 0, passesExit: false, weight: 1 }];
  const p0 = choose(plain, size) / total;
  const p1 = (exits * choose(plain, size - 1)) / total;
  const byCount: [number, number][] = [
    [0, p0],
    [1, p1],
  ];
  if (exits >= 2 && size >= 2 && plain >= size - 2) byCount.push([2, Math.max(0, 1 - p0 - p1)]);
  const out: Stratum[] = [];
  for (const [k, p] of byCount) {
    if (p <= 0 || k > exits || size - k > plain) continue;
    if (k > 0) out.push({ exits: k, passesExit: true, weight: (p * k) / size });
    if (k < size) out.push({ exits: k, passesExit: false, weight: (p * (size - k)) / size });
  }
  const sum = out.reduce((acc, stratum) => acc + stratum.weight, 0);
  return out.map((stratum) => ({ ...stratum, weight: stratum.weight / sum }));
}

/**
 * The deal give (levels 4 and 5): the score of each card `seat` may give, in hand order, the first card
 * of each rank only, with the rng after the imagined partner hands and the play-outs computed. Reads the
 * view only; the same view and rng give the same result. Neither is modified.
 */
export function dealGiveScores(
  view: PlayerView,
  seat: Color,
  rng: Rng,
  hands: number = DEAL_HANDS,
): DealGives {
  const team = teamOf(seat);
  const partner = PARTNER[seat];
  const budget = Math.max(1, Math.floor(hands));
  const pool = unknownCards(view);
  const exits = pool.filter(isExitCard);
  const plain = pool.filter((card) => !isExitCard(card));
  const size = Math.min(hiddenCounts(view).hands[partner], pool.length);
  const gives = firstOfEachRank(view.hand);
  const sums = gives.map(() => 0);
  const boards = newBoards(view.rules, team);
  const start = boards.node(view.pawns);
  const value = (mover: Color, hand: readonly CardId[]): number => {
    const sorted = [...hand].sort((x, y) => rankOf(x) - rankOf(y));
    return playOut(boards, start, mover, sorted).value - start.value;
  };

  let r: Rng = [rng[0], rng[1], rng[2], rng[3]];
  // Cards are dealt from one shuffled pile per kind and stratum, in consecutive runs, the pile shuffled
  // again when it runs out: over a stratum's hands every rank comes up about as often as it lies among
  // the unseen cards (a 4, which makes an As worth a home entry, is neither missed nor doubled by luck).
  const pile = (cards: readonly CardId[]): ((n: number) => CardId[]) => {
    let left: CardId[] = [];
    return (n) => {
      if (left.length < n) {
        let fresh: CardId[];
        [fresh, r] = shuffle(cards, r);
        left = [...left, ...fresh];
      }
      const out = left.slice(0, n);
      left = left.slice(n);
      return out;
    };
  };
  for (const { exits: count, passesExit, weight } of strata(size, exits.length, plain.length)) {
    // The hands are shared out by weight, at least one per stratum.
    const draws = Math.max(1, Math.round(budget * weight));
    const takeExits = pile(exits);
    const takePlain = pile(plain);
    for (let d = 0; d < draws; d++) {
      const held = takeExits(count);
      const others = takePlain(size - count);
      // The passed card: the first held exit card or the first other card, by the stratum (each run is
      // in random order, so it is any of them).
      const passed = passesExit ? held[0] : others[0];
      const partnerKeeps = passesExit
        ? [...held.slice(1), ...others]
        : [...held, ...others.slice(1)];
      gives.forEach(({ card, index }, g) => {
        const own = [...view.hand.slice(0, index), ...view.hand.slice(index + 1)];
        if (passed !== undefined) own.push(passed);
        const both = value(seat, own) + value(partner, [...partnerKeeps, card]);
        sums[g] = (sums[g] as number) + (weight * both) / draws;
      });
    }
  }
  return {
    scores: gives.map(({ card }, g) => ({ card, score: sums[g] as number })),
    rng: r,
    units: boards.expanded(),
  };
}
