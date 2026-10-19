// The browser's side of push.ts (plan 04-10): the facts of this page and the service worker's
// PushManager, for « Mon compte › Notifications » and « Se déconnecter ». push.ts keeps the rules
// (pure, run under Node); this file only reads the browser.
//
// The PushManager is the registration's. The page never waits for it before the tap: enablePush asks
// the permission first, inside the tap's handler, and only then subscribes through this manager,
// which finds the registration (getRegistration, else `ready`, at most READY_MS). A page without a
// service worker (blocked, unsupported) gets a manager that fails, never one that hangs.

import { browserPlatform, type IosVersion } from "../pwa/platform.ts";
import type { PushManagerLike, SubscriptionLike } from "./push.ts";

/** How long the manager waits for a service worker that is not registered yet. */
const READY_MS = 10_000;

/** Whether the player switched the notifications off on this device (the switch « Sur cet appareil »). */
const OFF_KEY = "toc.push.v1";

function hasPushApi(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      "PushManager" in window &&
      "Notification" in window &&
      "serviceWorker" in navigator
    );
  } catch {
    return false;
  }
}

export type BrowserPushFacts = {
  hasPushApi: boolean;
  apple: boolean;
  standalone: boolean;
  iosVersion: IosVersion | null;
  userAgent: string;
};

/** What this page is: the Push API, an iPhone or iPad, the installed app, its iOS. */
export function browserPushFacts(): BrowserPushFacts {
  const platform = browserPlatform();
  return {
    hasPushApi: hasPushApi(),
    apple: platform.apple,
    standalone: platform.standalone,
    iosVersion: platform.iosVersion,
    userAgent: navigator.userAgent ?? "",
  };
}

/** Notification.permission now ("default" when there is none to read). */
export function currentPermission(): NotificationPermission {
  try {
    return typeof Notification === "undefined" ? "default" : Notification.permission;
  } catch {
    return "default";
  }
}

/** Notification.requestPermission, called as is (synchronously, in the tap's handler). */
export function requestPermission(): Promise<NotificationPermission> {
  return Notification.requestPermission();
}

async function registration(wait: boolean): Promise<ServiceWorkerRegistration | null> {
  if (!hasPushApi()) return null;
  const found = await navigator.serviceWorker.getRegistration();
  if (found !== undefined) return found;
  if (!wait) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), READY_MS);
  });
  try {
    return await Promise.race([navigator.serviceWorker.ready, late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The service worker's PushManager. `wait`: a worker not registered yet is waited for (READY_MS);
 * without it (the sign-out), no registration means no subscription.
 */
export function browserPushManager(wait = true): PushManagerLike {
  return {
    async getSubscription() {
      const found = await registration(wait);
      if (found === null) return null;
      return (await found.pushManager.getSubscription()) as SubscriptionLike | null;
    },
    async subscribe(options) {
      const found = await registration(wait);
      if (found === null) throw new Error("no service worker");
      return (await found.pushManager.subscribe(options)) as SubscriptionLike;
    },
  };
}

/** The switch « Sur cet appareil » was turned off here (kept across starts; try/catch). */
export function readSwitchedOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === "off";
  } catch {
    return false;
  }
}

export function writeSwitchedOff(off: boolean): void {
  try {
    if (off) localStorage.setItem(OFF_KEY, "off");
    else localStorage.removeItem(OFF_KEY);
  } catch {
    // Private browsing: the switch's position lives for this page only.
  }
}
