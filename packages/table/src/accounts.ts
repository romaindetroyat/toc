// The account at the table (plan 04-04, D-05, D-12; 04-RESEARCH Pattern 4 « Person identity with
// accounts »). Pure: the Durable Object hashes the ids and passes them in.
//
// A socket comes with three ids, all base64url SHA-256 computed by the object:
//   device   hash(tableId:token), the phase-2 person of this device;
//   guest    hash(tableId:guest:token), the person this device is when signed out and its device
//            person is linked to an account;
//   account  { id, who = hash(tableId:acct:userId) } when the upgrade carried a session, else null.
// resolveWho picks the person:
//   1. an account with a person linked to it → that person (any device of the account gets the seat
//      back; the object closes the older socket with 4001 « Partie ouverte ailleurs »);
//   2. else an account and the device person exists unlinked → the device person, linked by the
//      hello (signing in keeps the device's seats, D-05);
//   3. else an account → account.who, a new person linked to it;
//   4. no account and the device person is linked → guest, a new guest without a seat (a linked seat
//      needs its account, D-12);
//   else the device person (phase 2).
// No `who` is ever renamed, so votes, the creator, the pause and the reclaims stay valid.
//
// The members outbox: after each command the reducer lists, for the object to write to D1's
// table_members after the commit, every linked person who became linked, sat, stood, was moved or
// left (seat null). A person's account never leaves the server (oracle.ts personSecrets).

import type { Color } from "@toc/engine";
import { type Person, personOf, type Table } from "./table.ts";

/** The account of a socket, as the hello command carries it: its id and its pseudo. */
export type HelloAccount = { id: string; pseudo: string };

/** The hashed ids of a socket (see the header). */
export type SocketIds = {
  device: string;
  guest: string;
  account: { id: string; who: string } | null;
};

/** One row for table_members: the account's seat at this table now (null: at the table, no seat). */
export type Member = { account: string; seat: Color | null };

/** The person a socket is at `table`, by the four rules. */
export function resolveWho(table: Table, ids: SocketIds): string {
  const account = ids.account;
  if (account !== null) {
    const linked = table.people.find((person) => (person.account ?? null) === account.id);
    if (linked !== undefined) return linked.who;
    const device = personOf(table, ids.device);
    if (device !== undefined && (device.account ?? null) === null) return ids.device;
    return account.who;
  }
  const device = personOf(table, ids.device);
  if (device !== undefined && (device.account ?? null) !== null) return ids.guest;
  return ids.device;
}

/**
 * The hello's update of an existing person: online, linked when unlinked and an account came (its
 * name is then the pseudo), its name the pseudo for its own account, the typed first name for a
 * guest. A person linked to an account keeps its name on any other hello, and is never relinked.
 */
export function linkPerson(person: Person, account: HelloAccount | null, name: string): void {
  person.online = true;
  const linked = person.account ?? null;
  if (account !== null && (linked === null || linked === account.id)) {
    person.account = account.id;
    person.name = account.pseudo;
    return;
  }
  if (linked === null) person.name = name;
}

/** A new person of the hello: linked and named by the pseudo for an account socket. */
export function newPerson(who: string, account: HelloAccount | null, name: string): Person {
  return {
    who,
    name: account?.pseudo ?? name,
    seat: null,
    online: true,
    account: account?.id ?? null,
  };
}

/**
 * The members rows a command calls for: each linked person of `after` who was not linked to that
 * account in `before` or whose seat changed, and each linked person of `before` gone from `after`
 * (seat null).
 */
export function memberChanges(before: Table, after: Table): Member[] {
  const rows: Member[] = [];
  for (const person of after.people) {
    const account = person.account ?? null;
    if (account === null) continue;
    const was = personOf(before, person.who);
    if (was !== undefined && (was.account ?? null) === account && was.seat === person.seat)
      continue;
    rows.push({ account, seat: person.seat });
  }
  for (const person of before.people) {
    const account = person.account ?? null;
    if (account === null || personOf(after, person.who) !== undefined) continue;
    rows.push({ account, seat: null });
  }
  return rows;
}
