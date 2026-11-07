import { expect, type Page, test } from "@playwright/test";
import { zone } from "../e2e/jouer.ts";
import { createTable, join, playOneMove, seatTile, tablePicture } from "./online.ts";

// « Règles du TOC » at an online table (plan 05-04, 05-UI-SPEC « Where it opens »): the game goes on
// while the person reads (the computers play behind the sheet); when the person's turn comes the
// sheet says « C’est à toi de jouer. » once, in a polite live region, and never closes by itself;
// « Revenir à la partie » closes it and the hand is playable.

// Bleu plays first with the Dame; each computer holds one card that moves its knight.
const POSITION = {
  pawns: {
    bleu: [{ p: 10 }, "S", "S", "S"],
    jaune: [{ p: 10 }, "S", "S", "S"],
    rouge: [{ p: 10 }, "S", "S", "S"],
    vert: [{ p: 10 }, "S", "S", "S"],
  },
  hands: { bleu: ["12H", "3S"], jaune: ["5S"], rouge: ["6S"], vert: ["8S"] },
  turn: "bleu",
};

const sheet = (page: Page) => page.getByRole("dialog", { name: "Règles du TOC" });
const book = (page: Page) => page.getByRole("button", { name: "Règles du jeu" });

test("en ligne, la partie continue derrière les règles et la feuille dit « C’est à toi de jouer »", async ({
  page,
  request,
  isMobile,
}) => {
  test.setTimeout(120_000);
  const id = await createTable(request, {
    pace: "normal",
    levels: { jaune: 1, rouge: 1, vert: 1 },
    before: POSITION,
  });
  await join(page, id, "Ana");
  await seatTile(page, "bleu").click();
  await expect(seatTile(page, "bleu")).toHaveAttribute("data-seat-state", "you");
  await page.getByRole("button", { name: "Lancer la partie" }).click();
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(zone(page)).toHaveAttribute("data-state", "idle", { timeout: 20_000 });

  // The book is there online too: in the strip under the gear, or first in the computer's row
  // before « À la table » and « Messages ».
  await expect(book(page)).toBeVisible();
  if (!isMobile) {
    const row = await page
      .locator("[data-table-row-buttons] button")
      .evaluateAll((all) => all.map((each) => each.getAttribute("aria-label")));
    expect(row[0]).toBe("Règles du jeu");
    expect(row.length).toBe(3);
  }

  await page.locator('[data-hand] [data-card="12H"]').click();
  await expect(zone(page)).toHaveAttribute("data-state", "preview");
  const jaune = page.locator('[data-board] [data-pawn="jaune0"]');
  const before = await jaune.getAttribute("data-place");
  // Ana plays and opens the rules in the same instant: the computers are due.
  await page.evaluate(() => {
    const play = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      /^Jouer/.test(button.textContent?.trim() ?? ""),
    );
    if (play === undefined) throw new Error("no « Jouer » button");
    play.click();
    (document.querySelector("[data-rules-button]") as HTMLButtonElement).click();
  });
  await expect(sheet(page)).toBeVisible();

  // The game goes on behind the sheet.
  await expect(jaune).not.toHaveAttribute("data-place", before ?? "", { timeout: 30_000 });

  // Ana's turn comes back: the line, announced once, and the sheet stays open.
  const line = sheet(page).locator("[data-rules-turn]");
  await expect(line).toBeVisible({ timeout: 30_000 });
  await expect(line).toContainText("C’est à toi de jouer.");
  const live = sheet(page).getByRole("status");
  await expect(live).toHaveCount(1);
  await expect(live).toHaveAttribute("aria-live", "polite");
  await expect(live).toHaveText("C’est à toi de jouer.");
  await page.waitForTimeout(1500);
  await expect(sheet(page)).toBeVisible();
  await expect(live).toHaveText("C’est à toi de jouer.");

  if (!isMobile) {
    // The focus ring on « Revenir à la partie », reached with the keyboard.
    const back = sheet(page).getByRole("button", { name: "Revenir à la partie" });
    for (let i = 0; i < 40; i++) {
      if (await back.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(back).toBeFocused();
    const ring = await back.evaluate((el) => {
      const style = getComputedStyle(el);
      return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`;
    });
    expect(ring).toBe("solid 3px rgb(255, 176, 46)");
  }

  await sheet(page).getByRole("button", { name: "Revenir à la partie" }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(zone(page)).toHaveAttribute("data-state", "idle");
  await expect(page.locator('[data-hand] [data-card="3S"]')).toHaveAttribute(
    "data-state",
    "playable",
  );
  const picture = await tablePicture(page);
  await playOneMove(page);
  await expect.poll(() => tablePicture(page), { timeout: 20_000 }).not.toBe(picture);
  await expect(page.locator("[data-error-screen]")).toHaveCount(0);
});
