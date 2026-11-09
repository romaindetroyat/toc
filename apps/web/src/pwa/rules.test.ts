import { describe, expect, it, vi } from "vitest";
import {
  appleCanInstall,
  applyOrReload,
  canPromptUpdate,
  INSTALL_HIDE_MS,
  inGameUpdateLine,
  installHiddenRecord,
  readInstallHidden,
  routeOf,
  type StripInput,
  stripFor,
} from "./rules.ts";

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

// Plan 04-08 Task 2: the home strip (04-UI-SPEC « Home strip »): at most one, offline > update >
// install; « Plus tard » on the install strip hides it 30 days (toc.install.v1).
describe("stripFor", () => {
  const NOW = Date.UTC(2026, 9, 18, 12);
  const base: StripInput = {
    online: true,
    apiReachable: true,
    needRefresh: false,
    updateDismissed: false,
    installable: false,
    appleMobile: false,
    standalone: false,
    installHiddenUntil: null,
    now: NOW,
  };

  it("shows nothing by default (computer Firefox, desktop Safari, nothing new)", () => {
    expect(stripFor(base)).toBeNull();
  });

  it("offline when the browser is offline or /api/me could not be reached", () => {
    expect(stripFor({ ...base, online: false })).toBe("offline");
    expect(stripFor({ ...base, apiReachable: false })).toBe("offline");
  });

  it("offline wins over an update and an install", () => {
    expect(
      stripFor({ ...base, online: false, needRefresh: true, installable: true, appleMobile: true }),
    ).toBe("offline");
  });

  it("update when a new version waits, unless « Plus tard » hid it", () => {
    expect(stripFor({ ...base, needRefresh: true })).toBe("update");
    expect(stripFor({ ...base, needRefresh: true, updateDismissed: true })).toBeNull();
  });

  it("update wins over an install", () => {
    expect(stripFor({ ...base, needRefresh: true, installable: true })).toBe("update");
    expect(stripFor({ ...base, needRefresh: true, updateDismissed: true, installable: true })).toBe(
      "install-prompt",
    );
  });

  it("install with the browser's prompt on Android and computer Chrome or Edge", () => {
    expect(stripFor({ ...base, installable: true })).toBe("install-prompt");
  });

  it("install with the steps on iPhone and iPad", () => {
    expect(stripFor({ ...base, appleMobile: true })).toBe("install-apple");
  });

  it("never an install strip in the installed app", () => {
    expect(stripFor({ ...base, installable: true, standalone: true })).toBeNull();
    expect(stripFor({ ...base, appleMobile: true, standalone: true })).toBeNull();
  });

  it("no install strip before installHiddenUntil, again after it", () => {
    const hidden = { ...base, appleMobile: true, installHiddenUntil: NOW + 1000 };
    expect(stripFor(hidden)).toBeNull();
    expect(stripFor({ ...hidden, now: NOW + 1000 })).toBe("install-apple");
  });

  it("the offline and update strips do not care about the install delay", () => {
    expect(stripFor({ ...base, needRefresh: true, installHiddenUntil: NOW + 1000 })).toBe("update");
  });
});

describe("toc.install.v1", () => {
  const NOW = Date.UTC(2026, 9, 18, 12);

  it("hides for 30 days", () => {
    expect(INSTALL_HIDE_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(JSON.parse(installHiddenRecord(NOW))).toEqual({ hiddenUntil: NOW + INSTALL_HIDE_MS });
  });

  it("reads back what it wrote", () => {
    expect(readInstallHidden(installHiddenRecord(NOW))).toBe(NOW + INSTALL_HIDE_MS);
  });

  it.each([
    null,
    "",
    "{pas du json",
    "[]",
    "null",
    '{"hiddenUntil":"demain"}',
    '{"hiddenUntil":-1}',
    '{"hiddenUntil":1e400}',
    '{"hiddenUntil":1.5}',
  ])("ignores a missing or damaged value: %s", (raw) => {
    expect(readInstallHidden(raw)).toBeNull();
  });
});

describe("appleCanInstall", () => {
  const SAFARI_15 =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1";
  const CHROME_16_3 =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
  const CHROME_16_4 =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
  const FIREFOX_17 =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15";
  const IPADOS_AS_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15";
  const ANDROID =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

  it("Safari on iPhone and iPad can add to the home screen, whatever its version", () => {
    expect(appleCanInstall(SAFARI_15, 5)).toBe(true);
    expect(appleCanInstall(IPADOS_AS_MAC, 5)).toBe(true);
  });

  it("another browser on iOS only from 16.4", () => {
    expect(appleCanInstall(CHROME_16_3, 5)).toBe(false);
    expect(appleCanInstall(CHROME_16_4, 5)).toBe(true);
    expect(appleCanInstall(FIREFOX_17, 5)).toBe(true);
  });

  it("never outside iPhone and iPad (desktop Safari: a Mac without touch)", () => {
    expect(appleCanInstall(ANDROID, 5)).toBe(false);
    expect(appleCanInstall(IPADOS_AS_MAC, 0)).toBe(false);
  });
});
