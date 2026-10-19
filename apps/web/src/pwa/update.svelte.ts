// The update flow of the installable app (plan 04-08, APP-02; 04-RESEARCH Pattern 8, Pitfalls 3 and 7;
// 04-UI-SPEC « Update »). The service worker is registered once per page (main.ts); a new version
// waits until the player says « Mettre à jour » where pwa/rules.ts allows it, never in a game.
//
// - `pwaUpdate.needRefresh` turns true when a new worker is waiting.
// - `applyUpdate()` posts SKIP_WAITING; the page reloads once the new worker controls it.
// - `applyUpdateOrReload()` is the 4002 notice's « Recharger la page »: a waiting worker, else a new
//   one found now, else a plain reload.
// - New versions are looked for when the app comes back to the foreground, never on a timer.
// - A registration that fails (service workers blocked by the tests, unsupported, the dev server) is
//   silent: the app works as before.

import { registerSW } from "virtual:pwa-register";
import { untrack } from "svelte";
import { applyOrReload, canPromptUpdate, type Place } from "./rules.ts";

export const pwaUpdate = $state({
  /** A new version is waiting for the player. */
  needRefresh: false,
  /** « Plus tard » on the strip: hidden until the next start or the next return to the foreground. */
  dismissed: false,
  /** « Mettre à jour » was pressed; the page reloads when the new worker takes over. */
  busy: false,
  /** Screens that must never be reloaded under the player (the backup code), counted. */
  holds: 0,
});

/** How long the 4002 notice waits for a new worker to install before a plain reload. */
const INSTALL_WAIT_MS = 10_000;

let started = false;
let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;
let waiters: (() => void)[] = [];

function supported(): boolean {
  try {
    return typeof navigator !== "undefined" && "serviceWorker" in navigator;
  } catch {
    return false;
  }
}

/** Once per page (main.ts): registers sw.js and listens for the return to the foreground. */
export function startUpdates(): void {
  if (started || !supported()) return;
  started = true;
  try {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        pwaUpdate.needRefresh = true;
        for (const wake of waiters) wake();
        waiters = [];
      },
      onRegisteredSW(_url, found) {
        registration = found;
      },
      onRegisterError() {
        // Blocked, unsupported or refused: no update flow, nothing to say.
      },
    });
  } catch {
    updateSW = null;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    pwaUpdate.dismissed = false;
    void checkForUpdate();
  });
}

/** Looks for a new version now (the app came back to the foreground). Errors are silent. */
export async function checkForUpdate(): Promise<void> {
  if (registration === undefined) return;
  try {
    await registration.update();
  } catch {
    // Offline, or the worker script is unreachable: the next return looks again.
  }
}

/** Where the page is now, for the rules. */
export function currentPlace(): Place {
  return { hash: location.hash, backupCode: pwaUpdate.holds > 0 };
}

/** A screen that must never be reloaded (the backup code) holds the updates while it is shown. */
export function holdUpdates(): () => void {
  // Called from an $effect: the count is written without becoming one of its dependencies.
  untrack(() => {
    pwaUpdate.holds += 1;
  });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    untrack(() => {
      pwaUpdate.holds -= 1;
    });
  };
}

/** « Mettre à jour »: SKIP_WAITING, then the reload on the controller change. Refused in a game. */
export async function applyUpdate(): Promise<void> {
  if (updateSW === null || !pwaUpdate.needRefresh) return;
  if (!canPromptUpdate(currentPlace())) return;
  pwaUpdate.busy = true;
  await updateSW(true);
}

/** Waits until a new worker is waiting, or `ms` went by; true when one is. */
function waitForWaiting(ms: number): Promise<boolean> {
  if (pwaUpdate.needRefresh) return Promise.resolve(true);
  return new Promise((resolve) => {
    const wake = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      waiters = waiters.filter((w) => w !== wake);
      resolve(pwaUpdate.needRefresh);
    }, ms);
    waiters.push(wake);
  });
}

/**
 * The 4002 « Nouvelle version du jeu » notice: the game at this table is over for this old client, so
 * the waiting worker is applied here (reloading into the old precached shell would meet 4002 again).
 */
export async function applyUpdateOrReload(): Promise<void> {
  await applyOrReload({
    waiting: () => updateSW !== null && pwaUpdate.needRefresh,
    check: async () => {
      if (registration === undefined || updateSW === null) return false;
      await registration.update();
      const installing = registration.installing !== null || registration.waiting !== null;
      return installing ? waitForWaiting(INSTALL_WAIT_MS) : pwaUpdate.needRefresh;
    },
    apply: async () => {
      pwaUpdate.busy = true;
      await updateSW?.(true);
    },
    reload: () => location.reload(),
  });
}
