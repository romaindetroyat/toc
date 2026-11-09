// The solo games not yet in « Mes résultats » (plan 05-07; 05-UI-SPEC « What counts »; 05-RESEARCH
// Pattern 2, Pitfall 4): toc.pending.v1, a list of { account, report }, at most 50 (the oldest go).
// Every report is queued before it is sent, so a page closed mid-request keeps it, and leaves the
// queue once the server took it (201, 200) or refused its body for good (400); without network,
// without session or with the server failing it waits for the next start. Each entry is tagged with
// the account that played: a family sharing one device never sends a game under another member's
// account (T-05-20). The stored value is untrusted (T-05-21): every entry is checked again with the
// Worker's SoloReport schema when read, and one out of shape is dropped. Storage may throw (private
// browsing, a full disk): never fatal.

import { parseSoloReport, type SoloReport, TABLE_ID_RE } from "@toc/protocol";
import { type SoloSent, sendSoloReport } from "./solo.ts";

export const PENDING_KEY = "toc.pending.v1";
export const PENDING_MAX = 50;

/** A game waiting for the server, with the account that played it (16 random bytes, base64url). */
export type PendingEntry = { account: string; report: SoloReport };

export type PendingStorage = Pick<Storage, "getItem" | "setItem">;

/** Sends one report: sendSoloReport by default. */
export type SendReport = (report: SoloReport) => Promise<SoloSent>;

export type PendingDeps = { storage: PendingStorage | null; send: SendReport };

/** The page's storage, or null where reading it throws. */
export function pendingStorage(): PendingStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const browserDeps = (): PendingDeps => ({
  storage: pendingStorage(),
  send: (report) => sendSoloReport(report),
});

function entryOf(raw: unknown): PendingEntry | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.length !== 2 || !keys.includes("account") || !keys.includes("report")) return null;
  const { account, report } = raw as Record<string, unknown>;
  if (typeof account !== "string" || !TABLE_ID_RE.test(account)) return null;
  const checked = parseSoloReport(report);
  return checked === null ? null : { account, report: checked };
}

/** The queue as stored, each entry checked; anything out of shape is left out. */
export function readPending(storage: PendingStorage | null): PendingEntry[] {
  let raw: unknown;
  try {
    const text = storage?.getItem(PENDING_KEY);
    raw = text ? JSON.parse(text) : [];
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.map(entryOf).filter((entry): entry is PendingEntry => entry !== null);
}

function write(storage: PendingStorage | null, entries: PendingEntry[]): void {
  try {
    storage?.setItem(PENDING_KEY, JSON.stringify(entries.slice(-PENDING_MAX)));
  } catch {
    // A full or forbidden storage: the game is still sent now, it only cannot wait.
  }
}

const same = (entry: PendingEntry, account: string, id: string) =>
  entry.account === account && entry.report.id === id;

/** Queues a game (once per account and game); beyond 50 the oldest are dropped. */
export function enqueuePending(storage: PendingStorage | null, entry: PendingEntry): void {
  const kept = readPending(storage).filter((e) => !same(e, entry.account, entry.report.id));
  write(storage, [...kept, { account: entry.account, report: entry.report }]);
}

/** Takes one account's game off the queue. */
export function removePending(storage: PendingStorage | null, account: string, id: string): void {
  const entries = readPending(storage);
  const kept = entries.filter((e) => !same(e, account, id));
  if (kept.length !== entries.length) write(storage, kept);
}

/** The server has the game, or will never take it: it leaves the queue. */
const settled = (sent: SoloSent) => sent === "added" || sent === "already" || sent === "refused";

/** Queues the game, sends it, and takes it off the queue when settled. Answers the send's meaning. */
export async function reportNow(
  entry: PendingEntry,
  deps: PendingDeps = browserDeps(),
): Promise<SoloSent> {
  enqueuePending(deps.storage, entry);
  const sent = await deps.send(entry.report);
  if (settled(sent)) removePending(deps.storage, entry.account, entry.report.id);
  return sent;
}

/**
 * Sends the games waiting for `account`, oldest first, one at a time, never another account's. Stops
 * at the first one without network or session (the rest would fail alike). Answers how many left the
 * queue.
 */
export async function flushPending(
  account: string,
  deps: PendingDeps = browserDeps(),
): Promise<number> {
  let done = 0;
  for (const entry of readPending(deps.storage).filter((e) => e.account === account)) {
    const sent = await deps.send(entry.report);
    if (settled(sent)) {
      removePending(deps.storage, account, entry.report.id);
      done++;
    } else if (sent === "offline" || sent === "signed-out") break;
  }
  return done;
}
