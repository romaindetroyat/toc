// The rematch votes as the online end plank words them (02-UI-SPEC « End plank (online) », D-08, plan
// 02-09). Pure: the server's votes (TablePublic.rematch), this device's seat and the plank's names
// (« Toi » for this device) give the line under the four discs and each disc's accessible name.
//
// Whom the rematch waits for: the seated people online who have not agreed yet. Computer seats always
// agree; someone offline is not waited for (their seat goes to the computer if the rematch starts).

import { COLORS, type Color } from "@toc/engine";
import type { RematchVote } from "@toc/protocol";
import { table as copy } from "../i18n/fr/table.ts";

export type VoteState =
  /** Nobody online agreed yet. */
  | { kind: "nobody" }
  /** This device agreed; `waiting` the others online who have not. */
  | { kind: "mine"; waiting: Color[] }
  /** Others agreed (`agreed`), not this device. */
  | { kind: "others"; agreed: Color[] }
  /** Everyone online agreed: the new game starts. */
  | { kind: "all" };

export function voteState(votes: Record<Color, RematchVote>, me: Color): VoteState {
  const waiting = COLORS.filter((color) => votes[color] === "no");
  const agreed = COLORS.filter((color) => votes[color] === "yes");
  if (waiting.length === 0 && agreed.length > 0) return { kind: "all" };
  if (votes[me] === "yes") return { kind: "mine", waiting };
  const others = agreed.filter((color) => color !== me);
  if (others.length > 0) return { kind: "others", agreed: others };
  return { kind: "nobody" };
}

/**
 * The line under the discs. `votes` null: the rematch has started (the server's table already moved
 * on to the new game), so the line is the starting one.
 */
export function voteLine(
  votes: Record<Color, RematchVote> | null,
  me: Color,
  names: Record<Color, string>,
): string {
  if (votes === null) return copy.rematch.all;
  const state = voteState(votes, me);
  switch (state.kind) {
    case "nobody":
      return copy.rematch.nobody;
    case "mine":
      return copy.rematch.mine(copy.names(state.waiting.map((color) => names[color])));
    case "others":
      return copy.rematch.others(
        copy.names(state.agreed.map((color) => names[color])),
        state.agreed.length > 1,
      );
    case "all":
      return copy.rematch.all;
  }
}

/** A disc's accessible name: « Bruno, d’accord », « Éclair (ordinateur), d’accord »… */
export function discLabel(name: string, vote: RematchVote): string {
  return copy.rematch.disc[vote](name);
}
