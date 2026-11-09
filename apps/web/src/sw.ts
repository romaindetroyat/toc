/// <reference lib="webworker" />
// TOC's service worker (plan 04-08; D-09, APP-01, APP-02, APP-03; 04-RESEARCH Pattern 8 and « Service
// worker »). Built by vite-plugin-pwa in injectManifest mode into dist/sw.js.
//
// - Precache: the build's files (the app shell, the cards, the fonts, the icons, the knights), so the
//   installed app starts without network and plays against the computer. `/` is served from
//   index.html (every screen is a hash route). There is NO runtime route and no fetch handler of our
//   own: /api/* and /ws/* always go to the network, never through a cache (T-04-60).
// - Updates wait for the player (APP-02): no skipWaiting on install, no clientsClaim. The page posts
//   SKIP_WAITING after « Mettre à jour » (or the 4002 notice), outside a game.
// - Push (APP-03): every push is shown, never silently (iOS revokes the permission otherwise,
//   Pitfall 1). A tap focuses an open TOC window and takes it to the table, else opens one.
// - pushsubscriptionchange: subscribes again with the server's key and saves it (the session cookie
//   goes with same-origin requests).

import { cleanupOutdatedCaches, type PrecacheEntry, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | PrecacheEntry)[];
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("message", (event) => {
  const data: unknown = event.data;
  if (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "SKIP_WAITING"
  ) {
    void self.skipWaiting();
  }
});

/** The title shown when a push carries no readable payload. */
const DEFAULT_TITLE = "TOC";
const MAX_TITLE = 100;
const MAX_BODY = 300;
const MAX_TAG = 64;

type Shown = { title: string; body?: string; tag?: string; url: string };

const text = (value: unknown, max: number): string | undefined =>
  typeof value === "string" && value.length > 0 ? value.slice(0, max) : undefined;

/** What a push shows: the 04-07 payload { t, title, body, url, tag }, else just « TOC ». */
function shownOf(data: PushMessageData | null): Shown {
  let payload: unknown = null;
  try {
    payload = data?.json() ?? null;
  } catch {
    payload = null;
  }
  if (typeof payload !== "object" || payload === null) return { title: DEFAULT_TITLE, url: "/" };
  const p = payload as Record<string, unknown>;
  return {
    title: text(p.title, MAX_TITLE) ?? DEFAULT_TITLE,
    body: text(p.body, MAX_BODY),
    tag: text(p.tag, MAX_TAG),
    url: text(p.url, 512) ?? "/",
  };
}

/** A link of this origin only (T-04-62): anything else opens the home. */
function ownUrl(url: unknown): string {
  const origin = self.location.origin;
  try {
    const resolved = new URL(typeof url === "string" ? url : "/", origin);
    return resolved.origin === origin ? resolved.href : `${origin}/`;
  } catch {
    return `${origin}/`;
  }
}

self.addEventListener("push", (event) => {
  const shown = shownOf(event.data);
  // Always shown, even when a page is open: the server decides who is away (PlayerHub).
  event.waitUntil(
    self.registration.showNotification(shown.title, {
      body: shown.body,
      tag: shown.tag,
      icon: "/icons/icon-192.png",
      lang: "fr",
      data: { url: shown.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = ownUrl((event.notification.data as { url?: unknown } | null)?.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows[0];
      if (open !== undefined) {
        await open.focus();
        try {
          await open.navigate(url);
          return;
        } catch {
          // An uncontrolled window cannot be navigated from here: open the table in a new one.
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

/** base64url → bytes (the VAPID public key). */
function bytesOf(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Subscribes again with the server's current key and saves the new subscription. */
async function resubscribe(): Promise<void> {
  const keyAnswer = await fetch("/api/push/key", {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!keyAnswer.ok) return;
  const { key } = (await keyAnswer.json()) as { key?: unknown };
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(key)) return;
  const subscription = await self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: bytesOf(key),
  });
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string") return;
  await fetch("/api/push/subscriptions", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint ?? subscription.endpoint,
      keys: { p256dh, auth },
    }),
  });
}

self.addEventListener("pushsubscriptionchange", (event) => {
  (event as ExtendableEvent).waitUntil(resubscribe().catch(() => undefined));
});
