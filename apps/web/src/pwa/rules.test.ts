import { describe, expect, it, vi } from "vitest";
import { applyOrReload, canPromptUpdate, inGameUpdateLine, routeOf } from "./rules.ts";

// Where a new version may be offered (plan 04-08, APP-02, 04-UI-SPEC « Update »): on the home, « Mon
// compte », « Mes amis » and the solo setup; never in a game, at a table (waiting room included),
// during sign-up or recovery, or while the backup code is on screen. During a game « Réglages » says
// the version will install back on the home. The 4002 notice applies a waiting worker, else reloads.

describe("routeOf", () => {
  it("drops the query of a hash route", () => {
    expect(routeOf("#/partie?debug=geometry")).toBe("#/partie");
    expect(routeOf("#/table/abc?vitesse=test")).toBe("#/table/abc");
    expect(routeOf("")).toBe("");
  });
});

describe("canPromptUpdate", () => {
  it.each(["", "#", "#/", "#/compte", "#/amis", "#/ordinateur", "#/?x=1"])(
    "offers the update at %s",
    (hash) => {
      expect(canPromptUpdate({ hash })).toBe(true);
    },
  );

  it.each([
    "#/partie",
    "#/partie?graine=1",
    "#/table/AbCdEfGhIjKlMnOpQrStUv",
    "#/table/AbCdEfGhIjKlMnOpQrStUv?vitesse=test",
    "#/invitation/K7QM2XRA",
    "#/secours",
  ])("never at %s", (hash) => {
    expect(canPromptUpdate({ hash })).toBe(false);
  });

  it("never while the backup code is on screen, wherever it is", () => {
    expect(canPromptUpdate({ hash: "#/compte", backupCode: true })).toBe(false);
    expect(canPromptUpdate({ hash: "#/", backupCode: true })).toBe(false);
  });

  it("not on pages that are not listed (sound test, bench)", () => {
    expect(canPromptUpdate({ hash: "#/sons" })).toBe(false);
    expect(canPromptUpdate({ hash: "#/banc" })).toBe(false);
  });
});

describe("inGameUpdateLine", () => {
  it("is shown in a game and at any table", () => {
    expect(inGameUpdateLine({ hash: "#/partie" })).toBe(true);
    expect(inGameUpdateLine({ hash: "#/partie?graine=1" })).toBe(true);
    expect(inGameUpdateLine({ hash: "#/table/AbCdEfGhIjKlMnOpQrStUv" })).toBe(true);
  });

  it("is not shown where the strip can show, nor in the sign-up flows", () => {
    for (const hash of ["", "#/", "#/compte", "#/amis", "#/ordinateur", "#/invitation/x"]) {
      expect(inGameUpdateLine({ hash })).toBe(false);
    }
  });
});

describe("applyOrReload (the 4002 notice's « Recharger la page »)", () => {
  function deps(over: Partial<Parameters<typeof applyOrReload>[0]> = {}) {
    return {
      waiting: vi.fn(() => false),
      check: vi.fn(async () => false),
      apply: vi.fn(async () => {}),
      reload: vi.fn(),
      ...over,
    };
  }

  it("applies a worker that is already waiting, without checking again", async () => {
    const d = deps({ waiting: vi.fn(() => true) });
    expect(await applyOrReload(d)).toBe("applied");
    expect(d.apply).toHaveBeenCalledOnce();
    expect(d.check).not.toHaveBeenCalled();
    expect(d.reload).not.toHaveBeenCalled();
  });

  it("looks for a new version, then applies it when one is waiting", async () => {
    const d = deps({ check: vi.fn(async () => true) });
    expect(await applyOrReload(d)).toBe("applied");
    expect(d.check).toHaveBeenCalledOnce();
    expect(d.apply).toHaveBeenCalledOnce();
    expect(d.reload).not.toHaveBeenCalled();
  });

  it("reloads the page when no new worker comes", async () => {
    const d = deps();
    expect(await applyOrReload(d)).toBe("reloaded");
    expect(d.apply).not.toHaveBeenCalled();
    expect(d.reload).toHaveBeenCalledOnce();
  });

  it("reloads the page when the check fails (no service worker, offline)", async () => {
    const d = deps({
      check: vi.fn(async () => {
        throw new Error("blocked");
      }),
    });
    expect(await applyOrReload(d)).toBe("reloaded");
    expect(d.reload).toHaveBeenCalledOnce();
  });
});
