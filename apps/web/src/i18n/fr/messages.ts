// The quick messages (02-UI-SPEC « Quick messages », D-07, D-13, plan 02-08): the sheet « Messages
// rapides », the seven phrases and the five emojis by protocol id, the names a screen reader says for
// the emojis, the history and the rate toast. Only ids travel; the text is looked up here and drawn as
// Svelte text nodes (T-02-33). French typography: U+202F before ! ? and inside « », U+00A0 before :.

import type { QuickMessageId } from "@toc/protocol";

/** What each id shows: the phrase, or the emoji glyph (system emoji font, never bundled). */
const shown: Record<QuickMessageId, string> = {
  "bien-joue": "Bien joué !",
  aie: "Aïe !",
  "merci-partenaire": "Merci partenaire",
  "a-toi": "À toi !",
  pardon: "Pardon…",
  presque: "On y est presque",
  bravo: "Bravo !",
  rire: "\u{1F602}",
  applaudir: "\u{1F44F}",
  surpris: "\u{1F62E}",
  cheval: "\u{1F434}",
  coeur: "\u2764\uFE0F",
};

/** What a screen reader says for each id: the phrase itself, or the emoji's name. */
const spoken: Record<QuickMessageId, string> = {
  "bien-joue": shown["bien-joue"],
  aie: shown.aie,
  "merci-partenaire": shown["merci-partenaire"],
  "a-toi": shown["a-toi"],
  pardon: shown.pardon,
  presque: shown.presque,
  bravo: shown.bravo,
  rire: "rire",
  applaudir: "applaudissements",
  surpris: "surprise",
  cheval: "cheval",
  coeur: "cœur",
};

export const messages = {
  /** The button (waiting room, the phone's right strip, the computer's fourth row) and its title. */
  button: "Messages",
  /** The sheet's title. */
  title: "Messages rapides",
  close: "Fermer",
  /** The visible text of a message: a phrase, or an emoji glyph. */
  text: (id: QuickMessageId): string => shown[id],
  /** The words of a message for a screen reader: the phrase, or the emoji's name (« cœur »). */
  spoken: (id: QuickMessageId): string => spoken[id],
  /** True for the five emojis (drawn at 20 px, alone). */
  isEmoji: (id: QuickMessageId): boolean => shown[id] !== spoken[id],
  /** A chip's accessible name: « Envoyer : Bien joué ! », « Envoyer : cœur ». */
  send: (id: QuickMessageId): string => `Envoyer : ${spoken[id]}`,
  history: {
    heading: "Derniers messages",
    /** Your own messages in the history. */
    you: "Toi",
    /** Between the name and the message: « {Nom} : {message} ». */
    sep: " : ",
    /** One row: « {Nom} : {message} ». */
    row: (name: string, message: string): string => `${name} : ${message}`,
    empty: "Aucun message pour l’instant.",
  },
  /** The polite live region for a received message: « {Nom} : {message} », an emoji by its name. */
  announce: (name: string, id: QuickMessageId): string => `${name} : ${spoken[id]}`,
  /** The server's rate code (3 messages in 5 s). */
  rate: "Doucement : attends un peu avant le prochain message.",
} as const;
