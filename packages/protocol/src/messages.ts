// The quick messages (plan 02-08): Romain chose ready-made messages only, no keyboard (D-07), and
// listed them (D-13). Only these ids travel; each device shows them from its French catalogue
// (apps/web/src/i18n/fr/messages.ts), so no text typed by anyone ever reaches another screen (T-02-33).

/** The twelve ids, in the order of the palette: the seven phrases, then the five emojis. */
export const QUICK_MESSAGES = [
  "bien-joue",
  "aie",
  "merci-partenaire",
  "a-toi",
  "pardon",
  "presque",
  "bravo",
  "rire",
  "applaudir",
  "surpris",
  "cheval",
  "coeur",
] as const;

export type QuickMessageId = (typeof QUICK_MESSAGES)[number];

/** The seven phrases, then the five emojis (the palette's two groups). */
export const QUICK_PHRASES: readonly QuickMessageId[] = QUICK_MESSAGES.slice(0, 7);
export const QUICK_EMOJIS: readonly QuickMessageId[] = QUICK_MESSAGES.slice(7);

/** The most messages a table keeps and gives back in every welcome. */
export const CHAT_KEEP = 30;
