// How the browser runs a computer player's decision (BOT-05, 03-RESEARCH Pattern 8, Pitfalls 5 and 8).
// The bot itself (@toc/bots) counts its work in units and never looks at a clock; the host decides how
// the work meets the wall clock:
// - syncRunner: chooseAction in one go. The default outside the browser session (Node tests, tools),
//   so a test game is the same on every machine.
// - createInlineRunner: steps createThinker on the main thread in slices of about 8 ms, and yields to
//   the event loop between slices through a MessageChannel message, so the page keeps painting and
//   answering while the Champion searches. A MessageChannel, because background tabs throttle timers
//   (Chrome clamps them to 1 s or more) and scheduler.yield is not in Safari. At each slice boundary:
//   past the deadline, the best move found so far is played (the anytime result()); while the page is
//   hidden, nobody watches, so the rest of the work runs at once; a cancelled think stops.
// This file is the only place where the web app slices a search (the bench page of plan 03-06 reuses
// it with no deadline). No timer here: the controller owns the pace.

import {
  type BotLevel,
  type Budget,
  chooseAction,
  createThinker,
  type Thinker,
  type Thought,
} from "@toc/bots";
import type { Color, PlayerView, Rng } from "@toc/engine";

/** One decision to make: the bot's own view only (BOT-04), and the wall-clock limit of the search. */
export type ThinkRequest = {
  view: PlayerView;
  seat: Color;
  level: BotLevel;
  rng: Rng;
  budget?: Budget;
  /** On the runner's clock: the search stops at this time with its best move so far. Null: no limit. */
  deadline: number | null;
};

export type BotRunner = {
  think(request: ThinkRequest): Promise<Thought>;
  /** Settles every think in progress (it rejects with ThinkCancelled) and stops its work. */
  cancel(): void;
};

/** The rejection of a cancelled think: the game was left, not a failure. */
export class ThinkCancelled extends Error {
  constructor() {
    super("the think was cancelled");
    this.name = "ThinkCancelled";
  }
}

/** The whole decision at once (the deadline is not needed: nothing is sliced). */
export const syncRunner: BotRunner = {
  async think(request) {
    return chooseAction(request.view, request.seat, request.level, request.rng, request.budget);
  },
  cancel() {},
};

/** The length of a slice of search between two yields, in ms. */
export const SLICE_MS = 8;
/** The work asked of the thinker per step: one rollout of the Champion; levels 1 to 4 end in one step. */
const STEP_UNITS = 1;

export type InlineRunnerOptions = {
  /** The clock of the slices and of the deadline, in ms (performance.now in the browser). */
  now: () => number;
  /** True while nobody can see the page (document.hidden): the rest of the work then runs at once. */
  isHidden: () => boolean;
  sliceMs?: number;
};

/** The runner of the game in the browser: the search in slices that let the page breathe. */
export function createInlineRunner(options: InlineRunnerOptions): BotRunner {
  const { now, isHidden, sliceMs = SLICE_MS } = options;
  const active = new Set<() => void>();

  function think(request: ThinkRequest): Promise<Thought> {
    return new Promise<Thought>((resolve, reject) => {
      let thinker: Thinker;
      try {
        thinker = createThinker(
          request.view,
          request.seat,
          request.level,
          request.rng,
          request.budget,
        );
      } catch (error) {
        reject(error);
        return;
      }
      const { deadline } = request;
      let settled = false;
      // One channel per think, closed when it settles (an open port keeps a Node process alive).
      let channel: MessageChannel | null = null;

      const settle = (): void => {
        settled = true;
        active.delete(cancel);
        channel?.port1.close();
        channel = null;
      };
      const cancel = (): void => {
        if (settled) return;
        settle();
        reject(new ThinkCancelled());
      };
      const finish = (): void => {
        const thought = thinker.result();
        settle();
        resolve(thought);
      };
      const past = (): boolean => deadline !== null && now() >= deadline;

      const slice = (): void => {
        if (settled) return;
        try {
          const begin = now();
          for (;;) {
            if (thinker.step(STEP_UNITS)) {
              finish();
              return;
            }
            const t = now();
            if (deadline !== null && t >= deadline) {
              finish();
              return;
            }
            if (t - begin >= sliceMs) break;
          }
          if (isHidden()) {
            // Nobody watches, and a hidden page would throttle the yields: the rest at once.
            while (!thinker.step(STEP_UNITS) && !past()) {
              // Each step runs one more rollout, until the budget or the deadline.
            }
            finish();
            return;
          }
          if (channel === null) {
            channel = new MessageChannel();
            channel.port1.onmessage = slice;
          }
          channel.port2.postMessage(null);
        } catch (error) {
          if (settled) return;
          settle();
          reject(error);
        }
      };

      active.add(cancel);
      slice();
    });
  }

  return {
    think,
    cancel() {
      for (const cancel of [...active]) cancel();
    },
  };
}
