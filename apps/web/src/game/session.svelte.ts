// The game session the screen reads: it creates the controller, the Director and the turn reducer and
// exposes their results as whole values (`view`, `render`, `ui`), each replaced and never mutated
// (RESEARCH: $state.raw, no deep proxies over engine data). The screen sends UI events to `send`.
//
// What reaches the screen: `render` follows the Director event by event while it animates; `ui` is
// brought up to date only once the Director is idle, so the board stays locked until the last
// animation has finished (UI-SPEC, Turn flow step 4).

import { quarterTurnsFor, screenSideOf } from "@toc/board";
import type { BotLevel } from "@toc/bots";
import {
  COLORS,
  type Color,
  type GameEvent,
  type PlayerView,
  type Reason,
  type RenderState,
} from "@toc/engine";
import * as audio from "../audio/engine.ts";
import type { BotLevels } from "../settings/settings.ts";
import { settings } from "../settings/store.svelte.ts";
import { createInlineRunner } from "./botRunner.ts";
import type { DebugParams } from "./debugParams.ts";
import { createDirector, type DirectorDeps, type DirectorMode } from "./director.ts";
import {
  botSeedFrom,
  createGame,
  type GameController,
  type GameDirector,
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

/**
 * What the game screen provides: it owns the SVG nodes, so it moves and animates the pawns. Its
 * `document` is the visibility the Director follows: hidden while the tab is hidden or while the
 * invitation to turn the screen hides the game (plan 01-38). Default: the page's document.
 */
export type SessionEnv = Pick<DirectorDeps, "animator" | "facingOf" | "commit" | "document"> & {
  /** Default: the audio engine of the app. */
  audio?: DirectorDeps["audio"];
  /**
   * Resolves at once unless the game is on hold (the invitation to turn the screen shows), otherwise
   * once it is released. The computer players wait for it before they act. Default: never on hold.
   */
  hold?: () => Promise<void>;
};

/**
 * Builds the controller of an online game (net/remoteGame.ts) from the session's Director. The online
 * table passes it; the local game (D-09) leaves it out and createGame runs as before.
 */
export type ControllerFactory = (
  director: GameDirector & { reset(view: PlayerView): void },
) => GameController & { onRefused?(listener: () => void): () => void };

/** What a bot just played: its seat and the events of its play (the action zone words them). */
export type BotPlay = { seat: Color; events: GameEvent[] };

export type Session = {
  readonly human: Color;
  /** The human's seat index (quarterTurnsFor): which colour sits at the bottom of the galet. */
  readonly k: number;
  /** The pace of the moment (settings, or `test` under the debug speed): read again at each use. */
  readonly pace: DirectorMode;
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
  /** The last play of a bot, kept until the human acts again. */
  readonly lastPlay: BotPlay | null;
  /** Set when the bot loop failed: the game cannot go on and the screen shows the error screen. */
  readonly failure: { error: unknown } | null;
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

/**
 * The level of each computer seat, by colour, from the levels remembered per role: the seat in front
 * of the human is the partner, the next seat clockwise is on his left, the previous one on his right
 * (screenSideOf, the same sides as the board).
 */
export function levelsByColour(levels: BotLevels, human: Color): Partial<Record<Color, BotLevel>> {
  const out: Partial<Record<Color, BotLevel>> = {};
  for (const color of COLORS) {
    const side = screenSideOf(color, human);
    if (side === "top") out[color] = levels.partner;
    else if (side === "left") out[color] = levels.left;
    else if (side === "right") out[color] = levels.right;
  }
  return out;
}

/**
 * `colour` is the seat the human plays; without it, the colour chosen on the launch screen. A debug
 * scenario overrides it with the seat whose turn it is.
 */
export function createSession(
  env: SessionEnv,
  debug: DebugParams = {},
  colour: Color = settings.lastColor,
  makeController?: ControllerFactory,
): Session {
  const scenario = debug.etat ?? debug.scenario?.before;
  const human = humanSeat(colour, scenario);
  const k = quarterTurnsFor(human);
  const testSpeed = debug.vitesse === "test";

  const paceNow = (): DirectorMode =>
    testSpeed ? "test" : settings.reduceMotion ? "reduced" : settings.fast ? "fast" : "normal";
  const director = createDirector({
    animator: env.animator,
    audio: env.audio ?? audio,
    quarterTurns: k,
    facingOf: env.facingOf,
    commit: env.commit,
    document: env.document,
    getMode: paceNow,
  });
  // The controller hands every play to the Director; the session listens in to word the bots' plays.
  let lastPlay = $state.raw<BotPlay | null>(null);
  const watched = {
    enqueue(events: GameEvent[]): void {
      const played = events.find(
        (event) => event.t === "cardPlayed" || event.t === "handDiscarded",
      );
      if (played !== undefined && played.seat !== human) lastPlay = { seat: played.seat, events };
      director.enqueue(events);
    },
    // The controller awaits this before a bot's turn and again after its think delay: the Director's
    // queue, then the screen's hold, so no computer player acts behind the invitation (plan 01-38).
    async idle(): Promise<void> {
      await director.idle();
      await env.hold?.();
    },
  };
  const controller: ReturnType<ControllerFactory> = makeController
    ? makeController({ ...watched, reset: (view) => director.reset(view) })
    : createLocal();

  function createLocal(): GameController {
    return createGame({
      human,
      seed: debug.graine,
      botSeed: debug.graine === undefined ? undefined : botSeedFrom(debug.graine),
      speed: (): Speed => (testSpeed ? "test" : settings.fast ? "fast" : "normal"),
      // A debug scenario's human is its turn seat: the roles are read from that seat.
      levels: levelsByColour(settings.botLevels, human),
      scenario,
      director: watched,
      // The Champion searches in slices that let the page breathe, within the cap of the speed; the
      // controller's clock and the runner's are the same (performance.now, the controller's default).
      runner: createInlineRunner({
        now: () => performance.now(),
        isHidden: () => document.hidden,
      }),
    });
  }

  let view = $state.raw<PlayerView>(controller.view());
  let render = $state.raw<RenderState | null>(null);
  let ui = $state.raw<TurnUiState>(initialTurnUi);
  let hint = $state.raw<Reason | "illegal" | null>(null);
  let thinking = $state.raw<Color | null>(null);
  let failure = $state.raw<{ error: unknown } | null>(null);
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
  director.reset(controller.view());

  // Only the latest request counts: an earlier one may have found the Director idle just before the
  // play it belongs to was enqueued (the controller notifies before and after a bot's play), and
  // would unlock the board while the move is still animating.
  let syncTicket = 0;
  async function syncWhenIdle(): Promise<void> {
    const ticket = ++syncTicket;
    await director.idle();
    if (disposed || ticket !== syncTicket) return;
    ui = reduceTurnUi(ui, { t: "sync" }, ctx()).state;
  }

  controller.onError((error) => {
    if (!disposed) failure = { error };
  });

  // Online, the server refuses an illegal act after submit() has answered: worded exactly like a
  // refused local move (nothing changed, the interaction starts again from the view).
  controller.onRefused?.(() => {
    if (disposed) return;
    hint = "illegal";
    ui = reduceTurnUi(ui, { t: "sync" }, ctx()).state;
  });

  controller.onChange(() => {
    view = controller.view();
    thinking = controller.thinking();
    void syncWhenIdle();
  });

  return {
    human,
    k,
    get pace() {
      return paceNow();
    },
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
    get lastPlay() {
      return lastPlay;
    },
    get failure() {
      return failure;
    },
    stats: () => controller.stats(),
    start() {
      ui = reduceTurnUi(ui, { t: "sync" }, ctx()).state;
      // The first deal of a new game is dealt on screen too: the bots wait for the Director to be idle.
      const opening = controller.openingDeal();
      if (opening.length > 0) director.openDeal(opening);
      controller.start();
    },
    send(event) {
      if (disposed) return;
      const result = reduceTurnUi(ui, event, ctx());
      ui = result.state;
      hint = result.hint ?? null;
      if (result.submit === undefined) return;
      lastPlay = null;
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
