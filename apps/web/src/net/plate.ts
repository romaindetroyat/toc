// What the plate over the board says (plan 02-06, 02-UI-SPEC « Plates », « Plate states »): the pause
// while someone is missing, the chef de table's choices once the minute is over, the saved game.
// Pure: built from the public table, this device's seat, and the clocks. The countdown is counted
// from the server's clock (the device's clock plus the offset measured on the table frames), never
// from the device's alone.
// Priority: connection > saved > pause (plan 02-07: this device's own connection lost for 10 s).
//
// Plan 02-07 also words this device's own connection (02-UI-SPEC « Own connection: reconnect banner
// and plate »): nothing for the first 2 s of a drop (a blip does not flicker), the banner « Connexion
// perdue. Reconnexion… » until 10 s, then the connection plate; and which notice a connection that
// ended shows (closeNotice).

import { COLORS, type Color } from "@toc/engine";
import { CLOSE_ELSEWHERE, CLOSE_GONE, CLOSE_VERSION, type TablePublic } from "@toc/protocol";
import { seats as seatCopy } from "../i18n/fr/seats.ts";
import { table as copy } from "../i18n/fr/table.ts";

/** A drop shorter than this shows nothing. */
export const BANNER_MS = 2_000;
/** A drop this long shows the connection plate instead of the banner. */
export const PLATE_MS = 10_000;

/** What this device shows of its own connection: nothing, the banner, or the plate. */
export type ConnectionState = "none" | "banner" | "plate";

/**
 * This device's own connection: `downSince` is when the socket dropped (or the browser said offline),
 * null while it is up; `online` is true once the connection is back (its welcome came).
 */
export function connectionState(
  downSince: number | null,
  nowMs: number,
  online: boolean,
): ConnectionState {
  if (online || downSince === null) return "none";
  const down = nowMs - downSince;
  if (down < BANNER_MS) return "none";
  return down < PLATE_MS ? "banner" : "plate";
}

/** The notice of a connection that ended (02-UI-SPEC « Connecting, errors »), or null while it lives. */
export type CloseNotice = "ailleurs" | "version" | "introuvable" | "serveur";

/**
 * 4001 → « Partie ouverte ailleurs », 4002 → « Nouvelle version du jeu », 4004 → « Cette table
 * n’existe plus »; a server error (the server's bad-frame, or a 5xx for the table) → « La table ne
 * répond pas ». Any other code is a drop the connection retries.
 */
export function closeNotice(code: number | null, serverError: boolean): CloseNotice | null {
  if (code === CLOSE_ELSEWHERE) return "ailleurs";
  if (code === CLOSE_VERSION) return "version";
  if (code === CLOSE_GONE) return "introuvable";
  return serverError ? "serveur" : null;
}

export type Plate =
  /** This device's connection is lost for 10 s: « Réessayer maintenant », « Retour à l’accueil ». */
  | { kind: "connection"; title: string; body: string }
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
  me: Color | null,
  offsetMs: number,
  nowMs: number,
  link: ConnectionState = "none",
): Plate | null {
  if (link === "plate") {
    return {
      kind: "connection",
      title: copy.game.connection.title,
      body: copy.game.connection.body,
    };
  }
  if (table === null || me === null) return null;
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
