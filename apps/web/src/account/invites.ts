// The invitation links this device created (plan 04-05, 04-UI-SPEC « Mes amis »), kept in
// toc.invites.v1. The server keeps only the SHA-256 of a link's code, so it can never show a link
// again: « Partager ce lien » works from the device that made the link only, through this list.
// Pure: the storage and the clock are passed in, so it runs under Node.
//
// The stored value is untrusted (like toc.tables.v1, T-02-17): it is read entry by entry; an entry is
// kept only with a well-formed id and code (22 base64url characters each) and a finite expiry still
// ahead; duplicates (by id or by code) keep their newest entry; at most MAX_INVITES, newest first
// (the latest expiry: every link lives 7 days). A storage that throws or holds anything else gives
// an empty list.

import { isInvitationCode } from "@toc/protocol";
import type { StorageLike } from "../net/device.ts";

export const INVITES_KEY = "toc.invites.v1";

/** As many links as an account can have pending (MAX_PENDING_INVITATIONS on the server). */
export const MAX_INVITES = 10;

/** A link this device made: its opaque id (as GET /api/invitations lists it), its code, its expiry. */
export type StoredInvite = { id: string; code: string; expiresAt: number };

function validEntry(value: unknown, now: number): StoredInvite | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const id = Object.hasOwn(source, "id") ? source.id : undefined;
  const code = Object.hasOwn(source, "code") ? source.code : undefined;
  const expiresAt = Object.hasOwn(source, "expiresAt") ? source.expiresAt : undefined;
  if (!isInvitationCode(id) || !isInvitationCode(code)) return null;
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return { id, code, expiresAt };
}

/** Valid, unexpired entries only, one per id and per code (the newest), newest first, at most 10. */
function clean(values: readonly unknown[], now: number): StoredInvite[] {
  const valid = values
    .map((value) => validEntry(value, now))
    .filter((entry): entry is StoredInvite => entry !== null)
    .sort((a, b) => b.expiresAt - a.expiresAt);
  const ids = new Set<string>();
  const codes = new Set<string>();
  const kept: StoredInvite[] = [];
  for (const entry of valid) {
    if (ids.has(entry.id) || codes.has(entry.code)) continue;
    ids.add(entry.id);
    codes.add(entry.code);
    kept.push(entry);
  }
  return kept.slice(0, MAX_INVITES);
}

function read(storage: StorageLike | null): unknown {
  try {
    const raw = storage?.getItem(INVITES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(storage: StorageLike | null, entries: readonly StoredInvite[]): void {
  try {
    storage?.setItem(INVITES_KEY, JSON.stringify(entries));
  } catch {
    // Private browsing or a full storage: the links live for this page only.
  }
}

/** The links this device made that are still valid (a hostile or broken value gives none). */
export function loadInvites(storage: StorageLike | null, now: number): StoredInvite[] {
  const raw = read(storage);
  return Array.isArray(raw) ? clean(raw, now) : [];
}

/**
 * A link just made (POST /api/invitations) joins the list; a malformed or expired one is not kept.
 * Returns the list as stored.
 */
export function rememberInvite(
  storage: StorageLike | null,
  invite: StoredInvite,
  now: number,
): StoredInvite[] {
  const entries = loadInvites(storage, now);
  const entry = validEntry(invite, now);
  if (entry === null) return entries;
  const next = clean([entry, ...entries], now);
  write(storage, next);
  return next;
}

/** A link disabled or used: this device forgets it. Returns the list as stored. */
export function forgetInvite(storage: StorageLike | null, id: string, now: number): StoredInvite[] {
  const next = loadInvites(storage, now).filter((entry) => entry.id !== id);
  write(storage, next);
  return next;
}

/** The code of the link `id` if this device made it and it is still valid, else null. */
export function codeFor(storage: StorageLike | null, id: string, now: number): string | null {
  return loadInvites(storage, now).find((entry) => entry.id === id)?.code ?? null;
}

/**
 * The server's pending list (GET /api/invitations, plan 04-10): a link it no longer lists was used or
 * disabled, and this device forgets it. Returns the list as stored.
 */
export function keepPending(
  storage: StorageLike | null,
  pendingIds: readonly string[],
  now: number,
): StoredInvite[] {
  const pending = new Set(pendingIds);
  const next = loadInvites(storage, now).filter((entry) => pending.has(entry.id));
  write(storage, next);
  return next;
}
