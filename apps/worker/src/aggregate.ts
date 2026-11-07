// The pure aggregation of the results (plan 05-05, HIST-03, HIST-04; 05-UI-SPEC Panels 2 and 3,
// 05-RESEARCH Pattern 4). No I/O: results.ts reads the rows and hands them here.
//   statsOf(rows, me)    « Mes chiffres »: over each of the player's game_seats ⋈ played rows, the
//                        three filters at once (« Toutes », « En ligne », « Contre l’ordinateur »):
//                        games, wins, the knights of the player's seat (eaten by it, eaten from it,
//                        brought home), the partners and the computer levels
// A partner is the seat of the player's team mate: another account (by its pseudo), all the guests
// together, or the computers of one level. A game counts under a computer level only when both
// opponents were computers from the start (a person's seat handed over is still a human opponent),
// under the stronger one's level. A seat handed to the computer still counts for its account (its
// game_seats row exists, UI-SPEC « What counts »). No account id ever leaves: partners carry a
// pseudo or a level, grouped by the account id server-side.

import { type Color, type Team, teamOf } from "@toc/engine";
import type { StatsAnswer, StatsBlock } from "@toc/protocol";

type Level = 1 | 2 | 3 | 4 | 5;

/** A seat of played.seats as record.ts (online) and the solo report (solo) write it. */
export type StoredSeat = {
  colour: Color;
  kind: "account" | "guest" | "bot";
  /** The account id (server-only), null for a guest or a computer. */
  account: string | null;
  name: string;
  level: Level | null;
  handedOver: boolean;
  captured: number;
  lost: number;
  home: number;
};

/** One of the player's games: their game_seats row and the played row's seats (JSON). */
export type StatsRow = {
  colour: Color;
  won: number;
  solo: number;
  captured: number;
  lost: number;
  home: number;
  seats: string;
};

/** The team mate's colour. */
const PARTNER: Record<Color, Color> = {
  bleu: "rouge",
  rouge: "bleu",
  jaune: "vert",
  vert: "jaune",
};

type Partner = StatsBlock["partners"][number];

const KIND_ORDER: Record<Partner["kind"], number> = { account: 0, guests: 1, bot: 2 };

/** Most games first, then accounts by pseudo, then the guests, then the computers by level. */
function byGames(a: Partner, b: Partner): number {
  if (a.games !== b.games) return b.games - a.games;
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (a.kind === "account") {
    return (a.name ?? "").localeCompare(b.name ?? "", "fr", { sensitivity: "base" });
  }
  return (a.level ?? 0) - (b.level ?? 0);
}

class Block {
  games = 0;
  wins = 0;
  captured = 0;
  lost = 0;
  home = 0;
  private readonly partners = new Map<string, Partner>();
  private readonly levels = new Map<Level, { level: Level; games: number; wins: number }>();

  add(row: StatsRow, partner: { key: string; entry: Partner } | null, level: Level | null): void {
    const won = row.won === 1 ? 1 : 0;
    this.games++;
    this.wins += won;
    this.captured += row.captured;
    this.lost += row.lost;
    this.home += row.home;
    if (partner !== null) {
      const known = this.partners.get(partner.key) ?? { ...partner.entry, games: 0, wins: 0 };
      known.games++;
      known.wins += won;
      this.partners.set(partner.key, known);
    }
    if (level !== null) {
      const known = this.levels.get(level) ?? { level, games: 0, wins: 0 };
      known.games++;
      known.wins += won;
      this.levels.set(level, known);
    }
  }

  done(): StatsBlock {
    return {
      games: this.games,
      wins: this.wins,
      captured: this.captured,
      lost: this.lost,
      home: this.home,
      partners: [...this.partners.values()].sort(byGames),
      levels: [...this.levels.values()].sort((a, b) => a.level - b.level),
    };
  }
}

/** The partner's group key (server-side: an account id never leaves) and its entry. */
function partnerOf(
  seat: StoredSeat | undefined,
  me: string,
): { key: string; entry: Partner } | null {
  if (seat === undefined) return null;
  if (seat.kind === "bot") {
    const level = seat.level ?? null;
    if (level === null) return null;
    return { key: `bot:${level}`, entry: { kind: "bot", name: null, level, games: 0, wins: 0 } };
  }
  if (seat.kind === "account" && seat.account !== null && seat.account !== me) {
    return {
      key: `account:${seat.account}`,
      entry: { kind: "account", name: seat.name, level: null, games: 0, wins: 0 },
    };
  }
  return { key: "guests", entry: { kind: "guests", name: null, level: null, games: 0, wins: 0 } };
}

/** The stronger level of the two opponents when both were computers, else null. */
function levelAgainst(seats: StoredSeat[], mine: Team): Level | null {
  const opponents = seats.filter((seat) => teamOf(seat.colour) !== mine);
  if (opponents.length !== 2) return null;
  let strongest: Level | null = null;
  for (const seat of opponents) {
    if (seat.kind !== "bot" || seat.level === null) return null;
    if (strongest === null || seat.level > strongest) strongest = seat.level;
  }
  return strongest;
}

/** « Mes chiffres » of the player `me` (an account id) over their rows, newest first. */
export function statsOf(rows: readonly StatsRow[], me: string): StatsAnswer {
  const all = new Block();
  const online = new Block();
  const solo = new Block();
  for (const row of rows) {
    const seats = JSON.parse(row.seats) as StoredSeat[];
    const partner = partnerOf(
      seats.find((seat) => seat.colour === PARTNER[row.colour]),
      me,
    );
    const level = levelAgainst(seats, teamOf(row.colour));
    all.add(row, partner, level);
    (row.solo === 1 ? solo : online).add(row, partner, level);
  }
  return { all: all.done(), online: online.done(), solo: solo.done() };
}
