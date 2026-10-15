// Engine invariants over random games (fast-check, fixed seeds). Every seat of every game is driven by the
// level-1 bot, which sees only its own view. After every action: the 52 cards are all accounted for, no two
// pawns share a cell, legal actions apply, mutated actions are refused, the 7 generator and the 7 validator
// agree, deals end, every home entry goes forward through the colour's carré 16 (G14), no knight of the
// mover's team is eaten in passing (G15), G16 never changes whether a 7 is playable and every applied 7
// brings home each knight it moved that it could bring home, a knight whose count lands on an empty home
// slot enters, jumping the knights already home (D-02, G17), and the same seed and actions give the
// same JSON.

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
  canPlaySeven,
  controlledPawns,
  ENTRY,
  FULL_DECK,
  type GameEvent,
  type GameState,
  IllegalActionError,
  legalActions,
  newGame,
  next,
  normalizePlan,
  PARTNER,
  type PawnId,
  type Place,
  RING,
  type Rng,
  rankOf,
  ringIndex,
  type SevenPlan,
  sevenMustEnter,
  sevenPlans,
  teamOf,
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
  entries: 0,
  /** Entries crossing the carré 16 below progress 70: refused by the rule of 2026-10-13, allowed by G14. */
  entriesWithoutLap: 0,
  /** 7 actions whose path crossed a knight of the mover's partner colour that stayed on its cell (G15). */
  teamPassedBySeven: 0,
  /** G16: 7 actions played while sevenMustEnter was not empty. */
  sevensWithDuty: 0,
  /** G16: of those, the 7 actions that moved a knight of the duty (each brought it home). */
  dutyKnightsMoved: 0,
  /** G16: boards holding a 7 where a split could bring a knight home but no split kept the duty (the safety). */
  dutySafety: 0,
  /** G17: entries that jumped a knight already home. */
  entryJumps: 0,
  /** G17: moves inside a home that jumped a knight already home. */
  homeJumps: 0,
  /** D-02 with G17: forward ring moves that crossed or left their carré 16 (none may skip an open slot). */
  entryChances: 0,
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

/**
 * Every pawnEnteredHome of a pawn that was on the ring in `before` reaches the home through its colour's
 * ENTRY cell moving forward: the pawn stood on it, or the last ring place of the event path is it. The
 * progress is followed through the action's events, so a pawn moved twice by one 7 is tracked too.
 */
function checkEntries(before: GameState, events: readonly GameEvent[]): void {
  const progress = new Map<PawnId, number>();
  for (const id of ALL_PAWNS) {
    const pawn = before.pawns[id];
    if (pawn.zone === "ring") progress.set(id, pawn.progress);
  }
  for (const event of events) {
    if (event.t === "pawnMoved") {
      const from = progress.get(event.pawn);
      if (from !== undefined) progress.set(event.pawn, from + event.dir * event.path.length);
    } else if (event.t === "pawnSentHome") {
      progress.delete(event.pawn);
    } else if (event.t === "pawnEnteredHome") {
      const from = progress.get(event.pawn);
      progress.delete(event.pawn);
      if (from === undefined) continue; // a home pawn moving inside its home
      const color = event.pawn.slice(0, -1) as Color;
      const ringPlaces = event.path.filter((place) => place.z === "ring");
      const firstHome = event.path.findIndex((place) => place.z === "home");
      check(firstHome === ringPlaces.length, `${event.pawn} enters with ring cells after its home`);
      const last = ringPlaces[ringPlaces.length - 1];
      const throughEntry =
        last === undefined
          ? ringIndex(color, from) === ENTRY[color]
          : last.z === "ring" && last.cell === ENTRY[color];
      check(throughEntry, `${event.pawn} entered its home without passing its carré 16`);
      // forward: the ring cells are consecutive from the pawn's cell
      ringPlaces.forEach((place, i) => {
        check(
          place.z === "ring" && place.cell === ringIndex(color, from + i + 1),
          `${event.pawn} entered its home moving backward`,
        );
      });
      seen.entries++;
      if (from + ringPlaces.length < RING - 2) seen.entriesWithoutLap++;
    }
  }
}

const colorOf = (id: PawnId): Color => id.slice(0, -1) as Color;

/**
 * D-02 with G17, event by event, the home slots followed through the action: a forward move of a ring
 * knight that stands on or crosses its carré 16 with 1 to 4 steps left, the target home slot being empty,
 * enters (the knights already home are jumped; G14 opens the carré 16 on every lap). Counts in seen the
 * entries and the moves inside a home that jumped a knight already home.
 */
function checkHomeJumps(before: GameState, events: readonly GameEvent[]): void {
  const slots = new Map<Color, boolean[]>(COLORS.map((c) => [c, [false, false, false, false]]));
  for (const id of ALL_PAWNS) {
    const pawn = before.pawns[id];
    if (pawn.zone === "home") (slots.get(colorOf(id)) as boolean[])[pawn.slot] = true;
  }
  const jumps = (home: boolean[], path: readonly Place[]): boolean =>
    path.slice(0, -1).some((place) => place.z === "home" && home[place.slot] === true);
  for (const event of events) {
    if (event.t === "pawnMoved") {
      const color = colorOf(event.pawn);
      const home = slots.get(color) as boolean[];
      if (event.from.z === "home") {
        const last = event.path[event.path.length - 1];
        check(last?.z === "home", `${event.pawn} left its home`);
        if (jumps(home, event.path)) seen.homeJumps++;
        home[event.from.slot] = false;
        if (last?.z === "home") home[last.slot] = true;
        continue;
      }
      if (event.from.z !== "ring" || event.dir !== 1) continue;
      const cells = [event.from, ...event.path.slice(0, -1)];
      cells.forEach((place, k) => {
        if (place.z !== "ring" || place.cell !== ENTRY[color]) return;
        seen.entryChances++;
        const r = event.path.length - k;
        check(
          r < 1 || r > 4 || home[r - 1] === true,
          `${event.pawn} passed its home while ${r} steps led to the empty slot ${r - 1}`,
        );
      });
    } else if (event.t === "pawnEnteredHome") {
      const home = slots.get(colorOf(event.pawn)) as boolean[];
      if (jumps(home, event.path)) seen.entryJumps++;
      home[event.slot] = true;
    }
  }
}

/**
 * G15: a pawnCaptured whose victim is of the capturer's team happens only on the last cell of the
 * capturer's move (landing), never in passing. For a 7, counts in seen.teamPassedBySeven the actions
 * where a micro-move crossed (before its last place) a ring cell held in `before` by a knight of the
 * mover's partner colour that is still on that cell after the action.
 */
function checkTeamCaptures(
  before: GameState,
  after: GameState,
  action: Action,
  events: readonly GameEvent[],
): void {
  let mover: PawnId | null = null;
  let pathLength = 0;
  const crossed: { mover: PawnId; cell: number }[] = [];
  for (const event of events) {
    if (event.t === "pawnMoved" || event.t === "pawnEnteredHome") {
      mover = event.pawn;
      pathLength = event.path.length;
      for (const place of event.path.slice(0, -1)) {
        if (place.z === "ring") crossed.push({ mover: event.pawn, cell: place.cell });
      }
    } else if (event.t === "pawnExited") {
      mover = event.pawn;
      pathLength = 1;
    } else if (event.t === "pawnCaptured") {
      check(event.by === mover, `${event.victim} captured by ${event.by}, not the pawn that moved`);
      if (teamOf(colorOf(event.victim)) === teamOf(colorOf(event.by))) {
        check(
          event.atStep === pathLength - 1,
          `${event.by} ate ${event.victim} of its own team in passing (step ${event.atStep} of ${pathLength})`,
        );
      }
    }
  }
  if (action.t !== "seven") return;
  const passed = crossed.some(({ mover: id, cell }) =>
    ALL_PAWNS.some((other) => {
      const color = colorOf(other);
      if (color !== PARTNER[colorOf(id)]) return false;
      const was = before.pawns[other];
      const is = after.pawns[other];
      return (
        was.zone === "ring" &&
        ringIndex(color, was.progress) === cell &&
        is.zone === "ring" &&
        ringIndex(color, is.progress) === cell
      );
    }),
  );
  if (passed) seen.teamPassedBySeven++;
}

/** The same state with G16 off (the rule of 2026-10-14). */
const withoutG16 = (state: GameState): GameState => ({
  ...state,
  rules: { ...state.rules, KNIGHT_MUST_ENTER: false },
});

/**
 * G16 on a board where `seat` holds a 7: the 7 is playable with G16 exactly when it is without it, and
 * seen.dutySafety counts the boards where the safety dropped the duty (a split could bring a knight home,
 * sevenMustEnter is empty). Only boards with a controlled knight within 6 cells of its carré 16 are
 * enumerated, the others cannot enter with a 7.
 */
function checkSevenDuty(state: GameState, seat: Color): void {
  check(
    canPlaySeven(state, seat) === canPlaySeven(withoutG16(state), seat),
    `${seat}: G16 changed whether the 7 is playable`,
  );
  if (sevenMustEnter(state, seat).length > 0) return;
  const near = controlledPawns(state, seat).filter((id) => {
    const pawn = state.pawns[id];
    if (pawn.zone !== "ring") return false;
    for (let k = 0; k < 7; k++) {
      if (ringIndex(colorOf(id), pawn.progress + k) === ENTRY[colorOf(id)]) return true;
    }
    return false;
  });
  if (near.length === 0) return;
  const off = withoutG16(state);
  const card = state.hands[seat].find((c) => rankOf(c) === 7) as CardId;
  const couldEnter = sevenPlans(off, seat, card).some((plan) => {
    const r = applyPlan(off, seat, card, plan);
    return r.ok && near.some((id) => r.pawns[id].zone === "home");
  });
  if (couldEnter) seen.dutySafety++;
}

/** G16 after an applied 7: each knight of the duty (listed before the move) that the plan moved is home. */
function checkDutyKept(duty: readonly PawnId[], action: Action, after: GameState): void {
  if (action.t !== "seven" || duty.length === 0) return;
  seen.sevensWithDuty++;
  const moved = duty.filter((id) => action.plan.some((entry) => entry.pawn === id));
  for (const id of moved) {
    check(after.pawns[id].zone === "home", `${id} moved by a 7 that could bring it home, not home`);
  }
  if (moved.length > 0) seen.dutyKnightsMoved++;
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
    if (holdsSeven) checkSevenDuty(state, seat);
    const duty = action.t === "seven" ? sevenMustEnter(state, seat) : [];
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
    checkEntries(before, result.events);
    checkHomeJumps(before, result.events);
    checkTeamCaptures(before, state, action, result.events);
    checkDutyKept(duty, action, state);

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
    expect(seen.entries).toBeGreaterThanOrEqual(GAMES * 8);
    expect(seen.entriesWithoutLap).toBeGreaterThan(0);
    expect(seen.teamPassedBySeven).toBeGreaterThan(0);
    expect(seen.sevensWithDuty).toBeGreaterThan(0);
    expect(seen.dutyKnightsMoved).toBeGreaterThan(0);
    // seed 20261015: 820 sevens with a duty, 616 of them moved a duty knight, 4 boards used the safety
    expect(seen.dutySafety).toBeGreaterThan(0);
    // seed 20261015: 5451 forward moves past a carré 16, 126 entries and 71 home moves jumped a knight
    expect(seen.entryChances).toBeGreaterThan(GAMES);
    expect(seen.entryJumps).toBeGreaterThan(0);
    expect(seen.homeJumps).toBeGreaterThan(0);
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
