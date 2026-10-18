// The leak oracle (RULE-19, SC2, T-02-08, T-02-09): one judge of the frames a person receives, shared
// by the pure core property (packages/table/test/leak.test.ts), the workerd test of every real socket
// frame (apps/worker/test/leak.test.ts) and the browser spec (apps/web/e2e-online/fuite.spec.ts).
//
// It is a test instrument, exported as the subpath "@toc/table/oracle": nothing under
// packages/table/src or apps/worker/src imports it. It never relaxes a check to make a frame pass;
// a failing frame is fixed in frames.ts or reduce.ts.
//
// Two independent checks:
// - leakedCards reads the frame as text and lists the card ids in it that the reader may not know
//   in the stored state (another seat's hand or exchange card, the talon), except the cards of the
//   frame's own public events (a card played or a dead hand laid down is public, even when the deck is
//   reshuffled in the same batch and that card already sits in another seat's new hand);
// - frameProblems checks the shape: only the reader's hand in handDealt, only the reader's card in
//   cardsExchanged, no key of a GameState, no person id, codes-only errors, and a view that is exactly
//   viewFor(state, reader). personSecrets lists the texts of a table's people that no frame may
//   contain (their ids, and since plan 04-04 their accounts), for the `forbidden` argument.

import { COLORS, type Color, type GameState, PARTNER, viewFor } from "@toc/engine";
import type { Table } from "./table.ts";

/** A card id (`${Rank}${Suit}`) anywhere in a text. */
export const CARD_PATTERN = /\b(?:1[0-3]|[1-9])[SHDC]\b/g;

/** Every card id written in `text`, in order, repeats kept. */
export function cardIdsIn(text: string): string[] {
  return [...text.matchAll(CARD_PATTERN)].map((match) => match[0]);
}

/** What the reader on `seat` holds or chose privately in `state`: own hand, own give, own received card. */
function ownCards(state: GameState, seat: Color): string[] {
  const own: string[] = [...state.hands[seat]];
  const given = state.given[seat];
  const received = state.received[seat];
  // The seat's give once the four gives have crossed: now the partner's received card (viewFor's
  // givenToPartner). A seat always knows what it handed over.
  const crossed = state.received[PARTNER[seat]];
  if (given !== null) own.push(given);
  if (received !== null) own.push(received);
  if (crossed !== null) own.push(crossed);
  return own;
}

/** The face-up cards of `state`: the discard pile, the dead hands laid down, the last card of each seat. */
function publicCards(state: GameState): string[] {
  const cards: string[] = [...state.discard];
  for (const color of COLORS) {
    cards.push(...state.posed[color]);
    const last = state.lastPlayed[color];
    if (last !== null) cards.push(last);
  }
  return cards;
}

/**
 * The cards hidden from the reader in `state`: every other seat's hand, given and received card, and
 * the talon, less what the reader knows (its own cards, its give, the face-up cards). An unseated
 * reader (null) knows only the face-up cards.
 */
export function hiddenCards(state: GameState, seat: Color | null): Set<string> {
  const hidden = new Set<string>(state.talon);
  for (const color of COLORS) {
    if (color === seat) continue;
    for (const card of state.hands[color]) hidden.add(card);
    const given = state.given[color];
    const received = state.received[color];
    if (given !== null) hidden.add(given);
    if (received !== null) hidden.add(received);
  }
  const known = [...publicCards(state), ...(seat === null ? [] : ownCards(state, seat))];
  for (const card of known) hidden.delete(card);
  return hidden;
}

/** The cards of the frame's public events: a card played, a dead hand laid down. */
function publicEventCards(frame: unknown): Set<string> {
  const cards = new Set<string>();
  if (!isRecord(frame) || frame.t !== "events" || !Array.isArray(frame.events)) return cards;
  for (const event of frame.events) {
    if (!isRecord(event)) continue;
    if (event.t === "cardPlayed" && typeof event.card === "string") cards.add(event.card);
    if (event.t === "handDiscarded" && Array.isArray(event.cards)) {
      for (const card of event.cards) if (typeof card === "string") cards.add(card);
    }
  }
  return cards;
}

/**
 * The card ids of `frameJson` the reader on `seat` may not know: hidden from it in `after` (the state
 * the frame was built from), not its own before the batch (`before`, null before the game), and not the
 * card of a public event of the same frame. [] when the frame leaks nothing.
 */
export function leakedCards(
  frameJson: string,
  before: GameState | null,
  after: GameState | null,
  seat: Color | null,
): string[] {
  if (after === null) {
    // No game: no card exists for anyone yet, so any card id is out of place.
    return cardIdsIn(frameJson);
  }
  const hidden = hiddenCards(after, seat);
  if (before !== null && seat !== null) {
    for (const card of ownCards(before, seat)) hidden.delete(card);
  }
  let frame: unknown;
  try {
    frame = JSON.parse(frameJson);
  } catch {
    frame = null;
  }
  const announced = publicEventCards(frame);
  return [...new Set(cardIdsIn(frameJson))].filter(
    (card) => hidden.has(card) && !announced.has(card),
  );
}

/** Keys of a GameState (or of the table) that hold hidden values and may never leave the server. */
const FORBIDDEN_KEYS = new Set([
  "hands",
  "talon",
  "rng",
  "botRng",
  "who",
  "token",
  "account",
  "people",
  "creator",
  "deadlines",
  "notifyAt",
  "message",
  "stack",
]);

const FRAME_TYPES = new Set([
  "welcome",
  "events",
  "table",
  "error",
  "reclaimRequest",
  "reclaimResult",
  "chat",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Walks every value of the frame, reporting forbidden keys and GameState marks with their path
 * (`path` is the stack of keys down to `value`, joined only when a problem is reported).
 */
function walk(value: unknown, path: string[], problems: string[]): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      path.push(`[${index}]`);
      walk(item, path, problems);
      path.pop();
    }
    return;
  }
  if (!isRecord(value)) return;
  const insideExchange = value.t === "cardsExchanged";
  for (const key in value) {
    const child = value[key];
    const at = () => [...path, `.${key}`].join("");
    if (FORBIDDEN_KEYS.has(key)) problems.push(`forbidden key ${at()}`);
    if (key === "kind" && child === "state") problems.push(`a GameState at ${path.join("")}`);
    // A per-seat record of exchange cards is the state's (given, received); only the projected
    // cardsExchanged event may carry one, checked below.
    if ((key === "given" || key === "received") && isRecord(child) && !insideExchange) {
      problems.push(`per-seat ${key} record at ${at()}`);
    }
    if (typeof child === "object" && child !== null) {
      path.push(`.${key}`);
      walk(child, path, problems);
      path.pop();
    }
  }
}

/**
 * The checks that need no server state, only the reader's seat: what a device can check of the frames
 * it receives (the browser spec uses this part). `forbidden` lists texts that must never appear, such
 * as person ids and device tokens.
 */
export function structuralProblems(
  frame: unknown,
  seat: Color | null,
  forbidden: readonly string[] = [],
): string[] {
  const problems: string[] = [];
  if (!isRecord(frame) || typeof frame.t !== "string" || !FRAME_TYPES.has(frame.t)) {
    return ["not a known server frame"];
  }
  const text = JSON.stringify(frame);
  for (const id of forbidden) {
    if (id !== "" && text.includes(id)) problems.push("a person id or token is in the frame");
  }
  if (/IllegalAction|Error:/.test(text)) problems.push("an error text is in the frame");
  walk(frame, ["frame"], problems);

  if (frame.t === "error") {
    const keys = Object.keys(frame).sort();
    if (keys.join(",") !== "code,t" || typeof frame.code !== "string") {
      problems.push(`error frame is not exactly { t, code }: ${keys.join(",")}`);
    }
  }
  // The reclaim's two frames (plan 02-07) carry a seat and a first name, or a yes or no: nothing else.
  if (frame.t === "reclaimRequest") {
    const keys = Object.keys(frame).sort();
    if (keys.join(",") !== "name,seat,t" || typeof frame.name !== "string") {
      problems.push(`reclaimRequest is not exactly { t, seat, name }: ${keys.join(",")}`);
    }
  }
  if (frame.t === "reclaimResult") {
    const keys = Object.keys(frame).sort();
    if (keys.join(",") !== "accepted,t" || typeof frame.accepted !== "boolean") {
      problems.push(`reclaimResult is not exactly { t, accepted }: ${keys.join(",")}`);
    }
  }
  // A quick message (plan 02-08): a seat, one id, a time; no name, no text, no person.
  if (frame.t === "chat") {
    const keys = Object.keys(frame).sort();
    if (keys.join(",") !== "at,from,msg,t") {
      problems.push(`chat is not exactly { t, from, msg, at }: ${keys.join(",")}`);
    }
  }
  if (frame.t === "events") {
    if (seat === null) problems.push("events frame for an unseated person");
    if (!Array.isArray(frame.events)) problems.push("events frame without events");
    else {
      for (const event of frame.events) {
        if (!isRecord(event)) continue;
        if (event.t === "handDealt" && event.seat !== seat && event.cards !== null) {
          problems.push(`handDealt shows the cards of ${String(event.seat)}`);
        }
        if (event.t === "cardsExchanged") {
          const received = event.received;
          if (!isRecord(received)) problems.push("cardsExchanged without its received record");
          else {
            for (const [color, card] of Object.entries(received)) {
              if (color !== seat && card !== null) {
                problems.push(`cardsExchanged shows the card received by ${color}`);
              }
            }
          }
        }
      }
    }
  }
  if (frame.t === "welcome" || frame.t === "events") {
    const view = frame.view;
    if (view !== null && view !== undefined) {
      if (!isRecord(view) || view.kind !== "view") problems.push("view is not a PlayerView");
      else if (view.seat !== seat) problems.push(`view of ${String(view.seat)} sent to ${seat}`);
    }
  }
  if (frame.t === "welcome") {
    const you = frame.you;
    if (!isRecord(you) || (you.seat ?? null) !== seat) problems.push("welcome names another seat");
  }
  return problems;
}

/**
 * The texts no frame may contain for `table`'s people: each person's id (`who`, a token hash) and
 * the account a person is linked to (plan 04-04). Pass them as frameProblems' `forbidden`.
 */
export function personSecrets(table: Table): string[] {
  const secrets: string[] = [];
  for (const person of table.people) {
    secrets.push(person.who);
    const account = person.account ?? null;
    if (account !== null) secrets.push(account);
  }
  return secrets;
}

/** JSON with sorted keys: two values are deep-equal when these texts are equal. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    isRecord(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
}

/** Deep equality of two JSON values (key order ignored), as canonical(a) === canonical(b). */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameJson(a[i], b[i])) return false;
    return true;
  }
  if (!isRecord(a) || !isRecord(b)) return false;
  const keys = Object.keys(a).filter((key) => a[key] !== undefined);
  if (keys.length !== Object.keys(b).filter((key) => b[key] !== undefined).length) return false;
  for (const key of keys) if (!sameJson(a[key], b[key])) return false;
  return true;
}

/**
 * Every check of one frame received by the reader on `seat` (null: unseated), built from `after`
 * (null: no game yet): the structural checks, plus a view (welcome, events) that deep-equals
 * viewFor(after, seat), or null when the reader has no seat or there is no game.
 */
export function frameProblems(
  frame: unknown,
  after: GameState | null,
  seat: Color | null,
  forbidden: readonly string[] = [],
): string[] {
  const problems = structuralProblems(frame, seat, forbidden);
  if (!isRecord(frame) || (frame.t !== "welcome" && frame.t !== "events")) return problems;
  const expected = after !== null && seat !== null ? viewFor(after, seat) : null;
  if (!sameJson(frame.view ?? null, expected)) {
    problems.push(
      expected === null ? "a view where none is due" : "view differs from viewFor(state, seat)",
    );
  }
  return problems;
}
