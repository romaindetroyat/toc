// The quick messages at the table (plan 02-08, D-07, D-13; 02-RESEARCH Pattern 10). Pure: the clock is
// the reducer's ctx.now. The id was already checked against QUICK_MESSAGES by the protocol (T-02-33);
// here: only a seated person may send (T-02-35: the sender's seat comes from the person record, never
// from the frame), at a friendly pace (T-02-34), and the table keeps the last CHAT_KEEP for a welcome.

import { CHAT_KEEP, type ChatEntry, type QuickMessageId } from "@toc/protocol";
import { personOf, type Table } from "./table.ts";

export { CHAT_KEEP };

/** At most CHAT_RATE accepted messages per person within any CHAT_WINDOW_MS. */
export const CHAT_RATE = 3;
export const CHAT_WINDOW_MS = 5000;

/** A person with a seat may send, in every status (waiting room, playing, paused, saved). */
export function canChat(table: Table, who: string): boolean {
  return (personOf(table, who)?.seat ?? null) !== null;
}

/** The times of `who`'s accepted messages still inside the window at `now`. */
function recent(table: Table, who: string, now: number): number[] {
  return (table.chatTimes?.[who] ?? []).filter((at) => now - at < CHAT_WINDOW_MS);
}

/** True when `who` already sent CHAT_RATE messages within the window: this one answers rate. */
export function overRate(table: Table, who: string, now: number): boolean {
  return recent(table, who, now).length >= CHAT_RATE;
}

/**
 * Keeps an accepted message on `next` (a copy the reducer owns) and returns the entry: the sender's
 * seat, the id, the time. The list keeps the newest CHAT_KEEP, oldest first; each person's times keep
 * only the window, and people with no recent message are dropped from the record.
 */
export function keepMessage(
  next: Table,
  who: string,
  msg: QuickMessageId,
  now: number,
): ChatEntry | null {
  const seat = personOf(next, who)?.seat ?? null;
  if (seat === null) return null;
  const entry: ChatEntry = { from: seat, msg, at: now };
  next.chat = [...next.chat, entry].slice(-CHAT_KEEP);
  const times: Record<string, number[]> = {};
  for (const [each, list] of Object.entries(next.chatTimes)) {
    const kept = list.filter((at) => now - at < CHAT_WINDOW_MS);
    if (kept.length > 0) times[each] = kept;
  }
  times[who] = [...recent(next, who, now), now];
  next.chatTimes = times;
  return entry;
}
