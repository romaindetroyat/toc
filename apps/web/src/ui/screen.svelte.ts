// The screen's mode, from media queries (UI-SPEC addendum « Plateau galet », items 6 and 7, « à confirmer
// par Romain »). The landscape galet is the only board (« paysage obligatoire »); what changes from one
// screen to the next is the chrome around it:
//
// - « bar »: landscape from 960 x 600 (computers, tablets held sideways). The board spans the width
//   and one 160 px bar under it holds the info, the hand and the action zone (plan 01-36).
// - « compact-bar »: every other landscape screen (phones held sideways, small windows). For now the
//   side panel of 01-24; 01-37 brings the compact band.
// - « rotate »: every screen taller than wide (a square one included). For now the portrait chrome of
//   01-24; 01-38 brings « Tourne ton téléphone ».
//
// Game.svelte's style block uses these very strings (screen.test.ts checks it), so the store and the
// CSS always agree. The store follows the queries' change events: a window resized from one mode to
// another changes the chrome in the same frame as the layout.

export type Chrome = "bar" | "compact-bar" | "rotate";

/** Landscape from 960 x 600. */
export const BAR_QUERY = "(orientation: landscape) and (min-width: 960px) and (min-height: 600px)";

/** Every other landscape screen: narrower than 960 or lower than 600 (a media query list: either one). */
export const COMPACT_BAR_QUERY =
  "(orientation: landscape) and (max-width: 959.98px), (orientation: landscape) and (max-height: 599.98px)";

/** Taller than wide, or square. */
export const ROTATE_QUERY = "(orientation: portrait)";

/** The mode for a media matcher; anything that is neither the bar nor portrait is the compact bar. */
export function chromeFrom(matches: (query: string) => boolean): Chrome {
  if (matches(BAR_QUERY)) return "bar";
  if (matches(ROTATE_QUERY)) return "rotate";
  return "compact-bar";
}

function browserMatcher(): ((query: string) => boolean) | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return (query) => window.matchMedia(query).matches;
}

const matcher = browserMatcher();

/** The game screen's mode; outside a browser it reports the bar. */
export const screen: { chrome: Chrome } = $state({
  chrome: matcher === null ? "bar" : chromeFrom(matcher),
});

if (matcher !== null) {
  const update = () => {
    screen.chrome = chromeFrom(matcher);
  };
  for (const query of [BAR_QUERY, COMPACT_BAR_QUERY, ROTATE_QUERY]) {
    window.matchMedia(query).addEventListener("change", update);
  }
}
