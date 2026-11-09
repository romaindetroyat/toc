// The rules of the installable app (plan 04-08; 04-UI-SPEC « Update », « Home strip », « Install
// guidance »; 04-RESEARCH Pattern 8, Pitfall 7). Pure: the page passes in where it is and what it
// knows, update.svelte.ts and install.svelte.ts hold the state.
//
// A new version never reloads a game (APP-02): the solo game is not saved, so « Mettre à jour » is
// offered only on the home, « Mon compte », « Mes amis » and the solo setup, and never in sign-up,
// recovery or while a backup code is on screen (it would be lost). In a game and at a table,
// « Réglages » only says that the version will install back on the home.

import { atLeast, iosVersion, isAppleMobile } from "./platform.ts";

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

// --- The home strip (04-UI-SPEC « Home strip », « Install guidance ») ---

/** One strip at most: offline > update > install (the browser's prompt, or Safari's steps). */
export type Strip = "offline" | "update" | "install-prompt" | "install-apple";

export type StripInput = {
  /** navigator.onLine. */
  online: boolean;
  /** /api/me answered, or was not asked yet (false only when its request failed on the network). */
  apiReachable: boolean;
  /** A new version waits and this page may offer it (canPromptUpdate). */
  needRefresh: boolean;
  /** « Plus tard » on the update strip, since the last start or return to the foreground. */
  updateDismissed: boolean;
  /** beforeinstallprompt was captured (Android, computer Chrome or Edge). */
  installable: boolean;
  /** An iPhone or iPad whose browser can add TOC to the home screen (appleCanInstall). */
  appleMobile: boolean;
  /** The app already runs installed. */
  standalone: boolean;
  /** « Plus tard » on the install strip hides it until then (toc.install.v1), ms. */
  installHiddenUntil: number | null;
  now: number;
};

export function stripFor(input: StripInput): Strip | null {
  if (!input.online || !input.apiReachable) return "offline";
  if (input.needRefresh && !input.updateDismissed) return "update";
  if (input.standalone) return null;
  if (input.installHiddenUntil !== null && input.now < input.installHiddenUntil) return null;
  if (input.installable) return "install-prompt";
  if (input.appleMobile) return "install-apple";
  return null;
}

/** « Plus tard » (or a refused prompt) hides the install strip this long. */
export const INSTALL_HIDE_MS = 30 * 24 * 60 * 60 * 1000;

/** The value of toc.install.v1 after « Plus tard » at `now`. */
export function installHiddenRecord(now: number): string {
  return JSON.stringify({ hiddenUntil: now + INSTALL_HIDE_MS });
}

/** toc.install.v1's date, or null when it is missing or damaged. */
export function readInstallHidden(raw: string | null): number | null {
  if (raw === null || raw === "") return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const until = (value as { hiddenUntil?: unknown }).hiddenUntil;
  if (typeof until !== "number" || !Number.isSafeInteger(until) || until < 0) return null;
  return until;
}

/**
 * An iPhone or iPad whose browser can add TOC to the home screen: Safari always (« Partager » then
 * « Sur l’écran d’accueil »), another browser (Chrome, Firefox, Edge) from iOS 16.4. iPadOS reports
 * itself as a Mac with a touch screen; a Mac without touch is desktop Safari (no install).
 */
export function appleCanInstall(userAgent: string, maxTouchPoints: number): boolean {
  if (!isAppleMobile(userAgent, maxTouchPoints)) return false;
  const otherBrowser = /\b(CriOS|FxiOS|EdgiOS|OPiOS|GSA)\//.test(userAgent);
  return !otherBrowser || atLeast(iosVersion(userAgent), 16, 4);
}
