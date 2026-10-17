import type { Color } from "@toc/engine";
import type { SeatPublic, TablePublic } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { typographyProblems } from "../i18n/typography.test.ts";
import { formatCountdown, plateFor, remainingMs } from "./plate.ts";

// The plate over the board (plan 02-06, 02-UI-SPEC « Plates », « Plate states »): what the pause, the
// chef de table's choices and the saved game say, for the chef de table and for the others, with the
// countdown counted from the server's clock.

const NNBSP = " ";
const NBSP = " ";

const human = (
  name: string,
  online = true,
  handedOver: SeatPublic["handedOver"] = null,
): SeatPublic => ({
  kind: "human",
  name,
  level: 3,
  online,
  handedOver,
});
const bot = (name: string): SeatPublic => ({
  kind: "bot",
  name,
  level: 3,
  online: true,
  handedOver: null,
});

function table(
  over: Partial<TablePublic> = {},
  seats: Partial<Record<Color, SeatPublic>> = {},
): TablePublic {
  return {
    status: "playing",
    seats: {
      bleu: human("Ana"),
      jaune: human("Bruno"),
      rouge: bot("Tornado"),
      vert: human("Paul"),
      ...seats,
    },
    host: "bleu",
    creatorName: "Ana",
    gameNo: 1,
    thinking: null,
    unseated: [],
    pause: null,
    now: 100_000,
    ...over,
  };
}

/** Bruno (jaune) is missing since 100 000; the chef de table may choose at 160 000. */
const paused = (choosing = false, missing: Color[] = ["jaune"]) =>
  table(
    {
      status: "paused",
      pause: { missing, since: 100_000, choiceAt: 160_000, choosing },
    },
    {
      jaune: human("Bruno", !missing.includes("jaune")),
      vert: human("Paul", !missing.includes("vert")),
    },
  );

describe("the countdown", () => {
  it("formats m:ss and never goes below zero", () => {
    expect(formatCountdown(60_000)).toBe("1:00");
    expect(formatCountdown(42_000)).toBe("0:42");
    expect(formatCountdown(41_001)).toBe("0:42");
    expect(formatCountdown(9_000)).toBe("0:09");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-5_000)).toBe("0:00");
  });

  it("counts from the server's clock: the device's clock plus the offset", () => {
    // The device is 30 s behind the server: at device time 88 000 the server is at 118 000.
    expect(remainingMs(160_000, 88_000, 30_000)).toBe(42_000);
    expect(remainingMs(160_000, 200_000, 0)).toBe(0);
  });
});

describe("plateFor", () => {
  it("shows nothing while the game runs", () => {
    expect(plateFor(table(), "bleu", 0, 100_000)).toBeNull();
    expect(plateFor(null, "bleu", 0, 100_000)).toBeNull();
  });

  it("pause, first minute, for the chef de table and for the others", () => {
    const host = plateFor(paused(), "bleu", 30_000, 88_000);
    expect(host).toEqual({
      kind: "pause",
      title: "En attente de Bruno…",
      body: "La partie est en pause jusqu’à son retour.",
      countdown: "Dans 0:42, tu pourras choisir la suite.",
      announce: "Tu pourras choisir la suite dans une minute.",
    });
    const other = plateFor(paused(), "vert", 0, 118_000);
    expect(other).toMatchObject({
      kind: "pause",
      countdown: "Dans 0:42, Ana pourra choisir la suite.",
      announce: "Ana pourra choisir la suite dans une minute.",
    });
  });

  it("names two and three missing players, and speaks of them in the plural", () => {
    const two = plateFor(paused(false, ["jaune", "vert"]), "bleu", 0, 100_000);
    expect(two).toMatchObject({
      title: "En attente de Bruno et Paul…",
      body: "La partie est en pause jusqu’à leur retour.",
    });
    const three = table(
      {
        status: "paused",
        host: "rouge",
        pause: { missing: ["bleu", "jaune", "vert"], since: 0, choiceAt: 60_000, choosing: false },
      },
      {
        bleu: human("Ana", false),
        jaune: human("Bruno", false),
        rouge: human("Céline"),
        vert: human("Paul", false),
      },
    );
    expect(plateFor(three, "rouge", 0, 0)).toMatchObject({
      title: "En attente d’Ana, Bruno et Paul…",
    });
  });

  it("after the minute: the others wait for the chef de table, who gets the choices", () => {
    expect(plateFor(paused(true), "vert", 0, 170_000)).toEqual({
      kind: "waitingChoice",
      title: "En attente de Bruno…",
      body: "Ana choisit la suite…",
    });
    expect(plateFor(paused(true), "bleu", 0, 170_000)).toEqual({
      kind: "choices",
      title: "En attente de Bruno…",
      body: `Bruno n’est pas de retour. Que veux-tu faire${NNBSP}?`,
      several: false,
    });
    expect(plateFor(paused(true, ["jaune", "vert"]), "bleu", 0, 170_000)).toMatchObject({
      body: `Bruno et Paul ne sont pas de retour. Que veux-tu faire${NNBSP}?`,
      several: true,
    });
  });

  it("follows the chef de table when the creator is the one missing", () => {
    const anaAway = table(
      {
        status: "paused",
        host: "jaune",
        pause: { missing: ["bleu"], since: 100_000, choiceAt: 160_000, choosing: false },
      },
      { bleu: human("Ana", false) },
    );
    expect(plateFor(anaAway, "vert", 0, 118_000)).toMatchObject({
      countdown: "Dans 0:42, Bruno pourra choisir la suite.",
    });
    expect(plateFor(anaAway, "jaune", 0, 118_000)).toMatchObject({
      countdown: "Dans 0:42, tu pourras choisir la suite.",
    });
  });

  it("saved: who is at the table, who is not yet, and who may resume", () => {
    const saved = table({ status: "saved" }, { jaune: human("Bruno", false), vert: human("Paul") });
    expect(plateFor(saved, "bleu", 0, 0)).toEqual({
      kind: "saved",
      title: "Partie sauvegardée",
      body: `Retrouve-la avec le même lien ou dans «${NNBSP}Mes parties en cours${NNBSP}». Elle est gardée 30${NNBSP}jours sans jouer.`,
      present: `À la table${NBSP}: Ana, Paul.`,
      absent: `Pas encore là${NBSP}: Bruno.`,
      host: true,
      hostLine: null,
    });
    expect(plateFor(saved, "vert", 0, 0)).toMatchObject({
      host: false,
      hostLine: "Ana peut reprendre la partie.",
    });
    const everyone = table({ status: "saved" });
    expect(plateFor(everyone, "vert", 0, 0)).toMatchObject({ absent: null });
  });

  it("writes every text with the French typography", () => {
    const plates = [
      plateFor(paused(), "bleu", 0, 100_000),
      plateFor(paused(true), "bleu", 0, 170_000),
      plateFor(paused(true), "vert", 0, 170_000),
      plateFor(table({ status: "saved" }, { jaune: human("Bruno", false) }), "vert", 0, 0),
    ];
    for (const plate of plates) {
      for (const text of Object.values(plate ?? {})) {
        if (typeof text === "string") expect(typographyProblems(text), text).toEqual([]);
      }
    }
  });
});
