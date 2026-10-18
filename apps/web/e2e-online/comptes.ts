import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { deviceOptions } from "./online.ts";

// Shared helpers of the account specs (plan 04-01): an invitation minted through the test-only route,
// a browser context with Playwright's virtual passkey authenticator, and the whole sign-up from the
// invitation link to the home.

/**
 * TEST-ONLY values passed to `wrangler dev` by playwright.online.config.ts (--var). They are not the
 * production secrets, which exist only as Worker secrets (wrangler secret put) and are never committed.
 */
export const TEST_PEPPER = "test-only-pepper-not-a-secret-0123456789";
/** TEST-ONLY bootstrap code (22 base64url characters, the shape of an invitation code). */
export const TEST_BOOTSTRAP = "TestOnlyBootstrap00000";
/**
 * TEST ONLY, NEVER DEPLOYED: a VAPID pair for the Web Push routes under `wrangler dev` (plan 04-07),
 * generated once with tools/vapid-keys.mjs for the end-to-end tests. Its private part is public in this
 * repository, so it can never be the production VAPID_PRIVATE_KEY (a Worker secret, put by the deploy
 * through a pipe from tools/vapid-keys.mjs, never written anywhere).
 */
export const TEST_VAPID =
  "NsaUGkfGYKVbIjjACcWCBaAUqdKb-wGl5KbP_einjtQ.cQd7Xdbe0mPv9VKiwjhJHcB9yhYvAZ9Wsbd1-HmkABk.-iGzIlhW1aku9y4p173x6uhVylPhB7gz4OLrDqoPMmI";

export const BASE_URL = "http://localhost:8787";

/** POST /api/test/invitation (TOC_TEST_MODE only): a fresh invitation, or a used or expired one. */
export async function mintInvitation(
  request: APIRequestContext,
  options: { used?: boolean; expired?: boolean } = {},
): Promise<string> {
  const response = await request.post("/api/test/invitation", {
    data: options,
    headers: { Origin: BASE_URL },
  });
  expect(response.status()).toBe(201);
  const { code } = (await response.json()) as { code: string };
  expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
  return code;
}

/** A pseudo no other run has taken (the local D1 keeps its accounts between runs). */
export function uniquePseudo(prefix: string): string {
  const letters = "abcdefghijkmnpqrstuvwxyz";
  let tail = "";
  for (let i = 0; i < 6; i++) tail += letters[Math.floor(Math.random() * letters.length)];
  return `${prefix} ${tail}`.slice(0, 20);
}

/** A new browser context of the project's device, with the virtual passkey authenticator installed. */
export async function passkeyContext(
  browser: Browser,
  testInfo: TestInfo,
): Promise<BrowserContext> {
  const context = await browser.newContext(deviceOptions(testInfo));
  await context.credentials.install();
  return context;
}

/**
 * The whole sign-up from the invitation link: the pseudo, « Créer mon compte », the code screen,
 * « J’ai gardé mon code », « Oui, je l’ai gardé », and the home with « Mon compte ». Answers the code.
 */
export async function signUp(page: Page, code: string, pseudo: string): Promise<string> {
  await page.goto(`/#/invitation/${code}`);
  const form = page.locator("[data-pseudo-form]");
  await expect(form).toBeVisible();
  await form.getByRole("textbox").fill(pseudo);
  await form.getByRole("button", { name: "Créer mon compte" }).click();
  const screen = page.locator("[data-backup-code]");
  await expect(screen).toBeVisible();
  const shown = (await screen.locator("[data-code]").innerText()).replace(/\s/g, "");
  await screen.getByRole("button", { name: "J’ai gardé mon code" }).click();
  const confirm = page.getByRole("dialog", { name: /^Tu as bien gardé ton code\s\?$/ });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Oui, je l’ai gardé" }).click();
  await expect(page.locator('[data-small-tile="compte"]')).toBeVisible();
  return shown;
}

/** The RP ID under `wrangler dev` in test mode (the request's own host): the suite's passkeys are made for it. */
export const RP_ID = "localhost";

/**
 * A synced passkey (plan 04-09): every passkey `from` holds for TOC is copied into `to`'s virtual
 * authenticator, keys and counter included, as iCloud or Google would carry it to a new device.
 * `to` must have its authenticator installed (passkeyContext). Copying again re-syncs (the server
 * refuses a counter that goes backwards, as it would for a cloned key). Answers how many were copied.
 */
export async function copyPasskey(from: BrowserContext, to: BrowserContext): Promise<number> {
  const held = await from.credentials.get({ rpId: RP_ID });
  const there = new Set((await to.credentials.get({ rpId: RP_ID })).map((each) => each.id));
  for (const credential of held) {
    // A sync replaces the older copy: its counter must follow, or the server sees it go backwards.
    if (there.has(credential.id)) await to.credentials.delete(credential.id);
    await to.credentials.create(RP_ID, {
      id: credential.id,
      userHandle: credential.userHandle,
      privateKey: credential.privateKey,
      publicKey: credential.publicKey,
      signCount: credential.signCount,
    });
  }
  return held.length;
}

/** Opens the sign-in sheet from the home's small tile and uses this device's passkey. */
export async function signInFromHome(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator('[data-small-tile="connexion"]').click();
  const sheet = page.locator("[data-signin-sheet]");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Utiliser ma clé d’accès" }).click();
}

// --- Plan 04-10: the browser's push, stood in for (service workers are blocked in these suites) ---

/** An iPhone on iOS 17.4 (the push of an installed web app needs iOS 16.4 or newer). */
export const IPHONE_17_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export type PushStubOptions = {
  /** Notification.permission before any tap (default "default"). */
  permission?: NotificationPermission;
  /** What Notification.requestPermission() answers (default "granted"). */
  answer?: NotificationPermission;
  /** navigator.standalone: the installed app on an iPhone (default true; ignored elsewhere). */
  standalone?: boolean;
};

/**
 * Stands in, for every page of `context`, for what the suites cannot have: the service worker's
 * PushManager (navigator.serviceWorker.ready and getRegistration answer a registration whose
 * pushManager makes subscriptions on push.toc.test, which the Worker accepts in TOC_TEST_MODE),
 * Notification.permission and Notification.requestPermission (each call counted), and
 * navigator.standalone. The state lives in the page's localStorage (test.permission, test.answer,
 * test.standalone, test.push, test.asks), so a test changes it and reloads.
 */
export async function stubPush(
  context: BrowserContext,
  options: PushStubOptions = {},
): Promise<void> {
  // A real P-256 public point (65 bytes, 0x04 first) and a 16-byte secret, as a browser makes them.
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const point = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const init = {
    permission: options.permission ?? "default",
    answer: options.answer ?? "granted",
    standalone: options.standalone ?? true,
    p256dh: base64url(point),
    auth: base64url(crypto.getRandomValues(new Uint8Array(16))),
  };
  await context.addInitScript((init) => {
    const get = (key: string, fallback: string): string => {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    };
    const set = (key: string, value: string | null): void => {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        // Nothing to keep.
      }
    };
    const encode = (bytes: Uint8Array): string =>
      btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    const decode = (text: string): Uint8Array => {
      const plain = text.replace(/-/g, "+").replace(/_/g, "/");
      const binary = atob(plain + "=".repeat((4 - (plain.length % 4)) % 4));
      return Uint8Array.from(binary, (c) => c.charCodeAt(0));
    };
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => get("test.permission", init.permission),
    });
    Notification.requestPermission = () => {
      set("test.asks", String(Number(get("test.asks", "0")) + 1));
      const answer = get("test.answer", init.answer);
      set("test.permission", answer);
      return Promise.resolve(answer as NotificationPermission);
    };
    type Stored = { endpoint: string; key: string };
    const subscription = (stored: Stored) => ({
      endpoint: stored.endpoint,
      options: { applicationServerKey: decode(stored.key).buffer, userVisibleOnly: true },
      toJSON: () => ({ endpoint: stored.endpoint, keys: { p256dh: init.p256dh, auth: init.auth } }),
      unsubscribe: async () => {
        set("test.push", null);
        return true;
      },
    });
    const pushManager = {
      getSubscription: async () => {
        const raw = get("test.push", "");
        return raw === "" ? null : subscription(JSON.parse(raw) as Stored);
      },
      subscribe: async (options: { applicationServerKey: ArrayBuffer | ArrayBufferView }) => {
        if (get("test.permission", init.permission) !== "granted") {
          throw new DOMException("Permission denied", "NotAllowedError");
        }
        const key = options.applicationServerKey;
        const bytes = ArrayBuffer.isView(key)
          ? new Uint8Array(key.buffer, key.byteOffset, key.byteLength)
          : new Uint8Array(key);
        const id = encode(crypto.getRandomValues(new Uint8Array(12)));
        const stored = { endpoint: `https://push.toc.test/${id}`, key: encode(bytes) };
        set("test.push", JSON.stringify(stored));
        return subscription(stored);
      },
    };
    const registration = { pushManager };
    Object.defineProperty(ServiceWorkerContainer.prototype, "ready", {
      configurable: true,
      get: () => Promise.resolve(registration),
    });
    ServiceWorkerContainer.prototype.getRegistration = () =>
      Promise.resolve(registration as unknown as ServiceWorkerRegistration);
    Object.defineProperty(Navigator.prototype, "standalone", {
      configurable: true,
      get: () => get("test.standalone", init.standalone ? "1" : "0") === "1",
    });
  }, init);
}

/** What the stub saw: how many times the permission was asked, and this device's endpoint. */
export async function pushStubState(
  page: Page,
): Promise<{ asks: number; endpoint: string | null }> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("test.push");
    return {
      asks: Number(localStorage.getItem("test.asks") ?? "0"),
      endpoint: raw === null ? null : (JSON.parse(raw) as { endpoint: string }).endpoint,
    };
  });
}

/**
 * A passkey context (passkeyContext) with the push stub; on the phone project its user agent is an
 * iPhone on iOS 17.4, so the installed app (navigator.standalone) may turn the notifications on.
 */
export async function accountContext(
  browser: Browser,
  testInfo: TestInfo,
  push: PushStubOptions = {},
): Promise<BrowserContext> {
  const options = deviceOptions(testInfo);
  const phone = testInfo.project.name === "phone";
  const context = await browser.newContext(
    phone ? { ...options, userAgent: IPHONE_17_UA } : options,
  );
  await context.credentials.install();
  await stubPush(context, push);
  return context;
}

// --- Plan 04-10: friends through the API, for the specs of « Mes amis » ---

/** POST /api/invitations from `page`'s account: a pending link this device does not remember. */
export async function apiInvitation(page: Page): Promise<{ id: string; code: string }> {
  const answer = await page.evaluate(async () => {
    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return {
      status: response.status,
      body: (await response.json()) as { id: string; code: string },
    };
  });
  expect(answer.status).toBe(201);
  return answer.body;
}

/** `a` gives a friend code and `b` redeems it through the API: they are friends. */
export async function befriend(a: Page, b: Page): Promise<void> {
  const code = await a.evaluate(async () => {
    const response = await fetch("/api/friends/code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return ((await response.json()) as { code: string }).code;
  });
  const status = await b.evaluate(async (code) => {
    const response = await fetch("/api/friends/code/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    return response.status;
  }, code);
  expect(status).toBe(200);
}

// --- Plan 04-11: the app's hub socket and « Se déconnecter », for amis-table.spec.ts ---

/** A notice the page's PlayerHub sent (GET /ws/me): its kind and table. */
export type HubNotice = { kind: string; table: string; from: string };

/** Every notice frame `page` receives on its hub socket, in order (set up before the page loads). */
export function listenNotices(page: Page): HubNotice[] {
  const notices: HubNotice[] = [];
  page.on("websocket", (ws) => {
    if (!ws.url().endsWith("/ws/me")) return;
    ws.on("framereceived", ({ payload }) => {
      const text = typeof payload === "string" ? payload : payload.toString("utf8");
      if (text === "pong") return;
      const frame = JSON.parse(text) as { t?: string } & HubNotice;
      if (frame.t === "notice")
        notices.push({ kind: frame.kind, table: frame.table, from: frame.from });
    });
  });
  return notices;
}

/** « Mon compte » → « Se déconnecter » → the confirmation's « Se déconnecter »: the guest home. */
export async function signOutHere(page: Page): Promise<void> {
  await page.goto("/");
  await page.goto("/#/compte");
  await page
    .locator("[data-account-identity]")
    .getByRole("button", { name: "Se déconnecter" })
    .click();
  await page
    .getByRole("dialog", { name: /^Se déconnecter de cet appareil\s\?$/ })
    .getByRole("button", { name: "Se déconnecter" })
    .click();
  await expect(page.locator('[data-small-tile="connexion"]')).toBeVisible();
}
