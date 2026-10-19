// The French texts of the push notifications (plan 04-07, 04-UI-SPEC « Push notifications »): built by
// the Worker, shown as they are by the service worker. No emoji; a body stays under 110 characters
// with a 20-character pseudo; no hand, card or score, only the kind, a name and the table's link.

import { describe, expect, it } from "vitest";
import { PUSH_BODY_MAX, pushPayload, pushTag, pushText } from "./push-fr.ts";

const NNBSP = " ";
const NBSP = " ";
const TABLE = "abcdefghijklmnopqrstuv";
const LONGEST = "Marie-Charlotte Lévy"; // 20 code points

describe("pushText", () => {
  it("a turn: the table of its creator waits", () => {
    expect(pushText({ kind: "turn", from: "Marie" })).toEqual({
      title: `C’est ton tour${NNBSP}!`,
      body: `La table de Marie t’attend${NBSP}: la partie est en pause jusqu’à ton retour.`,
    });
  });

  it("a turn at one's own table", () => {
    expect(pushText({ kind: "turn", from: "Marie", own: true })).toEqual({
      title: `C’est ton tour${NNBSP}!`,
      body: `Ta table t’attend${NBSP}: la partie est en pause jusqu’à ton retour.`,
    });
  });

  it("a saved game resumed without the player", () => {
    expect(pushText({ kind: "turn", from: "Marie", resumed: true })).toEqual({
      title: `C’est ton tour${NNBSP}!`,
      body: `Marie a repris la partie${NBSP}: on t’attend pour continuer.`,
    });
  });

  it("an invitation to a table", () => {
    expect(pushText({ kind: "invite", from: "Marie" })).toEqual({
      title: "Invitation à une table",
      body: "Marie t’invite à sa table de TOC.",
    });
  });

  it("every body stays under 110 characters with a 20-character pseudo, without emoji", () => {
    expect(LONGEST.length).toBe(20);
    expect(PUSH_BODY_MAX).toBe(110);
    const all = [
      pushText({ kind: "turn", from: LONGEST }),
      pushText({ kind: "turn", from: LONGEST, own: true }),
      pushText({ kind: "turn", from: LONGEST, resumed: true }),
      pushText({ kind: "invite", from: LONGEST }),
    ];
    for (const { title, body } of all) {
      expect([...body].length, body).toBeLessThan(PUSH_BODY_MAX);
      expect(`${title}${body}`).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("a longer name is cut to its first 20 code points", () => {
    const long = "Abcdefghijklmnopqrstuvwxyz";
    expect(pushText({ kind: "invite", from: long }).body).toBe(
      "Abcdefghijklmnopqrst t’invite à sa table de TOC.",
    );
  });
});

describe("pushTag and pushPayload", () => {
  it("one tag per table and kind, so a newer notice replaces the older one", () => {
    expect(pushTag("turn", TABLE)).toBe(`tour-${TABLE}`);
    expect(pushTag("invite", TABLE)).toBe(`inv-${TABLE}`);
  });

  it("the payload: the kind, the texts, the table's link and the tag, nothing else", () => {
    expect(pushPayload({ kind: "turn", table: TABLE, from: "Marie", own: false })).toEqual({
      t: "turn",
      title: `C’est ton tour${NNBSP}!`,
      body: `La table de Marie t’attend${NBSP}: la partie est en pause jusqu’à ton retour.`,
      url: `/#/table/${TABLE}`,
      tag: `tour-${TABLE}`,
    });
    expect(pushPayload({ kind: "invite", table: TABLE, from: "Paul" })).toEqual({
      t: "invite",
      title: "Invitation à une table",
      body: "Paul t’invite à sa table de TOC.",
      url: `/#/table/${TABLE}`,
      tag: `inv-${TABLE}`,
    });
  });
});
