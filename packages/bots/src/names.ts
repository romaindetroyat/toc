/** Famous horses that name the computer players (UI-SPEC, decision 4). The longest has 11 letters.
 * Shared by the local game and the online table (the Durable Object names its computers with them). */
export const BOT_NAMES = [
  "Tornado",
  "Jappeloup",
  "Bucéphale",
  "Ourasi",
  "Marengo",
  "Pégase",
  "Comanche",
  "Rossinante",
] as const;

export type BotName = (typeof BOT_NAMES)[number];
