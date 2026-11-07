// The eight lessons replayed in Node (05-RESEARCH Pattern 5, Pitfall 3): from each lesson's position,
// every step's expected event goes through lessonGate, then the real turn reducer and the real engine
// (createGame), up to the « Bravo » condition. Each declared wrong choice is refused with its exact line
// and changes nothing. A script the engine refuses fails here, not in front of Romain.

import {
  type Action,
  type CardId,
  COLORS,
  type Color,
  EXIT,
  type GameEvent,
  type PawnId,
  type PlayerView,
} from "@toc/engine";
import { describe, expect, it } from "vitest";
import { lecons } from "../i18n/fr/lecons.ts";
import type { BotRunner } from "./botRunner.ts";
import { createGame, type GameController } from "./GameController.ts";
import { type LessonEvent, lessonDone, lessonGate, lessonStep } from "./lessonRunner.ts";
import runnerSource from "./lessonRunner.ts?raw";
import { LESSONS, type Lesson, progressOf } from "./lessons.ts";
import lessonsSource from "./lessons.ts?raw";
import { initialTurnUi, reduceTurnUi, type TurnUiState, turnCtx } from "./turnUi.ts";

const SEED: [number, number, number, number] = [7, 14, 21, 28];

/** A runner that fails the replay if any seat thinks: in a lesson nobody else decides anything. */
const noThink: BotRunner = {
  think() {
    throw new Error("a computer thought during a lesson");
  },
  cancel() {},
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

type Driver = {
  game: GameController;
  ui: () => TurnUiState;
  view: () => PlayerView;
  progress: { told: number; played: Action[] };
  errors: unknown[];
  events: GameEvent[];
  /** One event through the gate, then the reducer and the controller, as the lesson screen does. */
  send(event: LessonEvent): Promise<ReturnType<typeof lessonGate>>;
};

function drive(lesson: Lesson): Driver {
  const events: GameEvent[] = [];
  const errors: unknown[] = [];
  const game = createGame({
    human: "bleu",
    seed: SEED,
    botSeed: SEED,
    speed: "test",
    scenario: lesson.before,
    ...(lesson.script === undefined ? {} : { script: lesson.script }),
    runner: noThink,
    director: { enqueue: (e) => events.push(...e), idle: () => Promise.resolve() },
  });
  game.onError((error) => errors.push(error));
  const ctx = () => turnCtx(game.view(), "bleu");
  let ui = reduceTurnUi(initialTurnUi, { t: "sync" }, ctx()).state;
  const progress = { told: 0, played: [] as Action[] };
  game.start();
  return {
    game,
    ui: () => ui,
    view: () => game.view(),
    progress,
    errors,
    events,
    async send(event) {
      const at = lessonStep(lesson, ui, progress);
      if (at === null) throw new Error("the lesson is over");
      const verdict = lessonGate(at.step, event, ui, ctx());
      if (!verdict.pass) {
        for (const reset of verdict.reset ?? []) ui = reduceTurnUi(ui, reset, ctx()).state;
        return verdict;
      }
      if (event.t === "next") {
        progress.told++;
        return verdict;
      }
      const result = reduceTurnUi(ui, event, ctx());
      ui = result.state;
      if (result.submit !== undefined) {
        const outcome = game.submit(result.submit);
        if (!outcome.ok) throw new Error(`the engine refused ${JSON.stringify(result.submit)}`);
        progress.played.push(result.submit);
      }
      await flush();
      ui = reduceTurnUi(ui, { t: "sync" }, ctx()).state;
      return verdict;
    },
  };
}

/** The event the guide waits for on the current step: what a player who follows the halo taps. */
function rightEvent(lesson: Lesson, d: Driver): LessonEvent {
  const at = lessonStep(lesson, d.ui(), d.progress);
  if (at === null) throw new Error("the lesson is over");
  const want = at.step.expect;
  const ui = d.ui();
  switch (want.t) {
    case "next":
    case "cross":
      return { t: "next" };
    case "card":
      return ui.kind === "exchange"
        ? { t: "selectGive", card: want.card }
        : { t: "tapCard", card: want.card };
    case "pawn":
      return { t: "tapPawn", pawn: want.pawn };
    case "steps":
      return ui.kind === "sevenBuilding" && ui.selected === want.pawn
        ? { t: "pickSteps", steps: want.steps }
        : { t: "tapPawn", pawn: want.pawn };
    case "button":
      return want.button === "give" ? { t: "give" } : { t: "confirm" };
    case "plan":
      return { t: "confirm" };
  }
}

/** Follows the halos until the step `index` is current (or the end when omitted). */
async function playUntil(lesson: Lesson, d: Driver, index?: number): Promise<void> {
  for (let guard = 0; guard < 40; guard++) {
    const at = lessonStep(lesson, d.ui(), d.progress);
    if (at === null || at.index === index) return;
    if (!at.ready) {
      await flush();
      continue;
    }
    const verdict = await d.send(rightEvent(lesson, d));
    expect(verdict, `step ${at.index} of lesson ${lesson.n}`).toEqual({ pass: true });
  }
  throw new Error(`lesson ${lesson.n} did not reach its end`);
}

const pawn = (view: PlayerView, id: PawnId) => view.pawns[id];
const ring = (progress: number) => ({ zone: "ring", progress });

/** Where the knights stand once each lesson is done (the lesson's point, on the real rules). */
const AFTER: Record<number, (view: PlayerView) => void> = {
  1: (view) => {
    const bleus: PawnId[] = ["bleu0", "bleu1", "bleu2", "bleu3"];
    const ringed = bleus.filter((id) => pawn(view, id).zone === "ring");
    expect(ringed).toHaveLength(1);
    expect(pawn(view, ringed[0] as PawnId)).toMatchObject(ring(0));
  },
  2: (view) => {
    expect(pawn(view, "bleu0")).toMatchObject(ring(2));
    expect(pawn(view, "bleu1")).toMatchObject(ring(18));
  },
  3: (view) => {
    expect(pawn(view, "bleu0")).toMatchObject(ring(20));
    expect(pawn(view, "jaune0")).toEqual({ zone: "stable" });
  },
  4: (view) => {
    expect(pawn(view, "bleu0")).toMatchObject(ring(-4));
    expect(pawn(view, "vert0")).toEqual({ zone: "stable" });
  },
  5: (view) => {
    expect(pawn(view, "bleu0")).toMatchObject(ring(66));
    expect(pawn(view, "jaune0")).toMatchObject(ring(progressOf("jaune", 5)));
    expect(pawn(view, "jaune1")).toMatchObject(ring(progressOf("jaune", 40)));
  },
  6: (view) => {
    expect(pawn(view, "jaune0")).toEqual({ zone: "stable" });
    expect(pawn(view, "vert0")).toEqual({ zone: "stable" });
  },
  7: (view) => {
    expect(pawn(view, "bleu0")).toEqual({ zone: "home", slot: 3 });
  },
  8: (view) => {
    expect(view.phase).toBe("play");
    expect(view.turn).toBe("bleu");
    expect(view.hand).toContain("7H");
    expect(view.hand).not.toContain("13S");
  },
};

describe("progressOf: RULES.md cells to each colour's progress (05-RESEARCH Pattern 5)", () => {
  it("gives the research examples", () => {
    expect(progressOf("jaune", 20)).toBe(2);
    expect(progressOf("jaune", 66)).toBe(48);
    expect(progressOf("jaune", 40)).toBe(22);
    expect(progressOf("jaune", 22)).toBe(4);
    expect(progressOf("vert", 68)).toBe(14);
    expect(progressOf("vert", 43)).toBe(61);
    expect(progressOf("vert", 50)).toBe(68);
    expect(progressOf("jaune", 30)).toBe(12);
  });

  it("is the cell itself for Bleu, whose losange is cell 0", () => {
    expect(EXIT.bleu).toBe(0);
    for (const cell of [0, 2, 10, 68]) expect(progressOf("bleu", cell)).toBe(cell);
  });
});

describe("LESSONS: the eight lessons of D-07, in the UI-SPEC order", () => {
  it("has the eight titles in order", () => {
    expect(LESSONS.map((l) => l.title)).toEqual([
      "Sortir un cheval",
      "Avancer",
      "Manger",
      "Le 4 recule",
      "Le Valet échange",
      "Le 7 se partage",
      "Rentrer à la maison",
      "L’échange de carte",
    ]);
    expect(LESSONS.map((l) => l.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("keeps every guide line within 110 characters and every recap within 160", () => {
    for (const lesson of LESSONS) {
      expect(lesson.recap.length, lesson.recap).toBeLessThanOrEqual(160);
      for (const step of lesson.steps) {
        for (const line of [step.line, step.wrong, ...Object.values(step.wrongs ?? {})]) {
          if (line !== undefined) expect(line.length, line).toBeLessThanOrEqual(110);
        }
      }
    }
  });

  it("takes every line from the catalogue and says « tu », never « vous » to the player", () => {
    const catalogue = JSON.stringify(lecons);
    for (const lesson of LESSONS) {
      expect(catalogue).toContain(JSON.stringify(lesson.title));
      expect(catalogue).toContain(JSON.stringify(lesson.recap));
      for (const step of lesson.steps) expect(catalogue).toContain(JSON.stringify(step.line));
    }
    expect(catalogue).not.toMatch(/\b(vous|votre)\b/i);
  });

  it("plays on Bleu's turn, the others' hands empty except in the exchange lesson", () => {
    for (const lesson of LESSONS) {
      expect(lesson.before.turn).toBe("bleu");
      const others = COLORS.filter((c) => c !== "bleu").map((c) => lesson.before.hands?.[c]);
      if (lesson.n === 8) {
        expect(lesson.before.phase).toBe("exchange");
        expect(lesson.before.dealer).toBe("vert");
        expect(lesson.script).toEqual({
          jaune: [{ t: "give", card: expect.any(String) }],
          rouge: [{ t: "give", card: "7H" }],
          vert: [{ t: "give", card: expect.any(String) }],
        });
      } else {
        expect(others).toEqual([undefined, undefined, undefined]);
        expect(lesson.script).toBeUndefined();
      }
    }
  });

  it("imports neither the scenario set, nor the debug parameters, nor storage, network or Svelte", () => {
    for (const source of [lessonsSource, runnerSource]) {
      expect(source).not.toMatch(/scenarios|debugParams|debug\.ts|__TOC_DEBUG__/);
      expect(source).not.toMatch(/localStorage|sessionStorage|fetch\(|WebSocket|svelte/);
      expect(source).not.toMatch(/setTimeout|Date\.now|performance\.now/);
    }
  });
});

describe("every lesson plays to « Bravo » on the real rules", () => {
  for (const lesson of LESSONS) {
    it(`lesson ${lesson.n} « ${lesson.title} »`, async () => {
      const d = drive(lesson);
      const deals = d.view().dealsPlayed;
      await playUntil(lesson, d);
      expect(lessonDone(lesson, d.ui(), d.progress)).toBe(true);
      expect(d.errors).toEqual([]);
      expect(d.progress.played).toHaveLength(1);
      const view = d.view();
      // No computer moved and no new deal started (Pitfall 3).
      expect(view.hand.length).toBeGreaterThanOrEqual(1);
      expect(view.dealsPlayed).toBe(deals);
      expect(d.events.some((e) => e.t === "dealt")).toBe(false);
      const played = d.events.filter((e) => e.t === "cardPlayed").map((e) => e.seat);
      expect(played.every((seat) => seat === "bleu")).toBe(true);
      AFTER[lesson.n]?.(view);
      d.game.dispose();
    });
  }

  it("lesson 6 also passes with 2 + 5, which eats both opponents too", async () => {
    const lesson = LESSONS[5] as Lesson;
    const d = drive(lesson);
    await playUntil(lesson, d, 2);
    for (const event of [
      { t: "tapPawn", pawn: "bleu0" },
      { t: "pickSteps", steps: 2 },
      { t: "tapPawn", pawn: "bleu1" },
      { t: "pickSteps", steps: 5 },
      { t: "confirm" },
    ] as LessonEvent[]) {
      expect(await d.send(event)).toEqual({ pass: true });
    }
    expect(lessonDone(lesson, d.ui(), d.progress)).toBe(true);
    expect(d.progress.played).toEqual([
      {
        t: "seven",
        card: "7C",
        plan: [
          { pawn: "bleu0", steps: 2 },
          { pawn: "bleu1", steps: 5 },
        ],
      },
    ]);
    AFTER[6]?.(d.view());
    d.game.dispose();
  });
});

/** A wrong choice at the step `index` of lesson `n`: refused with `line`, nothing changed. */
type Wrong = { n: number; index: number; event: LessonEvent; line: string };

const card = (c: string) => ({ t: "tapCard", card: c as CardId }) as LessonEvent;

const WRONGS: Wrong[] = [
  { n: 1, index: 0, event: card("1H"), line: lecons.sortir.bienvenue },
  { n: 1, index: 2, event: card("8S"), line: lecons.sortir.wrong.carte },
  { n: 1, index: 2, event: card("3D"), line: lecons.sortir.wrong.carte },
  { n: 2, index: 1, event: card("12H"), line: lecons.avancer.wrong.carte },
  { n: 3, index: 0, event: card("3S"), line: lecons.manger.wrong.carte },
  { n: 4, index: 0, event: card("9S"), line: lecons.recule.wrong.carte },
  { n: 5, index: 0, event: card("6D"), line: lecons.valet.wrong.carte },
  { n: 5, index: 2, event: { t: "tapPawn", pawn: "jaune1" }, line: lecons.valet.wrong.cible },
  { n: 5, index: 3, event: { t: "tapPawn", pawn: "jaune1" }, line: lecons.valet.wrong.cible },
  { n: 6, index: 1, event: card("2H"), line: lecons.sept.carte },
  { n: 7, index: 1, event: card("9H"), line: lecons.maison.wrong.neuf },
  { n: 7, index: 1, event: card("13C"), line: lecons.maison.wrong.roi },
  {
    n: 8,
    index: 1,
    event: { t: "selectGive", card: "9C" },
    line: lecons.echange.wrong.carte,
  },
];

describe("every wrong choice is explained and changes nothing (D-09)", () => {
  for (const wrong of WRONGS) {
    const lesson = LESSONS[wrong.n - 1] as Lesson;
    it(`lesson ${wrong.n}, step ${wrong.index + 1}: ${JSON.stringify(wrong.event)}`, async () => {
      const d = drive(lesson);
      await playUntil(lesson, d, wrong.index);
      const before = JSON.stringify(d.view());
      const ui = d.ui();
      const verdict = await d.send(wrong.event);
      expect(verdict).toEqual({ pass: false, line: wrong.line });
      expect(wrong.line.length).toBeGreaterThan(0);
      expect(JSON.stringify(d.view())).toBe(before);
      expect(d.ui()).toBe(ui);
      // The step is the same, and the right path still plays to the end.
      expect(lessonStep(lesson, d.ui(), d.progress)?.index).toBe(wrong.index);
      await playUntil(lesson, d);
      expect(lessonDone(lesson, d.ui(), d.progress)).toBe(true);
      d.game.dispose();
    });
  }

  it("lesson 6: a split that does not eat both is refused on « Jouer » and goes back to its start", async () => {
    const lesson = LESSONS[5] as Lesson;
    const d = drive(lesson);
    await playUntil(lesson, d, 2);
    for (const event of [
      { t: "tapPawn", pawn: "bleu0" },
      { t: "pickSteps", steps: 1 },
      { t: "tapPawn", pawn: "bleu1" },
      { t: "pickSteps", steps: 6 },
    ] as LessonEvent[]) {
      expect(await d.send(event)).toEqual({ pass: true });
    }
    const before = JSON.stringify(d.view());
    const verdict = await d.send({ t: "confirm" });
    expect(verdict).toMatchObject({ pass: false, line: lecons.sept.wrong.plan });
    expect(JSON.stringify(d.view())).toBe(before);
    expect(d.progress.played).toEqual([]);
    // Back to the start of the split: the 7 still in hand, nothing spread.
    const ui = d.ui();
    expect(ui.kind).toBe("sevenBuilding");
    if (ui.kind === "sevenBuilding") expect(ui.plan).toEqual([]);
    expect(lessonStep(lesson, ui, d.progress)?.index).toBe(2);
    await playUntil(lesson, d);
    expect(lessonDone(lesson, d.ui(), d.progress)).toBe(true);
    d.game.dispose();
  });
});

describe("each lesson's computers", () => {
  it("never think: only lesson 8's three others act, and only by the written gives", async () => {
    const lesson = LESSONS[7] as Lesson;
    const d = drive(lesson);
    await playUntil(lesson, d);
    const gives = (lesson.script ?? {}) as Partial<Record<Color, Action[]>>;
    for (const seat of ["jaune", "rouge", "vert"] as const) expect(gives[seat]).toHaveLength(1);
    expect(d.errors).toEqual([]);
    d.game.dispose();
  });
});
