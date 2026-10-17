// The waiting room's toasts (02-UI-SPEC « Waiting room », Toasts): who arrived, who left, and, for the
// person the host moved, where they are now. Pure: built from two public tables in a row and this
// device's own seat; nothing on the first frame (the screen is new, there is nothing to tell).
//
// People are counted by first name (the public table carries no id): the seated people plus the people
// online without a seat. Taking a seat, changing seat or going offline on a seat changes nothing; a
// person who leaves the table (or closes the page without a seat) is announced once.

import { COLORS, type Color } from "@toc/engine";
import type { TablePublic } from "@toc/protocol";
import { seats } from "../i18n/fr/seats.ts";
import { table as copy } from "../i18n/fr/table.ts";

/** This device at the moment of the change. */
export type Me = {
  /** Its first name: its own arrival is never announced to itself. */
  name: string;
  /** Its seat before the change and after it. */
  was: Color | null;
  seat: Color | null;
  /** It is the host: the host's own seat changes are the host's doing. */
  host: boolean;
  /** It asked for its own change of seat (a sit or a stand of its own). */
  asked: boolean;
};

/** The first names at the table other than this device, with repeats (two « Marie » count twice). */
function others(table: TablePublic, mySeat: Color | null, myName: string): string[] {
  const names: string[] = [];
  for (const color of COLORS) {
    const seat = table.seats[color];
    if (seat.kind === "human" && seat.name !== null && color !== mySeat) names.push(seat.name);
  }
  let skipMe = mySeat === null;
  for (const name of table.unseated) {
    if (skipMe && name === myName) {
      skipMe = false;
      continue;
    }
    names.push(name);
  }
  return names;
}

/** The names of `a` not matched by a name of `b`, one for one, in `a`'s order. */
function minus(a: readonly string[], b: readonly string[]): string[] {
  const left = [...b];
  const out: string[] = [];
  for (const name of a) {
    const at = left.indexOf(name);
    if (at === -1) out.push(name);
    else left.splice(at, 1);
  }
  return out;
}

/** The toasts for one change of the public table, most important first. */
export function tableNotices(prev: TablePublic | null, next: TablePublic, me: Me): string[] {
  if (prev === null) return [];
  const notices: string[] = [];
  if (!me.host && !me.asked && me.seat !== null && me.seat !== me.was) {
    notices.push(copy.lobby.movedYou(next.creatorName ?? "", seats[me.seat].name));
  }
  const before = others(prev, me.was, me.name);
  const after = others(next, me.seat, me.name);
  for (const name of minus(after, before)) notices.push(copy.lobby.joined(name));
  for (const name of minus(before, after)) notices.push(copy.lobby.left(name));
  return notices;
}
