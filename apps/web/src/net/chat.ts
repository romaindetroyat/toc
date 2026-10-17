// The quick messages on this device (plan 02-08): who sent a message, the rows of « Derniers
// messages » and the sentence the live region says. Pure: the screens pass the public table and this
// device's seat. Only ids come from the server; every word is from the French catalogue (T-02-33).

import type { Color } from "@toc/engine";
import type { ChatEntry, QuickMessageId, TablePublic } from "@toc/protocol";
import { messages } from "../i18n/fr/messages.ts";
import { seats } from "../i18n/fr/seats.ts";

/** How many rows « Derniers messages » shows (newest first) of the CHAT_KEEP the server keeps. */
export const HISTORY_ROWS = 5;

/** The sender's first name or horse name, or the seat's colour when nobody holds it any more. */
export function senderName(table: TablePublic, from: Color): string {
  return table.seats[from].name ?? seats[from].name;
}

export type HistoryRow = {
  key: string;
  /** « Toi » for this device's own messages. */
  name: string;
  msg: QuickMessageId;
  /** What shows: the phrase or the emoji glyph. */
  text: string;
  /** What a screen reader says: « Ana : Bien joué ! », « Toi : cœur ». */
  spoken: string;
  emoji: boolean;
};

/** The newest HISTORY_ROWS messages, newest first, each with its sender's name (« Toi » for yours). */
export function historyRows(
  chat: readonly ChatEntry[],
  table: TablePublic,
  me: Color | null,
): HistoryRow[] {
  return chat
    .slice(-HISTORY_ROWS)
    .reverse()
    .map((entry, i) => {
      const name = entry.from === me ? messages.history.you : senderName(table, entry.from);
      return {
        key: `${entry.at}-${entry.from}-${i}`,
        name,
        msg: entry.msg,
        text: messages.text(entry.msg),
        spoken: messages.history.row(name, messages.spoken(entry.msg)),
        emoji: messages.isEmoji(entry.msg),
      };
    });
}

/** The live region's sentence for a message someone else sent: « Marie : cœur ». */
export function announcement(entry: ChatEntry, table: TablePublic): string {
  return messages.announce(senderName(table, entry.from), entry.msg);
}
