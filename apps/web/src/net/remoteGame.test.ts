import {
  type Action,
  type CardId,
  type Color,
  type GameEvent,
  newGame,
  type PlayerView,
  viewFor,
} from "@toc/engine";
import type { ClientFrame, EventsFrame, ServerFrame, TablePublic, You } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { createRemoteGame, type RemoteConnection, type StartBatch } from "./remoteGame.ts";

const STATE = newGame({ firstDealer: "vert" }, [1, 2, 3, 4]);

const TABLE: TablePublic = {
  status: "playing",
  seats: {
    bleu: { kind: "human", name: "Ana", level: 3, online: true },
    jaune: { kind: "human", name: "Ben", level: 3, online: true },
    rouge: { kind: "bot", name: "Tornado", level: 3, online: true },
    vert: { kind: "bot", name: "Ourasi", level: 3, online: true },
  },
  host: "bleu",
  creatorName: "Ana",
  gameNo: 1,
  thinking: null,
  unseated: [],
};

function fakeConnection(options: { seat?: Color; seq?: number; start?: StartBatch | null } = {}) {
  const seat = options.seat ?? "jaune";
  const sent: ClientFrame[] = [];
  const listeners = new Set<(frame: ServerFrame) => void>();
  let start = options.start ?? null;
  const connection: RemoteConnection & { emit(frame: ServerFrame): void; sent: ClientFrame[] } = {
    you: { seat, host: false } satisfies You,
    table: TABLE,
    view: viewFor(STATE, seat),
    seq: options.seq ?? 7,
    sent,
    send(frame) {
      sent.push(frame);
      return true;
    },
    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    takeStart() {
      const taken = start;
      start = null;
      return taken;
    },
    emit(frame) {
      for (const listener of [...listeners]) listener(frame);
    },
  };
  return connection;
}

function fakeDirector() {
  const log: string[] = [];
  return {
    log,
    enqueue(events: GameEvent[]) {
      log.push(`enqueue:${events.map((e) => e.t).join(",")}`);
    },
    reset(view: PlayerView) {
      log.push(`reset:${view.seat}`);
    },
    idle: () => Promise.resolve(),
  };
}

const eventsFrame = (seq: number, events: GameEvent[], seat: Color = "jaune"): EventsFrame => ({
  t: "events",
  seq,
  events,
  view: { ...viewFor(STATE, seat), dealsPlayed: seq },
});

describe("createRemoteGame", () => {
  it("sends act with the current seq as base and answers ok at once", () => {
    const connection = fakeConnection({ seq: 7 });
    const game = createRemoteGame(connection, fakeDirector());
    const action: Action = { t: "give", card: STATE.hands.jaune[0] as CardId };
    expect(game.submit(action)).toEqual({ ok: true });
    expect(connection.sent).toEqual([{ t: "act", base: 7, action }]);
  });

  it("follows events frames: the view, the seq, the director and onChange", () => {
    const connection = fakeConnection();
    const director = fakeDirector();
    const game = createRemoteGame(connection, director);
    let changes = 0;
    game.onChange(() => changes++);
    game.start();
    connection.emit(eventsFrame(8, [{ t: "turn", seat: "rouge" }]));
    expect(changes).toBe(1);
    expect(game.view().dealsPlayed).toBe(8);
    expect(director.log).toEqual(["enqueue:turn"]);
    game.submit({ t: "discard" });
    expect(connection.sent.at(-1)).toMatchObject({ t: "act", base: 8 });
  });

  it("is silent on a stale error and reports an illegal one as refused", () => {
    const connection = fakeConnection();
    const game = createRemoteGame(connection, fakeDirector());
    const refused: string[] = [];
    game.onRefused?.(() => refused.push("illegal"));
    game.start();
    connection.emit({ t: "error", code: "stale" });
    expect(refused).toEqual([]);
    connection.emit({ t: "error", code: "illegal" });
    expect(refused).toEqual(["illegal"]);
  });

  it("resets the director on a welcome during the game", () => {
    const connection = fakeConnection();
    const director = fakeDirector();
    const game = createRemoteGame(connection, director);
    game.start();
    connection.emit({
      t: "welcome",
      you: { seat: "jaune", host: false },
      table: TABLE,
      view: { ...viewFor(STATE, "jaune"), dealsPlayed: 2 },
      seq: 12,
    });
    expect(director.log).toEqual(["reset:jaune"]);
    expect(game.view().dealsPlayed).toBe(2);
    game.submit({ t: "discard" });
    expect(connection.sent.at(-1)).toMatchObject({ base: 12 });
  });

  it("names the own seat « toi », the other people by first name and the computers by horse", () => {
    const game = createRemoteGame(fakeConnection({ seat: "jaune" }), fakeDirector());
    expect(game.human).toBe("jaune");
    expect(game.names).toEqual({ bleu: "Ana", jaune: "toi", rouge: "Tornado", vert: "Ourasi" });
  });

  it("deals the start events once the screen starts, then plays what came after", () => {
    const first = eventsFrame(1, [{ t: "dealt", dealer: "vert", dealIndex: 0, size: 5 }]);
    const later = eventsFrame(2, [{ t: "turn", seat: "bleu" }]);
    const connection = fakeConnection({ seq: 2, start: { first, later: [later] } });
    const director = fakeDirector();
    const game = createRemoteGame(connection, director);
    expect(game.view()).toEqual(first.view);
    expect(game.openingDeal()).toEqual(first.events);
    connection.emit(eventsFrame(3, [{ t: "cardPlayed", seat: "rouge", card: "5H" }]));
    expect(director.log).toEqual([]);
    game.start();
    expect(director.log).toEqual(["enqueue:turn", "enqueue:cardPlayed"]);
    expect(game.view().dealsPlayed).toBe(3);
  });

  it("reads the thinking seat and the stats from the table and the view", () => {
    const connection = fakeConnection();
    const game = createRemoteGame(connection, fakeDirector());
    game.start();
    connection.emit({ t: "table", table: { ...TABLE, thinking: "vert" } });
    expect(game.thinking()).toBe("vert");
    expect(game.stats()).toEqual({ dealsPlayed: 0, captured: { nous: 0, eux: 0 } });
  });

  it("a table frame moves the thinking sign: onChange runs, so the session follows it", () => {
    const connection = fakeConnection();
    const game = createRemoteGame(connection, fakeDirector());
    let changes = 0;
    game.onChange(() => changes++);
    game.start();
    expect(game.thinking()).toBeNull();
    connection.emit({ t: "table", table: { ...TABLE, thinking: "jaune" } });
    expect(game.thinking()).toBe("jaune");
    expect(changes).toBe(1);
    connection.emit({ t: "table", table: { ...TABLE, thinking: null } });
    expect(game.thinking()).toBeNull();
    expect(changes).toBe(2);
  });

  it("stops listening once disposed", () => {
    const connection = fakeConnection();
    const game = createRemoteGame(connection, fakeDirector());
    let changes = 0;
    game.onChange(() => changes++);
    game.start();
    game.dispose();
    connection.emit(eventsFrame(9, []));
    expect(changes).toBe(0);
    expect(game.submit({ t: "discard" })).toEqual({ ok: false, error: "illegal" });
  });
});
