// A knight's accessible name (plan 05-10, 05-UI-SPEC « Knight names », APP-05): its colour, its letter
// (A to D, as over the lit knights and on the 7's panel), whose it is from the player's seat, and where
// it stands, so that a screen reader tells every knight apart without the colours: « Cheval bleu A, à
// toi, à 12 cases de sa sortie », « Cheval rouge C, à ton partenaire Marie, à l’écurie », « Cheval
// jaune B, adversaire, à la maison »; a lit knight adds « , jouable », a lesson's target « , à
// toucher ». Pure: the board's Pawn and HitLayer both use it.

import { type Color, EXIT, PARTNER, type PawnId, type Place, pawnColor, RING } from "@toc/engine";
import { knightLetter } from "../game/turnUi.ts";
import { board } from "../i18n/fr/board.ts";
import { lecons } from "../i18n/fr/lecons.ts";

/** Where a knight stands, in words: the stable, the home, its exit, or how far it has come from it. */
function whereOf(pawn: PawnId, place: Place): string {
  if (place.z === "stable") return board.knight.stable;
  if (place.z === "home") return board.knight.home;
  const done = (((place.cell - EXIT[pawnColor(pawn)]) % RING) + RING) % RING;
  return done === 0 ? board.knight.exit : board.knight.ring(done);
}

/** Whose the knight is, seen from the player's seat. */
function ownerOf(
  color: Color,
  human: Color,
  names: Readonly<Partial<Record<Color, string>>>,
): string {
  if (color === human) return board.knight.mine;
  if (color === PARTNER[human]) return board.knight.partner(names[color] ?? "");
  return board.knight.opponent;
}

export function knightName(
  pawn: PawnId,
  place: Place,
  human: Color,
  names: Readonly<Partial<Record<Color, string>>>,
  options: { lit?: boolean; target?: boolean } = {},
): string {
  const color = pawnColor(pawn);
  const named = board.knight.name(
    board.pawn[color],
    knightLetter(pawn),
    ownerOf(color, human, names),
    whereOf(pawn, place),
  );
  const lit = options.lit ? board.knight.lit(named) : named;
  return options.target ? lecons.target(lit) : lit;
}
