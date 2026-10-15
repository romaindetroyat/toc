import { expect, type Page, test } from "@playwright/test";

type Rendered = Record<string, { duration: number; peak: number }>;
type TocWindow = Window & { __tocDebug?: { audio: { sounds?: Rendered } } };

// Every synthesized Phase 1 sound renders to a non-silent buffer in a real browser (no listening
// here: whether it sounds like a horse is Romain's call on the sound test page).
test("audio: tous les sons synthétisés sont rendus, audibles et de la bonne durée", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer la partie" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-audio", "running");
  await expect
    .poll(() =>
      page.evaluate(() => Object.keys((window as TocWindow).__tocDebug?.audio.sounds ?? {}).length),
    )
    .toBe(12); // 3 hoof variants + 6 neighs + 3 card sounds; no ambience since 2026-10-14
  const sounds = await page.evaluate(() => (window as TocWindow).__tocDebug?.audio.sounds ?? {});

  for (const [key, { peak }] of Object.entries(sounds)) {
    expect(peak, key).toBeGreaterThan(0.05);
    expect(peak, key).toBeLessThanOrEqual(1);
  }
  const seconds = (key: string) => sounds[key]?.duration ?? 0;
  expect(seconds("neigh-sortie#0")).toBeCloseTo(1.15, 1);
  expect(seconds("neigh-surpris#0")).toBeLessThan(0.5);
  expect(seconds("neigh-ruade#0")).toBeLessThan(0.4);
  expect(seconds("neigh-fete#0")).toBeGreaterThan(seconds("neigh-joyeux#0"));
  expect(seconds("card-donne#0")).toBeGreaterThan(seconds("card-pose#0"));
  expect(Object.keys(sounds).filter((key) => key.startsWith("ambience"))).toEqual([]);
});

// A reload or a PWA relaunch lands on #/partie without the launch screen's « Jouer la partie » tap:
// the first gesture on the game screen creates and resumes the audio.
test("audio: une partie ouverte directement démarre le son au premier geste", async ({ page }) => {
  await page.goto("/#/partie?vitesse=test");
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(page.locator("body")).not.toHaveAttribute("data-audio", /.*/);
  await page.locator("[data-board]").click({ position: { x: 4, y: 4 } });
  await expect(page.locator("body")).toHaveAttribute("data-audio", "running");
});

// --- Le son en mode silencieux (recette 3 de Romain, 2026-10-15, test 23) ---
// « Les sons ne fonctionnent pas sur iphone en mode silencieux ». The first gesture sets the audio
// session to « playback » before it creates the AudioContext and, on an iPhone or iPad, starts a
// silent looping <audio> element that keeps the page in the playback category (the ringer switch
// does not mute it). The phone project's user agent is an iPhone's; the desktop project's is not.
// Whether the iPhone really sounds with its switch on silent is Romain's check on his own phone.

type KeepAliveWindow = Window & {
  __tocAudioOrder?: string[];
  __tocDebug?: {
    audio: { keepAlive?: { exists: boolean; playing: boolean }; audioSessionType?: string };
  };
};

/** Gives the page an Audio Session API when it has none, and records its type at each AudioContext. */
async function watchAudioSession(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as KeepAliveWindow & { AudioContext: typeof AudioContext };
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (!nav.audioSession) {
      Object.defineProperty(navigator, "audioSession", {
        configurable: true,
        value: { type: "auto" },
      });
    }
    w.__tocAudioOrder = [];
    const Original = w.AudioContext;
    w.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        w.__tocAudioOrder?.push(nav.audioSession?.type ?? "none");
        super(options);
      }
    };
  });
}

const keepAlive = (page: Page) => page.locator("audio[data-audio-keepalive]");
const keepAlivePlaying = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector<HTMLAudioElement>("audio[data-audio-keepalive]");
    return el ? !el.paused : false;
  });

async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (value ? "hidden" : "visible"),
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

test("audio: « Jouer la partie » met la session en lecture avant le son, et le son muet ne joue que sur iPhone", async ({
  page,
}, testInfo) => {
  await watchAudioSession(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Jouer la partie" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-audio", "running");
  // The AudioContext was created once, with the session already in playback.
  expect(await page.evaluate(() => (window as KeepAliveWindow).__tocAudioOrder)).toEqual([
    "playback",
  ]);
  const debug = () => page.evaluate(() => (window as KeepAliveWindow).__tocDebug?.audio);
  expect((await debug())?.audioSessionType).toBe("playback");

  if (testInfo.project.name === "phone") {
    await expect(keepAlive(page)).toHaveCount(1);
    const element = await keepAlive(page).evaluate((el: HTMLAudioElement) => ({
      loop: el.loop,
      src: el.src,
      controls: el.controls,
      remote: el.disableRemotePlayback,
      airplay: el.getAttribute("x-webkit-airplay"),
      inline: el.hasAttribute("playsinline"),
      visible: el.checkVisibility(),
    }));
    expect(element).toMatchObject({
      loop: true,
      controls: false,
      remote: true,
      airplay: "deny",
      inline: true,
      visible: false,
    });
    expect(element.src).toMatch(/^data:audio\/wav;base64,UklGR/); // « RIFF »
    await expect.poll(() => keepAlivePlaying(page)).toBe(true);
    await expect
      .poll(async () => (await debug())?.keepAlive)
      .toEqual({
        exists: true,
        playing: true,
      });
  } else {
    await expect(keepAlive(page)).toHaveCount(0);
    expect((await debug())?.keepAlive).toEqual({ exists: false, playing: false });
  }
});

test("audio: une partie ouverte directement lance aussi le son muet au premier geste", async ({
  page,
}, testInfo) => {
  await watchAudioSession(page);
  await page.goto("/#/partie?vitesse=test");
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(keepAlive(page)).toHaveCount(0);
  await page.locator("[data-board]").click({ position: { x: 4, y: 4 } });
  await expect(page.locator("body")).toHaveAttribute("data-audio", "running");
  expect(await page.evaluate(() => (window as KeepAliveWindow).__tocAudioOrder)).toEqual([
    "playback",
  ]);
  if (testInfo.project.name === "phone") {
    await expect.poll(() => keepAlivePlaying(page)).toBe(true);
  } else {
    await expect(keepAlive(page)).toHaveCount(0);
  }
});

test.describe("le son muet de l’iPhone", () => {
  test.skip(({ isMobile }) => !isMobile, "only an iPhone or iPad gets the silent element");

  test("audio: la page cachée met le son muet en pause, et il ne reprend qu’au toucher suivant", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Jouer la partie" }).click();
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expect.poll(() => keepAlivePlaying(page)).toBe(true);

    await setHidden(page, true);
    await expect.poll(() => keepAlivePlaying(page)).toBe(false);
    // Back on screen it stays quiet until the player touches the page.
    await setHidden(page, false);
    await page.waitForTimeout(200);
    expect(await keepAlivePlaying(page)).toBe(false);
    await page.locator("[data-board]").click({ position: { x: 4, y: 4 } });
    await expect.poll(() => keepAlivePlaying(page)).toBe(true);
  });

  test("audio: « Son » coupé dans les réglages met le son muet en pause", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Jouer la partie" }).click();
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expect.poll(() => keepAlivePlaying(page)).toBe(true);

    await page.getByRole("button", { name: "Réglages", exact: true }).click();
    const son = page.getByRole("switch", { name: "Son", exact: true });
    await son.click();
    await expect(son).toHaveAttribute("aria-checked", "false");
    await expect.poll(() => keepAlivePlaying(page)).toBe(false);
    // A tap elsewhere does not restart it while « Son » is off.
    await page.getByRole("dialog", { name: "Réglages" }).click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(200);
    expect(await keepAlivePlaying(page)).toBe(false);
    // « Son » back on (a tap): it plays again.
    await son.click();
    await expect(son).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => keepAlivePlaying(page)).toBe(true);
  });
});
