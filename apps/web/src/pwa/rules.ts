// The rules of the installable app (plan 04-08; 04-UI-SPEC « Update », « Home strip », « Install
// guidance »; 04-RESEARCH Pattern 8, Pitfall 7). Pure: the page passes in where it is and what it
// knows, update.svelte.ts and install.svelte.ts hold the state.
//
// A new version never reloads a game (APP-02): the solo game is not saved, so « Mettre à jour » is
// offered only on the home, « Mon compte », « Mes amis » and the solo setup, and never in sign-up,
// recovery or while a backup code is on screen (it would be lost). In a game and at a table,
// « Réglages » only says that the version will install back on the home.

/** Where the page is: its hash, and whether a backup code is on screen (any route). */
export type Place = { hash: string; backupCode?: boolean };

/** The route of a hash: what precedes its query (#/partie?debug=geometry → #/partie). */
export function routeOf(hash: string): string {
  return hash.split("?")[0] ?? "";
}

/** The routes that show the strip « Nouvelle version disponible ». */
const UPDATE_ROUTES = new Set(["", "#", "#/", "#/compte", "#/amis", "#/ordinateur"]);

/** « Mettre à jour » may be offered (and applied) here. */
export function canPromptUpdate(place: Place): boolean {
  if (place.backupCode === true) return false;
  return UPDATE_ROUTES.has(routeOf(place.hash));
}

/** In a game or at a table: « Réglages » shows the line « Une nouvelle version est prête… ». */
export function inGameUpdateLine(place: Place): boolean {
  const route = routeOf(place.hash);
  return route === "#/partie" || route.startsWith("#/table/");
}

/** What the 4002 notice's « Recharger la page » needs. */
export type ApplyDeps = {
  /** A new worker is waiting now. */
  waiting: () => boolean;
  /** Looks for a new version; true when one is then waiting. May throw (no service worker). */
  check: () => Promise<boolean>;
  /** Sends SKIP_WAITING; the page reloads once the new worker controls it. */
  apply: () => Promise<void>;
  reload: () => void;
};

/**
 * The 4002 « Nouvelle version du jeu » notice (Pitfall 3): reloading into the old precached shell
 * would meet the same refusal, so a waiting worker is applied first; when none is waiting, a new
 * version is looked for and applied; else (no service worker, offline, nothing new) a plain reload.
 */
export async function applyOrReload(deps: ApplyDeps): Promise<"applied" | "reloaded"> {
  let found = deps.waiting();
  if (!found) {
    try {
      found = await deps.check();
    } catch {
      found = false;
    }
  }
  if (found) {
    await deps.apply();
    return "applied";
  }
  deps.reload();
  return "reloaded";
}
