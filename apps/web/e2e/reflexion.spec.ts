import { expect, type Page, test } from "@playwright/test";
import { exchange, playSimpleMove, untilOwnTurn } from "./jouer.ts";

// The thinking sign (D-12, 03-UI-SPEC « Thinking sign »): while a computer player thinks, its sign
// breathes discreetly; the giver it is in the exchange, its turn in the bar (computer) or the pill
// (phone). Never on the player's own turn. With reduced motion (the system's or the app's), nothing
// moves and a fixed « … » follows instead. The game runs at its natural pace so that the bots take
// their time.

const KEY = "toc.settings.v1";
const SEED = "1234567890abcdef1234567890abcdef";

/** What a breathing sign shows: its seat, its animation, whether its « … » is displayed. */
type Sign = {
  seat: string;
  animation: string;
  /** The animation of the name beside it (none in the pill, which shows no name). */
  text: string | null;
  mark: boolean | null;
  own: boolean;
};

/** The turn line of this project: the bottom bar's info zone (computer) or the pill (phone). */
function infoBar(project: string): string {
  return `[data-info-bar][data-form="${project === "phone" ? "pill" : "column"}"]`;
}

/** Opens the seeded game, with the stored settings given. */
async function open(page: Page, stored: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    KEY,
    JSON.stringify(stored),
  ] as const);
  await page.goto("/");
  await page.goto(`/#/partie?graine=${SEED}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

/**
 * Waits for a breathing element under `scope` and reads it in one go (a think is short): the thinking
 * seat, the animation's name and the display of its static « … » marker.
 */
async function sign(page: Page, scope: string): Promise<Sign> {
  const handle = await page.waitForFunction(
    (scope) => {
      const el = document.querySelector(`${scope} [data-thinking]`);
      if (el === null) return null;
      const holder = el.closest("li, .turn, .pill-turn") ?? el;
      const mark = holder.querySelector(".respire-mark");
      const text = holder.querySelector(".respire-texte");
      return {
        seat: el.getAttribute("data-thinking") ?? "",
        animation: getComputedStyle(el).animationName,
        text: text === null ? null : getComputedStyle(text).animationName,
        mark: mark === null ? null : getComputedStyle(mark).display !== "none",
        // The amber own-turn dot: lit only on the player's turn.
        own: holder.querySelector(".dot.own") !== null,
      };
    },
    scope,
    { timeout: 20_000, polling: "raf" },
  );
  return (await handle.jsonValue()) as Sign;
}

test("réflexion : dans l’échange, l’ordinateur qui choisit sa carte respire, sans « … »", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await open(page);
  await exchange(page);
  const giver = await sign(page, "[data-givers]");
  expect(giver.animation).toBe("respire");
  expect(giver.text).toBe("respire-texte");
  expect(giver.mark).toBe(false);
  // The breathing row is a computer player that has not chosen yet.
  await expect(page.locator(`[data-giver="${giver.seat}"]`)).toHaveAttribute("data-done", "false");
});

test("réflexion : au tour d’un ordinateur, la barre ou la pastille respire ; jamais au tien", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await open(page);
  // With this seed the player plays first after the exchange: his turn, nothing breathes anywhere.
  await untilOwnTurn(page);
  await expect(page.locator("[data-thinking]")).toHaveCount(0);
  await expect(page.locator(".respire-mark")).toHaveCount(0);

  // His move played, the computer players take their turns: the turn line breathes.
  await playSimpleMove(page);
  const turn = await sign(page, infoBar(testInfo.project.name));
  expect(turn.animation).toBe("respire");
  expect(turn.text).toBe(testInfo.project.name === "phone" ? null : "respire-texte");
  expect(turn.mark).toBe(false);
  expect(turn.own).toBe(false);

  // Back to the player: the sign has stopped.
  await untilOwnTurn(page);
  await expect(page.locator("[data-thinking]")).toHaveCount(0);
});

for (const [name, setup] of [
  [
    "le système demande moins d’animations",
    async (page: Page) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await open(page);
    },
  ],
  ["« Réduire les animations » est activé", (page: Page) => open(page, { reduceMotion: true })],
] as const) {
  test(`réflexion : quand ${name}, rien ne bouge et un « … » fixe suit le nom`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await setup(page);
    await exchange(page);

    const giver = await sign(page, "[data-givers]");
    expect(giver.animation).toBe("none");
    expect(giver.text).toBe("none");
    expect(giver.mark).toBe(true);

    await untilOwnTurn(page);
    await playSimpleMove(page);
    const turn = await sign(page, infoBar(testInfo.project.name));
    expect(turn.animation).toBe("none");
    expect(turn.mark).toBe(true);
  });
}
