// The pure aggregation of « Mes chiffres » (plan 05-05, HIST-03; 05-UI-SPEC Panel 2, 05-RESEARCH
// Pattern 4): statsOf over the player's game_seats ⋈ played rows, for the three filters at once.

import type { Color } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { type StatsRow, type StoredSeat, statsOf } from "../src/aggregate.ts";

const ME = "me-account-id";
const BRUNO = "bruno-account-id";

type SeatSpec = Partial<StoredSeat> & Pick<StoredSeat, "colour" | "kind">;

function seat(spec: SeatSpec): StoredSeat {
  return {
    account: null,
    name: "",
    level: null,
    handedOver: false,
    captured: 0,
    lost: 0,
    home: 0,
    ...spec,
  };
}

/** One row of the player's games: their own colour and counts, and the four seats as stored. */
function row(
  mine: Color,
  won: boolean,
  solo: boolean,
  seats: SeatSpec[],
  counts: { captured: number; lost: number; home: number },
): StatsRow {
  return {
    colour: mine,
    won: won ? 1 : 0,
    solo: solo ? 1 : 0,
    ...counts,
    seats: JSON.stringify(seats.map(seat)),
  };
}

/** An online win with Bruno (an account) as partner against two humans. */
const onlineWin = row(
  "bleu",
  true,
  false,
  [
    { colour: "bleu", kind: "account", account: ME, name: "Anaïs", home: 4, captured: 2 },
    { colour: "jaune", kind: "account", account: "other-id", name: "Chloé" },
    { colour: "rouge", kind: "account", account: BRUNO, name: "Bruno", home: 4 },
    { colour: "vert", kind: "guest", name: "Mamie" },
  ],
  { captured: 2, lost: 1, home: 4 },
);

/** An online loss with a guest partner against two computers, levels 2 and 4. */
const onlineLoss = row(
  "jaune",
  false,
  false,
  [
    { colour: "bleu", kind: "bot", name: "Ourasi", level: 2, home: 4 },
    { colour: "jaune", kind: "account", account: ME, name: "Anaïs", home: 1 },
    { colour: "rouge", kind: "bot", name: "Jappeloup", level: 4, home: 4 },
    { colour: "vert", kind: "guest", name: "Mamie", home: 2 },
  ],
  { captured: 1, lost: 3, home: 1 },
);

/** A solo win with a computer of level 3 as partner against levels 3 and 5. */
const soloWin = row(
  "bleu",
  true,
  true,
  [
    { colour: "bleu", kind: "account", account: ME, name: "Anaïs", home: 4 },
    { colour: "jaune", kind: "bot", level: 3 },
    { colour: "rouge", kind: "bot", level: 3, home: 4 },
    { colour: "vert", kind: "bot", level: 5 },
  ],
  { captured: 4, lost: 0, home: 4 },
);

describe("statsOf", () => {
  it("adds up games, wins and the player's knights for each filter", () => {
    const stats = statsOf([onlineWin, onlineLoss, soloWin], ME);
    expect(stats.all).toMatchObject({ games: 3, wins: 2, captured: 7, lost: 4, home: 9 });
    expect(stats.online).toMatchObject({ games: 2, wins: 1, captured: 3, lost: 4, home: 5 });
    expect(stats.solo).toMatchObject({ games: 1, wins: 1, captured: 4, lost: 0, home: 4 });
  });

  it("the partners: an account by pseudo, all guests together, computers by level", () => {
    const stats = statsOf([onlineWin, onlineLoss, soloWin], ME);
    expect(stats.all.partners).toEqual([
      { kind: "account", name: "Bruno", level: null, games: 1, wins: 1 },
      { kind: "guests", name: null, level: null, games: 1, wins: 0 },
      { kind: "bot", name: null, level: 3, games: 1, wins: 1 },
    ]);
    expect(stats.online.partners).toEqual([
      { kind: "account", name: "Bruno", level: null, games: 1, wins: 1 },
      { kind: "guests", name: null, level: null, games: 1, wins: 0 },
    ]);
    expect(stats.solo.partners).toEqual([{ kind: "bot", name: null, level: 3, games: 1, wins: 1 }]);
  });

  it("most games first, then accounts by pseudo, then the guests, then computers by level", () => {
    const withBruno = (won: boolean) =>
      row(
        "bleu",
        won,
        false,
        [
          { colour: "bleu", kind: "account", account: ME, name: "Anaïs" },
          { colour: "jaune", kind: "bot", level: 1 },
          { colour: "rouge", kind: "account", account: BRUNO, name: "Bruno" },
          { colour: "vert", kind: "bot", level: 1 },
        ],
        { captured: 0, lost: 0, home: 0 },
      );
    const withAlice = row(
      "vert",
      true,
      false,
      [
        { colour: "bleu", kind: "guest", name: "Mamie" },
        { colour: "jaune", kind: "account", account: "alice-id", name: "alice" },
        { colour: "rouge", kind: "guest", name: "Papi" },
        { colour: "vert", kind: "account", account: ME, name: "Anaïs" },
      ],
      { captured: 0, lost: 0, home: 4 },
    );
    const stats = statsOf([withBruno(true), withBruno(false), withAlice, soloWin], ME);
    expect(
      stats.all.partners.map((partner) => [partner.kind, partner.name, partner.level]),
    ).toEqual([
      ["account", "Bruno", null],
      ["account", "alice", null],
      ["bot", null, 3],
    ]);
    expect(stats.all.partners[0]).toMatchObject({ games: 2, wins: 1 });
  });

  it("levels: only games against two computers, under the stronger one", () => {
    const stats = statsOf([onlineWin, onlineLoss, soloWin], ME);
    expect(stats.all.levels).toEqual([
      { level: 4, games: 1, wins: 0 },
      { level: 5, games: 1, wins: 1 },
    ]);
    expect(stats.online.levels).toEqual([{ level: 4, games: 1, wins: 0 }]);
    expect(stats.solo.levels).toEqual([{ level: 5, games: 1, wins: 1 }]);
    // A human opponent handed over to the computer is still a human opponent.
    const handed = row(
      "bleu",
      true,
      false,
      [
        { colour: "bleu", kind: "account", account: ME, name: "Anaïs" },
        { colour: "jaune", kind: "guest", name: "Mamie", level: 5, handedOver: true },
        { colour: "rouge", kind: "bot", level: 2 },
        { colour: "vert", kind: "bot", level: 2 },
      ],
      { captured: 0, lost: 0, home: 4 },
    );
    expect(statsOf([handed], ME).all.levels).toEqual([]);
  });

  it("a seat handed over to the computer still counts for its account, win or loss", () => {
    const mine = (won: boolean) =>
      row(
        "rouge",
        won,
        false,
        [
          { colour: "bleu", kind: "guest", name: "Mamie" },
          { colour: "jaune", kind: "bot", level: 2 },
          {
            colour: "rouge",
            kind: "account",
            account: ME,
            name: "Anaïs",
            handedOver: true,
            level: 3,
          },
          { colour: "vert", kind: "bot", level: 4 },
        ],
        { captured: 1, lost: 1, home: won ? 4 : 2 },
      );
    const stats = statsOf([mine(true), mine(false)], ME);
    expect(stats.all).toMatchObject({ games: 2, wins: 1, captured: 2, lost: 2, home: 6 });
    expect(stats.all.levels).toEqual([{ level: 4, games: 2, wins: 1 }]);
  });

  it("zero games: zeros and empty lists, and no account id anywhere", () => {
    const empty = { games: 0, wins: 0, captured: 0, lost: 0, home: 0, partners: [], levels: [] };
    expect(statsOf([], ME)).toEqual({ all: empty, online: empty, solo: empty });
    const text = JSON.stringify(statsOf([onlineWin, onlineLoss, soloWin], ME));
    for (const id of [ME, BRUNO, "other-id"]) expect(text).not.toContain(id);
  });
});
