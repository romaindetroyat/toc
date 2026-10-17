// The table's toasts. In the waiting room (02-UI-SPEC « Waiting room », Toasts): who arrived, who
// left, and, for the person the host moved, where they are now. In the game (plan 02-06, 02-UI-SPEC
// « In the game (online only) »): the chef de table's choice, who is back, and the chef de table role
// passed while the creator is away and given back on return (D-05). Pure: built from two public tables in a row and this
// device's own seat; nothing on the first frame (the screen is new, there is nothing to tell).
// In both, the table's « Avance rapide » switched by the chef de table (plan 02-10b), told to everyone
// else with the chef de table's name.
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

/** « {Chef} a mis / a enlevé l’avance rapide. » when the flag changed; the chef de table's name. */
function fastNotice(prev: TablePublic, next: TablePublic): string | null {
  if (prev.fast === next.fast) return null;
  const host = next.host === null ? null : next.seats[next.host].name;
  const name = host ?? next.creatorName ?? "";
  return next.fast ? copy.game.notices.fastOn(name) : copy.game.notices.fastOff(name);
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
  const fast = me.host ? null : fastNotice(prev, next);
  if (fast !== null) notices.push(fast);
  return notices;
}

/** The online game's toasts for one change of the public table, seen from `me.seat`. */
export function gameNotices(
  prev: TablePublic | null,
  next: TablePublic,
  me: { seat: Color },
): string[] {
  if (prev === null || prev.status === "lobby" || next.status === "lobby") return [];
  const notices: string[] = [];
  const nameOf = (table: TablePublic, color: Color) => table.seats[color].name ?? seats[color].name;
  const creator = next.creatorName ?? "";

  // The chef de table's choice once the minute was over (saved: the plate says it).
  if (prev.status === "paused" && prev.pause?.choosing === true) {
    if (next.status === "paused" && next.pause !== null && !next.pause.choosing) {
      const host = next.host === null ? creator : nameOf(next, next.host);
      notices.push(copy.game.notices.waits(host));
    } else if (next.status === "playing") {
      const handed = COLORS.filter(
        (color) => prev.seats[color].handedOver === null && next.seats[color].handedOver !== null,
      );
      if (handed.length > 0) {
        const names = copy.names(handed.map((color) => nameOf(next, color)));
        notices.push(copy.game.notices.handedOver(names, handed.length > 1));
      }
    }
  }

  // The role: the creator's seat is the host's while the creator is online; when the role moves to a
  // seat whose person just came back with the creator's name, the creator is back.
  let creatorBack: Color | null = null;
  if (next.host !== prev.host && next.host !== null) {
    const host = next.host;
    const returned = !prev.seats[host].online && next.seats[host].online;
    if (returned && nameOf(next, host) === creator) {
      creatorBack = host;
      if (host !== me.seat) notices.push(copy.game.notices.creatorBack(creator));
    } else if (host === me.seat) {
      notices.push(copy.game.notices.youHost(copy.of(creator)));
    } else {
      notices.push(copy.game.notices.hostAway(nameOf(next, host), copy.of(creator)));
    }
  }

  // Who is back (the returning device hears it from its own welcome).
  for (const color of COLORS) {
    if (color === me.seat || color === creatorBack) continue;
    const before = prev.seats[color];
    const after = next.seats[color];
    if (after.kind !== "human" || before.online || !after.online) continue;
    notices.push(
      before.handedOver !== null
        ? copy.game.notices.tookBack(nameOf(next, color))
        : copy.game.notices.back(nameOf(next, color)),
    );
  }

  // The table's « Avance rapide », to everyone but the chef de table who switched it.
  const fast = next.host === me.seat ? null : fastNotice(prev, next);
  if (fast !== null) notices.push(fast);
  return notices;
}
