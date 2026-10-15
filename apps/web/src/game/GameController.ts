// The local game session: a thin shell around the engine that the Phase 2 Durable Object replaces.
// It owns the full GameState, applies the human's actions (validated by the engine), plays the three
// computer players with a human-like think delay, and hands every engine event to the Director.
//
// Nothing is ever played for the human: his give, his play and his dead-hand discard happen only
// through submit() (D-19, D-20). Bots see only viewFor(state, bot), and the deck and bot seeds come
// from the browser's secure random source (T-01-21, T-01-22).

import { randomLegal } from "@toc/bots";
import {
  type Action,
  apply,
  COLORS,
  type Color,
  type GameEvent,
  type GameState,
  IllegalActionError,
  next,
  nextColor,
  type PlayerView,
  type Rng,
  type Scenario,
  scenarioState,
  shuffle,
  startGame,
  teamOf,
  viewFor,
} from "@toc/engine";
import { BOT_NAMES } from "./botNames.ts";

/** `normal` and `fast` pace the bots (D-18); `test` has no think delay (debug builds and tests). */
export type Speed = "normal" | "fast" | "test";

/** What the controller needs from the Director. */
export type GameDirector = {
  enqueue(events: GameEvent[]): void;
  idle(): Promise<void>;
};

export type CreateGameOptions = {
  /** The seat the human plays; a scenario overrides it with the scenario's turn seat. */
  human: Color;
  /** Seed of the deck. Default: four words from crypto.getRandomValues. */
  seed?: Rng;
  /** Seed of the bots' choices and think times. Default: four words from crypto.getRandomValues. */
  botSeed?: Rng;
  /** Read again before every bot step, so the « Avance rapide » switch acts at once. */
  speed?: Speed | (() => Speed);
  /** A position to start from instead of a new game (debug builds: scenario and etat parameters). */
  scenario?: Scenario["before"];
  director: GameDirector;
};

export type SubmitResult = { ok: true } | { ok: false; error: "illegal" };

export type GameStats = {
  dealsPlayed: number;
  /** Pawns eaten so far: by the human's team (nous) and by the other team (eux). */
  captured: { nous: number; eux: number };
};

export type GameController = {
  readonly human: Color;
  /** The human is « toi »; the bots carry horse names. */
  readonly names: Record<Color, string>;
  /** What the human may know now. A fresh object each call. */
  view(): PlayerView;
  /** The events of the first deal of a new game (none when a scenario sets the position up). */
  openingDeal(): GameEvent[];
  /** The human's action, validated by the engine. Nothing changes when it is refused. */
  submit(action: Action): SubmitResult;
  /** Called after every applied action, the human's and the bots'. Returns the unsubscribe function. */
  onChange(listener: () => void): () => void;
  /**
   * Called once if a bot step throws: the bot loop has stopped and the game cannot go on, so the screen
   * must say so (the error screen) instead of leaving a frozen board. A listener added after the failure
   * is called at once. Returns the unsubscribe function.
   */
  onError(listener: (error: unknown) => void): () => void;
  stats(): GameStats;
  /** The bot that is thinking about its move, if any. */
  thinking(): Color | null;
  /** Starts the bot loop. Called once the screen is wired, so nothing is missed. */
  start(): void;
  dispose(): void;
};

/** Four 32-bit words from the secure random source. */
export function randomSeed(): Rng {
  const words = new Uint32Array(4);
  crypto.getRandomValues(words);
  return [words[0] as number, words[1] as number, words[2] as number, words[3] as number];
}

/** A bot seed derived from a game seed, so one debug `graine` fixes the whole game. */
export function botSeedFrom(seed: Rng): Rng {
  let rng: Rng = [
    seed[3] ^ 0x9e3779b9,
    seed[2] ^ 0x85ebca6b,
    seed[1] ^ 0xc2b2ae35,
    seed[0] ^ 0x27d4eb2f,
  ];
  for (let i = 0; i < 12; i++) rng = next(rng)[1];
  return rng;
}

/** The seat the human plays: the chosen colour, or the turn seat of a scenario. */
export function humanSeat(requested: Color, scenario?: Scenario["before"]): Color {
  return scenario === undefined
    ? requested
    : (COLORS.find((c) => c === scenario.turn) ?? requested);
}

/** Think time in ms for one bot step (D-18). `u` is uniform in [0, 1). */
export function thinkDelay(speed: Speed, u: number): number {
  switch (speed) {
    case "normal":
      return 700 + u * 600;
    case "fast":
      return 200 + u * 100;
    case "test":
      return 0;
  }
}

export function createGame(options: CreateGameOptions): GameController {
  const { director, scenario } = options;
  const human = humanSeat(options.human, scenario);
  const seed = options.seed ?? randomSeed();
  let botRng: Rng = options.botSeed ?? randomSeed();
  const speedOf: () => Speed =
    typeof options.speed === "function"
      ? options.speed
      : (() => {
          const fixed = options.speed ?? "normal";
          return () => fixed;
        })();

  let state: GameState;
  let opening: GameEvent[] = [];
  if (scenario !== undefined) {
    state = scenarioState(scenario, seed);
  } else {
    let u: number;
    [u, botRng] = next(botRng);
    const started = startGame(
      { firstDealer: COLORS[Math.floor(u * COLORS.length)] as Color },
      seed,
    );
    state = started.state;
    opening = started.events;
  }

  const [horses, afterNames] = shuffle(BOT_NAMES, botRng);
  botRng = afterNames;
  const names = {} as Record<Color, string>;
  let horse = 0;
  for (const color of COLORS) names[color] = color === human ? "toi" : (horses[horse++] as string);

  const listeners = new Set<() => void>();
  const errorListeners = new Set<(error: unknown) => void>();
  let failure: { error: unknown } | null = null;
  let disposed = false;
  let started = false;
  let running = false;
  let thinkingSeat: Color | null = null;
  let wake: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  function setThinking(seat: Color | null): void {
    if (thinkingSeat === seat) return;
    thinkingSeat = seat;
    notify();
  }

  /** The bot that must act now: the next to give in the exchange, or the seat whose turn it is. */
  function nextBot(): Color | null {
    if (state.phase === "won") return null;
    if (state.phase === "exchange") {
      return (
        COLORS.find((c) => c !== human && state.given[c] === null && state.hands[c].length > 0) ??
        null
      );
    }
    return state.turn === human ? null : state.turn;
  }

  function play(seat: Color, action: Action): void {
    const result = apply(state, seat, action);
    state = result.state;
    if (result.events.length > 0) director.enqueue(result.events);
    notify();
  }

  function sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      wake = resolve;
      timer = setTimeout(resolve, ms);
    });
  }

  async function run(): Promise<void> {
    if (running || disposed || failure !== null) return;
    running = true;
    try {
      while (!disposed) {
        await director.idle();
        if (disposed || nextBot() === null) break;
        let u: number;
        [u, botRng] = next(botRng);
        setThinking(nextBot());
        await sleep(thinkDelay(speedOf(), u));
        wake = null;
        // The screen may have been held meanwhile (the invitation to turn it, plan 01-38): the bot
        // plays only once the director is idle again, never behind the invitation.
        await director.idle();
        // The state may have moved while the bot was thinking (the human's give in the exchange).
        const bot = nextBot();
        if (disposed || bot === null) {
          setThinking(null);
          continue;
        }
        const [action, rng] = randomLegal(viewFor(state, bot), bot, botRng);
        botRng = rng;
        setThinking(null);
        play(bot, action);
      }
    } catch (error) {
      // The loop cannot go on: a silent console line would leave the board locked on a bot's turn
      // forever. The failure is kept (no bot plays again) and handed to the screen.
      console.error(error);
      if (!disposed && failure === null) {
        failure = { error };
        for (const listener of [...errorListeners]) listener(error);
      }
    } finally {
      running = false;
      setThinking(null);
    }
  }

  return {
    human,
    names,
    view: () => viewFor(state, human),
    openingDeal: () => opening,
    submit(action) {
      if (disposed) return { ok: false, error: "illegal" };
      try {
        play(human, action);
      } catch (error) {
        if (error instanceof IllegalActionError) return { ok: false, error: "illegal" };
        throw error;
      }
      if (started) void run();
      return { ok: true };
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onError(listener) {
      if (failure !== null) {
        listener(failure.error);
        return () => {};
      }
      errorListeners.add(listener);
      return () => errorListeners.delete(listener);
    },
    stats() {
      const us = teamOf(human);
      const them = teamOf(nextColor(human));
      return {
        dealsPlayed: state.dealsPlayed,
        captured: { nous: state.captures[us], eux: state.captures[them] },
      };
    },
    thinking: () => thinkingSeat,
    start() {
      started = true;
      void run();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      wake?.();
      listeners.clear();
      errorListeners.clear();
    },
  };
}
