import type { Color } from "@toc/engine";
import type { SeatPublic, TablePublic } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { type Me, tableNotices } from "./notices.ts";

const free: SeatPublic = { kind: "free", name: null, level: 3, online: true };
const human = (name: string, online = true): SeatPublic => ({
  kind: "human",
  name,
  level: 3,
  online,
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
