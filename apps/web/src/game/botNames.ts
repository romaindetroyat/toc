/** Famous horses that name the three computer players (UI-SPEC, decision 4). The longest has 11 letters. */
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
