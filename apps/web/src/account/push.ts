// The browser's side of the notifications (plan 04-07, D-08, APP-03; 04-RESEARCH Pattern 7, Pitfalls 1
// and 2; 04-UI-SPEC « Mon compte › Notifications », whose panel comes in plan 04-10).
//
//   pushState(facts)    which of the panel's states to show, checked in the UI-SPEC's order
//   enablePush(deps)    « Activer les notifications »: called from the tap's handler. It asks for the
//                       permission first, before any await (Safari and Chrome want the tap), then
//                       subscribes at once with userVisibleOnly and the server's key, which the panel
//                       fetched before the tap (api.pushKey), then saves the subscription
//   disablePush(deps)   the switch off: the server forgets this device's endpoint, the device
//                       unsubscribes (even offline: the push service then answers 410 and the server
//                       drops the row)
//   refreshKey(deps)    when the panel opens: a subscription made with another key than the server's
//                       (a new VAPID secret) is replaced, if the permission is still granted
//
// The browser never decides whether a push is shown: the service worker of 04-08 always shows it
// (Apple revokes the permission otherwise); the server decides who is away. Notification, the
// PushManager and fetch are passed in, so the rules run under Node with fakes.

import type { PushSubscriptionInput } from "@toc/protocol";
import type { ApiDeps } from "../net/api.ts";
import { atLeast, type IosVersion } from "../pwa/platform.ts";
import { deleteSubscription, saveSubscription } from "./api.ts";

/** The panel's states (04-UI-SPEC), and `off`: switched off on this device. */
export type PushState =
  | "unsupported"
  | "install-first"
  | "ios-too-old"
  | "blocked"
  | "failed"
  | "ask"
  | "on"
  | "off";

export type PushFacts = {
  /** PushManager and Notification exist in this page. */
  hasPushApi: boolean;
  /** An iPhone or iPad (platform.ts isAppleMobile). */
  apple: boolean;
  /** The installed app (platform.ts isStandalone). */
  standalone: boolean;
  iosVersion: IosVersion | null;
  permission: NotificationPermission;
  /** This device holds a push subscription. */
  subscribed: boolean;
  /** The last activation failed. */
  failed: boolean;
  /** The player switched the notifications off on this device. */
  switchedOff: boolean;
};

/** The state of the « Notifications » panel, checked in the UI-SPEC's order. */
export function pushState(facts: PushFacts): PushState {
  if (!facts.hasPushApi && !facts.apple) return "unsupported";
  if (facts.apple && !facts.standalone) return "install-first";
  if (facts.apple && (!facts.hasPushApi || !atLeast(facts.iosVersion, 16, 4))) {
    return "ios-too-old";
  }
  if (facts.permission === "denied") return "blocked";
  if (facts.failed) return "failed";
  if (facts.permission === "granted" && facts.subscribed) return "on";
  if (facts.permission === "granted" && facts.switchedOff) return "off";
  return "ask";
}

/** What the code needs of a PushSubscription. */
export type SubscriptionLike = {
  endpoint: string;
  options?: { applicationServerKey: ArrayBuffer | null };
  toJSON(): { endpoint?: string; keys?: Record<string, string> };
  unsubscribe(): Promise<boolean>;
};

/** What the code needs of a PushManager (the service worker registration's). */
export type PushManagerLike = {
  getSubscription(): Promise<SubscriptionLike | null>;
  subscribe(options: {
    userVisibleOnly: true;
    applicationServerKey: Uint8Array<ArrayBuffer>;
  }): Promise<SubscriptionLike>;
};

/** A base64url key as bytes (the applicationServerKey). */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = key.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sameKey(given: ArrayBuffer | null | undefined, key: string): boolean {
  if (given === null || given === undefined) return false;
  const a = new Uint8Array(given);
  const b = keyBytes(key);
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/** The body of POST /api/push/subscriptions, or null when the subscription lacks its keys. */
function bodyOf(subscription: SubscriptionLike): PushSubscriptionInput | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  return { endpoint: json.endpoint ?? subscription.endpoint, keys: { p256dh, auth } };
}

/** Subscribes with `key` and saves it; on any failure the device unsubscribes again. */
async function subscribeAndSave(
  manager: PushManagerLike,
  key: string,
  api: ApiDeps | undefined,
): Promise<"on" | "failed"> {
  let subscription: SubscriptionLike;
  try {
    subscription = await manager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(key),
    });
  } catch {
    return "failed";
  }
  const body = bodyOf(subscription);
  const saved = body === null ? null : await saveSubscription(body, api);
  if (saved?.ok === true) return "on";
  try {
    await subscription.unsubscribe();
  } catch {
    // Nothing more to undo.
  }
  return "failed";
}

export type EnableDeps = {
  /** The server's key, fetched before the tap (api.pushKey); null when it could not be had. */
  key: string | null;
  manager: PushManagerLike;
  /** Notification.requestPermission. */
  requestPermission: () => Promise<NotificationPermission>;
  api?: ApiDeps;
};

/**
 * « Activer les notifications », from the tap's handler: the permission is asked before anything is
 * awaited, then the subscription is made at once and saved. on, ask (the prompt dismissed), blocked
 * or failed.
 */
export function enablePush(deps: EnableDeps): Promise<"on" | "ask" | "blocked" | "failed"> {
  const key = deps.key;
  if (key === null) return Promise.resolve("failed");
  let asked: Promise<NotificationPermission>;
  try {
    // Synchronously, inside the tap's handler call (Pitfall 2).
    asked = deps.requestPermission();
  } catch {
    return Promise.resolve("failed");
  }
  return asked.then(
    (permission) => {
      if (permission === "denied") return "blocked";
      if (permission !== "granted") return "ask";
      return subscribeAndSave(deps.manager, key, deps.api);
    },
    () => "failed" as const,
  );
}

/** The switch off: the server forgets this device's endpoint, the device unsubscribes. */
export async function disablePush(deps: {
  manager: PushManagerLike;
  api?: ApiDeps;
}): Promise<"off"> {
  let subscription: SubscriptionLike | null = null;
  try {
    subscription = await deps.manager.getSubscription();
  } catch {
    subscription = null;
  }
  if (subscription === null) return "off";
  // Offline, nothing is sent: the push service answers 410 later and the server drops the row.
  await deleteSubscription(subscription.endpoint, deps.api);
  try {
    await subscription.unsubscribe();
  } catch {
    // The browser keeps it; the push service answers 410 once the server has none.
  }
  return "off";
}

/**
 * When the panel opens with the server's key: none (no subscription here), on (made with this key),
 * or a subscription made with another key is replaced (on, or failed), or dropped when the
 * permission is no longer granted (ask).
 */
export async function refreshKey(deps: {
  key: string;
  manager: PushManagerLike;
  permission: () => NotificationPermission;
  api?: ApiDeps;
}): Promise<"none" | "on" | "ask" | "failed"> {
  let subscription: SubscriptionLike | null;
  try {
    subscription = await deps.manager.getSubscription();
  } catch {
    return "none";
  }
  if (subscription === null) return "none";
  if (sameKey(subscription.options?.applicationServerKey, deps.key)) return "on";
  try {
    await subscription.unsubscribe();
  } catch {
    // Replaced below anyway.
  }
  await deleteSubscription(subscription.endpoint, deps.api);
  if (deps.permission() !== "granted") return "ask";
  return subscribeAndSave(deps.manager, deps.key, deps.api);
}
