import { describe, expect, it } from "vitest";
import { type Ceremonies, createPasskey, getPasskey, passkeyFailure } from "./webauthn.ts";

// The browser's passkey ceremony behind a seam (plan 04-01): @simplewebauthn/browser's
// startRegistration is injected, so these rules run in Node with fakes.

const OPTIONS = {
  challenge: "Y2hhbGxlbmdl",
  rp: { id: "localhost", name: "TOC" },
  user: { id: "dXNlcg", name: "Zoé", displayName: "Zoé" },
  pubKeyCredParams: [{ type: "public-key" as const, alg: -7 }],
};

const RESPONSE = {
  id: "AAAA",
  rawId: "AAAA",
  type: "public-key" as const,
  response: { clientDataJSON: "e30", attestationObject: "o2M" },
  clientExtensionResults: {},
};

function fake(register: Ceremonies["register"], supported = true) {
  const calls: unknown[] = [];
  const ceremonies: Ceremonies = {
    supported: () => supported,
    register: async (options) => {
      calls.push(options);
      return register(options);
    },
    authenticate: async () => {
      throw new Error("not this ceremony");
    },
  };
  return { ceremonies, calls };
}

const named = (name: string) => Object.assign(new Error(name), { name });

describe("passkeyFailure", () => {
  it("maps what the platform throws to what the page says", () => {
    expect(passkeyFailure(new DOMException("no", "NotAllowedError"))).toBe("cancelled");
    expect(passkeyFailure(named("NotAllowedError"))).toBe("cancelled");
    expect(passkeyFailure(named("AbortError"))).toBe("cancelled");
    expect(passkeyFailure(new DOMException("rp", "SecurityError"))).toBe("wrong-address");
    // A device that already holds a key of this account (excludeCredentials, plan 04-02).
    expect(passkeyFailure(named("InvalidStateError"))).toBe("already-here");
    expect(passkeyFailure(new TypeError("x"))).toBe("server");
    expect(passkeyFailure("odd")).toBe("server");
  });
});

describe("createPasskey", () => {
  it("passes the options as { optionsJSON } and answers the response", async () => {
    const { ceremonies, calls } = fake(async () => RESPONSE);
    expect(await createPasskey(OPTIONS, ceremonies)).toEqual({ ok: true, response: RESPONSE });
    expect(calls).toEqual([{ optionsJSON: OPTIONS }]);
  });

  it("a browser without WebAuthn: unsupported, and no ceremony", async () => {
    const { ceremonies, calls } = fake(async () => RESPONSE, false);
    expect(await createPasskey(OPTIONS, ceremonies)).toEqual({ ok: false, reason: "unsupported" });
    expect(calls).toEqual([]);
  });

  it("a cancelled dialog, a wrong address, anything else", async () => {
    for (const [error, reason] of [
      [new DOMException("no", "NotAllowedError"), "cancelled"],
      [new DOMException("rp", "SecurityError"), "wrong-address"],
      [new Error("boom"), "server"],
    ] as const) {
      const { ceremonies } = fake(async () => {
        throw error;
      });
      expect(await createPasskey(OPTIONS, ceremonies)).toEqual({ ok: false, reason });
    }
  });
});

// Plan 04-02: the assertion (login, step-up) behind the same seam.
describe("getPasskey", () => {
  const REQUEST = { challenge: "Y2hhbGxlbmdl", rpId: "localhost" };
  const ASSERTION = {
    id: "AAAA",
    rawId: "AAAA",
    type: "public-key" as const,
    response: { clientDataJSON: "e30", authenticatorData: "SZY", signature: "MEU" },
    clientExtensionResults: {},
  };

  function asserting(get: Ceremonies["authenticate"], supported = true) {
    const calls: unknown[] = [];
    const ceremonies: Ceremonies = {
      supported: () => supported,
      register: async () => {
        throw new Error("not this ceremony");
      },
      authenticate: async (options) => {
        calls.push(options);
        return get(options);
      },
    };
    return { ceremonies, calls };
  }

  it("passes the options as { optionsJSON } and answers the assertion", async () => {
    const { ceremonies, calls } = asserting(async () => ASSERTION);
    expect(await getPasskey(REQUEST, ceremonies)).toEqual({ ok: true, response: ASSERTION });
    expect(calls).toEqual([{ optionsJSON: REQUEST }]);
  });

  it("unsupported, cancelled, a wrong address, anything else", async () => {
    expect(await getPasskey(REQUEST, asserting(async () => ASSERTION, false).ceremonies)).toEqual({
      ok: false,
      reason: "unsupported",
    });
    for (const [error, reason] of [
      [new DOMException("no", "NotAllowedError"), "cancelled"],
      [new DOMException("rp", "SecurityError"), "wrong-address"],
      [new Error("boom"), "server"],
    ] as const) {
      const { ceremonies } = asserting(async () => {
        throw error;
      });
      expect(await getPasskey(REQUEST, ceremonies)).toEqual({ ok: false, reason });
    }
  });
});
