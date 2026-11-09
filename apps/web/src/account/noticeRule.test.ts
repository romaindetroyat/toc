import type { NoticeFrame } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import {
  decide,
  type NoticePlace,
  type NoticeSlot,
  placeChanged,
  receive,
  release,
  settle,
} from "./noticeRule.ts";

// When the app may show the card of a notice (plan 04-06; 04-UI-SPEC « In-app card », « Not shown »):
// never during a game (#/partie, or a table playing, paused or saved), on the backup-code screen,
// during sign-up or recovery. There it is held, and shown on the next other screen only if the table
// still waits (lobby for an invite, paused for a turn); else dropped. Only the latest is kept.

const TABLE = "abcdefghijklmnopqrstuv";

const invite: NoticeFrame = { t: "notice", kind: "invite", table: TABLE, from: "Romain", at: 1 };
const turn: NoticeFrame = { t: "notice", kind: "turn", table: TABLE, from: "Romain", at: 2 };

const HOME: NoticePlace = { route: "#/" };

describe("decide(notice, place)", () => {
  it("shows on the home screen, the computer setup, a waiting room, a finished table", () => {
    for (const place of [
      HOME,
      { route: "" },
      { route: "#/ordinateur" },
      { route: "#/table/ABCDEFGHIJKLMNOPQRSTUV", tableStatus: "lobby" },
      { route: "#/table/ABCDEFGHIJKLMNOPQRSTUV", tableStatus: "finished" },
      { route: "#/table/ABCDEFGHIJKLMNOPQRSTUV", tableStatus: null },
      { route: "#/table/ABCDEFGHIJKLMNOPQRSTUV" },
    ] satisfies NoticePlace[]) {
      expect(decide(invite, place), JSON.stringify(place)).toBe("show");
      expect(decide(turn, place), JSON.stringify(place)).toBe("show");
    }
  });

  it("holds during the local game and at a table playing, paused or saved", () => {
    for (const place of [
      { route: "#/partie" },
      { route: "#/table/ABCDEFGHIJKLMNOPQRSTUV", tableStatus: "playing" },
      { route: "#/table/ABCDEFGHIJKLMNOPQRSTUV", tableStatus: "paused" },
      { route: "#/table/ABCDEFGHIJKLMNOPQRSTUV", tableStatus: "saved" },
    ] satisfies NoticePlace[]) {
      expect(decide(invite, place), JSON.stringify(place)).toBe("hold");
      expect(decide(turn, place), JSON.stringify(place)).toBe("hold");
    }
  });

  it("holds during a sign-up, a recovery and on the backup-code screen, whatever the route", () => {
    for (const flow of ["signup", "recover", "backup"] as const) {
      expect(decide(invite, { route: "#/", flow })).toBe("hold");
      expect(decide(turn, { route: "#/invitation/abc", flow })).toBe("hold");
    }
    expect(decide(invite, { route: "#/", flow: null })).toBe("show");
  });
});

describe("release(held, status)", () => {
  it("an invite: shown only while the table waits in its lobby", () => {
    expect(release(invite, "lobby")).toBe("show");
    for (const status of ["playing", "paused", "saved", "finished", "gone", "unknown"] as const) {
      expect(release(invite, status), status).toBe("drop");
    }
  });

  it("a turn: shown only while the table is paused", () => {
    expect(release(turn, "paused")).toBe("show");
    for (const status of ["lobby", "playing", "saved", "finished", "gone", "unknown"] as const) {
      expect(release(turn, status), status).toBe("drop");
    }
  });
});

describe("the slot: only the latest notice", () => {
  it("a notice is shown or held where it arrives", () => {
    expect(receive(null, invite, HOME)).toEqual({ notice: invite, held: false });
    expect(receive(null, invite, { route: "#/partie" })).toEqual({ notice: invite, held: true });
  });

  it("a newer notice replaces a shown one and a held one", () => {
    const shown: NoticeSlot = { notice: invite, held: false };
    expect(receive(shown, turn, HOME)).toEqual({ notice: turn, held: false });
    const held: NoticeSlot = { notice: invite, held: true };
    expect(receive(held, turn, { route: "#/partie" })).toEqual({ notice: turn, held: true });
    expect(receive(held, turn, HOME)).toEqual({ notice: turn, held: false });
  });

  it("entering a game holds the card; leaving it asks for the table's status first", () => {
    const shown: NoticeSlot = { notice: invite, held: false };
    const entered = placeChanged(shown, { route: "#/partie" });
    expect(entered).toEqual({ slot: { notice: invite, held: true }, check: null });
    // Still in a game: nothing to check.
    expect(placeChanged(entered.slot, { route: "#/table/x", tableStatus: "playing" })).toEqual({
      slot: { notice: invite, held: true },
      check: null,
    });
    // Out of the game: the card stays held until the table's status says it still waits.
    expect(placeChanged(entered.slot, HOME)).toEqual({
      slot: { notice: invite, held: true },
      check: invite,
    });
    // Nothing held, nothing to check; a shown card stays shown elsewhere.
    expect(placeChanged(null, HOME)).toEqual({ slot: null, check: null });
    expect(placeChanged(shown, { route: "#/ordinateur" })).toEqual({ slot: shown, check: null });
  });

  it("settle: the status shows or drops the held card, unless a newer one replaced it", () => {
    const held: NoticeSlot = { notice: invite, held: true };
    expect(settle(held, invite, "lobby", HOME)).toEqual({ notice: invite, held: false });
    expect(settle(held, invite, "playing", HOME)).toBeNull();
    expect(settle(held, invite, "gone", HOME)).toBeNull();
    // The player went back into a game while the status was on its way: still held.
    expect(settle(held, invite, "lobby", { route: "#/partie" })).toEqual(held);
    // A newer notice came meanwhile: the answer for the older one changes nothing.
    const newer: NoticeSlot = { notice: turn, held: false };
    expect(settle(newer, invite, "gone", HOME)).toBe(newer);
    expect(settle(null, invite, "lobby", HOME)).toBeNull();
  });
});
