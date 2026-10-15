import { expect, type Page } from "@playwright/test";

// Shared helpers of the specs that play through the screen alone: only taps on cards, knights, chips
// and buttons, as a person would.

export const zone = (page: Page) => page.locator("[data-action-zone]");

/** Chooses the first card of the hand and passes it to the partner. */
export async function exchange(page: Page) {
  await expect(zone(page)).toHaveAttribute("data-state", "exchange");
  await page.locator("[data-hand] [data-card]").first().click();
  await page.getByRole("button", { name: "Passer cette carte" }).click();
}

/**
 * Plays the game forward until it is the player's turn with a card he can play: the exchange of every
 * deal is made with the first card, a dead hand is posed. The bots play by themselves.
 */
export async function untilOwnTurn(page: Page) {
  for (let i = 0; i < 300; i++) {
    const state = await zone(page).getAttribute("data-state");
    if (state === "idle" || state === "finishedPrompt") return;
    if (state === "exchange") await exchange(page);
    else if (state === "deadHand")
      await page.getByRole("button", { name: "Poser mes cartes" }).click();
    else await page.waitForTimeout(50);
  }
  throw new Error("the player's turn never came");
}

/**
 * After a simple card is tapped: the knight it moves. Several lit knights wait for a tap on the first
 * one; a card that only one knight can play shows its preview by itself (recette 3, test 27).
 * Returns the knight of the preview, marked as the chosen one.
 */
export async function chooseKnight(page: Page, onLit?: () => Promise<void>): Promise<string> {
  await expect(zone(page)).toHaveAttribute("data-state", /^(cardSelected|preview)$/);
  if ((await zone(page).getAttribute("data-state")) === "cardSelected") {
    if (onLit) await onLit();
    const halo = page.locator("[data-halo]").first();
    await expect(halo).toBeVisible();
    const lit = await halo.getAttribute("data-halo");
    await page.locator(`[data-hit="${lit}"]`).click({ force: true });
  }
  const chosen = page.locator("[data-selected]").first();
  await expect(chosen).toBeVisible();
  return (await chosen.getAttribute("data-selected")) ?? "";
}

/** Plays one simple card: a card that moves a knight (not the 7 nor the Valet), its knight, « Jouer ». */
export async function playSimpleMove(page: Page) {
  const card = page
    .locator('[data-hand] [data-state="playable"]:not([data-card^="7"]):not([data-card^="11"])')
    .first();
  await expect(card).toBeVisible();
  await card.click();
  const pawn = await chooseKnight(page);
  const before = await page.locator(`[data-pawn="${pawn}"]`).getAttribute("data-place");
  await page.getByRole("button", { name: /^Jouer/ }).click();
  await expect(page.locator(`[data-pawn="${pawn}"]`)).not.toHaveAttribute(
    "data-place",
    before ?? "",
  );
}

// --- A whole game, played through the screen alone ---

export type Snapshot = {
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
export function snapshot(page: Page): Promise<Snapshot> {
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

export type GameStats = {
  dealSizes: number[];
  dealers: Set<string>;
  banners: Set<string>;
  posed: number;
  sevens: number;
  valets: number;
  plays: number;
};

/**
 * Plays the game on screen until its end screen shows: the exchange with the first card, a dead hand
 * posed, the first card that can be played, the first knight lit, the most steps of a 7. The computer
 * players play by themselves.
 */
export async function playToEnd(page: Page): Promise<GameStats> {
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

  return { dealSizes, dealers, banners, posed, sevens, valets, plays };
}
