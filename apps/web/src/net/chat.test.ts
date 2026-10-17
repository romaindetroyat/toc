import { COLORS } from "@toc/engine";
import { type ChatEntry, QUICK_MESSAGES, type TablePublic } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { messages } from "../i18n/fr/messages.ts";
import { announcement, HISTORY_ROWS, historyRows, senderName } from "./chat.ts";

const NNBSP = " ";
const NBSP = " ";

const seat = (name: string | null, kind: "human" | "bot" | "free" = "human") => ({
  kind,
  name,
  level: 3 as const,
  online: true,
  handedOver: null,
});

const TABLE: TablePublic = {
  status: "playing",
  seats: {
    bleu: seat("Ana"),
    jaune: seat("Bruno"),
    rouge: seat("Tornado", "bot"),
    vert: seat(null, "free"),
  },
  host: "bleu",
  creatorName: "Ana",
  gameNo: 1,
  thinking: null,
  unseated: [],
  pause: null,
  winner: null,
  rematch: null,
  now: 0,
};

describe("the catalogue of the quick messages", () => {
  it("has a text and a spoken name for each of the twelve ids, in Romain's words", () => {
    expect(QUICK_MESSAGES.slice(0, 7).map(messages.text)).toEqual([
      `Bien joué${NNBSP}!`,
      `Aïe${NNBSP}!`,
      "Merci partenaire",
      `À toi${NNBSP}!`,
      "Pardon…",
      "On y est presque",
      `Bravo${NNBSP}!`,
    ]);
    expect(QUICK_MESSAGES.slice(7).map(messages.text)).toEqual(["😂", "👏", "😮", "🐴", "❤️"]);
    expect(QUICK_MESSAGES.slice(7).map(messages.spoken)).toEqual([
      "rire",
      "applaudissements",
      "surprise",
      "cheval",
      "cœur",
    ]);
    expect(QUICK_MESSAGES.filter(messages.isEmoji)).toEqual(QUICK_MESSAGES.slice(7));
    expect(messages.send("bien-joue")).toBe(`Envoyer${NBSP}: Bien joué${NNBSP}!`);
    expect(messages.send("coeur")).toBe(`Envoyer${NBSP}: cœur`);
  });
});

describe("who sent it", () => {
  it("names a person, a computer, or the colour of a seat nobody holds", () => {
    expect(senderName(TABLE, "bleu")).toBe("Ana");
    expect(senderName(TABLE, "rouge")).toBe("Tornado");
    expect(senderName(TABLE, "vert")).toBe("Vert");
  });
});

describe("« Derniers messages »", () => {
  const entry = (i: number, from = COLORS[i % 2] as "bleu" | "jaune"): ChatEntry => ({
    from,
    msg: QUICK_MESSAGES[i % QUICK_MESSAGES.length] as ChatEntry["msg"],
    at: 1000 + i,
  });

  it("shows the newest five, newest first, yours as « Toi »", () => {
    const chat = Array.from({ length: 8 }, (_, i) => entry(i));
    const rows = historyRows(chat, TABLE, "bleu");
    expect(HISTORY_ROWS).toBe(5);
    expect(rows.map((row) => row.msg)).toEqual(["rire", "bravo", "presque", "pardon", "a-toi"]);
    expect(rows[0]).toMatchObject({ name: "Bruno", spoken: `Bruno${NBSP}: rire`, emoji: true });
    expect(rows[1]).toMatchObject({ name: "Toi", spoken: `Toi${NBSP}: Bravo${NNBSP}!` });
  });

  it("reads an emoji row by its name", () => {
    const [row] = historyRows([{ from: "jaune", msg: "coeur", at: 1 }], TABLE, "bleu");
    expect(row).toMatchObject({ text: "❤️", emoji: true, spoken: `Bruno${NBSP}: cœur` });
  });

  it("is empty with no message", () => {
    expect(historyRows([], TABLE, "bleu")).toEqual([]);
  });
});

describe("the live region", () => {
  it("says « {Nom} : {message} », an emoji by its name", () => {
    expect(announcement({ from: "jaune", msg: "coeur", at: 1 }, TABLE)).toBe(`Bruno${NBSP}: cœur`);
    expect(announcement({ from: "bleu", msg: "aie", at: 1 }, TABLE)).toBe(
      `Ana${NBSP}: Aïe${NNBSP}!`,
    );
  });
});
