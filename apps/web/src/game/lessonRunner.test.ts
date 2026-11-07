// The lesson gate and the current step (05-03): pure, over the real turn reducer and a real view.

import { type CardId, type PawnId, scenarioState, viewFor } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { lecons } from "../i18n/fr/lecons.ts";
import {
  type LessonEvent,
  type LessonProgress,
  lessonDone,
  lessonGate,
  lessonHalo,
  lessonStep,
} from "./lessonRunner.ts";
import { LESSONS, type Lesson } from "./lessons.ts";
import {
  initialTurnUi,
  reduceTurnUi,
  type TurnCtx,
  type TurnUiEvent,
  type TurnUiState,
  turnCtx,
} from "./turnUi.ts";

const SEED: [number, number, number, number] = [3, 1, 4, 1];

/** A lesson's first position, without a controller: the gate and the reducer only (no move played). */
function at(n: number) {
  const lesson = LESSONS[n - 1] as Lesson;
  const ctx: TurnCtx = turnCtx(viewFor(scenarioState(lesson.before, SEED), "bleu"), "bleu");
  let ui: TurnUiState = reduceTurnUi(initialTurnUi, { t: "sync" }, ctx).state;
  const progress: LessonProgress = { told: 0, played: [] };
  return {
    lesson,
    ctx,
    progress,
    ui: () => ui,
    step: () => lessonStep(lesson, ui, progress),
    gate: (event: LessonEvent) => {
      const current = lessonStep(lesson, ui, progress);
      if (current === null) throw new Error("over");
      return lessonGate(current.step, event, ui, ctx);
    },
    /** Through the gate, then the reducer (a `next` moves the narration on). */
    send(event: LessonEvent) {
      const verdict = this.gate(event);
      if (!verdict.pass) {
        for (const reset of verdict.reset ?? []) ui = reduceTurnUi(ui, reset, ctx).state;
        return verdict;
      }
      if (event.t === "next") progress.told++;
      else ui = reduceTurnUi(ui, event as TurnUiEvent, ctx).state;
      return verdict;
    },
  };
}

const tap = (card: string): LessonEvent => ({ t: "tapCard", card: card as CardId });
const knight = (pawn: string): LessonEvent => ({ t: "tapPawn", pawn: pawn as PawnId });
const PASS = { pass: true };

describe("lessonStep: the current step comes from the turn state, never from a counter", () => {
  it("starts on the first line and moves on with « Suivant »", () => {
    const l = at(1);
    expect(l.step()).toMatchObject({ index: 0, step: { line: lecons.sortir.bienvenue } });
    expect(l.send({ t: "next" })).toEqual(PASS);
    expect(l.step()).toMatchObject({ index: 1, step: { line: lecons.sortir.but } });
    l.send({ t: "next" });
    expect(l.step()).toMatchObject({ index: 2, step: { line: lecons.sortir.carte } });
  });

  it("opens the single exit by itself on the As, and asks for « Jouer »", () => {
    const l = at(1);
    l.send({ t: "next" });
    l.send({ t: "next" });
    expect(l.send(tap("1H"))).toEqual(PASS);
    expect(l.ui()).toMatchObject({ kind: "preview", auto: true });
    expect(l.step()).toMatchObject({ index: 3, step: { line: lecons.sortir.jouer } });
  });

  it("brings the card step back with its own line after « Changer de carte » or Échap", () => {
    for (const back of [{ t: "changeCard" }, { t: "back" }, { t: "escape" }] as LessonEvent[]) {
      const l = at(3);
      l.send(tap("8D"));
      expect(l.step()?.index).toBe(1);
      expect(l.send(back)).toEqual(PASS);
      expect(l.step()).toMatchObject({ index: 0, step: { line: lecons.manger.carte } });
    }
  });

  it("steps back one Valet tap at a time, never skipping a line", () => {
    const l = at(5);
    l.send(tap("11S"));
    l.send(knight("bleu0"));
    l.send(knight("jaune0"));
    expect(l.step()).toMatchObject({ index: 3, step: { line: lecons.valet.jouer } });
    l.send({ t: "back" });
    expect(l.step()).toMatchObject({ index: 2, step: { line: lecons.valet.cible } });
    l.send({ t: "back" });
    expect(l.step()).toMatchObject({ index: 1, step: { line: lecons.valet.cheval } });
    l.send({ t: "back" });
    expect(l.step()).toMatchObject({ index: 0, step: { line: lecons.valet.carte } });
  });

  it("follows the 7's split by the steps spread, and goes back with Échap", () => {
    const l = at(6);
    l.send({ t: "next" });
    l.send(tap("7C"));
    expect(l.step()).toMatchObject({ index: 2, step: { line: lecons.sept.premier } });
    l.send(knight("bleu0"));
    expect(l.step()?.index).toBe(2);
    l.send({ t: "pickSteps", steps: 3 });
    expect(l.step()).toMatchObject({ index: 3, step: { line: lecons.sept.second } });
    l.send({ t: "back" });
    expect(l.step()?.index).toBe(2);
    l.send(knight("bleu0"));
    l.send({ t: "pickSteps", steps: 3 });
    l.send(knight("bleu1"));
    l.send({ t: "pickSteps", steps: 4 });
    expect(l.step()).toMatchObject({ index: 4, step: { line: lecons.sept.jouer } });
  });

  it("is done only past the last step", () => {
    const l = at(3);
    expect(lessonDone(l.lesson, l.ui(), l.progress)).toBe(false);
    l.send(tap("8D"));
    expect(lessonDone(l.lesson, l.ui(), l.progress)).toBe(false);
    expect(lessonDone(l.lesson, { kind: "idle" }, { told: 0, played: [{ t: "discard" }] })).toBe(
      true,
    );
  });

  it("waits for the cards to cross before lesson 8's last line can be passed", () => {
    const lesson = LESSONS[7] as Lesson;
    const progress: LessonProgress = { told: 1, played: [{ t: "give", card: "13S" }] };
    const waiting: TurnUiState = { kind: "exchangeWaiting", pending: ["jaune"] };
    const current = lessonStep(lesson, waiting, progress);
    expect(current).toMatchObject({ index: 3, ready: false });
    const ctx = turnCtx(viewFor(scenarioState(lesson.before, SEED), "bleu"), "bleu");
    if (current === null) throw new Error("over");
    expect(lessonGate(current.step, { t: "next" }, waiting, ctx).pass).toBe(false);
    expect(lessonStep(lesson, { kind: "idle" }, progress)).toMatchObject({ index: 3, ready: true });
    expect(lessonGate(current.step, { t: "next" }, { kind: "idle" }, ctx)).toEqual(PASS);
  });
});

describe("lessonGate: the right choice passes, another one gets the step's line (D-09)", () => {
  it("refuses another card with the step's wrong line, the right one passes", () => {
    const l = at(2);
    l.send({ t: "next" });
    expect(l.gate(tap("5S"))).toEqual({ pass: false, line: lecons.avancer.wrong.carte });
    expect(l.gate(tap("12H"))).toEqual({ pass: false, line: lecons.avancer.wrong.carte });
    expect(l.gate(tap("8C"))).toEqual(PASS);
  });

  it("gives each card of lesson 7 its own line", () => {
    const l = at(7);
    l.send({ t: "next" });
    expect(l.gate(tap("9H"))).toEqual({ pass: false, line: lecons.maison.wrong.neuf });
    expect(l.gate(tap("13C"))).toEqual({ pass: false, line: lecons.maison.wrong.roi });
    expect(l.gate(tap("6S"))).toEqual(PASS);
  });

  it("refuses a tap during a narration line with that line", () => {
    const l = at(1);
    expect(l.gate(tap("1H"))).toEqual({ pass: false, line: lecons.sortir.bienvenue });
    expect(l.gate(knight("bleu0"))).toEqual({ pass: false, line: lecons.sortir.bienvenue });
  });

  it("refuses another card once the card is chosen, and lets the chosen one go back", () => {
    const l = at(3);
    l.send(tap("8D"));
    expect(l.gate(tap("10C"))).toEqual({ pass: false, line: lecons.manger.jouer });
    expect(l.gate(tap("8D"))).toEqual(PASS);
  });

  it("refuses another knight, by a tap or by the first knight near a tap", () => {
    const l = at(5);
    l.send(tap("11S"));
    l.send(knight("bleu0"));
    expect(l.gate(knight("jaune1"))).toEqual({ pass: false, line: lecons.valet.wrong.cible });
    expect(l.gate({ t: "tapAt", near: ["jaune1"] })).toEqual({
      pass: false,
      line: lecons.valet.wrong.cible,
    });
    expect(l.gate({ t: "tapAt", near: ["jaune0"] })).toEqual(PASS);
    expect(l.gate(knight("jaune0"))).toEqual(PASS);
    // Its own knight again is a step back, not a wrong choice.
    expect(l.gate(knight("bleu0"))).toEqual(PASS);
  });

  it("refuses swapping with another knight from the preview", () => {
    const l = at(5);
    l.send(tap("11S"));
    l.send(knight("bleu0"));
    l.send(knight("jaune0"));
    expect(l.gate(knight("jaune1"))).toEqual({ pass: false, line: lecons.valet.wrong.cible });
    expect(l.gate({ t: "confirm" })).toEqual(PASS);
  });

  it("lets any knight and any chip pass in lesson 6's split, the halos only suggest", () => {
    const l = at(6);
    l.send({ t: "next" });
    l.send(tap("7C"));
    expect(l.send(knight("bleu1"))).toEqual(PASS);
    expect(l.send({ t: "pickSteps", steps: 5 })).toEqual(PASS);
    expect(l.send(knight("bleu0"))).toEqual(PASS);
    expect(l.send({ t: "pickSteps", steps: 2 })).toEqual(PASS);
    expect(l.step()?.step.expect.t).toBe("plan");
    expect(l.gate({ t: "confirm" })).toEqual(PASS);
  });

  it("refuses on « Jouer » a split that misses an opponent, and sends it back to its start", () => {
    const l = at(6);
    l.send({ t: "next" });
    l.send(tap("7C"));
    for (const e of [
      knight("bleu0"),
      { t: "pickSteps", steps: 1 },
      knight("bleu1"),
      { t: "pickSteps", steps: 6 },
    ] as LessonEvent[]) {
      l.send(e);
    }
    const verdict = l.gate({ t: "confirm" });
    expect(verdict).toEqual({
      pass: false,
      line: "Ce partage ne mange pas les deux. Essaie 3 sur un cheval et 4 sur l’autre.",
      reset: [{ t: "cancelAll" }, { t: "tapCard", card: "7C" }],
    });
    l.send({ t: "confirm" });
    expect(l.ui()).toMatchObject({ kind: "sevenBuilding", card: "7C", plan: [] });
    expect(l.step()?.index).toBe(2);
  });

  it("refuses another card to give in the exchange, and passes the Roi", () => {
    const l = at(8);
    l.send({ t: "next" });
    expect(l.gate({ t: "selectGive", card: "2S" })).toEqual({
      pass: false,
      line: lecons.echange.wrong.carte,
    });
    expect(l.send({ t: "selectGive", card: "13S" })).toEqual(PASS);
    expect(l.step()).toMatchObject({ index: 2, step: { line: lecons.echange.passer } });
    expect(l.gate({ t: "give" })).toEqual(PASS);
  });

  it("always lets the view sync and the steps back through", () => {
    const l = at(1);
    for (const e of [{ t: "sync" }, { t: "back" }, { t: "escape" }] as LessonEvent[]) {
      expect(l.gate(e)).toEqual(PASS);
    }
  });
});

describe("lessonHalo: what the guide rings", () => {
  it("rings the card, the knight, the chip, then the button", () => {
    const l = at(6);
    expect(lessonHalo(l.step()?.step ?? null, l.ui())).toEqual([{ t: "button", button: "next" }]);
    l.send({ t: "next" });
    expect(lessonHalo(l.step()?.step ?? null, l.ui())).toEqual([{ t: "card", card: "7C" }]);
    l.send(tap("7C"));
    expect(lessonHalo(l.step()?.step ?? null, l.ui())).toEqual([{ t: "pawn", pawn: "bleu0" }]);
    l.send(knight("bleu0"));
    expect(lessonHalo(l.step()?.step ?? null, l.ui())).toEqual([{ t: "chip", steps: 3 }]);
    for (const e of [
      { t: "pickSteps", steps: 3 },
      knight("bleu1"),
      { t: "pickSteps", steps: 4 },
    ] as LessonEvent[]) {
      l.send(e);
    }
    expect(lessonHalo(l.step()?.step ?? null, l.ui())).toEqual([
      { t: "button", button: "confirm" },
    ]);
    expect(lessonHalo(null, l.ui())).toEqual([]);
  });
});
