// Engine invariants over random games (fast-check, fixed seeds). Every seat of every game is driven by the
// level-1 bot, which sees only its own view. After every action: the 52 cards are all accounted for, no two
// pawns share a cell, legal actions apply, mutated actions are refused, the 7 generator and the 7 validator
// agree, deals end, and the same seed and actions give the same JSON.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { randomLegal } from "../../../bots/src/index.ts";
import {
  type Action,
  ALL_PAWNS,
  apply,
  applyPlan,
  type CardId,
  COLORS,
  type Color,
  FULL_DECK,
  type GameState,
  IllegalActionError,
  legalActions,
  newGame,
  next,
  normalizePlan,
  PARTNER,
  type PawnId,
  RING,
  type Rng,
  rankOf,
  ringIndex,
  type SevenPlan,
  sevenPlans,
  viewFor,
} from "../../src/index.ts";

const GAMES = 200;
const ACTION_CAP = 5000;
const DEAL_CAP = 60;
const SAMPLE_EVERY = 5;

/** The seat that must act: the first seat that has not chosen its exchange card, else the seat to play. */
function actingSeat(state: GameState): Color {
  if (state.phase === "exchange") {
    return COLORS.find((color) => state.given[color] === null) ?? state.turn;
  }
  return state.turn;
}

/** Counts of what the properties exercised, to prove they were not vacuous. */
const seen = {
  steps: 0,
  legalApplied: 0,
  mutationsRefused: 0,
  sevenBoards: 0,
  sevenPlansChecked: 0,
  botSevens: 0,
  wins: 0,
};

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/** RULE-02: every card of the deck is in exactly one of talon, hands, discard, posed. */
function checkCards(state: GameState): void {
  const all: CardId[] = [
    ...state.talon,
    ...state.discard,
    ...COLORS.flatMap((c) => state.hands[c]),
    ...COLORS.flatMap((c) => state.posed[c]),
  ];
  check(all.length === 52, `${all.length} cards instead of 52`);
  check(new Set(all).size === 52, "a card appears twice");
  for (const card of FULL_DECK) check(all.includes(card), `card ${card} is missing`);
}

/** At most one pawn per ring cell and per home slot of a colour. */
function checkPawns(state: GameState): void {
  const cells = new Set<number>();
  const slots = new Set<string>();
  for (const id of ALL_PAWNS) {
    const pawn = state.pawns[id];
    const color = id.slice(0, -1) as Color;
    if (pawn.zone === "ring") {
      const cell = ringIndex(color, pawn.progress);
      check(cell >= 0 && cell < RING, `${id} off the ring`);
      check(!cells.has(cell), `two pawns on ring cell ${cell}`);
      cells.add(cell);
    } else if (pawn.zone === "home") {
      const key = `${color}${pawn.slot}`;
      check(!slots.has(key), `two pawns in home slot ${key}`);
      slots.add(key);
    }
  }
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function refused(state: GameState, seat: Color, action: Action): boolean {
  try {
    apply(state, seat, action);
  } catch (error) {
    if (error instanceof IllegalActionError) return true;
    throw error;
  }
  return false;
}

/** Actions that must be refused, derived from the legal action the bot played. */
function mutations(state: GameState, seat: Color, action: Action, pick: (n: number) => number) {
  const out: Action[] = [];
  const foreign = COLORS.filter((c) => c !== seat).flatMap((c) => state.hands[c]);
  const notHeld = foreign.find((card) => !state.hands[seat].includes(card));
  if (action.t === "discard") return out;
  if (notHeld !== undefined) out.push({ ...action, card: notHeld });
  if (action.t === "give") return out;
  if (state.phase === "play") out.push({ t: "discard" });

  if (action.t === "seven") {
    const plan = action.plan.map((entry) => ({ ...entry }));
    const last = plan[plan.length - 1];
    if (last !== undefined) {
      // steps summing to 8
      out.push({
        ...action,
        plan: [...plan.slice(0, -1), { pawn: last.pawn, steps: last.steps + 1 }],
      });
      // steps summing to 6 (drop the last entry when it is a single step)
      out.push({
        ...action,
        plan:
          last.steps > 1
            ? [...plan.slice(0, -1), { pawn: last.pawn, steps: last.steps - 1 }]
            : plan.slice(0, -1),
      });
    }
    // a pawn of another team
    const foe = ALL_PAWNS.find(
      (id) => id.slice(0, -1) !== seat && id.slice(0, -1) !== PARTNER[seat],
    );
    if (foe !== undefined && plan[0] !== undefined) {
      out.push({ ...action, plan: [{ pawn: foe, steps: 7 }] });
    }
    return out;
  }

  // wrong pawn: any pawn the legal moves of this card do not offer
  const legal = legalActions(state, seat, { sevenPlans: "none" }).filter(
    (a) => a.t === action.t && "card" in a && a.card === action.card,
  );
  if (action.t === "exit" || action.t === "move") {
    const offered = new Set(legal.map((a) => (a.t === "exit" || a.t === "move" ? a.pawn : null)));
    const others = ALL_PAWNS.filter((id) => !offered.has(id));
    if (others.length > 0) out.push({ ...action, pawn: others[pick(others.length)] as PawnId });
  } else if (action.t === "swap") {
    const offered = new Set(legal.map((a) => (a.t === "swap" ? `${a.pawn}>${a.target}` : "")));
    const pairs = ALL_PAWNS.flatMap((p) => ALL_PAWNS.map((t) => ({ p, t }))).filter(
      ({ p, t }) => p !== t && !offered.has(`${p}>${t}`),
    );
    const bad = pairs[pick(pairs.length)];
    if (bad !== undefined) out.push({ ...action, pawn: bad.p, target: bad.t });
  }
  return out;
}

/** Every composition of 7 into ordered parts, as lists of step counts. */
function compositions(total: number): number[][] {
  if (total === 0) return [[]];
  const out: number[][] = [];
  for (let first = 1; first <= total; first++) {
    for (const rest of compositions(total - first)) out.push([first, ...rest]);
  }
  return out;
}
const COMPOSITIONS_OF_7 = compositions(7);

/**
 * With at most 3 pawns that can move (own and partner's, off the stable), enumerate every merged plan over
 * them and compare with sevenPlans: the generator and the validator agree.
 */
function checkSevenAgreement(state: GameState, seat: Color, card: CardId): boolean {
  const candidates = ALL_PAWNS.filter((id) => {
    const color = id.slice(0, -1) as Color;
    return (color === seat || color === PARTNER[seat]) && state.pawns[id].zone !== "stable";
  });
  if (candidates.length > 3) return false;
  const listed = new Set(sevenPlans(state, seat, card).map((plan) => JSON.stringify(plan)));
  let accepted = 0;
  for (const parts of COMPOSITIONS_OF_7) {
    // every assignment of a candidate pawn to each part
    const total = candidates.length ** parts.length;
    for (let code = 0; code < total; code++) {
      let rest = code;
      const plan: SevenPlan = parts.map((steps) => {
        const pawn = candidates[rest % candidates.length] as PawnId;
        rest = Math.floor(rest / candidates.length);
        return { pawn, steps };
      });
      const merged = normalizePlan(plan);
      const ok = applyPlan(state, seat, card, plan).ok;
      const inList = listed.has(JSON.stringify(merged));
      check(ok === inList, `plan ${JSON.stringify(plan)}: applyPlan ${ok}, sevenPlans ${inList}`);
      if (sameJson(merged, plan) && ok) accepted++;
    }
  }
  check(accepted === listed.size, `${accepted} merged plans accepted, ${listed.size} listed`);
  seen.sevenPlansChecked += listed.size;
  return true;
}

type Played = { seat: Color; action: Action };

function playChecked(
  dealSeed: Rng,
  botSeed: Rng,
  sample: Rng,
): { played: Played[]; final: GameState } {
  let state = newGame({ firstDealer: COLORS[dealSeed[0] % 4] as Color }, dealSeed);
  let botRng = botSeed;
  let sampleRng = sample;
  const draw = (n: number): number => {
    let u: number;
    [u, sampleRng] = next(sampleRng);
    return Math.floor(u * n);
  };
  const played: Played[] = [];
  let dealActions = 0;
  let sevenChecks = 0;
  checkCards(state);

  for (let actions = 0; state.phase !== "won"; actions++) {
    check(actions < ACTION_CAP, `no winner after ${ACTION_CAP} actions`);
    const seat = actingSeat(state);
    const [action, after] = randomLegal(viewFor(state, seat), seat, botRng);
    botRng = after;

    // On one step in SAMPLE_EVERY (and on every 7): a sample of the legal actions (without the 7 plans)
    // all apply, and mutated actions are refused, so is the same action from the wrong seat.
    if (action.t === "seven" || draw(SAMPLE_EVERY) === 0) {
      const legal = legalActions(state, seat, { sevenPlans: "none" });
      for (let i = 0; i < Math.min(2, legal.length); i++) {
        apply(state, seat, legal[draw(legal.length)] as Action);
        seen.legalApplied++;
      }
      for (const bad of mutations(state, seat, action, draw)) {
        check(refused(state, seat, bad), `${seat} was allowed ${JSON.stringify(bad)}`);
        seen.mutationsRefused++;
      }
      if (state.phase === "play") {
        const other = COLORS.find((c) => c !== seat) as Color;
        check(refused(state, other, action), `${other} played out of turn`);
        seen.mutationsRefused++;
      }
    }

    // the 7: generator and validator agree on small boards, and the bot's plan is one of the listed plans
    if (action.t === "seven") seen.botSevens++;
    const holdsSeven = state.phase === "play" && state.hands[seat].some((c) => rankOf(c) === 7);
    if (holdsSeven && sevenChecks < 2) {
      const card = state.hands[seat].find((c) => rankOf(c) === 7) as CardId;
      if (checkSevenAgreement(state, seat, card)) {
        sevenChecks++;
        seen.sevenBoards++;
        if (action.t === "seven") {
          const listed = sevenPlans(state, seat, card).map((plan) => JSON.stringify(plan));
          check(
            listed.includes(JSON.stringify(normalizePlan(action.plan))),
            "bot plan is not listed",
          );
        }
      }
    }

    const before = state;
    const result = apply(state, seat, action);
    state = result.state;
    played.push({ seat, action });
    seen.steps++;
    checkCards(state);
    checkPawns(state);

    // every deal ends within DEAL_CAP actions (RULE-16)
    if (state.dealsPlayed !== before.dealsPlayed) dealActions = 0;
    else dealActions++;
    check(dealActions <= DEAL_CAP, `deal ${state.dealsPlayed} lasts more than ${DEAL_CAP} actions`);
  }
  check(state.winner !== null, "won without a winner");
  seen.wins++;
  return { played, final: state };
}

/** Replays the recorded actions from the same seed: same JSON state at the end and at every step. */
function replay(dealSeed: Rng, played: Played[]): GameState {
  let state = newGame({ firstDealer: COLORS[dealSeed[0] % 4] as Color }, dealSeed);
  for (const { seat, action } of played) state = apply(state, seat, action).state;
  return state;
}

describe("engine invariants over 200 random games driven by the level-1 bot", () => {
  it("cards conserved, cells exclusive, legal actions apply, bad ones refused, 7 agreed, deals end, games won", () => {
    let games = 0;
    fc.assert(
      fc.property(
        fc.tuple(fc.nat(), fc.nat(), fc.nat(), fc.nat()),
        fc.tuple(fc.nat(), fc.nat(), fc.nat(), fc.nat()),
        fc.tuple(fc.nat(), fc.nat(), fc.nat(), fc.nat()),
        (dealSeed, botSeed, sample) => {
          games++;
          const { played, final } = playChecked(dealSeed, botSeed, sample);
          // same seed and same actions from scratch: identical JSON, and the state is JSON-safe
          const again = replay(dealSeed, played);
          expect(JSON.stringify(again)).toBe(JSON.stringify(final));
          expect(JSON.parse(JSON.stringify(final))).toEqual(final);
          expect(final.phase).toBe("won");
        },
      ),
      { numRuns: GAMES, seed: 20261015, endOnFailure: true },
    );
    expect(games).toBe(GAMES);
  }, 240_000);

  it("the games exercised every property (none was vacuous)", () => {
    expect(seen.wins).toBe(GAMES);
    expect(seen.steps).toBeGreaterThan(GAMES * 100);
    expect(seen.legalApplied).toBeGreaterThan(GAMES * 100);
    expect(seen.mutationsRefused).toBeGreaterThan(GAMES * 100);
    expect(seen.botSevens).toBeGreaterThan(GAMES);
    expect(seen.sevenBoards).toBeGreaterThan(50);
    expect(seen.sevenPlansChecked).toBeGreaterThan(100);
  });
});

describe("determinism", () => {
  it("two games from the same seeds and bot streams produce the same actions and the same JSON", () => {
    const dealSeed: Rng = [101, 202, 303, 404];
    const run = () => {
      const { played, final } = playChecked(dealSeed, [5, 6, 7, 8], [9, 10, 11, 12]);
      return JSON.stringify({ played, final, again: replay(dealSeed, played) });
    };
    expect(run()).toBe(run());
  }, 60_000);
});
