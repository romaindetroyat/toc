// « Mes parties en cours » (D-06, 02-UI-SPEC « « Mes parties en cours » list »): the tables this device
// has joined, kept in toc.tables.v1. Pure: the storage and the clock are passed in, so it runs under Node.
//
// The stored value is untrusted (T-02-17): it is read entry by entry, an entry is kept only with a well-
// formed table id, a colour or null, and a time; duplicates keep their newest entry; at most 20, the
// newest. Removing an entry touches only this device: the table lives on for the others.
//
// Plan 04-04: an entry may be tagged with the account it was played with; visibleTables hides the
// tagged entries from a signed-out device (D-12) and mergeTables adds the account's tables from
// GET /api/me/tables (wired into the home in plan 04-09).

import { COLORS, type Color } from "@toc/engine";
import { type AccountTable, isTableId, type TableStatus, type TableSummary } from "@toc/protocol";
import { table as copy } from "../i18n/fr/table.ts";
import type { StorageLike } from "./device.ts";

export const TABLES_KEY = "toc.tables.v1";

/** The most tables the list remembers. */
export const MAX_TABLES = 20;

/**
 * One table of this device: its id, this device's seat there (null before sitting), when it joined;
 * since plan 04-04 the account it was played with (`account`, absent for a guest's entry).
 */
export type TableEntry = { id: string; seat: Color | null; joinedAt: number; account?: string };

/** An account id: 22 base64url characters (16 random bytes, plan 04-01). */
const ACCOUNT_ID_RE = /^[A-Za-z0-9_-]{22}$/;

function validEntry(value: unknown): TableEntry | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const id = Object.hasOwn(source, "id") ? source.id : undefined;
  const seat = Object.hasOwn(source, "seat") ? source.seat : undefined;
  const joinedAt = Object.hasOwn(source, "joinedAt") ? source.joinedAt : undefined;
  const account = Object.hasOwn(source, "account") ? source.account : undefined;
  if (!isTableId(id)) return null;
  if (seat !== null && !COLORS.includes(seat as Color)) return null;
  if (typeof joinedAt !== "number" || !Number.isFinite(joinedAt) || joinedAt < 0) return null;
  const entry: TableEntry = { id, seat: seat as Color | null, joinedAt };
  // A tag out of shape is dropped; the entry stays.
  if (typeof account === "string" && ACCOUNT_ID_RE.test(account)) entry.account = account;
  return entry;
}

/** Valid entries only, one per table (its newest), newest first, at most MAX_TABLES. */
function clean(values: readonly unknown[]): TableEntry[] {
  const newest = new Map<string, TableEntry>();
  for (const value of values) {
    const entry = validEntry(value);
    if (entry === null) continue;
    const known = newest.get(entry.id);
    if (known === undefined || entry.joinedAt > known.joinedAt) newest.set(entry.id, entry);
  }
  return [...newest.values()].sort((a, b) => b.joinedAt - a.joinedAt).slice(0, MAX_TABLES);
}

function read(storage: StorageLike | null): unknown {
  try {
    const raw = storage?.getItem(TABLES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(storage: StorageLike | null, entries: readonly TableEntry[]): void {
  try {
    storage?.setItem(TABLES_KEY, JSON.stringify(entries));
  } catch {
    // Private browsing or a full storage: the list lives for this page only.
  }
}

/** The device's tables, validated (a hostile or broken value gives an empty list). */
export function loadTables(storage: StorageLike | null): TableEntry[] {
  const raw = read(storage);
  return Array.isArray(raw) ? clean(raw) : [];
}

/**
 * The table joins the list (at the front), or its seat is updated in place; the join time of a known
 * table stays. `account`: the welcome came on this account's socket (plan 04-04), so the entry is
 * tagged with it. A guest's welcome (no account) never changes an entry tagged with an account: the
 * seat there stays the account's (04-RESEARCH Pattern 4, rule 4). Returns the list as stored.
 */
export function rememberTable(
  storage: StorageLike | null,
  id: string,
  seat: Color | null,
  now: number,
  account?: string,
): TableEntry[] {
  const entries = loadTables(storage);
  if (!isTableId(id)) return entries;
  const tag = account !== undefined && ACCOUNT_ID_RE.test(account) ? account : undefined;
  const at = entries.findIndex((entry) => entry.id === id);
  const known = entries[at];
  if (known !== undefined) {
    if (tag === undefined && known.account !== undefined) return entries;
    if (known.seat === seat && known.account === tag) return entries;
    entries[at] = tag === undefined ? { ...known, seat } : { ...known, seat, account: tag };
    write(storage, entries);
    return entries;
  }
  const entry: TableEntry =
    tag === undefined ? { id, seat, joinedAt: now } : { id, seat, joinedAt: now, account: tag };
  const next = [entry, ...entries].slice(0, MAX_TABLES);
  write(storage, next);
  return next;
}

/**
 * The entries this device shows (plan 04-04, D-12): signed out (null), only the guest entries;
 * signed in, the guest entries and the account's own, never another account's.
 */
export function visibleTables(
  entries: readonly TableEntry[],
  accountId: string | null,
): TableEntry[] {
  return entries.filter((entry) => entry.account === undefined || entry.account === accountId);
}

/**
 * « Mes parties en cours » for a signed-in account (plan 04-04, ACCT-02): this device's visible
 * entries and the account's tables from GET /api/me/tables, one per table (the device's seat and
 * join time win when both have it, tagged with the account), newest first, at most MAX_TABLES. A row
 * out of shape is skipped.
 */
export function mergeTables(
  device: readonly TableEntry[],
  account: readonly AccountTable[],
  accountId: string,
): TableEntry[] {
  const byId = new Map<string, TableEntry>();
  for (const row of account) {
    const entry = validEntry({ id: row.tableId, seat: row.seat, joinedAt: row.joinedAt });
    if (entry !== null && !byId.has(entry.id)) byId.set(entry.id, { ...entry, account: accountId });
  }
  for (const entry of visibleTables(device, accountId)) {
    byId.set(entry.id, { ...entry, account: accountId });
  }
  return [...byId.values()].sort((a, b) => b.joinedAt - a.joinedAt).slice(0, MAX_TABLES);
}

/**
 * Signing in on this device (plan 04-09, D-05): the device's guest entries pass to the account (the
 * server links the seats at the next hello, 04-RESEARCH Pattern 4 rule 2); entries of another account
 * stay as they are. Answers how many were linked (the sign-in toast says so when there were some).
 */
export function linkTables(storage: StorageLike | null, accountId: string): number {
  if (!ACCOUNT_ID_RE.test(accountId)) return 0;
  const entries = loadTables(storage);
  let linked = 0;
  const next = entries.map((entry) => {
    if (entry.account !== undefined) return entry;
    linked++;
    return { ...entry, account: accountId };
  });
  if (linked > 0) write(storage, next);
  return linked;
}

/** Removes the table from this device's list; its entry and place, for « Remettre ». */
export function forgetTable(
  storage: StorageLike | null,
  id: string,
): { entry: TableEntry; index: number } | null {
  const entries = loadTables(storage);
  const index = entries.findIndex((entry) => entry.id === id);
  const entry = entries[index];
  if (entry === undefined) return null;
  entries.splice(index, 1);
  write(storage, entries);
  return { entry, index };
}

/** « Remettre »: the entry back at its place (once). */
export function restoreTable(
  storage: StorageLike | null,
  entry: TableEntry,
  index: number,
): TableEntry[] {
  const entries = loadTables(storage).filter((each) => each.id !== entry.id);
  entries.splice(Math.max(0, Math.min(index, entries.length)), 0, entry);
  const next = entries.slice(0, MAX_TABLES);
  write(storage, next);
  return next;
}

/** Row line 1: the other seats by first name or horse name; free seats are never listed. */
export function rowText(summary: TableSummary, seat: Color | null): string {
  const names = COLORS.filter((color) => color !== seat)
    .map((color) => summary.seats[color])
    .filter((other) => other.kind !== "free" && other.name !== null)
    .map((other) => other.name as string);
  return names.length === 0 ? copy.list.nobody : copy.list.with(names);
}

/** Row line 2's first part: the table's status (`missingIsMe`: paused, waiting for this device). */
export function statusText(status: TableStatus, missingIsMe = false): string {
  if (status === "paused" && missingIsMe) return copy.list.status.pausedForYou;
  return copy.list.status[status];
}

/** Row line 2's status for this device's seat: « En pause : on t’attend » when its seat is missing. */
export function rowStatus(summary: TableSummary, seat: Color | null): string {
  return statusText(summary.status, seat !== null && summary.missing.includes(seat));
}

const DAY = 86_400_000;

/** How long ago, in French (« il y a 5 minutes », « hier »), never in the future. */
export function timeAgo(then: number, now: number): string {
  const format = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  const ago = Math.max(0, now - then);
  if (ago < 45_000) return format.format(0, "second");
  if (ago < 3_600_000) return format.format(-Math.max(1, Math.round(ago / 60_000)), "minute");
  if (ago < DAY) return format.format(-Math.round(ago / 3_600_000), "hour");
  if (ago < 30 * DAY) return format.format(-Math.round(ago / DAY), "day");
  return format.format(-Math.round(ago / (30 * DAY)), "month");
}
