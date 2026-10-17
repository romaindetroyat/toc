// The only builders of server frames (RULE-19, T-02-01). A frame is either built for one person from
// viewFor / eventsFor (the engine's projection, the hidden-hand boundary) or carries public table data
// only. Nothing here copies a GameState field by hand, and no `who` (a token hash) is ever put in.

import { COLORS, type Color, eventsFor, type GameEvent, viewFor } from "@toc/engine";
import type { EventsFrame, SeatPublic, TableFrame, TablePublic, WelcomeFrame } from "@toc/protocol";
import { dueBot, type Person, type Table } from "./table.ts";

export function personOf(table: Table, who: string): Person | undefined {
  return table.people.find((person) => person.who === who);
}

/** What anyone at the table may know of it. */
export function tablePublic(table: Table): TablePublic {
  const seats = {} as Record<Color, SeatPublic>;
  for (const color of COLORS) {
    const seat = table.seats[color];
    const level = table.levels[color];
    if (seat.kind === "human") {
      const person = personOf(table, seat.who);
      seats[color] = {
        kind: "human",
        name: person?.name ?? null,
        level,
        online: person?.online ?? false,
      };
    } else if (seat.kind === "bot") {
      seats[color] = { kind: "bot", name: seat.name, level, online: true };
    } else {
      seats[color] = { kind: "free", name: null, level, online: true };
    }
  }
  const creator = table.creator === null ? undefined : personOf(table, table.creator);
  return {
    status: table.status,
    seats,
    host: creator?.seat ?? null,
    creatorName: creator?.name ?? null,
    gameNo: table.gameNo,
    thinking: table.deadlines.bot === undefined ? null : dueBot(table),
  };
}

export function tableFrame(table: Table): TableFrame {
  return { t: "table", table: tablePublic(table) };
}

/** The one snapshot of the table for one person: their seat, the public table, their own view. */
export function welcomeFor(table: Table, who: string): WelcomeFrame {
  const seat = personOf(table, who)?.seat ?? null;
  return {
    t: "welcome",
    you: { seat, host: table.creator === who },
    table: tablePublic(table),
    view: table.game !== null && seat !== null ? viewFor(table.game, seat) : null,
    seq: table.seq,
  };
}

/** One batch of play for the person on `seat`: the events projected for that seat and its view. */
export function eventsFrameFor(
  table: Table,
  rawEvents: readonly GameEvent[],
  seat: Color,
): EventsFrame {
  if (table.game === null) throw new Error("eventsFrameFor: no game");
  return {
    t: "events",
    seq: table.seq,
    events: eventsFor(rawEvents, seat),
    view: viewFor(table.game, seat),
  };
}
