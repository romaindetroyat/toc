import { expect, type Page, test } from "@playwright/test";
import { exchange, playSimpleMove, untilOwnTurn, zone } from "./jouer.ts";
import { etatParam } from "./position.ts";

// « Réglages » (plan 01-23): opened from the launch screen and from the gear of the game, switches
// for « Son », « Bruitages », « Ambiance » (with its volume) and « Réduire les animations », all applied
// at once and kept in toc.settings.v1. The bus gains and the ambience request are read through
// window.__tocDebug.audio (debug builds only).

type Gains = { master: number; sfx: number; ambience: number };
type TocWindow = Window & {
  __tocDebug?: { audio: { gains?: Gains; ambience?: "on" | "paused" | "off" } };
  __anims: { pawn: string | null; role: string; duration: number }[];
};

const KEY = "toc.settings.v1";
const NBSP = " ";
const SEED = "1234567890abcdef1234567890abcdef";

const dialog = (page: Page, name: string) => page.getByRole("dialog", { name });
const sw = (page: Page, name: string) => page.getByRole("switch", { name, exact: true });
const gains = (page: Page) =>
  page.evaluate(() => (window as unknown as TocWindow).__tocDebug?.audio.gains);
const ambience = (page: Page) =>
  page.evaluate(() => (window as unknown as TocWindow).__tocDebug?.audio.ambience);
const stored = async (page: Page) =>
  JSON.parse((await page.evaluate((key) => localStorage.getItem(key), KEY)) ?? "{}");

async function openFromLaunch(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  await expect(dialog(page, "Réglages")).toBeVisible();
}

async function openGame(page: Page, query = `graine=${SEED}&vitesse=test`) {
  await page.goto("/");
  await page.goto(`/#/partie?${query}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

async function openFromGame(page: Page) {
  await page.getByRole("button", { name: "Réglages", exact: true }).click();
  await expect(dialog(page, "Réglages")).toBeVisible();
}

test.describe("depuis l’écran de lancement", () => {
  test("réglages: la feuille propose les cinq réglages, aux valeurs par défaut", async ({
    page,
  }) => {
    await openFromLaunch(page);
    const sheet = dialog(page, "Réglages");
    for (const name of ["Son", "Bruitages", "Ambiance"]) {
      await expect(sw(page, name)).toHaveAttribute("aria-checked", "true");
    }
    await expect(sw(page, "Réduire les animations")).toHaveAttribute("aria-checked", "false");
    const volume = page.getByRole("slider", { name: "Volume de l’ambiance" });
    await expect(volume).toHaveValue("30");
    await expect(volume).toHaveAttribute("aria-valuetext", `30${NBSP}%`);
    await expect(sheet.getByText("Pas de son sur iPhone")).toBeVisible();
    await expect(
      sheet.getByText("Les déplacements sont instantanés, sans bonds, ruades ni effets."),
    ).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Tester les sons" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Crédits et licences" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Fermer" })).toBeVisible();

    // Every control is a touch target of at least 44 px (a hundredth of slack for the slide-in transform).
    for (const target of [
      sw(page, "Son"),
      sw(page, "Bruitages"),
      sw(page, "Ambiance"),
      sw(page, "Réduire les animations"),
      volume,
    ]) {
      const box = await target.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(43.99);
      expect(box?.width).toBeGreaterThanOrEqual(43.99);
    }
  });

  test("réglages: chaque réglage change aussitôt, est gardé et revient après rechargement", async ({
    page,
  }) => {
    await openFromLaunch(page);
    await sw(page, "Son").click();
    await sw(page, "Bruitages").click();
    await sw(page, "Ambiance").click();
    await sw(page, "Réduire les animations").click();
    await expect(sw(page, "Son")).toHaveAttribute("aria-checked", "false");
    await expect(sw(page, "Bruitages")).toHaveAttribute("aria-checked", "false");
    await expect(sw(page, "Ambiance")).toHaveAttribute("aria-checked", "false");
    await expect(sw(page, "Réduire les animations")).toHaveAttribute("aria-checked", "true");
    // « Ambiance » off: the volume is disabled but still there.
    const volume = page.getByRole("slider", { name: "Volume de l’ambiance" });
    await expect(volume).toBeDisabled();
    await expect(volume).toBeVisible();

    await sw(page, "Ambiance").click();
    await expect(volume).toBeEnabled();
    await volume.fill("65");
    await expect(volume).toHaveAttribute("aria-valuetext", `65${NBSP}%`);

    expect(await stored(page)).toMatchObject({
      sound: false,
      sfx: false,
      ambience: true,
      ambienceVolume: 65,
      reduceMotion: true,
    });

    await page.reload();
    await page.getByRole("button", { name: "Réglages", exact: true }).click();
    await expect(sw(page, "Son")).toHaveAttribute("aria-checked", "false");
    await expect(sw(page, "Bruitages")).toHaveAttribute("aria-checked", "false");
    await expect(sw(page, "Ambiance")).toHaveAttribute("aria-checked", "true");
    await expect(sw(page, "Réduire les animations")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("slider", { name: "Volume de l’ambiance" })).toHaveValue("65");
  });

  test("réglages: « Son » coupe tout, « Bruitages » les effets, « Ambiance » et son volume l’ambiance", async ({
    page,
  }) => {
    await openFromLaunch(page);
    await expect.poll(() => gains(page)).toEqual({ master: 1, sfx: 1, ambience: 0.3 });

    await sw(page, "Son").click();
    await expect.poll(() => gains(page)).toEqual({ master: 0, sfx: 1, ambience: 0.3 });
    // « Son » off dims the other two switches and the volume, which stay usable.
    await expect(page.locator("[data-settings] .row.dimmed")).toHaveCount(2);
    await expect(page.locator("[data-settings] .slider.dimmed")).toHaveCount(1);
    await sw(page, "Son").click();
    await expect(page.locator("[data-settings] .dimmed")).toHaveCount(0);

    await sw(page, "Bruitages").click();
    await expect.poll(() => gains(page)).toEqual({ master: 1, sfx: 0, ambience: 0.3 });
    await sw(page, "Bruitages").click();

    await page.getByRole("slider", { name: "Volume de l’ambiance" }).fill("80");
    await expect.poll(() => gains(page)).toEqual({ master: 1, sfx: 1, ambience: 0.8 });

    await sw(page, "Ambiance").click();
    await expect.poll(() => gains(page)).toEqual({ master: 1, sfx: 1, ambience: 0 });
    await expect(page.getByRole("slider", { name: "Volume de l’ambiance" })).toBeDisabled();
    await expect(page.locator("[data-settings] .slider.dimmed")).toHaveCount(1);
  });

  test("réglages: « Tester les sons » ouvre la page de test des sons", async ({ page }) => {
    await openFromLaunch(page);
    await dialog(page, "Réglages").getByRole("link", { name: "Tester les sons" }).click();
    await expect(page).toHaveURL(/#\/sons$/);
    await expect(page.getByRole("heading", { name: "Test des sons", level: 1 })).toBeVisible();
  });

  test("réglages: « Crédits et licences » ouvre les crédits, Échap les ferme un par un", async ({
    page,
  }) => {
    await openFromLaunch(page);
    const credits = page.getByRole("button", { name: "Crédits et licences" });
    await credits.click();
    await expect(dialog(page, "Crédits et licences")).toBeVisible();

    // The first Échap closes the credits only; the focus goes back to the button that opened them.
    await page.keyboard.press("Escape");
    await expect(dialog(page, "Crédits et licences")).toHaveCount(0);
    await expect(dialog(page, "Réglages")).toBeVisible();
    await expect(credits).toBeFocused();

    // The second one closes « Réglages » and the focus goes back to the launch button.
    await page.keyboard.press("Escape");
    await expect(dialog(page, "Réglages")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Réglages", exact: true })).toBeFocused();
  });

  test("réglages: « Fermer » ferme la feuille", async ({ page }) => {
    await openFromLaunch(page);
    await dialog(page, "Réglages").getByRole("button", { name: "Fermer" }).click();
    await expect(dialog(page, "Réglages")).toHaveCount(0);
  });
});

test.describe("« Réduire les animations » suit la préférence du système, puis le choix du joueur", () => {
  test.use({ reducedMotion: "reduce" });

  test("réglages: allumé au départ, et le choix du joueur l’emporte ensuite", async ({ page }) => {
    await openFromLaunch(page);
    await expect(sw(page, "Réduire les animations")).toHaveAttribute("aria-checked", "true");
    await sw(page, "Réduire les animations").click();
    await expect(sw(page, "Réduire les animations")).toHaveAttribute("aria-checked", "false");
    await page.reload();
    await page.getByRole("button", { name: "Réglages", exact: true }).click();
    await expect(sw(page, "Réduire les animations")).toHaveAttribute("aria-checked", "false");
  });
});

test.describe("en pleine partie", () => {
  test("réglages: la roue dentée de la barre d’info (44 x 44) ouvre la même feuille", async ({
    page,
  }) => {
    await openGame(page);
    const gear = page.locator("[data-info-bar]").getByRole("button", { name: "Réglages" });
    const box = await gear.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await gear.click();
    await expect(dialog(page, "Réglages")).toBeVisible();
    await expect(sw(page, "Son")).toHaveAttribute("aria-checked", "true");

    // Échap closes the sheet, and the focus comes back to the gear.
    await page.keyboard.press("Escape");
    await expect(dialog(page, "Réglages")).toHaveCount(0);
    await expect(gear).toBeFocused();
  });

  test("réglages: « Son » coupé en partie met aussitôt le bus principal à zéro", async ({
    page,
  }) => {
    await openGame(page);
    await expect.poll(() => gains(page)).toEqual({ master: 1, sfx: 1, ambience: 0.3 });
    await openFromGame(page);
    await sw(page, "Son").click();
    await expect.poll(() => gains(page)).toMatchObject({ master: 0 });
    await sw(page, "Bruitages").click();
    await expect.poll(() => gains(page)).toMatchObject({ master: 0, sfx: 0 });
    await sw(page, "Son").click();
    await expect.poll(() => gains(page)).toMatchObject({ master: 1, sfx: 0 });
  });

  test("réglages: l’ambiance démarre dans la partie, se met en pause avec la page et s’arrête quand on la coupe", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Jouer la partie" }).click();
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expect(page.locator("body")).toHaveAttribute("data-audio", "running");
    await expect.poll(() => ambience(page)).toBe("on");

    // The page goes to the background: the ambience pauses; it comes back with the page.
    const hide = (hidden: boolean) =>
      page.evaluate((value) => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
        document.dispatchEvent(new Event("visibilitychange"));
      }, hidden);
    await hide(true);
    await expect.poll(() => ambience(page)).toBe("paused");
    await hide(false);
    await expect.poll(() => ambience(page)).toBe("on");

    // « Ambiance » off stops it for good, « Ambiance » on starts it again.
    await openFromGame(page);
    await sw(page, "Ambiance").click();
    await expect.poll(() => ambience(page)).toBe("off");
    await hide(true);
    await hide(false);
    await expect.poll(() => ambience(page)).toBe("off");
    await sw(page, "Ambiance").click();
    await expect.poll(() => ambience(page)).toBe("on");

    // « Son » off stops it as well.
    await sw(page, "Son").click();
    await expect.poll(() => ambience(page)).toBe("off");
  });

  test("réglages: « Réduire les animations » fait du coup suivant un seul glissement de 180 ms", async ({
    page,
  }) => {
    // Records every Web Animation on a knight (inner group role and duration) from page load.
    await page.addInitScript(() => {
      const w = window as unknown as TocWindow;
      w.__anims = [];
      const known = new Set<Animation>();
      const tick = () => {
        for (const animation of document.getAnimations()) {
          if (known.has(animation) || animation.startTime === null) continue;
          const target = animation.effect && (animation.effect as KeyframeEffect).target;
          if (!(target instanceof Element)) continue;
          const owner = target.closest("[data-pawn]");
          if (owner === null) continue;
          known.add(animation);
          w.__anims.push({
            pawn: owner.getAttribute("data-pawn"),
            role: target.getAttribute("data-role") ?? "",
            duration: Number(animation.effect?.getTiming().duration),
          });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const etat = {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
      hands: { bleu: ["12H"] },
    };
    await openGame(page, `etat=${etatParam(etat)}`);
    await expect(page.locator("[data-action-zone]")).toHaveAttribute("data-state", "idle");

    await openFromGame(page);
    await sw(page, "Réduire les animations").click();
    await expect(sw(page, "Réduire les animations")).toHaveAttribute("aria-checked", "true");
    await dialog(page, "Réglages").getByRole("button", { name: "Fermer" }).click();
    await expect(dialog(page, "Réglages")).toHaveCount(0);

    await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
    await page.locator('[data-hit="bleu0"]').click({ force: true });
    await page.getByRole("button", { name: "Jouer", exact: true }).click();

    await expect(page.locator('[data-pawn="bleu0"]')).toHaveAttribute("data-place", "ring:22", {
      timeout: 15_000,
    });
    const moves = await page.evaluate(() =>
      (window as unknown as TocWindow).__anims.filter((a) => a.pawn === "bleu0"),
    );
    expect(moves.filter((a) => a.role === "mover").map((a) => a.duration)).toEqual([180]);
    expect(moves.filter((a) => a.role === "arc" || a.role === "squash")).toHaveLength(0);
  });
});

test.describe("abandonner la partie", () => {
  const confirm = (page: Page) => dialog(page, "Abandonner la partie ?");
  const abandonLink = (page: Page) =>
    dialog(page, "Réglages").getByRole("button", { name: "Abandonner la partie" });

  test("réglages: « Abandonner la partie » n’existe qu’en partie, pas sur l’écran de lancement", async ({
    page,
  }) => {
    await openFromLaunch(page);
    await expect(dialog(page, "Réglages").getByRole("button", { name: "Abandonner" })).toHaveCount(
      0,
    );
    await openGame(page);
    await openFromGame(page);
    await expect(abandonLink(page)).toBeVisible();
  });

  test("abandon: la confirmation garde « Continuer à jouer » au focus, Échap et le fond ne quittent pas", async ({
    page,
  }) => {
    await openGame(page);
    await openFromGame(page);
    await abandonLink(page).click();

    await expect(confirm(page)).toBeVisible();
    await expect(confirm(page)).toContainText(
      "La partie en cours sera perdue. Tu ne pourras pas la reprendre.",
    );
    const keep = confirm(page).getByRole("button", { name: "Continuer à jouer" });
    await expect(keep).toBeFocused();
    await expect(confirm(page).getByRole("button", { name: "Abandonner la partie" })).toBeVisible();

    // A tap outside the dialog does not close it.
    await page.mouse.click(4, 4);
    await expect(confirm(page)).toBeVisible();

    // Échap keeps the game: only the confirmation closes, the focus goes back to the text button.
    await page.keyboard.press("Escape");
    await expect(confirm(page)).toHaveCount(0);
    await expect(dialog(page, "Réglages")).toBeVisible();
    await expect(abandonLink(page)).toBeFocused();
    await expect(page).toHaveURL(/#\/partie/);

    // « Continuer à jouer » keeps it as well.
    await abandonLink(page).click();
    await confirm(page).getByRole("button", { name: "Continuer à jouer" }).click();
    await expect(confirm(page)).toHaveCount(0);
    await expect(page).toHaveURL(/#\/partie/);
    await expect(page.locator("[data-board]")).toBeVisible();
  });

  test("abandon: confirmer ramène à l’écran de lancement", async ({ page }) => {
    await openGame(page);
    await openFromGame(page);
    await abandonLink(page).click();
    await confirm(page).getByRole("button", { name: "Abandonner la partie" }).click();

    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole("button", { name: "Jouer la partie" })).toBeVisible();
    await expect(page.locator("[data-board]")).toHaveCount(0);
    await expect(page.locator("[data-sheet-layer]")).toHaveCount(0);
    // The two stacked sheets (Réglages, then the confirmation) give the page its scroll back.
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  test("réglages en partie: « Tester les sons » demande d’abord d’abandonner la partie", async ({
    page,
  }) => {
    await openGame(page);
    await openFromGame(page);
    const sounds = dialog(page, "Réglages").getByRole("link", { name: "Tester les sons" });
    await sounds.click();

    // The same destructive confirmation as « Abandonner la partie »; keeping the game stays in it.
    await expect(confirm(page)).toBeVisible();
    await expect(confirm(page)).toContainText("La partie en cours sera perdue.");
    await expect(page).toHaveURL(/#\/partie/);
    await confirm(page).getByRole("button", { name: "Continuer à jouer" }).click();
    await expect(confirm(page)).toHaveCount(0);
    await expect(sounds).toBeFocused();
    await expect(page).toHaveURL(/#\/partie/);

    // Confirmed: the game is given up and the sound test opens.
    await sounds.click();
    await confirm(page).getByRole("button", { name: "Abandonner la partie" }).click();
    await expect(page).toHaveURL(/#\/sons$/);
    await expect(page.getByRole("heading", { name: "Test des sons", level: 1 })).toBeVisible();
    await expect(page.locator("[data-board]")).toHaveCount(0);
  });
});

test.describe("le son ne démarre pas", () => {
  const toast = (page: Page) => page.locator("[data-toast]");

  test("son: le message et « Réessayer » apparaissent, la partie se joue jusqu’au bout du tour sans son", async ({
    page,
  }) => {
    // A browser that cannot create an AudioContext (or refuses to).
    await page.addInitScript(() => {
      const refuse = function refuse() {
        throw new Error("AudioContext indisponible");
      };
      Object.assign(window, { AudioContext: refuse, webkitAudioContext: refuse });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Jouer la partie" }).click();
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);

    await expect(toast(page)).toContainText(
      "Le son n’a pas pu démarrer. La partie reste jouable sans son.",
    );
    await expect(toast(page).getByRole("button", { name: "Réessayer" })).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute("data-audio", "none");

    // « Réessayer » asks again; the browser still refuses, so the message comes back.
    await toast(page).getByRole("button", { name: "Réessayer" }).click();
    await expect(toast(page)).toContainText("Le son n’a pas pu démarrer.");

    // The game goes on without sound: an exchange, then a move, from a seeded game in test speed.
    await page.evaluate((seed) => {
      location.hash = "#/";
      setTimeout(() => {
        location.hash = `#/partie?graine=${seed}&vitesse=test`;
      }, 0);
    }, SEED);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expect(zone(page)).toHaveAttribute("data-state", "exchange");
    await exchange(page);
    await untilOwnTurn(page);
    await playSimpleMove(page);
    await expect(page.locator("body")).toHaveAttribute("data-audio", "none");
  });
});

test.describe("un problème inattendu", () => {
  test("erreur: l’écran amical ne montre ni texte d’erreur ni trace, « Recharger la page » repart de zéro", async ({
    page,
  }) => {
    const logged: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") logged.push(message.text());
    });
    await page.goto("/");
    await page.goto("/#/panne");

    const screen = page.locator("[data-error-screen]");
    await expect(
      screen.getByRole("heading", { name: "Oups, le jeu a rencontré un problème." }),
    ).toBeVisible();
    await expect(screen).toContainText(
      "Recharge la page pour repartir. La partie en cours sera perdue.",
    );
    await expect(screen).not.toContainText("panne de test");
    await expect(screen).not.toContainText("Error");

    await screen.getByRole("button", { name: "Recharger la page" }).click();
    await expect(page.getByRole("button", { name: "Jouer la partie" })).toBeVisible();
    await expect(page).toHaveURL(/#\/$/);
    expect(logged.length).toBeGreaterThan(0);
  });
});
