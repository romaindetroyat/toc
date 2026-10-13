import { expect, type Page, test } from "@playwright/test";

// A whole game against three computer players, played through the screen alone: only taps on cards,
// knights, chips and buttons, as a person would (success criterion 2 of phase 1). The deck and the bots
// are seeded (`graine`) and there is no think delay (`vitesse=test`), so the game is the same each time.
// The player's strategy is the plainest one: the first card that can be played, the first knight lit.

const SEED = "00c0ffee00c0ffee1234567890abcdef";

test.skip(({ isMobile }) => isMobile, "one long game, on the desktop project only");

type Snapshot = {
  end: boolean;
  seven: boolean;
  state: string | null;
  banner: string | null;
  dealer: string | null;
  handSize: number;
  playable: string[];
  halos: string[];
  tray: string[];
  modes: number;
  chips: number[];
  done: boolean;
  posedOnFelt: boolean;
};

/** What the screen shows right now, read in one round trip. */
function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate((): Snapshot => {
    const all = (selector: string) => [...document.querySelectorAll(selector)];
    const dealText = document.querySelector("[data-deal]")?.textContent ?? "";
    return {
      end: document.querySelector("[data-end-screen]") !== null,
      seven: document.querySelector("[data-seven-panel]") !== null,
      state: document.querySelector("[data-action-zone]")?.getAttribute("data-state") ?? null,
      banner: document.querySelector("[data-deal-banner]")?.textContent ?? null,
      dealer: /Donneur\s*:\s*(.+?)\s*·/.exec(dealText)?.[1] ?? null,
      handSize: all("[data-hand] [data-card]").length,
      playable: all('[data-hand] [data-card][data-state="playable"]').map(
        (card) => card.getAttribute("data-card") ?? "",
      ),
      halos: all("[data-halo]").map((halo) => halo.getAttribute("data-halo") ?? ""),
      tray: all("[data-tray-option]").map((chip) => chip.getAttribute("data-tray-option") ?? ""),
      modes: all("button[data-mode]").length,
      chips: all('[data-seven-chips] [data-step]:not([aria-disabled="true"])').map((chip) =>
        Number(chip.getAttribute("data-step")),
      ),
      done: document.querySelector("[data-remaining]")?.getAttribute("data-remaining") === "0",
      posedOnFelt: document.querySelector("[data-felt-posed]") !== null,
    };
  });
}

const tapKnight = (page: Page, pawn: string) =>
  page.locator(`[data-hit="${pawn}"]`).click({ force: true });

test("une partie entière contre trois ordinateurs, au doigt, jusqu’à l’écran de fin", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  await page.goto("/");
  await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);

  const dealSizes: number[] = [];
  const dealers = new Set<string>();
  const banners = new Set<string>();
  let posed = 0;
  let sevens = 0;
  let valets = 0;
  let plays = 0;

  for (let step = 0; step < 20_000; step++) {
    const s = await snapshot(page);
    if (s.end) break;
    if (s.banner !== null) banners.add(s.banner.replace(/\s+/g, " ").trim());
    if (s.posedOnFelt) posed = Math.max(posed, 1);

    if (s.seven) {
      // The 7, knight by knight: tap a lit knight, then the largest number of steps that is still allowed.
      if (s.done) {
        await page.getByRole("button", { name: "Jouer", exact: true }).click();
        sevens += 1;
        plays += 1;
      } else if (s.tray.length > 0) {
        await page.locator("[data-tray-option]").first().click();
      } else if (s.chips.length > 0) {
        await page.locator(`[data-seven-chips] [data-step="${Math.max(...s.chips)}"]`).click();
      } else if (s.halos.length > 0) {
        await tapKnight(page, s.halos[0] as string);
      } else {
        await page.waitForTimeout(20);
      }
      continue;
    }

    switch (s.state) {
      case "exchange": {
        dealSizes.push(s.handSize);
        if (s.dealer !== null) dealers.add(s.dealer);
        await page.locator("[data-hand] [data-card]").first().click();
        await page.getByRole("button", { name: "Passer cette carte" }).click();
        break;
      }
      case "deadHand":
        await page.getByRole("button", { name: "Poser mes cartes" }).click();
        posed += 1;
        break;
      case "idle":
      case "finishedPrompt": {
        const card = s.playable[0];
        if (card === undefined) {
          await page.waitForTimeout(20);
          break;
        }
        if (card.startsWith("11")) valets += 1;
        await page.locator(`[data-hand] [data-card="${card}"]`).click();
        break;
      }
      case "modeChoice":
        await page.locator("button[data-mode]").first().click();
        break;
      case "tray":
        await page.locator("[data-tray-option]").first().click();
        break;
      case "cardSelected":
      case "jackPick":
      case "jackTarget":
        if (s.halos.length > 0) await tapKnight(page, s.halos[0] as string);
        else await page.waitForTimeout(20);
        break;
      case "preview":
        await page.getByRole("button", { name: /^Jouer/ }).click();
        plays += 1;
        break;
      default:
        // The computer players are thinking or their moves are playing.
        await page.waitForTimeout(20);
    }
  }

  // The end screen is the only way out of the loop: « Victoire ! » or « Défaite ».
  const end = page.locator("[data-end-screen]");
  await expect(end).toBeVisible();
  await expect(end.getByRole("heading", { name: /^(Victoire !|Défaite)$/ })).toBeVisible();
  await expect(end.locator('[data-stat="deals"]')).toContainText(/Donnes jouées/);

  // Deals of 5, 4 then 4 cards, over and over.
  expect(dealSizes.slice(0, 4)).toEqual([5, 4, 4, 5]);
  for (const [i, size] of dealSizes.entries()) expect(size, `deal ${i + 1}`).toBe([5, 4, 4][i % 3]);
  // The dealer changes, the banner announces the deals.
  expect(dealers.size).toBeGreaterThanOrEqual(2);
  expect([...banners].some((text) => /Donne 1 sur 3\s*·\s*5 cartes/.test(text))).toBe(true);
  expect([...banners].some((text) => /Donne 2 sur 3\s*·\s*4 cartes/.test(text))).toBe(true);
  // A hand that could not be played was laid down at least once.
  expect(posed).toBeGreaterThanOrEqual(1);
  // The game was a real one.
  expect(plays).toBeGreaterThan(20);
  test.info().annotations.push({
    type: "partie",
    description: `${dealSizes.length} donnes, ${plays} coups, ${sevens} sept, ${valets} valets, ${posed} mains posées, donneurs ${[...dealers].join("/")}`,
  });
});
