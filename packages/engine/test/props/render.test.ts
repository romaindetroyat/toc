// The render state is a pure fold of engine events (RESEARCH Pattern 5): folding renderReduce over every
// event of a game gives what the view projection gives, for each seat, and the views never carry another
// seat's cards. The games are played by drawing one action uniformly from legalActions with the engine's
// own sfc32 (no bot package), all from fixed seeds.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  apply,
  COLORS,
  type Color,
  eventsFor,
  type GameEvent,
  type GameState,
  legalActions,
  newGame,
  next,
  type RenderState,
  type Rng,
  renderInit,
  renderOf,
  renderReduce,
  viewFor,
} from "../../src/index.ts";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** The seat that must act: the first seat that has not chosen its exchange card, else the seat to play. */
function actingSeat(state: GameState): Color {
  if (state.phase === "exchange") {
    return COLORS.find((color) => state.given[color] === null) ?? state.turn;
  }
  return state.turn;
}

type Step = { state: GameState; events: GameEvent[] };

/** Plays a game from fixed seeds, calling `onStep` after every action; stops at the win or after `maxPlies`. */
function playGame(
  dealSeed: Rng,
  pickSeed: Rng,
  maxPlies: number,
  onStep: (step: Step) => void,
): GameState {
  let state = newGame({ firstDealer: COLORS[dealSeed[0] % 4] as Color }, dealSeed);
  let rng = pickSeed;
  for (let ply = 0; ply < maxPlies && state.phase !== "won"; ply++) {
    const seat = actingSeat(state);
    const actions = legalActions(state, seat);
    if (actions.length === 0)
      throw new Error(`no legal action for ${seat} in phase ${state.phase}`);
    let draw: number;
    [draw, rng] = next(rng);
    const action = actions[Math.floor(draw * actions.length)];
    if (action === undefined) throw new Error("draw out of range");
    const out = apply(state, seat, action);
    state = out.state;
    onStep({ state, events: out.events });
  }
  return state;
}

const CARD_IN_JSON = /"((?:1[0-3]|[1-9])[SHDC])"/g;

/** Cards a view may legitimately show: the viewer's own, the public piles and the felt. */
function publicCards(state: GameState, seat: Color): Set<string> {
  return new Set<string>([
    ...state.hands[seat],
    ...state.discard,
    ...COLORS.flatMap((c) => state.posed[c]),
    ...COLORS.flatMap((c) => (state.lastPlayed[c] === null ? [] : [state.lastPlayed[c] as string])),
    ...(state.given[seat] === null ? [] : [state.given[seat] as string]),
    ...(state.received[seat] === null ? [] : [state.received[seat] as string]),
  ]);
}

describe("renderOf: what the board, the felt and the info bar draw", () => {
  it("a new game has every pawn in its stable, the first deal sizes, the dealer and dealIndex 0", () => {
    const state = newGame({ firstDealer: "vert" }, [11, 22, 33, 44]);
    for (const seat of COLORS) {
      const rs = renderOf(viewFor(state, seat));
      for (const color of COLORS) {
        for (const index of [0, 1, 2, 3] as const) {
          expect(rs.pawns[`${color}${index}`]).toEqual({ z: "stable", color, slot: index });
        }
        expect(rs.handSizes[color]).toBe(5);
        expect(rs.homeCounts[color]).toBe(0);
        expect(rs.lastPlayed[color]).toBeNull();
        expect(rs.posed[color]).toEqual([]);
      }
      expect(rs.talonSize).toBe(52 - 20);
      expect(rs.discardSize).toBe(0);
      expect(rs.dealer).toBe("vert");
      expect(rs.dealIndex).toBe(0);
      expect(rs.phase).toBe("exchange");
      expect(rs.winner).toBeNull();
      expect(rs.captures).toEqual({ "bleu-rouge": 0, "jaune-vert": 0 });
    }
  });

  it("is the same for every seat: it carries public information only", () => {
    const state = newGame({ firstDealer: "bleu" }, [5, 6, 7, 8]);
    const views = COLORS.map((seat) => renderOf(viewFor(state, seat)));
    for (const rs of views) expect(rs).toEqual(views[0]);
  });

  it("renderReduce never mutates its input", () => {
    const state = newGame({ firstDealer: "rouge" }, [1, 2, 3, 4]);
    let rs: RenderState = deepFreeze(renderInit(viewFor(state, "bleu")));
    playGame([1, 2, 3, 4], [9, 8, 7, 6], 80, ({ events }) => {
      for (const event of events) rs = deepFreeze(renderReduce(rs, event));
    });
    expect(rs.phase).not.toBe("exchange");
  });
});

describe("the render fold equals the view projection (200 fixed-seed games)", () => {
  const seen = new Set<GameEvent["t"]>();
  let games = 0;

  it("folding every event of a game gives renderOf(viewFor(state, seat)) at each step and each seat", () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.nat(), fc.nat(), fc.nat(), fc.nat()),
        fc.tuple(fc.nat(), fc.nat(), fc.nat(), fc.nat()),
        (dealSeed, pickSeed) => {
          // The first five games are played to the end; the others stop after 250 actions (about four deals).
          const maxPlies = games++ < 5 ? 6000 : 250;
          const first = newGame({ firstDealer: COLORS[dealSeed[0] % 4] as Color }, dealSeed);
          let rs = renderInit(viewFor(first, "bleu"));
          let last: GameState = first;
          const final = playGame(dealSeed, pickSeed, maxPlies, ({ state, events }) => {
            for (const event of events) {
              rs = renderReduce(rs, event);
              seen.add(event.t);
            }
            last = state;
            const projected = renderOf(viewFor(state, "bleu"));
            if (JSON.stringify(rs) !== JSON.stringify(projected)) expect(rs).toEqual(projected);
          });
          expect(final).toBe(last);
          for (const seat of COLORS) expect(rs).toEqual(renderOf(viewFor(final, seat)));
        },
      ),
      { numRuns: 200, seed: 20261013, endOnFailure: true },
    );
    expect(games).toBe(200);
  }, 180_000);

  it("the 200 games exercised every kind of event", () => {
    const kinds: GameEvent["t"][] = [
      "dealt",
      "handDealt",
      "cardsExchanged",
      "cardPlayed",
      "pawnExited",
      "pawnMoved",
      "pawnCaptured",
      "pawnSentHome",
      "pawnsSwapped",
      "pawnEnteredHome",
      "handDiscarded",
      "playerFinished",
      "reshuffled",
      "turn",
      "gameWon",
    ];
    for (const kind of kinds) expect(seen.has(kind), `no ${kind} event seen`).toBe(true);
  });
});

describe("a view never carries another seat's cards", () => {
  it("at no step of 200 fixed-seed games does viewFor show a card the seat may not know", () => {
    let games = 0;
    fc.assert(
      fc.property(
        fc.tuple(fc.nat(), fc.nat(), fc.nat(), fc.nat()),
        fc.tuple(fc.nat(), fc.nat(), fc.nat(), fc.nat()),
        (dealSeed, pickSeed) => {
          const maxPlies = games++ < 5 ? 1500 : 150;
          const check = (state: GameState) => {
            for (const seat of COLORS) {
              const allowed = publicCards(state, seat);
              // Any card id in the view that is not public or the viewer's own is a leak (hands, talon).
              const json = JSON.stringify(viewFor(state, seat));
              for (const match of json.matchAll(CARD_IN_JSON)) {
                if (!allowed.has(match[1] as string)) {
                  throw new Error(`${seat} sees ${match[1]}`);
                }
              }
            }
          };
          check(newGame({ firstDealer: COLORS[dealSeed[0] % 4] as Color }, dealSeed));
          playGame(dealSeed, pickSeed, maxPlies, ({ state }) => check(state));
        },
      ),
      { numRuns: 200, seed: 20261014, endOnFailure: true },
    );
  }, 180_000);
});

describe("the projected event stream (eventsFor) is safe to send to one seat", () => {
  it("folds to the same render as the full stream and carries no card the seat may not know", () => {
    let games = 0;
    fc.assert(
      fc.property(
        fc.tuple(fc.nat(), fc.nat(), fc.nat(), fc.nat()),
        fc.tuple(fc.nat(), fc.nat(), fc.nat(), fc.nat()),
        (dealSeed, pickSeed) => {
          const maxPlies = games++ < 3 ? 1500 : 150;
          const first = newGame({ firstDealer: COLORS[dealSeed[0] % 4] as Color }, dealSeed);
          const folded = perSeat(() => renderInit(viewFor(first, "bleu")));
          let full = renderInit(viewFor(first, "bleu"));
          let before: GameState = first;
          playGame(dealSeed, pickSeed, maxPlies, ({ state, events }) => {
            for (const event of events) full = renderReduce(full, event);
            for (const seat of COLORS) {
              const projected = eventsFor(events, seat);
              for (const event of projected) folded[seat] = renderReduce(folded[seat], event);
              // Public card facts of this step: what was played or laid on the felt.
              const allowed = new Set<string>([
                ...publicCards(before, seat),
                ...publicCards(state, seat),
                ...events.flatMap((e) =>
                  e.t === "cardPlayed" ? [e.card] : e.t === "handDiscarded" ? e.cards : [],
                ),
              ]);
              for (const match of JSON.stringify(projected).matchAll(CARD_IN_JSON)) {
                if (!allowed.has(match[1] as string)) {
                  throw new Error(`${seat} is sent ${match[1]}`);
                }
              }
              if (JSON.stringify(folded[seat]) !== JSON.stringify(full)) {
                expect(folded[seat]).toEqual(full);
              }
            }
            before = state;
          });
        },
      ),
      { numRuns: 60, seed: 20261015, endOnFailure: true },
    );
  }, 180_000);
});

function perSeat<T>(make: (seat: Color) => T): Record<Color, T> {
  return { bleu: make("bleu"), jaune: make("jaune"), rouge: make("rouge"), vert: make("vert") };
}
