// One whole game between two team levels, for the ladder (D-07, 03-RESEARCH Pattern 10): the deal seed
// sets the cards, the bot seed sets the bots' random numbers, each seat drawing from its own stream so
// one team's choices never shift the other team's draws. Every action goes through the engine's apply,
// which throws on anything illegal. Each seat decides from its own PlayerView only (BOT-04).
// The ladder measures decision time through an injected `time` function: this package never reads a
// clock itself (it runs later inside the Durable Object of phase 2).
// Pure, no I/O, erasable syntax only.

import {
  apply,
  COLORS,
  type Color,
  newGame,
  next,
  type Rng,
  type Team,
  teamOf,
  viewFor,
} from "@toc/engine";
import type { BotLevel } from "./levels.ts";
import { type Budget, chooseAction } from "./thinker.ts";

/** A game that has not ended after this many actions is a failure (tools/selfplay.mjs's cap). */
export const ACTION_CAP = 5000;

export type TeamStats = {
  /** Decisions taken by the two seats of the team. */
  decisions: number;
  /** Work spent (Thought.units), summed over the decisions. */
  units: number;
  /** The duration of each decision, in the unit of the injected clock; [] without one. */
  ms: number[];
};

export type GameResult = { winner: Team; actions: number; perTeam: Record<Team, TeamStats> };

export type PlayGameOptions = {
  levels: Readonly<Record<Team, BotLevel>>;
  dealSeed: Rng;
  botSeed: Rng;
  /** Per-team search budget (level 5, plan 03-04); levels 1 to 4 ignore it. */
  budgets?: Partial<Readonly<Record<Team, Budget>>>;
  /** A clock injected by the host (performance.now in the ladder); none here. */
  time?: () => number;
};

/** A mixing step for 32-bit integers (the seeds of the streams). */
function mix(a: number, b: number): number {
  return Math.imul(a ^ (b >>> 15), 0x2c1b3c6d) ^ Math.imul(b + 0x9e3779b9, 0x297a2d39);
}

/** Warms an sfc32 state up so that close seeds give unrelated streams. */
function warm(rng: Rng): Rng {
  let r = rng;
  for (let i = 0; i < 12; i++) [, r] = next(r);
  return r;
}

/** One sfc32 stream per seat, derived from the bot seed and the seat's place in turn order. */
export function seatStreams(botSeed: Rng): Record<Color, Rng> {
  const out = {} as Record<Color, Rng>;
  COLORS.forEach((color, i) => {
    const salt = (i + 1) * 0x85ebca6b;
    out[color] = warm([
      mix(botSeed[0], salt) | 0,
      mix(botSeed[1], salt ^ 0x1b873593) | 0,
      mix(botSeed[2], salt + 0x27d4eb2f) | 0,
      mix(botSeed[3], salt ^ 0x165667b1) | 0,
    ]);
  });
  return out;
}

/** Four 32-bit integers drawn from an sfc32 stream, and the new stream state. */
function draw4(rng: Rng): [Rng, Rng] {
  const out: number[] = [];
  let r = rng;
  for (let i = 0; i < 4; i++) {
    let u: number;
    [u, r] = next(r);
    out.push(Math.floor(u * 4294967296) | 0);
  }
  return [out as Rng, r];
}

/**
 * The seeds of the ladder's pairs: pair i takes a deal seed and a bot seed from one sfc32 stream seeded
 * by `seed` (tools/selfplay.mjs's stream). Each pair is played twice, the teams swapped.
 */
export function ladderSeeds(seed: number, pairs: number): { dealSeed: Rng; botSeed: Rng }[] {
  let stream: Rng = [seed | 0, (seed ^ 0x9e3779b9) | 0, (seed ^ 0x85ebca6b) | 0, 0x1b873593];
  for (let i = 0; i < 20; i++) [, stream] = next(stream);
  const out: { dealSeed: Rng; botSeed: Rng }[] = [];
  for (let i = 0; i < pairs; i++) {
    let dealSeed: Rng;
    let botSeed: Rng;
    [dealSeed, stream] = draw4(stream);
    [botSeed, stream] = draw4(stream);
    out.push({ dealSeed, botSeed });
  }
  return out;
}

/**
 * Plays one game: the two seats of each team at the team's level, from the deal seed (the first dealer
 * too) and the bot seed. Throws after ACTION_CAP actions or on an action apply refuses.
 */
export function playGame(options: PlayGameOptions): GameResult {
  const { levels, dealSeed, botSeed, budgets, time } = options;
  let state = newGame({ firstDealer: COLORS[(dealSeed[0] >>> 0) % 4] as Color }, dealSeed);
  const streams = seatStreams(botSeed);
  const perTeam: Record<Team, TeamStats> = {
    "bleu-rouge": { decisions: 0, units: 0, ms: [] },
    "jaune-vert": { decisions: 0, units: 0, ms: [] },
  };
  let actions = 0;
  while (state.phase !== "won") {
    if (actions >= ACTION_CAP) throw new Error(`playGame: more than ${ACTION_CAP} actions`);
    // The seat that must act: the first that has not chosen its exchange card, else the turn.
    const phase = state.phase;
    const given = state.given;
    const seat =
      phase === "exchange"
        ? (COLORS.find((color) => given[color] === null) ?? state.turn)
        : state.turn;
    const team = teamOf(seat);
    const view = viewFor(state, seat);
    const started = time?.();
    const thought = chooseAction(view, seat, levels[team], streams[seat], budgets?.[team]);
    if (time !== undefined && started !== undefined) perTeam[team].ms.push(time() - started);
    streams[seat] = thought.rng;
    perTeam[team].decisions++;
    perTeam[team].units += thought.units;
    state = apply(state, seat, thought.action).state;
    actions++;
  }
  const winner = state.winner;
  if (winner === null) throw new Error("playGame: the game ended without a winner");
  return { winner, actions, perTeam };
}
