// The game session the screen reads: it creates the controller, the Director and the turn reducer and
// exposes their results as whole values (`view`, `render`, `ui`), each replaced and never mutated
// (RESEARCH: $state.raw, no deep proxies over engine data). The screen sends UI events to `send`.
//
// What reaches the screen: `render` follows the Director event by event while it animates; `ui` is
// brought up to date only once the Director is idle, so the board stays locked until the last
// animation has finished (UI-SPEC, Turn flow step 4).

import { quarterTurnsFor } from "@toc/board";
import type { Color, PlayerView, Reason, RenderState } from "@toc/engine";
import * as audio from "../audio/engine.ts";
import { settings } from "../settings/store.svelte.ts";
import type { DebugParams } from "./debugParams.ts";
import { createDirector, type DirectorDeps, type DirectorMode } from "./director.ts";
import {
  botSeedFrom,
  createGame,
  type GameStats,
  humanSeat,
  type Speed,
} from "./GameController.ts";
import {
  initialTurnUi,
  reduceTurnUi,
  type TurnCtx,
  type TurnUiEvent,
  type TurnUiState,
  turnCtx,
} from "./turnUi.ts";

/** What the game screen provides: it owns the SVG nodes, so it moves and animates the pawns. */
export type SessionEnv = Pick<DirectorDeps, "animator" | "facingOf" | "commit"> & {
  /** Default: the audio engine of the app. */
  audio?: DirectorDeps["audio"];
};

export type Session = {
  readonly human: Color;
  /** Clockwise quarter turns of the board toward the human (D-05). */
  readonly k: number;
  /** « toi » for the human, a horse name for each bot. */
  readonly names: Record<Color, string>;
  /** What the human may know now. */
  readonly view: PlayerView;
  /** The board, felt and piles as the Director has played them so far; null before start(). */
  readonly render: RenderState | null;
  readonly ui: TurnUiState;
  /** The reason a tapped card cannot be played, or « illegal » for a refused move. */
  readonly hint: Reason | "illegal" | null;
  /** The bot that is thinking about its move. */
  readonly thinking: Color | null;
  stats(): GameStats;
  /** Starts the game: the bots begin to act. */
  start(): void;
  /** A tap or a button of the screen; the reducer decides what it means. */
  send(event: TurnUiEvent): void;
  dispose(): void;
};

/**
 * The debug parameters of the hash. The parser is loaded by a dynamic import inside a branch that
 * tests `__TOC_DEBUG__` itself, so release bundles do not contain it nor the scenario set.
 */
export async function loadDebugParams(hash: string): Promise<DebugParams> {
  if (__TOC_DEBUG__) {
    const { parseDebugParams } = await import("./debugParams.ts");
    return parseDebugParams(hash);
  }
  return {};
}

export function createSession(env: SessionEnv, debug: DebugParams = {}): Session {
  const scenario = debug.etat ?? debug.scenario?.before;
  const human = humanSeat(settings.lastColor, scenario);
  const k = quarterTurnsFor(human);
  const testSpeed = debug.vitesse === "test";

  const director = createDirector({
    animator: env.animator,
    audio: env.audio ?? audio,
    quarterTurns: k,
    facingOf: env.facingOf,
    commit: env.commit,
    getMode: (): DirectorMode =>
      testSpeed ? "test" : settings.reduceMotion ? "reduced" : settings.fast ? "fast" : "normal",
  });
  const controller = createGame({
    human,
    seed: debug.graine,
    botSeed: debug.graine === undefined ? undefined : botSeedFrom(debug.graine),
    speed: (): Speed => (testSpeed ? "test" : settings.fast ? "fast" : "normal"),
    scenario,
    director,
  });

  let view = $state.raw<PlayerView>(controller.view());
  let render = $state.raw<RenderState | null>(null);
  let ui = $state.raw<TurnUiState>(initialTurnUi);
  let hint = $state.raw<Reason | "illegal" | null>(null);
  let thinking = $state.raw<Color | null>(null);
  let disposed = false;

  // The reducer's context is worth computing once per view.
  let cached: { view: PlayerView; ctx: TurnCtx } | null = null;
  function ctx(): TurnCtx {
    if (cached === null || cached.view !== view) cached = { view, ctx: turnCtx(view, human) };
    return cached.ctx;
  }

  director.onRender((next) => {
    render = next;
  });
  director.reset(view);

  async function syncWhenIdle(): Promise<void> {
    await director.idle();
    if (disposed) return;
    ui = reduceTurnUi(ui, { t: "sync" }, ctx()).state;
  }

  controller.onChange(() => {
    view = controller.view();
    thinking = controller.thinking();
    void syncWhenIdle();
  });

  return {
    human,
    k,
    names: controller.names,
    get view() {
      return view;
    },
    get render() {
      return render;
    },
    get ui() {
      return ui;
    },
    get hint() {
      return hint;
    },
    get thinking() {
      return thinking;
    },
    stats: () => controller.stats(),
    start() {
      ui = reduceTurnUi(ui, { t: "sync" }, ctx()).state;
      controller.start();
    },
    send(event) {
      if (disposed) return;
      const result = reduceTurnUi(ui, event, ctx());
      ui = result.state;
      hint = result.hint ?? null;
      if (result.submit === undefined) return;
      const outcome = controller.submit(result.submit);
      if (!outcome.ok) {
        // The engine refused: nothing changed, the interaction starts again from the view.
        hint = outcome.error;
        ui = reduceTurnUi(ui, { t: "sync" }, ctx()).state;
      }
    },
    dispose() {
      disposed = true;
      controller.dispose();
      director.dispose();
    },
  };
}
