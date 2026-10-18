// Installing TOC as an app (plan 04-08, APP-01; 04-UI-SPEC « Install guidance », « Home strip »).
//
// - Android and computer Chrome or Edge: the browser's beforeinstallprompt is kept (preventDefault) and
//   « Installer » shows its prompt. Accepted: a toast; refused: the strip hides 30 days.
// - iPhone and iPad: « Comment faire » opens « Installer TOC » (Safari's steps).
// - Installed, Firefox, desktop Safari: nothing.
// - « Plus tard » hides the strip 30 days: toc.install.v1 { hiddenUntil }, read and written in
//   try/catch and validated (rules.ts).

import { appli } from "../i18n/fr/appli.ts";
import { showToast } from "../ui/toast.svelte.ts";
import { browserPlatform } from "./platform.ts";
import { appleCanInstall, installHiddenRecord, readInstallHidden } from "./rules.ts";

const KEY = "toc.install.v1";

/** Chromium's install prompt (not in the DOM types). */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const install = $state({
  /** The captured prompt: installing through the browser is possible. */
  prompt: null as InstallPromptEvent | null,
  /** An iPhone or iPad whose browser can add TOC to the home screen. */
  apple: false,
  /** The app already runs installed. */
  standalone: false,
  /** « Plus tard » hides the strip until then (ms), null: not hidden. */
  hiddenUntil: null as number | null,
});

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

let started = false;

/** Once per page (main.ts), before the browser may fire beforeinstallprompt. */
export function startInstall(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    install.hiddenUntil = readInstallHidden(storage()?.getItem(KEY) ?? null);
  } catch {
    install.hiddenUntil = null;
  }
  const platform = browserPlatform();
  install.standalone = platform.standalone;
  install.apple = appleCanInstall(navigator.userAgent ?? "", navigator.maxTouchPoints ?? 0);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    install.prompt = event as InstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    install.prompt = null;
  });
}

/** « Plus tard », or a refused prompt: the install strip hides 30 days. */
export function hideInstall(now = Date.now()): void {
  const record = installHiddenRecord(now);
  install.hiddenUntil = readInstallHidden(record);
  try {
    storage()?.setItem(KEY, record);
  } catch {
    // Storage refused: hidden for this page only.
  }
}

/** « Installer l’application » in « Réglages »: installing is possible here (no 30-day delay). */
export function canInstall(): boolean {
  return !install.standalone && (install.prompt !== null || install.apple);
}

/** « Installer »: the browser's own prompt (Android, computer Chrome or Edge). */
export async function promptInstall(): Promise<void> {
  const event = install.prompt;
  if (event === null) return;
  // A prompt can be shown once: the next one comes with a new beforeinstallprompt.
  install.prompt = null;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") showToast(appli.installed);
    else hideInstall();
  } catch {
    // The browser refused to show it again: nothing to say.
  }
}
