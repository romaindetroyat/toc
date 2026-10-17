// What the plate over the board says (plan 02-06, 02-UI-SPEC « Plates », « Plate states »): the pause
// while someone is missing, the chef de table's choices once the minute is over, the saved game.
// Pure: built from the public table, this device's seat, and the clocks. The countdown is counted
// from the server's clock (the device's clock plus the offset measured on the table frames), never
// from the device's alone.
// Priority: saved > pause (the connection plate of plan 02-07 comes before both).

import { COLORS, type Color } from "@toc/engine";
import type { TablePublic } from "@toc/protocol";
import { seats as seatCopy } from "../i18n/fr/seats.ts";
import { table as copy } from "../i18n/fr/table.ts";

export type Plate =
  /** The first minute, for everyone: who is missing and when the chef de table may choose. */
  | { kind: "pause"; title: string; body: string; countdown: string; announce: string }
  /** After the minute, for everyone but the chef de table. */
  | { kind: "waitingChoice"; title: string; body: string }
  /** After the minute, for the chef de table: the three choices. */
  | { kind: "choices"; title: string; body: string; several: boolean }
  /** The saved game: who is here, who is not yet, and who may resume. */
  | {
      kind: "saved";
      title: string;
      body: string;
      present: string;
      absent: string | null;
      /** This device is the chef de table: « Reprendre la partie ». */
      host: boolean;
      /** For the others: « {Créateur} peut reprendre la partie. » */
      hostLine: string | null;
    };

/** « 1:00 », « 0:42 »: whole seconds rounded up, never below zero. */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The time left until `at` (server time), the server's clock being the device's plus `offsetMs`. */
export function remainingMs(at: number, nowMs: number, offsetMs: number): number {
  return Math.max(0, at - (nowMs + offsetMs));
}

function nameOf(table: TablePublic, color: Color): string {
  return table.seats[color].name ?? seatCopy[color].name;
}

/** The chef de table's first name: the host's seat, else the creator's name. */
function hostName(table: TablePublic): string {
  return table.host === null ? (table.creatorName ?? "") : nameOf(table, table.host);
}

export function plateFor(
  table: TablePublic | null,
  me: Color,
  offsetMs: number,
  nowMs: number,
): Plate | null {
  if (table === null) return null;
  const isHost = table.host === me;
  if (table.status === "saved") {
    const people = COLORS.filter((color) => table.seats[color].kind === "human");
    const present = people.filter((color) => table.seats[color].online);
    const absent = people.filter(
      (color) => !table.seats[color].online && table.seats[color].handedOver === null,
    );
    // « À la table : Ana, Paul. » (a list, 02-UI-SPEC « Saved plate »).
    const names = (colors: Color[]) => colors.map((color) => nameOf(table, color)).join(", ");
    return {
      kind: "saved",
      title: copy.game.saved.title,
      body: copy.game.saved.body,
      present: copy.game.saved.present(names(present)),
      absent: absent.length === 0 ? null : copy.game.saved.absent(names(absent)),
      host: isHost,
      hostLine: isHost ? null : copy.game.saved.hostResumes(hostName(table)),
    };
  }
  const pause = table.status === "paused" ? table.pause : null;
  if (pause === null) return null;
  const missing = copy.names(pause.missing.map((color) => nameOf(table, color)));
  const several = pause.missing.length > 1;
  const title = copy.game.pause.title(missing);
  if (pause.choosing) {
    return isHost
      ? { kind: "choices", title, body: copy.game.pause.choose(missing, several), several }
      : { kind: "waitingChoice", title, body: copy.game.pause.choosing(hostName(table)) };
  }
  const time = formatCountdown(remainingMs(pause.choiceAt, nowMs, offsetMs));
  return {
    kind: "pause",
    title,
    body: copy.game.pause.body(several),
    countdown: isHost
      ? copy.game.pause.countdownYou(time)
      : copy.game.pause.countdown(hostName(table), time),
    announce: isHost ? copy.game.pause.announceYou : copy.game.pause.announce(hostName(table)),
  };
}
