import { expect, type Page, test } from "@playwright/test";
import { zone } from "./jouer.ts";
import { etatParam } from "./position.ts";

// The keyboard shortcuts of the game screen (UI-SPEC « Addendum 2026-10-14 — Raccourcis clavier »): a
// computer player plays with the keyboard alone. Positions are made by hand with the `etat` debug
// parameter at test speed; after the page has loaded, nothing is clicked (the keys do everything),
// except the « Réglages » gear that opens the sheet of the guard test.

async function openPosition(page: Page, etat: unknown, state = "idle") {
  await page.goto("/");
  await page.goto(`/#/partie?etat=${etatParam(etat)}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(zone(page)).toHaveAttribute("data-state", state);
}

const pawn = (page: Page, id: string) => page.locator(`[data-pawn="${id}"]`);
const seven = (page: Page) => page.locator("[data-seven-panel]");

/** Presses the digit of `card`: its place in the hand, counted from the left (the fan's order). */
async function pressCard(page: Page, card: string) {
  const cards = page.locator("[data-hand] [data-card]");
  await expect(page.locator(`[data-hand] [data-card="${card}"]`)).toHaveCount(1);
  const order = await cards.evaluateAll((all) => all.map((each) => each.getAttribute("data-card")));
  await page.keyboard.press(String(order.indexOf(card) + 1));
}

// As with both modes: bleu0 on the ring, three knights in the stable.
const ACE = { turn: "bleu", pawns: { bleu: [{ p: 10 }, "S", "S", "S"] }, hands: { bleu: ["1S"] } };
// The 7 with two knights on the ring, so the split is possible.
const SEVEN = {
  turn: "bleu",
  pawns: { bleu: [{ p: 10 }, { p: 30 }, "S", "S"] },
  hands: { bleu: ["7H"] },
};

test.describe("au clavier seul", () => {
  test.skip(({ isMobile }) => isMobile, "keyboard shortcuts are for computers");

  test("la Dame : 1, A, Entrée jouent le coup sans la souris", async ({ page }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
      hands: { bleu: ["12H"] },
    });

    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
    await page.keyboard.press("a");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.keyboard.press("Enter");
    await expect(pawn(page, "bleu0")).toHaveAttribute("data-place", "ring:22");
  });

  test("Entrée joue depuis le cheval montré, mais garde son sens sur « Annuler ce coup »", async ({
    page,
  }) => {
    const QUEEN = {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
      hands: { bleu: ["12H"] },
    };
    // The focus on a button: Entrée presses that button, the move is not played.
    await openPosition(page, QUEEN);
    await page.keyboard.press("1");
    await page.keyboard.press("a");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.getByRole("button", { name: "Annuler ce coup" }).focus();
    await page.keyboard.press("Enter");
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    await expect(pawn(page, "bleu0")).toHaveAttribute("data-place", "ring:10");

    // The focus on the previewed knight (reached with Tab in real play): Entrée plays, once.
    await page.keyboard.press("1");
    await page.keyboard.press("a");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.locator('[data-hit="bleu0"]').focus();
    await page.keyboard.press("Enter");
    await expect(pawn(page, "bleu0")).toHaveAttribute("data-place", "ring:22");
  });

  test("cinq tours au clavier", async ({ page }) => {
    // The other seats hold no card: Bleu plays five turns in a row, then the next deal starts.
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"], jaune: ["S", { p: 20 }, "S", "S"] },
      hands: { bleu: ["1S", "4S", "7H", "11H", "13H"] },
    });

    // As: « Sortir un cheval ».
    await pressCard(page, "1S");
    await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
    await page.keyboard.press("s");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.keyboard.press("Enter");
    await expect(pawn(page, "bleu1")).toHaveAttribute("data-place", "ring:0");

    // 4: back four cells.
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    await pressCard(page, "4S");
    await page.keyboard.press("a");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.keyboard.press("Enter");
    await expect(pawn(page, "bleu0")).toHaveAttribute("data-place", "ring:6");

    // 7: three steps for A, four for B.
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    await pressCard(page, "7H");
    await expect(seven(page)).toBeVisible();
    await page.keyboard.press("a");
    await expect(seven(page)).toHaveAttribute("data-selected", "bleu0");
    await page.keyboard.press("3");
    await page.keyboard.press("b");
    await page.keyboard.press("4");
    await expect(seven(page).locator("[data-remaining]")).toHaveAttribute("data-remaining", "0");
    await page.keyboard.press("Enter");
    await expect(pawn(page, "bleu0")).toHaveAttribute("data-place", "ring:9");
    await expect(pawn(page, "bleu1")).toHaveAttribute("data-place", "ring:4");

    // Valet: his knight A, then the target B (jaune1).
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    await pressCard(page, "11H");
    await expect(zone(page)).toHaveAttribute("data-state", "jackPick");
    await page.keyboard.press("a");
    await expect(zone(page)).toHaveAttribute("data-state", "jackTarget");
    await page.keyboard.press("b");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.keyboard.press("Enter");
    await expect(pawn(page, "bleu0")).toHaveAttribute("data-place", "ring:38");
    await expect(pawn(page, "jaune1")).toHaveAttribute("data-place", "ring:9");

    // Roi: « Avancer de 13 », then knight B.
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    await pressCard(page, "13H");
    await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
    await page.keyboard.press("a");
    await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
    await page.keyboard.press("b");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.keyboard.press("Enter");
    await expect(pawn(page, "bleu1")).toHaveAttribute("data-place", "ring:17");

    // The next deal: the card to pass with « 1 », passed with « Entrée ».
    await expect(zone(page)).toHaveAttribute("data-state", "exchange");
    await expect(page.locator("[data-hand] [data-card]").first()).toBeVisible();
    await page.keyboard.press("1");
    await expect(page.locator('[data-hand] [data-card][data-state="selected"]')).toHaveCount(1);
    await page.keyboard.press("Enter");
    await expect(zone(page)).not.toHaveAttribute("data-state", "exchange");
  });

  test("Échap revient d’un pas", async ({ page }) => {
    // As with both modes: « Avancer », then back to the question, then nothing selected.
    await openPosition(page, ACE);
    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
    await page.keyboard.press("a");
    await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
    await page.keyboard.press("Escape");
    await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
    await page.keyboard.press("Escape");
    await expect(zone(page)).toHaveAttribute("data-state", "idle");

    // The 7: the knight is unselected, then the step taken back, then the card dropped.
    await openPosition(page, SEVEN);
    await page.keyboard.press("1");
    await page.keyboard.press("a");
    await expect(seven(page)).toHaveAttribute("data-selected", "bleu0");
    await page.keyboard.press("Escape");
    await expect(seven(page)).toHaveAttribute("data-selected", "");
    await page.keyboard.press("a");
    await page.keyboard.press("3");
    const remaining = seven(page).locator("[data-remaining]");
    await expect(remaining).toHaveAttribute("data-remaining", "4");
    await page.keyboard.press("Escape");
    await expect(remaining).toHaveAttribute("data-remaining", "7");
    await page.keyboard.press("Escape");
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
  });

  test("le 7 : Retour arrière retire le dernier pas", async ({ page }) => {
    await openPosition(page, SEVEN);
    await page.keyboard.press("1");
    await page.keyboard.press("a");
    await page.keyboard.press("3");
    const remaining = seven(page).locator("[data-remaining]");
    await expect(remaining).toHaveAttribute("data-remaining", "4");
    await page.keyboard.press("Backspace");
    await expect(remaining).toHaveAttribute("data-remaining", "7");
  });

  test("Valet : deux chevaux éclairés de même lettre ouvrent le plateau de choix", async ({
    page,
  }) => {
    // bleu0 and the target vert0 are both knight « A ».
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"], vert: [{ p: 40 }, "S", "S", "S"] },
      hands: { bleu: ["11H"] },
    });
    const bleu = await pawn(page, "bleu0").getAttribute("data-place");
    const vert = await pawn(page, "vert0").getAttribute("data-place");
    await page.keyboard.press("1");
    await page.keyboard.press("a");
    await expect(zone(page)).toHaveAttribute("data-state", "jackTarget");
    await page.keyboard.press("a");
    await expect(zone(page)).toHaveAttribute("data-state", "tray");
    await expect(page.locator("[data-tray-option]")).toHaveCount(2);
    await page.keyboard.press("b");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.keyboard.press("Enter");
    await expect(pawn(page, "bleu0")).toHaveAttribute("data-place", vert as string);
    await expect(pawn(page, "vert0")).toHaveAttribute("data-place", bleu as string);
  });

  test("P pose une main injouable", async ({ page }) => {
    await openPosition(
      page,
      { turn: "bleu", pawns: { bleu: ["S", "S", "S", "S"] }, hands: { bleu: ["2S"] } },
      "deadHand",
    );
    await page.keyboard.press("p");
    await expect(zone(page)).toHaveAttribute("data-state", /^(posed|exchange|exchangeWaiting)$/);
  });

  test("AZERTY : la touche 1 sans Maj", async ({ page }) => {
    await openPosition(page, ACE);
    // The key « & » of the French top row, without Shift: its physical code is Digit1.
    await page.evaluate(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "&", code: "Digit1" })),
    );
    await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
  });

  test("le premier raccourci démarre aussi le son d’une partie ouverte directement", async ({
    page,
  }) => {
    // A reload on #/partie has no launch-screen tap: the first key, a shortcut too, unlocks the audio.
    await openPosition(page, ACE);
    await expect(page.locator("body")).not.toHaveAttribute("data-audio", /.*/);
    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
    await expect(page.locator("body")).toHaveAttribute("data-audio", "running");
  });

  test("rien ne bouge derrière une feuille", async ({ page }) => {
    await openPosition(page, ACE);
    // Opening the sheet is the setup step (a click); then only keys.
    await page.getByRole("button", { name: "Réglages", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Réglages" });
    await expect(sheet).toBeVisible();
    await page.keyboard.press("1");
    await page.keyboard.press("?");
    await expect(sheet).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Raccourcis clavier" })).toHaveCount(0);
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
  });

  test("? ouvre l’aide", async ({ page }) => {
    await openPosition(page, ACE);
    await page.keyboard.press("?");
    const help = page.getByRole("dialog", { name: "Raccourcis clavier" });
    await expect(help).toBeVisible();
    expect(
      await help.locator("[data-shortcuts-sheet] [data-shortcut-row]").count(),
    ).toBeGreaterThanOrEqual(8);
    await expect(help).toContainText("Sur ordinateur, tu peux jouer sans la souris.");
    // Behind the help, the keys do nothing.
    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    await page.keyboard.press("Escape");
    await expect(help).toHaveCount(0);
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
  });

  test("fin de partie : les touches n’agissent plus", async ({ page }) => {
    // R-16.1: Rouge brings his last knight home with the 5, which wins for Bleu and Rouge.
    await page.goto("/");
    await page.goto("/#/partie?scenario=R-16.1&vitesse=test");
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    await page.keyboard.press("1");
    await page.keyboard.press("d");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.keyboard.press("Enter");
    const end = page.locator("[data-end-screen]");
    await expect(end).toBeVisible();
    await page.keyboard.press("1");
    await page.keyboard.press("?");
    await page.keyboard.press("Escape");
    await expect(end).toBeVisible();
    await expect(page.locator("[data-layout][inert]")).toHaveCount(1);
    await expect(page.getByRole("dialog", { name: "Raccourcis clavier" })).toHaveCount(0);
  });
});
