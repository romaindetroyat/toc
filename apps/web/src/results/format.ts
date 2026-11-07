// The wording of a game in « Mes résultats » (plan 05-01; 05-UI-SPEC Panel 1 « Historique »,
// « Typography », D-03 with D-12). Pure: the game and the clock in, the strings out.
//   line 1   « Victoire · 8 – 5 »: the knights home per team, own team first
//   line 2   « Avec Marie · contre Paul et Pur-sang »: the partner, then the opponents in seat order
//   date     « 25 oct. » (the year added when it is not the current one), time « 21 h 14 »
//   label    the row's accessible name, the whole sentence (line 2 may be cut by an ellipsis)
// Names: an account by its pseudo, a guest « Mamie (sans compte) », a computer by its level name
// (« Pur-sang »), never its horse name; two opponent computers of the same level « deux ordinateurs
// Galopeur ». Dates in French with Intl.

import { type Color, PARTNER, type Team, teamOf } from "@toc/engine";
import type { HistoryGame, HistorySeat } from "@toc/protocol";
import { bots } from "../i18n/fr/bots.ts";
import { resultats } from "../i18n/fr/resultats.ts";

export type GameRowText = {
  icon: "users" | "bot";
  line1: string;
  line2: string;
  date: string;
  time: string;
  label: string;
};

const copy = resultats.row;

/** A seat's name in this page: a pseudo, « Prénom (sans compte) », or a computer's level name. */
export function nameOf(seat: HistorySeat): string {
  if (seat.kind === "guest") return copy.guest(seat.name);
  if (seat.kind === "bot") return seat.level === null ? seat.name : bots.levels[seat.level];
  return seat.name;
}

function opponentsOf(seats: HistorySeat[]): string {
  const [a, b] = seats;
  if (a === undefined || b === undefined) return seats.map(nameOf).join("");
  if (a.kind === "bot" && b.kind === "bot" && a.level !== null && a.level === b.level) {
    return copy.twoComputers(bots.levels[a.level]);
  }
  return copy.both(nameOf(a), nameOf(b));
}

const homeOf = (game: HistoryGame, team: Team) =>
  game.seats.filter((seat) => teamOf(seat.colour) === team).reduce((n, seat) => n + seat.home, 0);

const sameYear = (a: number, b: number) => new Date(a).getFullYear() === new Date(b).getFullYear();

function dayText(at: number, now: number, month: "short" | "long"): string {
  return new Intl.DateTimeFormat("fr", {
    day: "numeric",
    month,
    ...(sameYear(at, now) ? {} : { year: "numeric" }),
  }).format(at);
}

function timeText(at: number): string {
  const parts = new Intl.DateTimeFormat("fr", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const part = (type: "hour" | "minute") => parts.find((each) => each.type === type)?.value ?? "";
  return copy.time(String(Number(part("hour"))), part("minute").padStart(2, "0"));
}

/** Everything a row of the history says about `game`, at time `now` (for the year). */
export function rowOf(game: HistoryGame, now: number): GameRowText {
  const mine = teamOf(game.mine);
  const theirs: Team = mine === "bleu-rouge" ? "jaune-vert" : "bleu-rouge";
  const result = game.winner === mine ? copy.win : copy.loss;
  const own = homeOf(game, mine);
  const other = homeOf(game, theirs);
  const partnerColour: Color = PARTNER[game.mine];
  const partnerSeat = game.seats.find((seat) => seat.colour === partnerColour);
  const partner = partnerSeat === undefined ? "" : nameOf(partnerSeat);
  const opponents = opponentsOf(game.seats.filter((seat) => teamOf(seat.colour) === theirs));
  const time = timeText(game.endedAt);
  return {
    icon: game.kind === "solo" ? "bot" : "users",
    line1: copy.line1(result, own, other),
    line2: copy.line2(partner, opponents),
    date: dayText(game.endedAt, now, "short"),
    time,
    label: copy.label({
      result,
      mine: own,
      theirs: other,
      day: dayText(game.endedAt, now, "long"),
      time,
      kind: game.kind === "solo" ? copy.solo : copy.online,
      partner,
      opponents,
    }),
  };
}
