// The online game as a GameController (02-RESEARCH Pattern 14): the same contract as the local game, so
// the session, the Director and the whole game screen work unchanged. The server holds the state and
// plays the computers; this controller only follows its frames and sends the human's actions.
//
// submit() sends act { base: seq, action } and answers ok at once: the move shows when the server's
// events frame comes back, built for this seat only. A stale act is silent (the server sends a fresh
// welcome, which resets the Director); an illegal one reaches onRefused, which words it like a refused
// local move. Pure TypeScript: the connection is passed in, so Node tests use a fake one.

import { type Color, type GameEvent, nextColor, type PlayerView, teamOf } from "@toc/engine";
import type { ClientFrame, EventsFrame, ServerFrame, TablePublic, You } from "@toc/protocol";
import type { GameController, GameDirector } from "../game/GameController.ts";
import { table as copy } from "../i18n/fr/table.ts";

/** The events of a game start: the first frame is dealt on screen, the later ones follow it. */
export type StartBatch = { first: EventsFrame; later: EventsFrame[] };

/** What the controller reads from the table connection (connection.svelte.ts). */
export type RemoteConnection = {
  readonly you: You | null;
  readonly table: TablePublic | null;
  readonly view: PlayerView | null;
  readonly seq: number;
  /** False when the socket is not open: nothing was sent. */
  send(frame: ClientFrame): boolean;
  onFrame(listener: (frame: ServerFrame) => void): () => void;
  /** The frames of the latest game start, once: null when the game was already running. */
  takeStart(): StartBatch | null;
};

/** What the controller needs from the Director: GameDirector plus the snapshot reset. */
export type RemoteDirector = GameDirector & { reset(view: PlayerView): void };

export type RemoteGame = GameController & {
  /** Called when the server refuses the human's action as illegal. */
  onRefused(listener: () => void): () => void;
};

const SELF = "toi";

export function createRemoteGame(
  connection: RemoteConnection,
  director: RemoteDirector,
): RemoteGame {
  const human = connection.you?.seat;
  if (human === null || human === undefined) throw new Error("createRemoteGame: no seat");
  const startBatch = connection.takeStart();
  let view: PlayerView | null = startBatch?.first.view ?? connection.view;
  let seq = startBatch?.first.seq ?? connection.seq;
  let table = connection.table;
  if (view === null) throw new Error("createRemoteGame: no view");
  const opening: GameEvent[] = startBatch?.first.events ?? [];

  const listeners = new Set<() => void>();
  const refusedListeners = new Set<() => void>();
  let started = false;
  let disposed = false;
  /** Frames that came before the screen started: played after the opening deal. */
  const early: ServerFrame[] = [...(startBatch?.later ?? [])];

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  function handle(frame: ServerFrame): void {
    switch (frame.t) {
      case "events":
        seq = frame.seq;
        view = frame.view;
        if (frame.events.length > 0) director.enqueue(frame.events);
        notify();
        return;
      case "welcome":
        table = frame.table;
        seq = frame.seq;
        if (frame.view !== null) {
          view = frame.view;
          director.reset(frame.view);
        }
        notify();
        return;
      case "table":
        table = frame.table;
        notify();
        return;
      case "error":
        if (frame.code === "illegal") for (const listener of [...refusedListeners]) listener();
        return;
    }
  }

  const unsubscribe = connection.onFrame((frame) => {
    if (disposed) return;
    if (started) handle(frame);
    else early.push(frame);
  });

  /** A seat the computer plays for its absent person reads « {Nom} (ordinateur) » (plan 02-06). */
  function names(): Record<Color, string> {
    const out = {} as Record<Color, string>;
    for (const color of ["bleu", "jaune", "rouge", "vert"] as const) {
      const seat = table?.seats[color];
      const name = seat?.name ?? "";
      out[color] =
        color === human
          ? SELF
          : seat?.kind === "human" && seat.handedOver !== null
            ? copy.game.handedOverName(name)
            : name;
    }
    return out;
  }

  return {
    human,
    get names() {
      return names();
    },
    view: () => view as PlayerView,
    openingDeal: () => opening,
    submit(action) {
      if (disposed) return { ok: false, error: "illegal" };
      const sent = connection.send({ t: "act", base: seq, action });
      return sent ? { ok: true } : { ok: false, error: "illegal" };
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onRefused(listener) {
      refusedListeners.add(listener);
      return () => refusedListeners.delete(listener);
    },
    // The server plays the computers: no loop here can fail.
    onError: () => () => {},
    stats() {
      const current = view as PlayerView;
      return {
        dealsPlayed: current.dealsPlayed,
        captured: {
          nous: current.captures[teamOf(human)],
          eux: current.captures[teamOf(nextColor(human))],
        },
      };
    },
    thinking: () => table?.thinking ?? null,
    start() {
      if (started || disposed) return;
      started = true;
      for (const frame of early.splice(0)) handle(frame);
    },
    dispose() {
      disposed = true;
      unsubscribe();
      listeners.clear();
      refusedListeners.clear();
    },
  };
}
