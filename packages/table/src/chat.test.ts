// The quick messages' server rules (plan 02-08, D-07, D-13, T-02-33..35): only one of the twelve ids,
// only from a seated person, at most CHAT_RATE per CHAT_WINDOW_MS per person, the last CHAT_KEEP kept
// and given back in every welcome. The sender's colour comes from the person record, never the frame.

import type { Rng } from "@toc/engine";
import { QUICK_MESSAGES, type ServerFrame } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { CHAT_KEEP, CHAT_RATE, CHAT_WINDOW_MS, canChat } from "./chat.ts";
import { createTable, type Out, reduce, type Table, welcomeFor } from "./index.ts";

const ID = "abcdefghijklmnopqrstuv";
const ANA = "who-ana";
const BEN = "who-ben";
const CLO = "who-clo";
const ctx = (now: number) => ({ now, seed: (): Rng => [11, 22, 33, 44] });

type Command = Parameters<typeof reduce>[1];
type Frame = Extract<Command, { t: "client" }>["frame"];

const client = (who: string, frame: Frame): Command => ({ t: "client", who, frame });

function run(table: Table, commands: Command[], now = 2000) {
  let t = table;
  let out: Out[] = [];
  for (const command of commands) {
    const result = reduce(t, command, ctx(now));
    t = result.table;
    out = result.out;
  }
  return { table: t, out };
}

const to = (out: Out[], who: string): ServerFrame[] =>
  out.filter((each) => each.to === who).map((each) => each.frame);

/** Ana (creator, bleu), Ben (jaune) and Clo (no seat) in the waiting room. */
function lobby(): Table {
  return run(createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8], test: { pace: "zero" } }), [
    { t: "hello", who: ANA, name: "Ana" },
    { t: "hello", who: BEN, name: "Ben" },
    { t: "hello", who: CLO, name: "Clo" },
    client(ANA, { t: "sit", seat: "bleu" }),
    client(BEN, { t: "sit", seat: "jaune" }),
  ]).table;
}

const say = (table: Table, who: string, msg: (typeof QUICK_MESSAGES)[number], now: number) =>
  reduce(table, client(who, { t: "chat", msg }), ctx(now));

describe("who may send a quick message", () => {
  it("sends a seated person's message to everyone online at the table, from their seat", () => {
    const { table, out } = say(lobby(), BEN, "merci-partenaire", 5000);
    const frame = { t: "chat", from: "jaune", msg: "merci-partenaire", at: 5000 };
    for (const who of [ANA, BEN, CLO]) expect(to(out, who)).toEqual([frame]);
    expect(table.chat).toEqual([{ from: "jaune", msg: "merci-partenaire", at: 5000 }]);
    // No person id travels, no table frame for a message.
    expect(JSON.stringify(out)).not.toContain('"table"');
  });

  it("refuses a person without a seat, and keeps nothing", () => {
    const before = lobby();
    const { table, out } = say(before, CLO, "aie", 5000);
    expect(out).toEqual([{ to: CLO, frame: { t: "error", code: "refused" } }]);
    expect(table.chat).toEqual([]);
    expect(canChat(before, CLO)).toBe(false);
    expect(canChat(before, ANA)).toBe(true);
    expect(canChat(before, "who-nobody")).toBe(false);
  });

  it("does not send to people who are offline", () => {
    const table = run(lobby(), [{ t: "gone", who: CLO }]).table;
    const { out } = say(table, ANA, "bravo", 5000);
    expect(to(out, CLO)).toEqual([]);
    expect(to(out, BEN)).toHaveLength(1);
  });

  it("is open in the waiting room, during the game, paused and saved", () => {
    let table = lobby();
    expect(say(table, ANA, "a-toi", 3000).table.chat).toHaveLength(1);
    table = run(table, [client(ANA, { t: "start" })]).table;
    expect(table.status).toBe("playing");
    expect(say(table, BEN, "bien-joue", 3000).table.chat).toHaveLength(1);
    table = run(table, [{ t: "gone", who: BEN }]).table;
    expect(table.status).toBe("paused");
    expect(say(table, ANA, "pardon", 3000).table.chat).toHaveLength(1);
    table = run(table, [client(ANA, { t: "stop" })]).table;
    expect(table.status).toBe("saved");
    expect(say(table, ANA, "coeur", 3000).table.chat).toHaveLength(1);
  });
});

describe("the pace of the messages", () => {
  it("lets three through in five seconds; the fourth gets rate, to the sender only", () => {
    expect(CHAT_RATE).toBe(3);
    expect(CHAT_WINDOW_MS).toBe(5000);
    let table = lobby();
    for (const [i, msg] of (["aie", "bravo", "rire"] as const).entries()) {
      const result = say(table, ANA, msg, 10_000 + i * 1000);
      expect(to(result.out, BEN)).toHaveLength(1);
      table = result.table;
    }
    const fourth = say(table, ANA, "coeur", 14_999);
    expect(fourth.out).toEqual([{ to: ANA, frame: { t: "error", code: "rate" } }]);
    expect(fourth.table.chat.map((entry) => entry.msg)).toEqual(["aie", "bravo", "rire"]);
    // Another person has their own count.
    expect(to(say(table, BEN, "coeur", 14_999).out, ANA)).toHaveLength(1);
    // Five seconds after the first, a fourth is welcome.
    const later = say(fourth.table, ANA, "coeur", 15_000);
    expect(to(later.out, BEN)).toEqual([{ t: "chat", from: "bleu", msg: "coeur", at: 15_000 }]);
  });

  it("does not count a refused message against the sender", () => {
    let table = lobby();
    for (let i = 0; i < 3; i++) table = say(table, ANA, "aie", 10_000).table;
    for (let i = 0; i < 5; i++) table = say(table, ANA, "aie", 12_000).table;
    expect(to(say(table, ANA, "aie", 15_000).out, BEN)).toHaveLength(1);
  });
});

describe("the kept messages", () => {
  it("keeps the last CHAT_KEEP, oldest first, and gives them in every welcome", () => {
    expect(CHAT_KEEP).toBe(30);
    let table = lobby();
    for (let i = 0; i < 40; i++) {
      const who = i % 2 === 0 ? ANA : BEN;
      table = say(table, who, QUICK_MESSAGES[i % QUICK_MESSAGES.length] as never, 10_000 * i).table;
    }
    expect(table.chat).toHaveLength(CHAT_KEEP);
    expect(table.chat[0]).toEqual({ from: "bleu", msg: QUICK_MESSAGES[10 % 12], at: 100_000 });
    expect(table.chat[29]?.at).toBe(390_000);
    expect(welcomeFor(table, CLO).chat).toEqual(table.chat);
    // A returning person reads them too.
    const back = run(table, [
      { t: "gone", who: BEN },
      { t: "hello", who: BEN, name: "Ben" },
    ]);
    const welcome = to(back.out, BEN).find((frame) => frame.t === "welcome");
    expect(welcome).toMatchObject({ chat: table.chat });
  });

  it("starts empty, and an older snapshot without messages reads as empty", () => {
    const table = lobby();
    expect(welcomeFor(table, ANA).chat).toEqual([]);
    const old = JSON.parse(JSON.stringify(table)) as Record<string, unknown>;
    delete old.chat;
    delete old.chatTimes;
    const result = say(old as unknown as Table, ANA, "aie", 5000);
    expect(result.table.chat).toHaveLength(1);
  });

  it("never puts a person id in a chat frame or a welcome", () => {
    let table = lobby();
    table = say(table, ANA, "cheval", 5000).table;
    const sent = say(table, BEN, "aie", 6000).out.map((each) => each.frame);
    const text = JSON.stringify([welcomeFor(table, BEN), sent]);
    for (const who of [ANA, BEN, CLO]) expect(text).not.toContain(who);
  });
});
