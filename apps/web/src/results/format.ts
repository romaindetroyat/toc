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

// --- Plan 05-09: the months, the detail sheet and the counting line (05-UI-SPEC Panel 1, « Game
// detail sheet », « Typography ») ---

const sheetCopy = resultats.sheet;

/** « Novembre 2026 »: a month heading of the history, a capital first letter. */
export function monthHeading(at: number): string {
  const text = new Intl.DateTimeFormat("fr", { month: "long", year: "numeric" }).format(at);
  return text.charAt(0).toLocaleUpperCase("fr") + text.slice(1);
}

const monthKey = (at: number) => {
  const date = new Date(at);
  return `${date.getFullYear()}-${date.getMonth()}`;
};

export type MonthGroup = { key: string; heading: string; games: HistoryGame[] };

/** The games (newest first) under their month's heading, in the same order. */
export function groupByMonth(games: readonly HistoryGame[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const game of games) {
    const key = monthKey(game.endedAt);
    const last = groups[groups.length - 1];
    if (last !== undefined && last.key === key) last.games.push(game);
    else groups.push({ key, heading: monthHeading(game.endedAt), games: [game] });
  }
  return groups;
}

/** The live region's count: « 25 parties », « 1 partie ». */
export const gamesCount = (n: number): string => resultats.count(n);

/**
 * A game's key in the page (its row's test hook and its list key): the game id without the account
 * part of a solo id (« solo:<user_id>:<uuid> » → the uuid), so no account id reaches the DOM.
 */
export function gameKey(game: HistoryGame): string {
  if (game.kind !== "solo") return game.id;
  const parts = game.id.split(":");
  return parts[parts.length - 1] ?? "";
}

/** « Partie du samedi 24 octobre » (the end day; the year when it is not the current one). */
export function sheetTitle(endedAt: number, now: number): string {
  const day = new Intl.DateTimeFormat("fr", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear(endedAt, now) ? {} : { year: "numeric" }),
  }).format(endedAt);
  return sheetCopy.title(day);
}

/** « 43 min » under an hour, « 1 h 05 » from an hour (minutes rounded, at least one). */
export function durationText(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return sheetCopy.minutes(minutes);
  return sheetCopy.hours(Math.floor(minutes / 60), String(minutes % 60).padStart(2, "0"));
}

/** « De 20 h 31 à 21 h 14 (43 min) ». */
export function spanText(startedAt: number, endedAt: number): string {
  return sheetCopy.span(timeText(startedAt), timeText(endedAt), durationText(endedAt - startedAt));
}

/** The tags after a seat's name in the sheet. */
export function seatTags(seat: HistorySeat): string[] {
  const tags: string[] = [];
  if (seat.kind === "me") tags.push(sheetCopy.me);
  if (seat.kind === "guest") tags.push(sheetCopy.guest);
  if (seat.kind === "bot") tags.push(sheetCopy.bot);
  else if (seat.handedOver) tags.push(sheetCopy.handedOver);
  return tags;
}

/** What counts (D-01, D-02): ranked, the only account at an online table, or a solo game. */
export function countingLine(game: HistoryGame): string {
  if (game.kind === "solo") return sheetCopy.soloCounting;
  return game.ranked ? sheetCopy.ranked : sheetCopy.alone;
}

export type SheetSeat = { colour: Color; name: string; tags: string[] };

export type GameSheetText = {
  title: string;
  kind: string;
  result: string;
  score: string;
  mine: SheetSeat[];
  theirs: SheetSeat[];
  span: string;
  deals: string;
  eaten: string;
  counting: string;
};

/** A seat's name in the sheet: the pseudo, the guest's first name (tagged), the computer's level. */
function sheetName(seat: HistorySeat): string {
  if (seat.kind === "bot") return seat.level === null ? seat.name : bots.levels[seat.level];
  return seat.name;
}

/** Everything the detail sheet of `game` says, at time `now` (for the year). */
export function sheetOf(game: HistoryGame, now: number): GameSheetText {
  const mine = teamOf(game.mine);
  const of = (own: boolean) => game.seats.filter((seat) => (teamOf(seat.colour) === mine) === own);
  const sum = (seats: HistorySeat[], key: "home" | "captured") =>
    seats.reduce((n, seat) => n + seat[key], 0);
  const ours = of(true);
  const theirs = of(false);
  const line = (seat: HistorySeat): SheetSeat => ({
    colour: seat.colour,
    name: sheetName(seat),
    tags: seatTags(seat),
  });
  return {
    title: sheetTitle(game.endedAt, now),
    kind:
      game.kind === "solo"
        ? sheetCopy.solo
        : game.creator === null || game.creator === ""
          ? sheetCopy.onlineAlone
          : sheetCopy.online(game.creator),
    result: game.winner === mine ? sheetCopy.win : sheetCopy.loss,
    score: sheetCopy.score(sum(ours, "home"), sum(theirs, "home")),
    mine: ours.map(line),
    theirs: theirs.map(line),
    span: spanText(game.startedAt, game.endedAt),
    deals: sheetCopy.deals(game.deals),
    eaten: sheetCopy.eaten(sum(ours, "captured"), sum(theirs, "captured")),
    counting: countingLine(game),
  };
}
