import type { MeAccount } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import type { ApiDeps } from "../net/api.ts";
import {
  addPasskey,
  invitationState,
  logIn,
  logOut,
  me,
  newBackupCode,
  removePasskey,
  signUp,
} from "./api.ts";
import type { Ceremonies } from "./webauthn.ts";

// The account calls of the page (plan 04-01): the invitation's state, the sign-up (options, the
// passkey, verify) and GET /api/me. fetch, the online flag and the passkey ceremony are injected;
// every answer is untrusted and read with the shared schemas.

const CODE = "abcdefghijklmnopqrstu_";

const ME: MeAccount = {
  id: "u".repeat(22),
  pseudo: "Zoé",
  createdAt: 1_792_000_000_000,
  passkeys: [
    {
      id: "AAAA",
      label: "iPhone",
      createdAt: 1_792_000_000_000,
      lastUsedAt: null,
      backedUp: true,
      current: true,
    },
  ],
  hasBackupCode: true,
  backupAt: 1_792_000_000_000,
};

const OPTIONS = {
  challenge: "Y2hhbGxlbmdl",
  rp: { id: "localhost", name: "TOC" },
  user: { id: "dXNlcg", name: "Zoé", displayName: "Zoé" },
  pubKeyCredParams: [{ type: "public-key", alg: -7 }],
  authenticatorSelection: { residentKey: "required" },
};

const RESPONSE = {
  id: "AAAA",
  rawId: "AAAA",
  type: "public-key" as const,
  response: { clientDataJSON: "e30", attestationObject: "o2M" },
  clientExtensionResults: {},
};

type Call = { url: string; init: RequestInit | undefined };

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function api(respond: (call: Call) => Response | Promise<Response>, online = true) {
  const calls: Call[] = [];
  const deps: ApiDeps = {
    fetch: async (input, init) => {
      const call = { url: String(input), init };
      calls.push(call);
      return respond(call);
    },
    online: () => online,
  };
  return { deps, calls };
}

function passkeys(result: () => Promise<typeof RESPONSE>, supported = true) {
  const seen: unknown[] = [];
  const ceremonies: Ceremonies = {
    supported: () => supported,
    register: async (options) => {
      seen.push(options);
      return result();
    },
    authenticate: async () => {
      throw new Error("not this ceremony");
    },
  };
  return { ceremonies, seen };
}

const ASSERTION = {
  id: "AAAA",
  rawId: "AAAA",
  type: "public-key" as const,
  response: { clientDataJSON: "e30", authenticatorData: "SZY", signature: "MEU", userHandle: "dQ" },
  clientExtensionResults: {},
};

const REQUEST = { challenge: "Y2hhbGxlbmdl", rpId: "localhost", userVerification: "preferred" };

/** A ceremony fake for assertions (login, step-up) and registrations (adding a key). */
function both(
  options: {
    get?: () => Promise<typeof ASSERTION>;
    create?: () => Promise<typeof RESPONSE>;
    supported?: boolean;
  } = {},
) {
  const seen: { kind: "get" | "create"; options: unknown }[] = [];
  const ceremonies: Ceremonies = {
    supported: () => options.supported ?? true,
    register: async (given) => {
      seen.push({ kind: "create", options: given });
      return (options.create ?? (async () => RESPONSE))();
    },
    authenticate: async (given) => {
      seen.push({ kind: "get", options: given });
      return (options.get ?? (async () => ASSERTION))();
    },
  };
  return { ceremonies, seen };
}

const failing = (name: string) => async () => {
  throw Object.assign(new Error(name), { name });
};

describe("invitationState(code)", () => {
  it("reads the four states from GET /api/invitations/<code>", async () => {
    for (const state of [
      { state: "ok", inviter: "Ana", expiresAt: 1_792_000_000_000 },
      { state: "ok", inviter: null, bootstrap: true },
      { state: "used", inviter: "Ana" },
      { state: "expired", inviter: "Ana" },
      { state: "unknown" },
    ]) {
      const { deps, calls } = api(() => json(state, 200));
      expect(await invitationState(CODE, deps)).toEqual(state);
      expect(calls[0]?.url).toBe(`/api/invitations/${CODE}`);
    }
  });

  it("a code that cannot be one is unknown, without a request", async () => {
    const { deps, calls } = api(() => json({ state: "ok", inviter: "Ana" }, 200));
    expect(await invitationState("short", deps)).toEqual({ state: "unknown" });
    expect(calls).toHaveLength(0);
  });

  it("offline: the browser says so, fetch rejects, or the server fails", async () => {
    expect(await invitationState(CODE, api(() => json({}, 200), false).deps)).toEqual({
      state: "offline",
    });
    const rejecting = api(() => {
      throw new TypeError("Failed to fetch");
    });
    expect(await invitationState(CODE, rejecting.deps)).toEqual({ state: "offline" });
    expect(await invitationState(CODE, api(() => json({ error: "x" }, 503)).deps)).toEqual({
      state: "offline",
    });
  });

  it("anything else is unknown: a 404, not JSON, not a state", async () => {
    for (const respond of [
      () => json({ error: "not-found" }, 404),
      () => new Response("<html>", { status: 200 }),
      () => json({ state: "maybe" }, 200),
    ]) {
      expect(await invitationState(CODE, api(respond).deps)).toEqual({ state: "unknown" });
    }
  });
});

describe("signUp(code, pseudo)", () => {
  it("options, then the passkey with { optionsJSON }, then verify: the account and the code", async () => {
    const { deps, calls } = api((call) =>
      call.url.endsWith("/options")
        ? json(OPTIONS, 200)
        : json({ me: ME, backupCode: "K7QM2XRAP9DWHT4ENB6Z" }, 201),
    );
    const { ceremonies, seen } = passkeys(async () => RESPONSE);
    expect(await signUp(CODE, "Zoé", { api: deps, passkeys: ceremonies })).toEqual({
      ok: true,
      me: ME,
      backupCode: "K7QM2XRAP9DWHT4ENB6Z",
    });
    expect(calls.map((call) => call.url)).toEqual([
      "/api/auth/signup/options",
      "/api/auth/signup/verify",
    ]);
    for (const call of calls) {
      expect(call.init?.method).toBe("POST");
      expect(new Headers(call.init?.headers).get("content-type")).toBe("application/json");
    }
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ invitation: CODE, pseudo: "Zoé" });
    expect(seen).toEqual([{ optionsJSON: OPTIONS }]);
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ response: RESPONSE });
  });

  it("the options call's refusals", async () => {
    const cases: [Response, string][] = [
      [json({ error: "pseudo", reason: "chars" }, 400), "pseudo"],
      [json({ error: "taken" }, 409), "taken"],
      [json({ error: "used" }, 410), "used"],
      [json({ error: "expired" }, 410), "expired"],
      [json({ error: "unknown" }, 410), "unknown"],
      [json({ error: "config" }, 503), "server"],
      [json({ nope: true }, 200), "server"],
    ];
    for (const [response, reason] of cases) {
      const { deps } = api(() => response.clone());
      const { ceremonies, seen } = passkeys(async () => RESPONSE);
      const result = await signUp(CODE, "Zoé", { api: deps, passkeys: ceremonies });
      expect(result, reason).toMatchObject({ ok: false, reason });
      expect(seen).toEqual([]);
    }
  });

  it("the passkey's failures, and no verify call", async () => {
    for (const [name, reason] of [
      ["NotAllowedError", "cancelled"],
      ["SecurityError", "wrong-address"],
      ["UnknownError", "server"],
    ] as const) {
      const { deps, calls } = api(() => json(OPTIONS, 200));
      const { ceremonies } = passkeys(failing(name));
      expect(await signUp(CODE, "Zoé", { api: deps, passkeys: ceremonies })).toEqual({
        ok: false,
        reason,
      });
      expect(calls).toHaveLength(1);
    }
    const { deps, calls } = api(() => json(OPTIONS, 200));
    const { ceremonies } = passkeys(async () => RESPONSE, false);
    expect(await signUp(CODE, "Zoé", { api: deps, passkeys: ceremonies })).toEqual({
      ok: false,
      reason: "unsupported",
    });
    expect(calls).toHaveLength(0);
  });

  it("the verify call's refusals: taken meanwhile, the invitation gone, a server error", async () => {
    const cases: [Response, string][] = [
      [json({ error: "taken" }, 409), "taken-meanwhile"],
      [json({ error: "used" }, 410), "used"],
      [json({ error: "expired" }, 410), "expired"],
      [json({ error: "expired" }, 400), "server"],
      [json({ me: ME, backupCode: "short" }, 201), "server"],
      [new Response("<html>", { status: 201 }), "server"],
    ];
    for (const [response, reason] of cases) {
      const { deps } = api((call) =>
        call.url.endsWith("/options") ? json(OPTIONS, 200) : response.clone(),
      );
      const { ceremonies } = passkeys(async () => RESPONSE);
      expect(await signUp(CODE, "Zoé", { api: deps, passkeys: ceremonies }), reason).toEqual({
        ok: false,
        reason,
      });
    }
  });

  it("offline before or during the sign-up", async () => {
    const { ceremonies } = passkeys(async () => RESPONSE);
    const off = api(() => json(OPTIONS, 200), false);
    expect(await signUp(CODE, "Zoé", { api: off.deps, passkeys: ceremonies })).toEqual({
      ok: false,
      reason: "offline",
    });
    expect(off.calls).toHaveLength(0);
    const dropped = api((call) => {
      if (call.url.endsWith("/verify")) throw new TypeError("Failed to fetch");
      return json(OPTIONS, 200);
    });
    expect(await signUp(CODE, "Zoé", { api: dropped.deps, passkeys: ceremonies })).toEqual({
      ok: false,
      reason: "offline",
    });
  });
});

describe("me()", () => {
  it("the account from GET /api/me", async () => {
    const { deps, calls } = api(() => json(ME, 200));
    expect(await me(deps)).toEqual(ME);
    expect(calls[0]?.url).toBe("/api/me");
    expect(calls[0]?.init?.cache).toBe("no-store");
  });

  it("signed out (401), no Worker (404 or not JSON, the local preview): null", async () => {
    for (const respond of [
      () => json({ error: "signed-out" }, 401),
      () => json({ error: "not-found" }, 404),
      () => new Response("<!doctype html>", { status: 200 }),
      () => json({ pseudo: 3 }, 200),
    ]) {
      expect(await me(api(respond).deps)).toBeNull();
    }
  });

  it("offline: the browser says so, fetch rejects, or the server fails", async () => {
    expect(await me(api(() => json(ME, 200), false).deps)).toBe("offline");
    expect(
      await me(
        api(() => {
          throw new TypeError("Failed to fetch");
        }).deps,
      ),
    ).toBe("offline");
    expect(await me(api(() => json({}, 500)).deps)).toBe("offline");
  });
});

// --- Plan 04-02: logIn, logOut, addPasskey, removePasskey, newBackupCode ---

describe("logIn()", () => {
  it("options {}, then the passkey with { optionsJSON }, then verify: the account", async () => {
    const { deps, calls } = api((call) =>
      call.url.endsWith("/options") ? json(REQUEST, 200) : json({ me: ME }, 200),
    );
    const { ceremonies, seen } = both();
    expect(await logIn({ api: deps, passkeys: ceremonies })).toEqual({ ok: true, me: ME });
    expect(calls.map((call) => call.url)).toEqual([
      "/api/auth/login/options",
      "/api/auth/login/verify",
    ]);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({});
    expect(seen).toEqual([{ kind: "get", options: { optionsJSON: REQUEST } }]);
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ response: ASSERTION });
    for (const call of calls) {
      expect(new Headers(call.init?.headers).get("content-type")).toBe("application/json");
    }
  });

  it("the passkey's failures, and no verify call", async () => {
    for (const [name, reason] of [
      ["NotAllowedError", "cancelled"],
      ["AbortError", "cancelled"],
      ["SecurityError", "wrong-address"],
      ["UnknownError", "server"],
    ] as const) {
      const { deps, calls } = api(() => json(REQUEST, 200));
      const { ceremonies } = both({ get: failing(name) as never });
      expect(await logIn({ api: deps, passkeys: ceremonies })).toEqual({ ok: false, reason });
      expect(calls).toHaveLength(1);
    }
    const { deps, calls } = api(() => json(REQUEST, 200));
    expect(await logIn({ api: deps, passkeys: both({ supported: false }).ceremonies })).toEqual({
      ok: false,
      reason: "unsupported",
    });
    expect(calls).toHaveLength(0);
  });

  it("the server's refusals: unknown key, expired, anything else", async () => {
    const cases: [Response, string][] = [
      [json({ error: "unknown" }, 400), "unknown"],
      [json({ error: "expired" }, 400), "expired"],
      [json({ error: "refused" }, 400), "server"],
      [json({ error: "config" }, 503), "server"],
      [json({ me: { id: 1 } }, 200), "server"],
    ];
    for (const [response, reason] of cases) {
      const { deps } = api((call) =>
        call.url.endsWith("/options") ? json(REQUEST, 200) : response.clone(),
      );
      expect(await logIn({ api: deps, passkeys: both().ceremonies }), reason).toEqual({
        ok: false,
        reason,
      });
    }
    const badOptions = api(() => json({ nope: 1 }, 200));
    expect(await logIn({ api: badOptions.deps, passkeys: both().ceremonies })).toEqual({
      ok: false,
      reason: "server",
    });
  });

  it("offline before or during", async () => {
    expect(
      await logIn({ api: api(() => json(REQUEST, 200), false).deps, passkeys: both().ceremonies }),
    ).toEqual({ ok: false, reason: "offline" });
    const dropped = api((call) => {
      if (call.url.endsWith("/verify")) throw new TypeError("Failed to fetch");
      return json(REQUEST, 200);
    });
    expect(await logIn({ api: dropped.deps, passkeys: both().ceremonies })).toEqual({
      ok: false,
      reason: "offline",
    });
  });
});

describe("logOut()", () => {
  it("POST /api/auth/logout {}, and the cached account forgotten", async () => {
    const { deps, calls } = api(() => new Response(null, { status: 204 }));
    let forgotten = 0;
    expect(await logOut({ api: deps, forget: () => forgotten++ })).toEqual({ ok: true });
    expect(calls[0]?.url).toBe("/api/auth/logout");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({});
    expect(forgotten).toBe(1);
  });

  it("forgets the account on this device even when the call fails", async () => {
    for (const [respond, online, reason] of [
      [() => json({}, 500), true, "server"],
      [
        () => {
          throw new TypeError("Failed to fetch");
        },
        true,
        "offline",
      ],
      [() => new Response(null, { status: 204 }), false, "offline"],
    ] as const) {
      let forgotten = 0;
      const result = await logOut({ api: api(respond, online).deps, forget: () => forgotten++ });
      expect(result).toEqual({ ok: false, reason });
      expect(forgotten).toBe(1);
    }
  });
});

describe("addPasskey()", () => {
  const PASSKEY = {
    id: "BBBB",
    label: "Mac",
    createdAt: 1_792_000_000_000,
    lastUsedAt: null,
    backedUp: false,
    current: true,
  };

  it("options {}, the registration with { optionsJSON }, verify: the new key", async () => {
    const { deps, calls } = api((call) =>
      call.url.endsWith("/options") ? json(OPTIONS, 200) : json({ passkey: PASSKEY }, 201),
    );
    const { ceremonies, seen } = both();
    expect(await addPasskey({ api: deps, passkeys: ceremonies })).toEqual({
      ok: true,
      passkey: PASSKEY,
    });
    expect(calls.map((call) => call.url)).toEqual([
      "/api/auth/passkeys/options",
      "/api/auth/passkeys/verify",
    ]);
    expect(seen).toEqual([{ kind: "create", options: { optionsJSON: OPTIONS } }]);
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ response: RESPONSE });
  });

  it("this device already has a key: InvalidStateError from the browser, or 409 from the server", async () => {
    const browser = api(() => json(OPTIONS, 200));
    expect(
      await addPasskey({
        api: browser.deps,
        passkeys: both({ create: failing("InvalidStateError") as never }).ceremonies,
      }),
    ).toEqual({ ok: false, reason: "already-here" });
    expect(browser.calls).toHaveLength(1);
    const server = api((call) =>
      call.url.endsWith("/options") ? json(OPTIONS, 200) : json({ error: "already-here" }, 409),
    );
    expect(await addPasskey({ api: server.deps, passkeys: both().ceremonies })).toEqual({
      ok: false,
      reason: "already-here",
    });
  });

  it("signed out, cancelled, expired, offline", async () => {
    expect(
      await addPasskey({
        api: api(() => json({ error: "signed-out" }, 401)).deps,
        passkeys: both().ceremonies,
      }),
    ).toEqual({ ok: false, reason: "signed-out" });
    expect(
      await addPasskey({
        api: api(() => json(OPTIONS, 200)).deps,
        passkeys: both({ create: failing("NotAllowedError") as never }).ceremonies,
      }),
    ).toEqual({ ok: false, reason: "cancelled" });
    const expired = api((call) =>
      call.url.endsWith("/options") ? json(OPTIONS, 200) : json({ error: "expired" }, 400),
    );
    expect(await addPasskey({ api: expired.deps, passkeys: both().ceremonies })).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(
      await addPasskey({
        api: api(() => json(OPTIONS, 200), false).deps,
        passkeys: both().ceremonies,
      }),
    ).toEqual({ ok: false, reason: "offline" });
  });
});

describe("removePasskey(id)", () => {
  it("DELETE /api/auth/passkeys/<id> with no body", async () => {
    const { deps, calls } = api(() => new Response(null, { status: 204 }));
    expect(await removePasskey("AB-c_9", deps)).toEqual({ ok: true });
    expect(calls[0]?.url).toBe("/api/auth/passkeys/AB-c_9");
    expect(calls[0]?.init?.method).toBe("DELETE");
    expect(calls[0]?.init?.body).toBeUndefined();
  });

  it("the last key, signed out, already gone, a server error, offline", async () => {
    const cases: [() => Response, string][] = [
      [() => json({ error: "last" }, 409), "last"],
      [() => json({ error: "signed-out" }, 401), "signed-out"],
      [() => json({ error: "not-found" }, 404), "unknown"],
      [() => json({}, 500), "server"],
    ];
    for (const [respond, reason] of cases) {
      expect(await removePasskey("AAAA", api(respond).deps), reason).toEqual({ ok: false, reason });
    }
    expect(await removePasskey("AAAA", api(() => json({}, 204), false).deps)).toEqual({
      ok: false,
      reason: "offline",
    });
  });

  it("an id that cannot be a credential id: no request", async () => {
    const { deps, calls } = api(() => new Response(null, { status: 204 }));
    expect(await removePasskey("../me", deps)).toEqual({ ok: false, reason: "unknown" });
    expect(calls).toHaveLength(0);
  });
});

describe("newBackupCode()", () => {
  it("options {}, the step-up assertion, verify: the new code", async () => {
    const { deps, calls } = api((call) =>
      call.url.endsWith("/options")
        ? json({ ...REQUEST, allowCredentials: [{ id: "AAAA", type: "public-key" }] }, 200)
        : json({ backupCode: "K7QM2XRAP9DWHT4ENB6Z" }, 200),
    );
    const { ceremonies, seen } = both();
    expect(await newBackupCode({ api: deps, passkeys: ceremonies })).toEqual({
      ok: true,
      backupCode: "K7QM2XRAP9DWHT4ENB6Z",
    });
    expect(calls.map((call) => call.url)).toEqual([
      "/api/auth/backup-code/options",
      "/api/auth/backup-code/verify",
    ]);
    expect(seen[0]?.kind).toBe("get");
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ response: ASSERTION });
  });

  it("the step-up cancelled, another account's key, expired, signed out", async () => {
    const cancelled = api(() => json(REQUEST, 200));
    expect(
      await newBackupCode({
        api: cancelled.deps,
        passkeys: both({ get: failing("NotAllowedError") as never }).ceremonies,
      }),
    ).toEqual({ ok: false, reason: "cancelled" });
    expect(cancelled.calls).toHaveLength(1);
    const cases: [Response, string][] = [
      [json({ error: "refused" }, 400), "unknown"],
      [json({ error: "expired" }, 400), "expired"],
      [json({ error: "signed-out" }, 401), "signed-out"],
      [json({ backupCode: "short" }, 200), "server"],
    ];
    for (const [response, reason] of cases) {
      const { deps } = api((call) =>
        call.url.endsWith("/options") ? json(REQUEST, 200) : response.clone(),
      );
      expect(await newBackupCode({ api: deps, passkeys: both().ceremonies }), reason).toEqual({
        ok: false,
        reason,
      });
    }
  });
});
