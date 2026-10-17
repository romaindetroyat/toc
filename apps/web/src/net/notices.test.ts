import type { Color } from "@toc/engine";
import type { SeatPublic, TablePublic } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { gameNotices, type Me, tableNotices } from "./notices.ts";

const free: SeatPublic = { kind: "free", name: null, level: 3, online: true, handedOver: null };
const human = (name: string, online = true): SeatPublic => ({
  kind: "human",
  name,
  level: 3,
  online,
  handedOver: null,
});

function table(
  seats: Partial<Record<Color, SeatPublic>>,
  unseated: string[] = [],
  host: Color | null = "bleu",
): TablePublic {
  return {
    status: "lobby",
    seats: { bleu: free, jaune: free, rouge: free, vert: free, ...seats },
    host,
    creatorName: "Romain",
    gameNo: 0,
    thinking: null,
    unseated,
    pause: null,
    winner: null,
    rematch: null,
    now: 0,
  };
}

const bruno = (was: Color | null, seat: Color | null, asked = false): Me => ({
  name: "Bruno",
  was,
  seat,
  host: false,
  asked,
});

describe("tableNotices", () => {
  it("says nothing on the first frame", () => {
    expect(
      tableNotices(null, table({ bleu: human("Romain") }, ["Bruno"]), bruno(null, null)),
    ).toEqual([]);
  });

  it("announces someone who arrives, never this device itself", () => {
    const before = table({ bleu: human("Romain") }, ["Bruno"]);
    const after = table({ bleu: human("Romain") }, ["Bruno", "Céline"]);
    expect(tableNotices(before, after, bruno(null, null))).toEqual(["Céline a rejoint la table."]);
  });

  it("does not announce a person taking a seat, moving, or going offline on a seat", () => {
    const me = bruno(null, null);
    const before = table({ bleu: human("Romain") }, ["Bruno", "Céline"]);
    const seated = table({ bleu: human("Romain"), rouge: human("Céline") }, ["Bruno"]);
    expect(tableNotices(before, seated, me)).toEqual([]);
    const offline = table({ bleu: human("Romain"), rouge: human("Céline", false) }, ["Bruno"]);
    expect(tableNotices(seated, offline, me)).toEqual([]);
  });

  it("announces someone who leaves, seated or not", () => {
    const me = bruno("jaune", "jaune");
    const before = table({ bleu: human("Romain"), jaune: human("Bruno"), vert: human("Paul") }, [
      "Céline",
    ]);
    const after = table({ bleu: human("Romain"), jaune: human("Bruno") }, []);
    expect(tableNotices(before, after, me)).toEqual([
      "Paul a quitté la table.",
      "Céline a quitté la table.",
    ]);
  });

  it("counts two people with the same first name apart", () => {
    const me = bruno(null, null);
    const before = table({ bleu: human("Marie") }, ["Bruno"]);
    const after = table({ bleu: human("Marie") }, ["Bruno", "Marie"]);
    expect(tableNotices(before, after, me)).toEqual(["Marie a rejoint la table."]);
  });

  it("tells the moved person who moved them and where, unless they asked", () => {
    const before = table({ bleu: human("Romain"), jaune: human("Bruno") });
    const after = table({ bleu: human("Romain"), vert: human("Bruno") });
    expect(tableNotices(before, after, bruno("jaune", "vert"))).toEqual([
      "Romain a changé ta place : tu es maintenant Vert.",
    ]);
    expect(tableNotices(before, after, bruno("jaune", "vert", true))).toEqual([]);
    // The host moves people; their own changes are their doing (here a swap with Bruno).
    const swapped = table({ bleu: human("Bruno"), jaune: human("Romain") }, [], "jaune");
    expect(tableNotices(before, swapped, bruno("jaune", "bleu"))).toEqual([
      "Romain a changé ta place : tu es maintenant Bleu.",
    ]);
    expect(
      tableNotices(before, swapped, {
        name: "Romain",
        was: "bleu",
        seat: "jaune",
        host: true,
        asked: false,
      }),
    ).toEqual([]);
  });
});

describe("gameNotices (plan 02-06)", () => {
  const seat = (
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
  const bot: SeatPublic = {
    kind: "bot",
    name: "Tornado",
    level: 3,
    online: true,
    handedOver: null,
  };
  function game(
    over: Partial<TablePublic>,
    seats: Partial<Record<Color, SeatPublic>> = {},
  ): TablePublic {
    return {
      ...table({}),
      status: "playing",
      seats: { bleu: seat("Ana"), jaune: seat("Bruno"), rouge: bot, vert: seat("Paul"), ...seats },
      host: "bleu",
      creatorName: "Ana",
      gameNo: 1,
      ...over,
    };
  }
  const pause = (missing: Color[], choosing = false) => ({
    missing,
    since: 0,
    choiceAt: 60_000,
    choosing,
  });
  const brunoAway = (choosing = false) =>
    game({ status: "paused", pause: pause(["jaune"], choosing) }, { jaune: seat("Bruno", false) });
  const paul = { seat: "vert" as Color };

  it("says nothing on the first frame, nor in the waiting room, nor when the pause begins", () => {
    expect(gameNotices(null, brunoAway(), paul)).toEqual([]);
    expect(gameNotices(game({}), brunoAway(), paul)).toEqual([]);
    expect(gameNotices(table({}), table({}, ["Céline"]), paul)).toEqual([]);
  });

  it("tells everyone the chef de table's choice: wait, or the computer plays for the missing", () => {
    expect(gameNotices(brunoAway(true), brunoAway(false), paul)).toEqual([
      "Ana attend encore une minute.",
    ]);
    const handed = game({}, { jaune: seat("Bruno", false, 4) });
    expect(gameNotices(brunoAway(true), handed, paul)).toEqual([
      "L’ordinateur joue pour Bruno jusqu’à son retour.",
    ]);
    const both = game(
      { status: "paused", pause: pause(["jaune", "vert"], true) },
      { jaune: seat("Bruno", false), vert: seat("Paul", false) },
    );
    const bothHanded = game({}, { jaune: seat("Bruno", false, 3), vert: seat("Paul", false, 3) });
    expect(gameNotices(both, bothHanded, { seat: "bleu" })).toEqual([
      "L’ordinateur joue pour Bruno et Paul jusqu’à leur retour.",
    ]);
    // Saved: the plate says it, no toast.
    expect(
      gameNotices(
        brunoAway(true),
        game({ status: "saved" }, { jaune: seat("Bruno", false) }),
        paul,
      ),
    ).toEqual([]);
  });

  it("announces a return, and a seat taken back from the computer, never to the returning one", () => {
    expect(gameNotices(brunoAway(), game({}), paul)).toEqual(["Bruno est de retour."]);
    const handed = game({}, { jaune: seat("Bruno", false, 4) });
    expect(gameNotices(handed, game({}), paul)).toEqual(["Bruno reprend sa place."]);
    expect(gameNotices(handed, game({}), { seat: "jaune" })).toEqual([]);
  });

  it("passes the chef de table role and brings it back (D-05)", () => {
    const anaAway = game(
      { status: "paused", host: "jaune", pause: pause(["bleu"]) },
      { bleu: seat("Ana", false) },
    );
    expect(gameNotices(game({}), anaAway, paul)).toEqual([
      "Bruno est chef de table jusqu’au retour d’Ana.",
    ]);
    expect(gameNotices(game({}), anaAway, { seat: "jaune" })).toEqual([
      "Tu es chef de table jusqu’au retour d’Ana.",
    ]);
    expect(gameNotices(anaAway, game({}), paul)).toEqual([
      "Ana est de retour et redevient chef de table.",
    ]);
    const romain = game({ host: "jaune", creatorName: "Romain" }, { bleu: seat("Romain", false) });
    expect(
      gameNotices(game({ creatorName: "Romain" }, { bleu: seat("Romain") }), romain, paul),
    ).toEqual(["Bruno est chef de table jusqu’au retour de Romain."]);
  });
});
