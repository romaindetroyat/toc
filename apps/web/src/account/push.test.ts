import { describe, expect, it } from "vitest";
import type { ApiDeps } from "../net/api.ts";
import { deleteSubscription, pushKey, saveSubscription } from "./api.ts";
import {
  disablePush,
  enablePush,
  type PushFacts,
  type PushManagerLike,
  pushState,
  refreshKey,
  type SubscriptionLike,
} from "./push.ts";

// The browser's side of the notifications (plan 04-07, D-08, APP-03; 04-RESEARCH Pattern 7, Pitfall
// 2; 04-UI-SPEC « Mon compte › Notifications »): which of the panel's states to show, asking for the
// permission and subscribing inside the tap's handler with a key fetched before it, switching off,
// and subscribing again when the server's key changed. Notification, the PushManager and fetch are
// fakes.

const KEY_A = `B${"A".repeat(86)}`;
const KEY_B = `B${"B".repeat(86)}`;
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/device-1";
const P256DH = `B${"p".repeat(86)}`;
const AUTH = "a".repeat(22);

const bytesOf = (key: string) =>
  Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const base: PushFacts = {
  hasPushApi: true,
  apple: false,
  standalone: false,
  iosVersion: null,
  permission: "default",
  subscribed: false,
  failed: false,
  switchedOff: false,
};

describe("pushState, in the order of the UI-SPEC", () => {
  it("no Push API and not an iPhone or iPad: unsupported", () => {
    expect(pushState({ ...base, hasPushApi: false })).toBe("unsupported");
  });

  it("iPhone or iPad not installed: install first, whatever else", () => {
    expect(pushState({ ...base, apple: true, hasPushApi: false })).toBe("install-first");
    expect(
      pushState({
        ...base,
        apple: true,
        iosVersion: { major: 17, minor: 4 },
        permission: "denied",
      }),
    ).toBe("install-first");
  });

  it("installed but below iOS 16.4, or no PushManager there: too old", () => {
    const apple = { ...base, apple: true, standalone: true };
    expect(pushState({ ...apple, iosVersion: { major: 16, minor: 3 } })).toBe("ios-too-old");
    expect(pushState({ ...apple, iosVersion: { major: 17, minor: 0 }, hasPushApi: false })).toBe(
      "ios-too-old",
    );
    expect(pushState({ ...apple, iosVersion: { major: 16, minor: 4 } })).toBe("ask");
  });

  it("denied: blocked, before a failure", () => {
    expect(pushState({ ...base, permission: "denied", failed: true })).toBe("blocked");
  });

  it("a failed activation: failed", () => {
    expect(pushState({ ...base, failed: true })).toBe("failed");
  });

  it("default, or granted without a subscription: ask; switched off on this device: off", () => {
    expect(pushState(base)).toBe("ask");
    expect(pushState({ ...base, permission: "granted" })).toBe("ask");
    expect(pushState({ ...base, permission: "granted", switchedOff: true })).toBe("off");
  });

  it("granted and subscribed: on", () => {
    expect(pushState({ ...base, permission: "granted", subscribed: true })).toBe("on");
  });
});

type Call = string;

/** A fake fetch that answers each call by method and path, and logs it. */
function fakeApi(
  calls: Call[],
  answers: Record<string, () => Response> = {},
  online = true,
): ApiDeps & { bodies: unknown[] } {
  const bodies: unknown[] = [];
  return {
    bodies,
    online: () => online,
    fetch: async (input, init) => {
      const method = init?.method ?? "GET";
      calls.push(`fetch ${method} ${input}`);
      if (typeof init?.body === "string") bodies.push(JSON.parse(init.body));
      const answer = answers[`${method} ${input}`];
      if (answer === undefined) throw new Error("network");
      return answer();
    },
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fakeSubscription(calls: Call[], key: string, endpoint = ENDPOINT): SubscriptionLike {
  return {
    endpoint,
    options: { applicationServerKey: bytesOf(key).buffer as ArrayBuffer },
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: P256DH, auth: AUTH } }),
    unsubscribe: async () => {
      calls.push(`unsubscribe ${endpoint}`);
      return true;
    },
  };
}

function fakeManager(
  calls: Call[],
  current: SubscriptionLike | null,
  fail = false,
): PushManagerLike & { options: unknown[] } {
  const options: unknown[] = [];
  return {
    options,
    getSubscription: async () => current,
    subscribe: async (given) => {
      calls.push("subscribe");
      options.push(given);
      if (fail) throw new Error("AbortError");
      const key = btoa(String.fromCharCode(...given.applicationServerKey))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      return fakeSubscription(calls, key);
    },
  };
}

const SAVED = { "POST /api/push/subscriptions": () => new Response(null, { status: 201 }) };

describe("enablePush, inside the tap", () => {
  it("asks for the permission at once, then subscribes, then saves: on", async () => {
    const calls: Call[] = [];
    const api = fakeApi(calls, SAVED);
    const manager = fakeManager(calls, null);
    const pending = enablePush({
      key: KEY_A,
      manager,
      api,
      requestPermission: () => {
        calls.push("requestPermission");
        return Promise.resolve("granted");
      },
    });
    // Synchronously, in the same handler call as the tap (Pitfall 2), before any other await.
    expect(calls).toEqual(["requestPermission"]);
    expect(await pending).toBe("on");
    expect(calls).toEqual(["requestPermission", "subscribe", "fetch POST /api/push/subscriptions"]);
    expect(manager.options).toEqual([
      { userVisibleOnly: true, applicationServerKey: bytesOf(KEY_A) },
    ]);
    expect(api.bodies).toEqual([{ endpoint: ENDPOINT, keys: { p256dh: P256DH, auth: AUTH } }]);
  });

  it("denied: blocked, never subscribed", async () => {
    const calls: Call[] = [];
    const manager = fakeManager(calls, null);
    const result = await enablePush({
      key: KEY_A,
      manager,
      api: fakeApi(calls, SAVED),
      requestPermission: async () => "denied",
    });
    expect(result).toBe("blocked");
    expect(calls).toEqual([]);
  });

  it("the prompt dismissed: ask again later", async () => {
    const calls: Call[] = [];
    const result = await enablePush({
      key: KEY_A,
      manager: fakeManager(calls, null),
      api: fakeApi(calls, SAVED),
      requestPermission: async () => "default",
    });
    expect(result).toBe("ask");
    expect(calls).toEqual([]);
  });

  it("the subscribe call fails: failed", async () => {
    const calls: Call[] = [];
    const result = await enablePush({
      key: KEY_A,
      manager: fakeManager(calls, null, true),
      api: fakeApi(calls, SAVED),
      requestPermission: async () => "granted",
    });
    expect(result).toBe("failed");
  });

  it("the server refuses or the network fails: failed, and the device unsubscribes", async () => {
    for (const answers of [
      { "POST /api/push/subscriptions": () => json({ error: "endpoint" }, 400) },
      {},
    ]) {
      const calls: Call[] = [];
      const result = await enablePush({
        key: KEY_A,
        manager: fakeManager(calls, null),
        api: fakeApi(calls, answers),
        requestPermission: async () => "granted",
      });
      expect(result).toBe("failed");
      expect(calls.at(-1)).toBe(`unsubscribe ${ENDPOINT}`);
    }
  });

  it("no key from the server: failed, nothing asked", async () => {
    const calls: Call[] = [];
    let asked = false;
    const result = await enablePush({
      key: null,
      manager: fakeManager(calls, null),
      api: fakeApi(calls, SAVED),
      requestPermission: async () => {
        asked = true;
        return "granted";
      },
    });
    expect(result).toBe("failed");
    expect(asked).toBe(false);
  });
});

describe("disablePush", () => {
  it("the server forgets the endpoint and the device unsubscribes: off", async () => {
    const calls: Call[] = [];
    const api = fakeApi(calls, {
      "DELETE /api/push/subscriptions": () => new Response(null, { status: 204 }),
    });
    const result = await disablePush({
      manager: fakeManager(calls, fakeSubscription(calls, KEY_A)),
      api,
    });
    expect(result).toBe("off");
    expect(calls).toEqual(["fetch DELETE /api/push/subscriptions", `unsubscribe ${ENDPOINT}`]);
    expect(api.bodies).toEqual([{ endpoint: ENDPOINT }]);
  });

  it("offline: the device unsubscribes anyway (the push service then answers 410)", async () => {
    const calls: Call[] = [];
    const result = await disablePush({
      manager: fakeManager(calls, fakeSubscription(calls, KEY_A)),
      api: fakeApi(calls, {}, false),
    });
    expect(result).toBe("off");
    expect(calls).toEqual([`unsubscribe ${ENDPOINT}`]);
  });
});

describe("refreshKey", () => {
  it("the same key: on, nothing done", async () => {
    const calls: Call[] = [];
    const result = await refreshKey({
      key: KEY_A,
      manager: fakeManager(calls, fakeSubscription(calls, KEY_A)),
      api: fakeApi(calls, SAVED),
      permission: () => "granted",
    });
    expect(result).toBe("on");
    expect(calls).toEqual([]);
  });

  it("the server's key changed: unsubscribed and subscribed again with the new key", async () => {
    const calls: Call[] = [];
    const manager = fakeManager(calls, fakeSubscription(calls, KEY_A));
    const result = await refreshKey({
      key: KEY_B,
      manager,
      api: fakeApi(calls, {
        ...SAVED,
        "DELETE /api/push/subscriptions": () => new Response(null, { status: 204 }),
      }),
      permission: () => "granted",
    });
    expect(result).toBe("on");
    expect(calls).toEqual([
      `unsubscribe ${ENDPOINT}`,
      "fetch DELETE /api/push/subscriptions",
      "subscribe",
      "fetch POST /api/push/subscriptions",
    ]);
    expect(manager.options).toEqual([
      { userVisibleOnly: true, applicationServerKey: bytesOf(KEY_B) },
    ]);
  });

  it("the key changed and the permission is not granted any more: ask", async () => {
    const calls: Call[] = [];
    const result = await refreshKey({
      key: KEY_B,
      manager: fakeManager(calls, fakeSubscription(calls, KEY_A)),
      api: fakeApi(calls, {
        "DELETE /api/push/subscriptions": () => new Response(null, { status: 204 }),
      }),
      permission: () => "default",
    });
    expect(result).toBe("ask");
    expect(calls).not.toContain("subscribe");
  });

  it("no subscription on this device: none", async () => {
    const calls: Call[] = [];
    const result = await refreshKey({
      key: KEY_A,
      manager: fakeManager(calls, null),
      api: fakeApi(calls, SAVED),
      permission: () => "granted",
    });
    expect(result).toBe("none");
  });
});

describe("the push calls of api.ts", () => {
  it("pushKey: the key, push-off, offline or server", async () => {
    const calls: Call[] = [];
    expect(
      await pushKey(fakeApi(calls, { "GET /api/push/key": () => json({ key: KEY_A }) })),
    ).toEqual({ ok: true, key: KEY_A });
    expect(
      await pushKey(
        fakeApi(calls, { "GET /api/push/key": () => json({ error: "push-off" }, 503) }),
      ),
    ).toEqual({ ok: false, reason: "off" });
    expect(
      await pushKey(fakeApi(calls, { "GET /api/push/key": () => json({ key: "short" }) })),
    ).toEqual({ ok: false, reason: "server" });
    expect(await pushKey(fakeApi(calls, {}))).toEqual({ ok: false, reason: "offline" });
    expect(await pushKey(fakeApi(calls, {}, false))).toEqual({ ok: false, reason: "offline" });
  });

  it("saveSubscription and deleteSubscription: ok, signed-out, offline, server", async () => {
    const calls: Call[] = [];
    const body = { endpoint: ENDPOINT, keys: { p256dh: P256DH, auth: AUTH } };
    expect(await saveSubscription(body, fakeApi(calls, SAVED))).toEqual({ ok: true });
    expect(
      await saveSubscription(
        body,
        fakeApi(calls, { "POST /api/push/subscriptions": () => json({ error: "x" }, 401) }),
      ),
    ).toEqual({ ok: false, reason: "signed-out" });
    expect(await saveSubscription(body, fakeApi(calls, {}))).toEqual({
      ok: false,
      reason: "offline",
    });
    const deleted = fakeApi(calls, {
      "DELETE /api/push/subscriptions": () => new Response(null, { status: 204 }),
    });
    expect(await deleteSubscription(ENDPOINT, deleted)).toEqual({ ok: true });
    expect(
      await deleteSubscription(
        ENDPOINT,
        fakeApi(calls, { "DELETE /api/push/subscriptions": () => json({ error: "x" }, 404) }),
      ),
    ).toEqual({ ok: false, reason: "unknown" });
  });
});
