// The computer players' memory of the pack is the engine's (quick task 261109-6an): knowledge.ts
// re-exports the very functions the sheet « Les cartes du paquet » reads, and its per-seat counts add
// up to the same total as deckCount.

import {
  type CardId,
  COLORS,
  deckCount,
  partnerHolds as enginePartnerHolds,
  unknownCards as engineUnknownCards,
  giveCard,
  newGame,
  viewFor,
} from "@toc/engine";
import { describe, expect, it } from "vitest";
import { hiddenCounts, partnerHolds, unknownCards } from "./knowledge.ts";

describe("knowledge: the engine's pool", () => {
  it("re-exports the engine's unknownCards and partnerHolds", () => {
    expect(unknownCards).toBe(engineUnknownCards);
    expect(partnerHolds).toBe(enginePartnerHolds);
  });

  it("hidden hands plus the talon make deckCount's total, before and after the exchange", () => {
    for (const seed of [1, 7, 42, 1234]) {
      let state = newGame({ firstDealer: COLORS[seed % 4] ?? "bleu" }, [seed, 2, 3, 4]);
      const states = [state];
      for (const seat of COLORS) {
        state = giveCard(state, seat, state.hands[seat][0] as CardId).state;
        states.push(state);
      }
      for (const each of states) {
        for (const seat of COLORS) {
          const view = viewFor(each, seat);
          const counts = hiddenCounts(view);
          const inHands = COLORS.reduce((sum, color) => sum + counts.hands[color], 0);
          expect(inHands + counts.talon, `${seed} ${seat}`).toBe(deckCount(view).total);
        }
      }
    }
  });
});
