import type { Mode } from "@toc/board";
import {
  type CardId,
  type Color,
  type GameEvent,
  type Rng,
  scenarioState,
  viewFor,
} from "@toc/engine";
import { describe, expect, it } from "vitest";
import type { SoundId } from "../audio/sounds.ts";
import type { Facing } from "../board/geometry.ts";
import { createDirector, type DirectorMode, LEAD_S, type VisibilitySource } from "./director.ts";

// What the Director asks of the card animator and of the audio for each card event: which motion, with
// which delay and pace, which sound at which time, and when the felt and the hands are counted. The
// pictures are checked in e2e/animations.spec.ts.

const SEED: Rng = [3, 1, 4, 1];
const NOW = 10;
const T0 = NOW + LEAD_S;
const LEAD = LEAD_S * 1000;

type Call = { name: string; lead: number; mode: Mode; args: unknown[] };

function start() {
  return viewFor(
    scenarioState({ turn: "bleu", hands: { bleu: ["5H", "9S"], jaune: ["2S"] } }, SEED),
    "bleu",
  );
}

function fakeDocument() {
  const listeners = new Set<() => void>();
  const doc = {
    hidden: false as boolean,
    addEventListener: (_: "visibilitychange", l: () => void) => listeners.add(l),
    removeEventListener: (_: "visibilitychange", l: () => void) => listeners.delete(l),
  } satisfies VisibilitySource;
  return {
    doc,
    set(hidden: boolean) {
      doc.hidden = hidden;
      for (const l of [...listeners]) l();
    },
  };
}

function rig(mode: () => DirectorMode = () => "normal", doc?: VisibilitySource) {
  const calls: Call[] = [];
  const cues: { id: SoundId; at: number }[] = [];
  const folds: string[] = [];
  const resolvers: (() => void)[] = [];
  let hold = false;
  let finished = 0;
  const note =
    (name: string) =>
    (...args: unknown[]): Promise<void> => {
      const mode = args[args.length - 1] as Mode;
      const lead = args[args.length - 2] as number;
      calls.push({ name, lead, mode, args: args.slice(0, -2) });
      if (!hold) return Promise.resolve();
      return new Promise<void>((resolve) => resolvers.push(resolve));
    };
  const director = createDirector({
    animator: {
      hop: () => Promise.resolve(),
      deal: note("deal"),
      playCard: note("playCard"),
      exchange: note("exchange"),
      lay: note("lay"),
      finishCards: () => {
        finished++;
        for (const resolve of resolvers.splice(0)) resolve();
      },
    },
    audio: {
      now: () => NOW,
      scheduleClops: () => {},
      cue: (id, at) => cues.push({ id, at: at ?? NOW }),
    },
    quarterTurns: 0,
    facingOf: () => "right" as Facing,
    commit: () => {},
    getMode: mode,
    initial: start(),
    ...(doc === undefined ? {} : { document: doc }),
  });
  director.onRender((state) => {
    folds.push(
      `${state.phase}|talon ${state.talonSize}|hands ${Object.values(state.handSizes).join(",")}`,
    );
  });
  return {
    director,
    calls,
    cues,
    folds,
    finishedCount: () => finished,
    hold: () => {
      hold = true;
    },
    release: () => {
      hold = false;
    },
  };
}

const dealt = (dealIndex: 0 | 1 | 2, size: number, dealer: Color = "bleu"): GameEvent[] => [
  { t: "dealt", dealer, dealIndex, size },
  { t: "handDealt", seat: "jaune", cards: Array.from({ length: size }, () => "2S" as CardId) },
  { t: "handDealt", seat: "rouge", cards: Array.from({ length: size }, () => "3S" as CardId) },
  { t: "handDealt", seat: "vert", cards: Array.from({ length: size }, () => "4S" as CardId) },
  { t: "handDealt", seat: "bleu", cards: Array.from({ length: size }, () => "5S" as CardId) },
];

const named = (calls: Call[], name: string) => calls.filter((c) => c.name === name);

describe("a deal", () => {
  it("flies the cards of the four hands in dealing order, with the riffle at t0", async () => {
    const h = rig();
    h.director.enqueue(dealt(0, 5));
    await h.director.idle();
    expect(named(h.calls, "deal")).toEqual([
      {
        name: "deal",
        lead: LEAD,
        mode: "normal",
        args: [
          [
            { seat: "jaune", count: 5 },
            { seat: "rouge", count: 5 },
            { seat: "vert", count: 5 },
            { seat: "bleu", count: 5 },
          ],
        ],
      },
    ]);
    expect(h.cues).toEqual([{ id: "carte-donne", at: T0 }]);
  });

  it("opens the exchange first (the banner), then counts the hands once the cards have landed", async () => {
    const h = rig();
    h.hold();
    h.director.enqueue(dealt(1, 4));
    await Promise.resolve();
    await Promise.resolve();
    // The deal is in flight: the exchange is open, no hand has been counted yet.
    expect(h.director.renderState?.phase).toBe("exchange");
    expect(h.director.renderState?.dealIndex).toBe(1);
    expect(h.director.renderState?.handSizes.jaune).toBe(1);
    await h.director.snapToEnd();
    expect(h.director.renderState?.handSizes).toEqual({ bleu: 4, jaune: 4, rouge: 4, vert: 4 });
    expect(h.director.renderState?.talonSize).toBe(start().talonSize - 16);
  });

  it("goes fast with the pace it is given, and reduced as well", async () => {
    for (const mode of ["fast", "reduced"] as const) {
      const h = rig(() => mode);
      h.director.enqueue(dealt(0, 5));
      await h.director.idle();
      expect(named(h.calls, "deal")[0]?.mode).toBe(mode);
    }
  });

  it("the first deal of a game starts from a talon of 52 and empty hands", async () => {
    const h = rig();
    h.hold();
    h.director.openDeal(dealt(0, 5));
    expect(h.director.renderState?.talonSize).toBe(start().talonSize + 2 + 1);
    expect(h.director.renderState?.handSizes).toEqual({ bleu: 0, jaune: 0, rouge: 0, vert: 0 });
    await h.director.snapToEnd();
    expect(h.director.renderState?.handSizes).toEqual({ bleu: 5, jaune: 5, rouge: 5, vert: 5 });
    expect(h.director.renderState?.talonSize).toBe(start().talonSize + 3 - 20);
  });

  it("is applied at once, without a motion or a sound, in test mode", async () => {
    const h = rig(() => "test");
    h.director.enqueue(dealt(0, 5));
    await h.director.idle();
    expect(h.calls).toEqual([]);
    expect(h.cues).toEqual([]);
    expect(h.director.renderState?.handSizes.bleu).toBe(5);
  });
});

describe("a played card", () => {
  const played: GameEvent = { t: "cardPlayed", seat: "jaune", card: "2S" };

  it("flies to the felt slot with the card-down sound, then the felt shows it", async () => {
    const h = rig();
    h.hold();
    h.director.enqueue([played]);
    await Promise.resolve();
    await Promise.resolve();
    expect(named(h.calls, "playCard")).toEqual([
      { name: "playCard", lead: LEAD, mode: "normal", args: ["jaune", "2S"] },
    ]);
    expect(h.cues).toEqual([{ id: "carte-pose", at: T0 }]);
    // Still flying: the felt does not show it yet.
    expect(h.director.renderState?.lastPlayed.jaune).toBeNull();
    await h.director.snapToEnd();
    expect(h.director.renderState?.lastPlayed.jaune).toBe("2S");
    expect(h.director.renderState?.handSizes.jaune).toBe(0);
  });

  it("plays the cards of a play one after the other", async () => {
    const h = rig();
    h.director.enqueue([
      played,
      { t: "cardPlayed", seat: "bleu", card: "5H" },
      { t: "cardPlayed", seat: "rouge", card: "3S" },
    ]);
    await h.director.idle();
    expect(named(h.calls, "playCard").map((c) => c.args[0])).toEqual(["jaune", "bleu", "rouge"]);
    expect(h.cues.map((c) => c.id)).toEqual(["carte-pose", "carte-pose", "carte-pose"]);
  });
});

describe("the exchange", () => {
  const exchanged: GameEvent = {
    t: "cardsExchanged",
    received: { bleu: "2S", jaune: "3S", rouge: "4S", vert: "5S" },
  };

  it("crosses the cards with the slide sound, then opens the play", async () => {
    const h = rig();
    h.hold();
    h.director.enqueue([exchanged]);
    await Promise.resolve();
    await Promise.resolve();
    expect(named(h.calls, "exchange")).toEqual([
      { name: "exchange", lead: LEAD, mode: "normal", args: [] },
    ]);
    expect(h.cues).toEqual([{ id: "carte-echange", at: T0 }]);
    expect(h.director.renderState?.phase).toBe("play");
  });
});

describe("a dead hand", () => {
  it("lays its cards in front of the seat with one card-down sound", async () => {
    const h = rig();
    h.director.enqueue([{ t: "handDiscarded", seat: "bleu", cards: ["5H", "9S"] }]);
    await h.director.idle();
    expect(named(h.calls, "lay")).toEqual([
      { name: "lay", lead: LEAD, mode: "normal", args: ["bleu", ["5H", "9S"]] },
    ]);
    expect(h.cues).toEqual([{ id: "carte-pose", at: T0 }]);
    expect(h.director.renderState?.posed.bleu).toEqual(["5H", "9S"]);
  });
});

describe("a hidden tab and the fast-forward", () => {
  it("jumps the cards in flight to their end, folds the rest silently and plays no sound", async () => {
    const view = fakeDocument();
    const h = rig(() => "normal", view.doc);
    h.hold();
    h.director.enqueue([{ t: "cardPlayed", seat: "jaune", card: "2S" }]);
    await Promise.resolve();
    await Promise.resolve();
    expect(h.cues).toHaveLength(1);
    // The tab is hidden mid-flight, and more events arrive: all applied at once, no new sound.
    view.set(true);
    h.director.enqueue([
      { t: "cardPlayed", seat: "bleu", card: "5H" },
      ...dealt(1, 4),
      { t: "handDiscarded", seat: "rouge", cards: ["3S"] },
    ]);
    await h.director.idle();
    expect(h.finishedCount()).toBeGreaterThan(0);
    expect(h.cues).toHaveLength(1);
    expect(named(h.calls, "playCard")).toHaveLength(1);
    expect(named(h.calls, "deal")).toHaveLength(0);
    expect(named(h.calls, "lay")).toHaveLength(0);
    expect(h.director.renderState?.lastPlayed.bleu).toBe("5H");
    expect(h.director.renderState?.handSizes.bleu).toBe(4);
    // Back on screen, the next event moves and sounds again.
    view.set(false);
    h.release();
    h.director.enqueue([{ t: "cardPlayed", seat: "vert", card: "4S" }]);
    await h.director.idle();
    expect(h.cues.map((c) => c.id)).toEqual(["carte-pose", "carte-pose"]);
  });

  it("an animator without card motions still applies every card event", async () => {
    const director = createDirector({
      animator: { hop: () => Promise.resolve() },
      audio: { now: () => NOW, scheduleClops: () => {} },
      quarterTurns: 0,
      facingOf: () => "right" as Facing,
      commit: () => {},
      initial: start(),
    });
    director.enqueue([{ t: "cardPlayed", seat: "jaune", card: "2S" }, ...dealt(0, 5)]);
    await director.idle();
    expect(director.renderState?.lastPlayed.jaune).toBe("2S");
    expect(director.renderState?.handSizes.bleu).toBe(5);
  });
});
