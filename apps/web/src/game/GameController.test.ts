import { randomLegal } from "@toc/bots";
import {
  type Action,
  type CardId,
  COLORS,
  type Color,
  type GameEvent,
  type PlayerView,
  type Scenario,
} from "@toc/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOT_NAMES } from "./botNames.ts";
import { createGame, type GameDirector, type Speed } from "./GameController.ts";
import source from "./GameController.ts?raw";

// The real bot, wrapped so the tests can see what it was called with.
vi.mock("@toc/bots", async (importOriginal) => {
  const original = await importOriginal<typeof import("@toc/bots")>();
  return { ...original, randomLegal: vi.fn(original.randomLegal) };
});

const SEED: [number, number, number, number] = [11, 22, 33, 44];
const BOT_SEED: [number, number, number, number] = [55, 66, 77, 88];

type FakeDirector = GameDirector & {
  events: GameEvent[];
  calls: number;
  /** While set, idle() waits for it. */
  hold?: Promise<void>;
};

function fakeDirector(): FakeDirector {
  const director: FakeDirector = {
    events: [],
    calls: 0,
    enqueue(events) {
      director.calls++;
      director.events.push(...events);
    },
    idle: () => director.hold ?? Promise.resolve(),
  };
  return director;
}

function newGameFor(speed: Speed | (() => Speed), human: Color = "bleu") {
  const director = fakeDirector();
  const game = createGame({ human, seed: SEED, botSeed: BOT_SEED, speed, director });
  return { game, director };
}

/** A board where every colour has one knight on the ring, far from the others. */
const PAWNS: NonNullable<Scenario["before"]["pawns"]> = {
  bleu: [{ p: 5 }, "S", "S", "S"],
  jaune: [{ p: 5 }, "S", "S", "S"],
  rouge: [{ p: 5 }, "S", "S", "S"],
  vert: [{ p: 5 }, "S", "S", "S"],
};

function play(hands: Partial<Record<Color, CardId[]>>, turn: Color = "bleu"): Scenario["before"] {
  return { pawns: PAWNS, hands, turn, phase: "play" };
}

function scenarioGame(before: Scenario["before"], speed: Speed | (() => Speed)) {
  const director = fakeDirector();
  const game = createGame({
    human: "rouge", // overridden by the scenario's turn seat
    seed: SEED,
    botSeed: BOT_SEED,
    speed,
    scenario: before,
    director,
  });
  return { game, director };
}

const sizes = (view: PlayerView) => view.handSizes;

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(randomLegal).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createGame: set-up", () => {
  it("names the three bots from the horse list, without repeats", () => {
    const { game } = newGameFor("test");
    const bots = COLORS.filter((c) => c !== "bleu").map((c) => game.names[c]);
    expect(new Set(bots).size).toBe(3);
    for (const name of bots) expect(BOT_NAMES as readonly string[]).toContain(name);
    expect(game.names.bleu).toBe("toi");
  });

  it("starts in the exchange of the first deal, the human holding five cards", () => {
    const { game } = newGameFor("test");
    const view = game.view();
    expect(view.kind).toBe("view");
    expect(view.seat).toBe("bleu");
    expect(view.phase).toBe("exchange");
    expect(view.hand).toHaveLength(5);
    expect(view.dealsPlayed).toBe(0);
  });

  it("is reproducible from its seeds", () => {
    const a = newGameFor("test").game.view();
    const b = newGameFor("test").game.view();
    expect(b).toEqual(a);
  });

  it("draws the deck and the bot seeds from crypto.getRandomValues, never from the clock or Math", () => {
    const random = vi.spyOn(Math, "random");
    const crypt = vi.spyOn(globalThis.crypto, "getRandomValues");
    const director = fakeDirector();
    const a = createGame({ human: "bleu", speed: "test", director });
    const b = createGame({ human: "bleu", speed: "test", director });
    expect(crypt).toHaveBeenCalledTimes(4);
    for (const call of crypt.mock.calls) {
      expect(call[0]).toBeInstanceOf(Uint32Array);
      expect((call[0] as Uint32Array).length).toBe(4);
    }
    expect(random).not.toHaveBeenCalled();
    expect(a.view().hand).not.toEqual(b.view().hand);
    a.dispose();
    b.dispose();
  });

  it("keeps the random source out of the controller code", () => {
    expect(source).toContain("getRandomValues");
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/Date\.now|new Date/);
  });

  it("takes the scenario's turn seat as the human", () => {
    const { game } = scenarioGame(play({ jaune: ["5H", "6H"], bleu: ["2S"] }, "jaune"), "test");
    expect(game.human).toBe("jaune");
    expect(game.view().seat).toBe("jaune");
    expect(game.view().hand).toEqual(["5H", "6H"]);
    expect(game.view().turn).toBe("jaune");
    expect(game.names.jaune).toBe("toi");
  });
});

describe("bots: think delay and view-only play (D-18)", () => {
  it("gives the three bots' cards one at a time, each after a 700 to 1300 ms think", async () => {
    const { game } = newGameFor("normal");
    game.start();
    const given = () => COLORS.filter((c) => game.view().hasGiven[c]).length;

    await vi.advanceTimersByTimeAsync(699);
    expect(given()).toBe(0);
    await vi.advanceTimersByTimeAsync(601); // 1300 ms in all
    expect(given()).toBe(1);
    await vi.advanceTimersByTimeAsync(699);
    expect(given()).toBe(1);
    await vi.advanceTimersByTimeAsync(601);
    expect(given()).toBe(2);
    await vi.advanceTimersByTimeAsync(1300);
    expect(given()).toBe(3);
    // Then it waits for the human, however long.
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(given()).toBe(3);
    expect(game.view().hasGiven.bleu).toBe(false);
    expect(game.view().phase).toBe("exchange");
    game.dispose();
  });

  it("thinks 200 to 300 ms in fast mode and not at all at test speed", async () => {
    const hands = { bleu: ["5H", "6H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] } as const;
    const before = play({ ...hands, bleu: [...hands.bleu] } as never);

    const fast = scenarioGame(before, "fast");
    fast.game.start();
    expect(fast.game.submit({ t: "move", card: "5H", pawn: "bleu0" })).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(199);
    expect(sizes(fast.game.view()).jaune).toBe(1);
    await vi.advanceTimersByTimeAsync(101);
    expect(sizes(fast.game.view()).jaune).toBe(0);
    expect(sizes(fast.game.view()).rouge).toBe(1);
    fast.game.dispose();

    const quick = scenarioGame(before, "test");
    quick.game.start();
    quick.game.submit({ t: "move", card: "5H", pawn: "bleu0" });
    await vi.runAllTimersAsync();
    const view = quick.game.view();
    expect(sizes(view)).toEqual({ bleu: 1, jaune: 0, rouge: 0, vert: 0 });
    expect(view.turn).toBe("bleu");
    quick.game.dispose();
  });

  it("reads the speed again for every bot step", async () => {
    let speed: Speed = "normal";
    const hands = { bleu: ["5H", "6H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] };
    const { game } = scenarioGame(play(hands as never), () => speed);
    game.start();
    game.submit({ t: "move", card: "5H", pawn: "bleu0" });
    speed = "fast";
    await vi.advanceTimersByTimeAsync(300);
    expect(sizes(game.view()).jaune).toBe(0);
    game.dispose();
  });

  it("calls the bot with a PlayerView of its own seat, never the full state", async () => {
    const hands = { bleu: ["5H", "6H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] };
    const { game } = scenarioGame(play(hands as never), "test");
    game.start();
    game.submit({ t: "move", card: "5H", pawn: "bleu0" });
    await vi.runAllTimersAsync();

    const calls = vi.mocked(randomLegal).mock.calls;
    expect(calls.map((c) => c[1])).toEqual(["jaune", "rouge", "vert"]);
    for (const [view, seat] of calls) {
      expect(view.kind).toBe("view");
      expect(view.seat).toBe(seat);
      expect(view).not.toHaveProperty("talon");
      expect(view).not.toHaveProperty("hands");
      expect(view).not.toHaveProperty("rng");
    }
    // The jaune bot saw its own card and the size of the others, nothing more.
    const jaune = calls[0]?.[0] as PlayerView;
    expect(jaune.hand).toEqual(["4S"]);
    expect(jaune.handSizes.bleu).toBe(1);
    game.dispose();
  });

  it("follows the engine's clockwise order", async () => {
    const hands = { bleu: ["5H", "6H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] };
    const { game, director } = scenarioGame(play(hands as never), "test");
    game.start();
    game.submit({ t: "move", card: "5H", pawn: "bleu0" });
    await vi.runAllTimersAsync();
    const turns = director.events.flatMap((e) => (e.t === "cardPlayed" ? [e.seat] : []));
    expect(turns).toEqual(["bleu", "jaune", "rouge", "vert"]);
    game.dispose();
  });

  it("lets a bot lay down its dead hand after the think delay", async () => {
    // A lone 4 in the stable-only hand of the jaune bot: nothing can be played.
    const before: Scenario["before"] = {
      pawns: { ...PAWNS, jaune: ["S", "S", "S", "S"] },
      hands: { bleu: ["5H", "6H"], jaune: ["8S"], rouge: ["8D"], vert: ["9C"] },
      turn: "bleu",
    };
    const { game, director } = scenarioGame(before, "fast");
    game.start();
    game.submit({ t: "move", card: "5H", pawn: "bleu0" });
    await vi.advanceTimersByTimeAsync(300);
    expect(director.events.some((e) => e.t === "handDiscarded" && e.seat === "jaune")).toBe(true);
    game.dispose();
  });

  it("waits for the director to be idle before the next bot step", async () => {
    const hands = { bleu: ["5H", "6H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] };
    const { game, director } = scenarioGame(play(hands as never), "fast");
    let release: () => void = () => {};
    director.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    game.start();
    game.submit({ t: "move", card: "5H", pawn: "bleu0" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(sizes(game.view()).jaune).toBe(1);

    director.hold = undefined;
    release();
    await vi.advanceTimersByTimeAsync(300);
    expect(sizes(game.view()).jaune).toBe(0);
    game.dispose();
  });

  it("stops when disposed", async () => {
    const { game } = newGameFor("fast");
    game.start();
    await vi.advanceTimersByTimeAsync(300);
    const before = COLORS.filter((c) => game.view().hasGiven[c]).length;
    expect(before).toBe(1);
    game.dispose();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(COLORS.filter((c) => game.view().hasGiven[c]).length).toBe(before);
  });
});

describe("human: nothing is played for him (D-19, D-20)", () => {
  it("waits for his move when only one is legal", async () => {
    // One card, one knight on the ring: a single legal action.
    const before = play({ bleu: ["5H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] });
    const { game, director } = scenarioGame(before, "test");
    game.start();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(director.events).toEqual([]);
    expect(game.view().hand).toEqual(["5H"]);
    expect(game.view().turn).toBe("bleu");
    game.dispose();
  });

  it("does not lay down his dead hand by itself", async () => {
    const before: Scenario["before"] = {
      pawns: { ...PAWNS, bleu: ["S", "S", "S", "S"] },
      hands: { bleu: ["8S", "9S"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
      turn: "bleu",
    };
    const { game, director } = scenarioGame(before, "test");
    game.start();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(director.events).toEqual([]);
    expect(game.view().hand).toEqual(["8S", "9S"]);

    expect(game.submit({ t: "discard" })).toEqual({ ok: true });
    expect(director.events[0]).toMatchObject({ t: "handDiscarded", seat: "bleu" });
    game.dispose();
  });

  it("waits for his give in the exchange", async () => {
    const { game, director } = newGameFor("test");
    game.start();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(game.view().phase).toBe("exchange");
    expect(director.events).toEqual([]);

    const card = game.view().hand[0] as CardId;
    expect(game.submit({ t: "give", card })).toEqual({ ok: true });
    await vi.runAllTimersAsync();
    expect(game.view().phase).toBe("play");
    expect(director.events.map((e) => e.t)).toContain("cardsExchanged");
    expect(game.view().hand).toHaveLength(5);
    game.dispose();
  });

  it("refuses an illegal submit without changing anything", async () => {
    const { game, director } = newGameFor("fast");
    const changes = vi.fn();
    game.onChange(changes);
    const before = JSON.stringify(game.view());
    const foreign = (["1S", "2S", "3S", "4S", "5S"] as CardId[]).find(
      (card) => !game.view().hand.includes(card),
    ) as CardId;
    const bad: Action[] = [
      { t: "give", card: foreign },
      { t: "discard" },
      { t: "move", card: game.view().hand[0] as CardId, pawn: "bleu0" },
      { t: "give", card: "99Z" as CardId },
    ];
    for (const action of bad) {
      expect(game.submit(action)).toEqual({ ok: false, error: "illegal" });
    }
    expect(JSON.stringify(game.view())).toBe(before);
    expect(changes).not.toHaveBeenCalled();
    expect(director.calls).toBe(0);
    game.dispose();
  });

  it("refuses a second give and a move out of turn", async () => {
    const { game } = newGameFor("test");
    const card = game.view().hand[0] as CardId;
    expect(game.submit({ t: "give", card }).ok).toBe(true);
    expect(game.submit({ t: "give", card: game.view().hand[1] as CardId }).ok).toBe(false);
  });
});

describe("events, change notices and statistics", () => {
  it("hands the events of every action to the director, in order", async () => {
    const hands = { bleu: ["5H", "6H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] };
    const { game, director } = scenarioGame(play(hands as never), "test");
    game.start();
    game.submit({ t: "move", card: "5H", pawn: "bleu0" });
    expect(director.events.slice(0, 2).map((e) => e.t)).toEqual(["cardPlayed", "pawnMoved"]);
    await vi.runAllTimersAsync();
    expect(director.events.filter((e) => e.t === "turn")).toHaveLength(4);
    game.dispose();
  });

  it("tells the listeners after every applied action and lets them stop listening", async () => {
    const hands = { bleu: ["5H", "6H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] };
    const { game } = scenarioGame(play(hands as never), "test");
    const seen = vi.fn();
    const stop = game.onChange(seen);
    game.start();
    game.submit({ t: "move", card: "5H", pawn: "bleu0" });
    expect(seen).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    // The human's move, then the three bots.
    expect(seen.mock.calls.length).toBeGreaterThanOrEqual(4);
    const count = seen.mock.calls.length;
    stop();
    game.submit({ t: "move", card: "6H", pawn: "bleu0" });
    expect(seen).toHaveBeenCalledTimes(count);
    game.dispose();
  });

  it("counts the deals played and the pawns eaten by each side", async () => {
    // Bleu's knight on cell 5 plays a 3 and lands on jaune's knight at cell 8 (progress 62).
    const before: Scenario["before"] = {
      pawns: { ...PAWNS, jaune: [{ p: 62 }, "S", "S", "S"] },
      hands: { bleu: ["3S", "6H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
      turn: "bleu",
    };
    const { game } = scenarioGame(before, "test");
    expect(game.stats()).toEqual({ dealsPlayed: 0, captured: { nous: 0, eux: 0 } });
    game.start();
    expect(game.submit({ t: "move", card: "3S", pawn: "bleu0" })).toEqual({ ok: true });
    expect(game.stats().captured).toEqual({ nous: 1, eux: 0 });
    game.dispose();
  });

  it("plays a whole game of bots and human random moves to the end", async () => {
    // The human plays a random legal move too: the loop must reach a winner without stalling.
    const { game } = newGameFor("test");
    game.start();
    let rng: [number, number, number, number] = [1, 2, 3, 4];
    let guard = 0;
    while (game.view().phase !== "won" && guard++ < 20_000) {
      await vi.runAllTimersAsync();
      const view = game.view();
      if (view.phase === "won") break;
      const [action, next] = randomLegal(view, "bleu", rng);
      rng = next;
      // Only the human's own turn (or his give) is left to play.
      expect(game.submit(action).ok).toBe(true);
    }
    expect(game.view().phase).toBe("won");
    expect(game.view().winner).not.toBeNull();
    expect(game.stats().dealsPlayed).toBeGreaterThan(5);
    game.dispose();
  }, 120_000);
});
