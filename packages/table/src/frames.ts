// The only builders of server frames (RULE-19, T-02-01). A frame is either built for one person from
// viewFor / eventsFor (the engine's projection, the hidden-hand boundary) or carries public table data
// only. Nothing here copies a GameState field by hand, and no `who` (a token hash) is ever put in.

import { COLORS, type Color, eventsFor, type GameEvent, viewFor } from "@toc/engine";
import type {
  ChatEntry,
  ChatFrame,
  EventsFrame,
  SeatPublic,
  TableFrame,
  TablePublic,
  WelcomeFrame,
} from "@toc/protocol";
import { hostOf } from "./presence.ts";
import { rematchVotes } from "./rematch.ts";
import { personOf, type Table } from "./table.ts";

export { personOf };

/** The most « Sans place » names a public table lists (the protocol accepts up to 64). */
const MAX_UNSEATED = 32;

/**
 * What anyone at the table may know of it, with the server's clock `now` (the countdown's reference;
 * the table's last activity when left out).
 */
export function tablePublic(table: Table, now: number = table.lastActivity): TablePublic {
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
        handedOver: seat.handedOver ?? null,
      };
    } else if (seat.kind === "bot") {
      seats[color] = { kind: "bot", name: seat.name, level, online: true, handedOver: null };
    } else {
      seats[color] = { kind: "free", name: null, level, online: true, handedOver: null };
    }
  }
  const creator = table.creator === null ? undefined : personOf(table, table.creator);
  const unseated = table.people
    .filter((person) => person.seat === null && person.online)
    .map((person) => person.name)
    .slice(0, MAX_UNSEATED);
  const host = hostOf(table);
  const pause = table.status === "paused" ? table.pause : null;
  return {
    status: table.status,
    seats,
    host: host === null ? null : (personOf(table, host)?.seat ?? null),
    creatorName: creator?.name ?? null,
    gameNo: table.gameNo,
    thinking: table.thinking?.seat ?? null,
    unseated,
    pause:
      pause === null
        ? null
        : {
            missing: [...pause.missing],
            since: pause.since,
            choiceAt: pause.choiceAt,
            choosing: pause.choosing,
          },
    winner: table.status === "finished" ? (table.game?.winner ?? null) : null,
    rematch: rematchVotes(table),
    // An older snapshot has no flag (copyTable fills it in on the next change).
    fast: table.fast === true,
    now,
  };
}

export function tableFrame(table: Table, now?: number): TableFrame {
  return { t: "table", table: tablePublic(table, now) };
}

/**
 * The one snapshot of the table for one person: their seat, the public table, their own view;
 * `regained` when this hello gave them back a seat the computer played (plan 02-06).
 */
export function welcomeFor(
  table: Table,
  who: string,
  now?: number,
  regained = false,
): WelcomeFrame {
  const seat = personOf(table, who)?.seat ?? null;
  const frame: WelcomeFrame = {
    t: "welcome",
    you: { seat, host: hostOf(table) === who },
    table: tablePublic(table, now),
    view: table.game !== null && seat !== null ? viewFor(table.game, seat) : null,
    seq: table.seq,
    // An older snapshot has no messages (copyTable fills them in on the next change).
    chat: (table.chat ?? []).map((entry) => ({ ...entry })),
  };
  if (regained) frame.regained = true;
  return frame;
}

/** A quick message for everyone at the table: the sender's seat, the id, the server's time. */
export function chatFrame(entry: ChatEntry): ChatFrame {
  return { t: "chat", from: entry.from, msg: entry.msg, at: entry.at };
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
