// The leak oracle (RULE-19, SC2, T-02-08, T-02-09): signatures only (RED).

import type { Color, GameState } from "@toc/engine";

/** A card id (`${Rank}${Suit}`) anywhere in a text. */
export const CARD_PATTERN = /\b(?:1[0-3]|[1-9])[SHDC]\b/g;

export function cardIdsIn(_text: string): string[] {
  throw new Error("cardIdsIn: not written yet");
}

export function hiddenCards(_state: GameState, _seat: Color | null): Set<string> {
  throw new Error("hiddenCards: not written yet");
}

export function leakedCards(
  _frameJson: string,
  _before: GameState | null,
  _after: GameState | null,
  _seat: Color | null,
): string[] {
  throw new Error("leakedCards: not written yet");
}

export function structuralProblems(
  _frame: unknown,
  _seat: Color | null,
  _forbidden: readonly string[] = [],
): string[] {
  throw new Error("structuralProblems: not written yet");
}

export function canonical(_value: unknown): string {
  throw new Error("canonical: not written yet");
}

export function frameProblems(
  _frame: unknown,
  _after: GameState | null,
  _seat: Color | null,
  _forbidden: readonly string[] = [],
): string[] {
  throw new Error("frameProblems: not written yet");
}
