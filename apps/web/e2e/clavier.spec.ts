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

  test("la Dame d’un cheval seul : 1, Entrée jouent le coup sans la souris", async ({ page }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
      hands: { bleu: ["12H"] },
    });

    // Her lone knight is chosen by itself (recette 3, test 27): no letter is needed.
    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await expect(page.locator('[data-selected="bleu0"]')).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(pawn(page, "bleu0")).toHaveAttribute("data-place", "ring:22");
  });

  test("la Dame de deux chevaux : 1, B, Entrée jouent le coup sans la souris", async ({ page }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, { p: 30 }, "S", "S"] },
      hands: { bleu: ["12H"] },
    });

    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
    await page.keyboard.press("b");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.keyboard.press("Enter");
    await expect(pawn(page, "bleu1")).toHaveAttribute("data-place", "ring:42");
    await expect(pawn(page, "bleu0")).toHaveAttribute("data-place", "ring:10");
  });

  test("Entrée joue depuis le cheval montré, mais garde son sens sur « Annuler ce coup »", async ({
    page,
  }) => {
    const QUEEN = {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
      hands: { bleu: ["12H"] },
    };
    // The focus on a button: Entrée presses that button, the move is not played. (« 1 » alone shows the
    // preview: the Dame has a single knight, recette 3, test 27.)
    await openPosition(page, QUEEN);
    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.getByRole("button", { name: "Annuler ce coup" }).focus();
    await page.keyboard.press("Enter");
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    await expect(pawn(page, "bleu0")).toHaveAttribute("data-place", "ring:10");

    // The focus on the previewed knight (reached with Tab in real play): Entrée plays, once.
    await page.keyboard.press("1");
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
    // As with both modes: « Avancer » shows the lone ring knight's move at once (recette 3, test 27),
    // then back to the question, then nothing selected.
    await openPosition(page, ACE);
    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
    await page.keyboard.press("a");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.keyboard.press("Escape");
    await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
    await page.keyboard.press("Escape");
    await expect(zone(page)).toHaveAttribute("data-state", "idle");

    // A lone knight's Dame: « 1 » shows its preview, Échap puts the card down at once.
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
      hands: { bleu: ["12H"] },
    });
    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await page.keyboard.press("Escape");
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    await expect(page.locator("[data-ghost]")).toHaveCount(0);

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

// The key hints (plan 01-28): on a computer the keys are written where they act; on a phone, nothing.
const FINE = "(hover: hover) and (pointer: fine)";
// Two knights on the ring can play the Dame, so she lights them both (a lone knight would be chosen
// by itself, recette 3, test 27).
const QUEEN_HAND = {
  turn: "bleu",
  pawns: { bleu: [{ p: 10 }, { p: 30 }, "S", "S"] },
  hands: { bleu: ["12H", "4S", "11S"] },
};
const visibleHints = (page: Page) => page.locator("[data-key-hint]:visible");

test.describe("les touches se voient sur ordinateur", () => {
  test("chaque carte montre son chiffre, sur ordinateur seulement", async ({
    page,
    isMobile,
  }, info) => {
    await openPosition(page, QUEEN_HAND);
    // The badges hang on this media query: an emulation mismatch fails here, with a clear message.
    const fine = await page.evaluate((query) => window.matchMedia(query).matches, FINE);
    expect(fine, `matchMedia('${FINE}') on the ${info.project.name} project`).toBe(!isMobile);

    if (isMobile) {
      await expect(page.locator("[data-hand] [data-card]")).toHaveCount(3);
      await expect(visibleHints(page)).toHaveCount(0);
      return;
    }
    const badges = page.locator("[data-hand] [data-key-hint]");
    await expect(badges).toHaveCount(3);
    for (const badge of await badges.all()) await expect(badge).toBeVisible();
    const seen = await badges.evaluateAll((all) =>
      all
        .map((each) => ({
          x: each.getBoundingClientRect().x,
          text: each.getAttribute("data-key-hint"),
        }))
        .sort((a, b) => a.x - b.x)
        .map((each) => each.text),
    );
    expect(seen).toEqual(["1", "2", "3"]);
  });

  test("les boutons d’action et le 7 montrent leur touche, sur ordinateur seulement", async ({
    page,
    isMobile,
  }) => {
    // Reached with taps, so the phone project goes through the very same states.
    const hintsOf = (button: ReturnType<Page["getByRole"]>) => button.locator("[data-key-hint]");
    const expectHint = async (button: ReturnType<Page["getByRole"]>, label: string) => {
      if (isMobile) await expect(hintsOf(button)).toBeHidden();
      else {
        await expect(hintsOf(button)).toBeVisible();
        // Plan 05-10: the key is painted from its attribute (KeyHint), not written as text.
        await expect(hintsOf(button)).toHaveAttribute("data-key-hint", label);
      }
    };

    // The Dame's preview: « Jouer » shows « Entrée », keeps its name and its size.
    await openPosition(page, QUEEN_HAND);
    await page.getByRole("button", { name: "Dame de cœur, jouable" }).click();
    await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
    const change = page.getByRole("button", { name: "Choisir une autre carte" });
    await expect(change).toBeVisible();
    await expect(hintsOf(change)).toHaveCount(0);
    await page.locator('[data-hit="bleu0"]').click({ force: true });
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    const play = page.getByRole("button", { name: "Jouer", exact: true });
    await expect(play).toHaveCount(1);
    await expectHint(play, "Entrée");
    await expect(hintsOf(page.getByRole("button", { name: "Annuler ce coup" }))).toHaveCount(0);
    // « Entrée », the three cards, the book's « R » (plan 05-04) and the pack's « T » (quick task
    // 261109-6an).
    await expect(visibleHints(page)).toHaveCount(isMobile ? 0 : 1 + 3 + 1 + 1);
    const shown = await play.boundingBox();
    await page.addStyleTag({ content: "[data-key-hint]{display:none!important}" });
    await expect(hintsOf(play)).toBeHidden();
    expect(await play.boundingBox()).toEqual(shown);

    // The As/Roi question: « S » and « A ».
    await openPosition(page, ACE);
    await page.getByRole("button", { name: "As de pique, jouable" }).click();
    await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
    await expectHint(page.getByRole("button", { name: "Sortir un cheval" }), "S");
    await expectHint(page.getByRole("button", { name: "Avancer de 1" }), "A");

    // The 7: « Entrée » on « Jouer », « ⌫ » on « Retirer le dernier pas », nothing on « Tout effacer ».
    await openPosition(page, SEVEN);
    await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
    await expect(seven(page)).toBeVisible();
    await page.locator('[data-hit="bleu0"]').click({ force: true });
    await page.locator('[data-step="3"]').click();
    await expectHint(page.getByRole("button", { name: "Jouer", exact: true }), "Entrée");
    await expectHint(page.getByRole("button", { name: "Retirer le dernier pas" }), "⌫");
    await expect(hintsOf(page.getByRole("button", { name: "Tout effacer" }))).toHaveCount(0);
    if (isMobile) await expect(visibleHints(page)).toHaveCount(0);
  });

  test("« R » ouvre et ferme « Règles du TOC », l’anneau du focus sur ses onglets", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "keyboard shortcuts are for computers");
    await openPosition(page, ACE);
    const rules = page.getByRole("dialog", { name: "Règles du TOC" });
    await page.keyboard.press("r");
    await expect(rules).toBeVisible();
    const chosen = rules.locator('[role="tab"][aria-selected="true"]');
    await expect(chosen).toHaveAttribute("data-rules-tab", "cartes");
    for (let i = 0; i < 20; i++) {
      if (await chosen.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(chosen).toBeFocused();
    const ring = await chosen.evaluate((el) => {
      const style = getComputedStyle(el);
      return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`;
    });
    expect(ring).toBe("solid 3px rgb(255, 176, 46)");
    // The arrows move the focus and the ring with it.
    await page.keyboard.press("ArrowDown");
    await expect(rules.locator('[data-rules-tab="donne"]')).toBeFocused();
    await page.keyboard.press("R");
    await expect(rules).toHaveCount(0);
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    // Again with « R », and the game's keys work once it is closed.
    await page.keyboard.press("r");
    await expect(rules).toBeVisible();
    await page.keyboard.press("r");
    await expect(rules).toHaveCount(0);
    await pressCard(page, "1S");
    await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
  });

  test("chaque touche affichée fait ce que fait son bouton", async ({ context, isMobile }) => {
    test.skip(isMobile, "keyboard shortcuts are for computers");

    /** What a key or a click leaves on screen, once the bots have settled. */
    async function snapshot(page: Page) {
      const read = () =>
        page.evaluate(() => ({
          state: document.querySelector("[data-action-zone]")?.getAttribute("data-state") ?? null,
          remaining:
            document
              .querySelector("[data-seven-panel] [data-remaining]")
              ?.getAttribute("data-remaining") ?? null,
          places: [...document.querySelectorAll("[data-pawn]")]
            .map((each) => `${each.getAttribute("data-pawn")}@${each.getAttribute("data-place")}`)
            .sort(),
        }));
      let last = JSON.stringify(await read());
      for (let i = 0; i < 100; i++) {
        await page.waitForTimeout(150);
        const now = JSON.stringify(await read());
        if (now === last) return JSON.parse(now) as unknown;
        last = now;
      }
      throw new Error("the screen never settled");
    }

    /**
     * Opens `etat` (or `query`) on a fresh page, reaches the state with `keys`, then either clicks the
     * button or presses its key, and returns what is left on screen.
     */
    async function run(
      open: { etat?: unknown; query?: string; state: string },
      keys: string[],
      act: (page: Page) => Promise<void>,
    ) {
      const page = await context.newPage();
      if (open.etat !== undefined) await openPosition(page, open.etat, open.state);
      else {
        await page.goto("/");
        await page.goto(`/#/partie?${open.query}&vitesse=test`);
        await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
        await expect(zone(page)).toHaveAttribute("data-state", open.state);
      }
      for (const key of keys) await page.keyboard.press(key);
      const before = await snapshot(page);
      await act(page);
      const after = await snapshot(page);
      await page.close();
      // Both ways must do something: two no-ops would compare equal too.
      expect(after, "the click or the key changed nothing").not.toEqual(before);
      return after;
    }

    const button =
      (name: string | RegExp, exact = true) =>
      (page: Page) =>
        page.getByRole("button", { name, exact }).click();
    const press = (key: string) => (page: Page) => page.keyboard.press(key);
    const tray = (page: Page) => page.locator("[data-tray-close]").click();
    const sevenPlay = (page: Page) => page.locator("[data-seven-play]").click();
    const sevenUndo = (page: Page) => page.locator("[data-seven-undo]").click();

    const QUEEN = {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
      hands: { bleu: ["12H"] },
    };
    const JACK_TRAY = {
      turn: "bleu",
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"], vert: [{ p: 40 }, "S", "S", "S"] },
      hands: { bleu: ["11H"] },
    };
    const DEAD = { turn: "bleu", pawns: { bleu: ["S", "S", "S", "S"] }, hands: { bleu: ["2S"] } };
    const EXCHANGE = { query: `graine=1234567890abcdef1234567890abcdef`, state: "exchange" };

    const cases: {
      name: string;
      open: { etat?: unknown; query?: string; state: string };
      keys: string[];
      click: (page: Page) => Promise<void>;
      key: string;
    }[] = [
      {
        name: "« Jouer » / Entrée",
        open: { etat: QUEEN, state: "idle" },
        keys: ["1"],
        click: button("Jouer"),
        key: "Enter",
      },
      {
        name: "« Sortir un cheval » / S",
        open: { etat: ACE, state: "idle" },
        keys: ["1"],
        click: button("Sortir un cheval"),
        key: "s",
      },
      {
        name: "« Avancer de 1 » / A",
        open: { etat: ACE, state: "idle" },
        keys: ["1"],
        click: button("Avancer de 1"),
        key: "a",
      },
      {
        name: "« Passer cette carte » / Entrée",
        open: EXCHANGE,
        keys: ["1"],
        click: button("Passer cette carte"),
        key: "Enter",
      },
      {
        name: "« Passer cette carte » / P",
        open: EXCHANGE,
        keys: ["1"],
        click: button("Passer cette carte"),
        key: "p",
      },
      {
        name: "« Poser mes cartes » / P",
        open: { etat: DEAD, state: "deadHand" },
        keys: [],
        click: button("Poser mes cartes"),
        key: "p",
      },
      {
        name: "« Choisir un autre cheval » / Échap",
        open: { etat: JACK_TRAY, state: "idle" },
        keys: ["1", "a", "a"],
        click: tray,
        key: "Escape",
      },
      {
        name: "le 7, « Jouer » / Entrée",
        open: { etat: SEVEN, state: "idle" },
        keys: ["1", "a", "3", "b", "4"],
        click: sevenPlay,
        key: "Enter",
      },
      {
        name: "le 7, « Retirer le dernier pas » / ⌫",
        open: { etat: SEVEN, state: "idle" },
        keys: ["1", "a", "3"],
        click: sevenUndo,
        key: "Backspace",
      },
    ];

    for (const each of cases) {
      const clicked = await run(each.open, each.keys, each.click);
      const pressed = await run(each.open, each.keys, press(each.key));
      expect(pressed, each.name).toEqual(clicked);
    }
  });

  test("les chevaux éclairés portent leur lettre ; le plateau de choix garde les siennes", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the phone sweep is below");
    // Two lit knights for the Dame: A and B.
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 10 }, { p: 30 }, "S", "S"] },
      hands: { bleu: ["12H"] },
    });
    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
    const letter = (id: string) => page.locator(`[data-key-hint-knight="${id}"]`);
    await expect(letter("bleu0")).toBeVisible();
    await expect(letter("bleu0")).toHaveText("A");
    await expect(letter("bleu1")).toBeVisible();
    await expect(letter("bleu1")).toHaveText("B");
    await expect(page.locator("[data-key-hint-knight]")).toHaveCount(2);

    // The Valet's tray: its chips and the board letters of the tray, no key letter.
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"], vert: [{ p: 40 }, "S", "S", "S"] },
      hands: { bleu: ["11H"] },
    });
    await page.keyboard.press("1");
    await page.keyboard.press("a");
    await page.keyboard.press("a");
    await expect(zone(page)).toHaveAttribute("data-state", "tray");
    await expect(page.locator("[data-tray-option]")).toHaveCount(2);
    await expect(page.locator("[data-letter]")).toHaveCount(2);
    await expect(page.locator("[data-key-hint-knight]")).toHaveCount(0);
  });

  test("Réglages : le lien « Raccourcis clavier » ouvre l’aide, Échap y revient", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the phone sweep is below");
    await openPosition(page, ACE);
    await page.getByRole("button", { name: "Réglages", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "Réglages" });
    const link = settings.getByRole("button", { name: "Raccourcis clavier" });
    await expect(link).toBeVisible();
    await link.click();
    const help = page.getByRole("dialog", { name: "Raccourcis clavier" });
    await expect(help).toBeVisible();
    await expect(help).toContainText("Sur ordinateur, tu peux jouer sans la souris.");
    await page.keyboard.press("Escape");
    await expect(help).toHaveCount(0);
    await expect(settings).toBeVisible();
    await expect(link).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(settings).toHaveCount(0);
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
  });

  test("sur téléphone, aucune touche nulle part", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the phone project only");
    const anyHint = page.locator("[data-key-hint]:visible, [data-key-hint-knight]:visible");
    const card = (name: string) => page.getByRole("button", { name });

    // Idle, card selected, preview.
    await openPosition(page, QUEEN_HAND);
    await expect(anyHint).toHaveCount(0);
    await card("Dame de cœur, jouable").click();
    await expect(zone(page)).toHaveAttribute("data-state", "cardSelected");
    await expect(anyHint).toHaveCount(0);
    await page.locator('[data-hit="bleu0"]').click({ force: true });
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    await expect(anyHint).toHaveCount(0);

    // The As/Roi question.
    await openPosition(page, ACE);
    await card("As de pique, jouable").click();
    await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
    await expect(anyHint).toHaveCount(0);

    // The 7 assistant, a knight chosen and a step given.
    await openPosition(page, SEVEN);
    await card("7 de cœur, jouable").click();
    await expect(seven(page)).toBeVisible();
    await page.locator('[data-hit="bleu0"]').click({ force: true });
    await page.locator('[data-step="3"]').click();
    await expect(anyHint).toHaveCount(0);

    // The exchange, a card chosen.
    await page.goto("/");
    await page.goto("/#/partie?graine=1234567890abcdef1234567890abcdef&vitesse=test");
    await expect(zone(page)).toHaveAttribute("data-state", "exchange");
    await expect(anyHint).toHaveCount(0);
    await page.locator("[data-hand] [data-card]").first().click();
    await expect(anyHint).toHaveCount(0);

    // A dead hand.
    await openPosition(
      page,
      { turn: "bleu", pawns: { bleu: ["S", "S", "S", "S"] }, hands: { bleu: ["2S"] } },
      "deadHand",
    );
    await expect(anyHint).toHaveCount(0);

    // Réglages in a game: no « Raccourcis clavier ».
    await page.getByRole("button", { name: "Réglages", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "Réglages" });
    await expect(settings).toBeVisible();
    await expect(settings.getByRole("button", { name: "Crédits et licences" })).toBeVisible();
    await expect(settings.locator("[data-shortcuts-link]")).toBeHidden();
    await expect(settings.getByRole("button", { name: "Raccourcis clavier" })).toHaveCount(0);
  });
});

// --- Plan 05-10 (05-UI-SPEC « Keyboard (additions) », « The audit » focus row): the phase's new
// screens with the keyboard alone. Every new control shows the amber ring when Tab reaches it, Tab
// follows the DOM order each contract lists, Échap closes the top sheet and gives the focus back.

/** The amber ring of :focus-visible (app.css): 3 px solid --ambre. */
async function expectRing(locator: ReturnType<Page["locator"]>, what: string) {
  await expect(locator, what).toBeFocused();
  const ring = await locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });
  expect(ring, `${what}: the amber ring`).toEqual({
    style: "solid",
    width: "3px",
    color: "rgb(255, 176, 46)",
  });
}

/** Tab once, then the focused element must be `locator`, with its ring. */
async function tabTo(page: Page, locator: ReturnType<Page["locator"]>, what: string) {
  await page.keyboard.press("Tab");
  await expectRing(locator, what);
}

/** A signed-in account and « Mes résultats » answered by the test (the local suite has no Worker). */
async function serveAccount(page: Page) {
  const me = {
    id: "u".repeat(22),
    pseudo: "Zoé",
    createdAt: 1_792_000_000_000,
    passkeys: [
      {
        id: "AAAA",
        label: "iPhone",
        createdAt: 1_792_000_000_000,
        lastUsedAt: null,
        backedUp: true,
        current: true,
      },
    ],
    hasBackupCode: true,
    backupAt: 1_792_000_000_000,
  };
  const seat = (
    colour: string,
    kind: string,
    name: string,
    home: number,
    level: number | null = null,
  ) => ({
    colour,
    kind,
    name,
    level,
    handedOver: false,
    captured: 1,
    lost: 1,
    home,
  });
  const at = (day: number) => new Date(2026, 10, day, 21, 14).getTime();
  const games = [1, 2].map((n) => ({
    id: `${"Q".repeat(43)}:${n}`,
    kind: "online",
    startedAt: at(n) - 40 * 60_000,
    endedAt: at(n),
    winner: "bleu-rouge",
    mine: "bleu",
    seats: [
      seat("bleu", "me", "Zoé", 4),
      seat("jaune", "account", "Paul", 3),
      seat("rouge", "account", "Marie", 4),
      seat("vert", "bot", "Ourasi", 2, 4),
    ],
    deals: 6,
    creator: "Zoé",
    ranked: true,
  }));
  const block = { games: 6, wins: 4, captured: 9, lost: 7, home: 30, partners: [], levels: [] };
  await page.route("**/api/me", (route) => route.fulfill({ json: me }));
  await page.route("**/api/me/results", (route) => route.fulfill({ json: { games, next: null } }));
  await page.route("**/api/me/stats", (route) =>
    route.fulfill({ json: { all: block, online: block, solo: { ...block, games: 0, wins: 0 } } }),
  );
  await page.route("**/api/me/ranking", (route) =>
    route.fulfill({
      json: {
        friends: 2,
        ranked: [
          { rank: 1, pseudo: "Marie", games: 12, wins: 8, me: false },
          { rank: 2, pseudo: "Zoé", games: 9, wins: 5, me: true },
        ],
        unranked: [{ pseudo: "Paul", games: 3, me: false }],
      },
    }),
  );
}

test.describe("au clavier sur les écrans de la phase 5", () => {
  test.skip(({ isMobile }) => isMobile, "the keyboard: the desktop project");

  test("l’accueil : la roue, les deux choix, les petites tuiles, puis « Règles » et « Apprendre »", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("main[data-home]")).toBeVisible();
    await tabTo(page, page.getByRole("button", { name: "Réglages", exact: true }), "la roue");
    await tabTo(page, page.locator('[data-home-choice="ordinateur"]'), "Jouer contre l’ordinateur");
    await tabTo(page, page.locator('[data-home-choice="table"]'), "Créer une table en ligne");
    await tabTo(page, page.locator('[data-small-tile="connexion"]'), "Se connecter");
    await tabTo(page, page.locator('[data-small-tile="regles"]'), "Règles");
    await tabTo(page, page.locator('[data-small-tile="apprendre"]'), "Apprendre");

    // « Règles » opens the sheet; Échap closes it and gives the focus back to the tile.
    await page.locator('[data-small-tile="regles"]').focus();
    await page.keyboard.press("Enter");
    const rules = page.getByRole("dialog", { name: "Règles du TOC" });
    await expect(rules).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(rules).toHaveCount(0);
    await expectRing(page.locator('[data-small-tile="regles"]'), "Règles, après Échap");
  });

  test("« Apprendre à jouer » : « Accueil », le bouton principal, les règles, puis les huit leçons", async ({
    page,
  }) => {
    await page.goto("/#/apprendre");
    const lessons = page.locator("main[data-lessons-page]");
    await expect(lessons).toBeVisible();
    // The h1 has the focus when the page opens (04 rule); « Accueil » is just before it.
    await expect(lessons.getByRole("heading", { level: 1 })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expectRing(lessons.getByRole("link", { name: "Accueil" }), "Accueil");
    await tabTo(page, lessons.locator("[data-lessons-primary]"), "Commencer");
    await tabTo(page, lessons.getByRole("button", { name: "Règles du jeu" }), "Règles du jeu");
    for (let n = 1; n <= 8; n++) {
      await tabTo(page, lessons.locator(`[data-lesson="${n}"]`), `leçon ${n}`);
    }
    // « Règles du jeu » opens the rules over the page; Échap gives the focus back.
    await lessons.getByRole("button", { name: "Règles du jeu" }).focus();
    await page.keyboard.press("Enter");
    const rules = page.getByRole("dialog", { name: "Règles du TOC" });
    await expect(rules).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(rules).toHaveCount(0);
    await expectRing(
      lessons.getByRole("button", { name: "Règles du jeu" }),
      "Règles du jeu, après Échap",
    );
  });

  test("une leçon : Entrée presse « Suivant », la pastille ouvre « Les leçons », Échap y revient", async ({
    page,
  }) => {
    await page.goto("/");
    await page.goto("/#/apprendre/1?vitesse=test");
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    const next = page.getByRole("button", { name: /^Suivant/ });
    await expect(next).toBeFocused();
    const band = page.locator("[data-guide-band]");
    const first = await band.textContent();
    await page.keyboard.press("Enter");
    await expect(band).not.toHaveText(first ?? "");

    const pill = page.getByRole("button", { name: /^Leçon 1 sur 8 : / });
    await pill.focus();
    await expectRing(pill, "la pastille de la leçon");
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog", { name: "Les leçons" });
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expectRing(pill, "la pastille, après Échap");
  });

  test("« Règles » : les flèches, Début et Fin choisissent l’onglet, l’anneau le suit", async ({
    page,
  }) => {
    await openPosition(page, ACE);
    await page.keyboard.press("r");
    const rules = page.getByRole("dialog", { name: "Règles du TOC" });
    await expect(rules).toBeVisible();
    const selected = rules.locator('[role="tab"][aria-selected="true"]');
    await expect(selected).toHaveAttribute("data-rules-tab", "cartes");
    await selected.focus();
    await page.keyboard.press("ArrowDown");
    await expect(selected).toHaveAttribute("data-rules-tab", "donne");
    await expectRing(rules.locator('[data-rules-tab="donne"]'), "Une donne");
    await page.keyboard.press("End");
    await expect(selected).toHaveAttribute("data-rules-tab", "regles-maison");
    await expectRing(rules.locator('[data-rules-tab="regles-maison"]'), "Règles de la maison");
    await page.keyboard.press("Home");
    await expect(selected).toHaveAttribute("data-rules-tab", "but");
    await expectRing(rules.locator('[data-rules-tab="but"]'), "Le but");
    await page.keyboard.press("ArrowUp");
    await expect(selected).toHaveAttribute("data-rules-tab", "regles-maison");
  });

  test("Échap ferme la feuille du dessus : « Règles » sur « Réglages », puis « Réglages »", async ({
    page,
  }) => {
    await openPosition(page, ACE);
    const gear = page.getByRole("button", { name: "Réglages", exact: true });
    await gear.focus();
    await page.keyboard.press("Enter");
    const settings = page.getByRole("dialog", { name: "Réglages" });
    await expect(settings).toBeVisible();
    const open = settings.getByRole("button", { name: "Règles du jeu" });
    await open.focus();
    await page.keyboard.press("Enter");
    const rules = page.getByRole("dialog", { name: "Règles du TOC" });
    await expect(rules).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(rules).toHaveCount(0);
    await expect(settings).toBeVisible();
    await expectRing(open, "« Règles du jeu » dans « Réglages »");
    await page.keyboard.press("Escape");
    await expect(settings).toHaveCount(0);
    await expectRing(gear, "la roue");
  });

  test("« Mes résultats » : « Accueil », les trois onglets, les parties ; la fiche et « Le classement » rendent le focus", async ({
    page,
  }) => {
    await serveAccount(page);
    await page.goto("/");
    await page.goto("/#/resultats");
    const rows = page.locator("[data-game-row]");
    await expect(rows).toHaveCount(2);
    // The h1 has the focus when the page opens (04 rule); « Accueil » is just before it.
    await expect(page.getByRole("heading", { level: 1, name: "Mes résultats" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expectRing(page.locator("main").getByRole("link", { name: "Accueil" }), "Accueil");
    await page.getByRole("heading", { level: 1, name: "Mes résultats" }).focus();
    await tabTo(page, page.locator('[data-results-tab="historique"]'), "Historique");
    await tabTo(page, page.locator('[data-results-tab="chiffres"]'), "Mes chiffres");
    await tabTo(page, page.locator('[data-results-tab="classement"]'), "Classement");
    await tabTo(page, rows.nth(0), "la première partie");
    await tabTo(page, rows.nth(1), "la deuxième partie");

    // A row opens its sheet; Échap gives the focus back to the row.
    await page.keyboard.press("Enter");
    const sheet = page.locator("[data-game-sheet]");
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expectRing(rows.nth(1), "la partie, après Échap");

    // « Mes chiffres » with Entrée: the focus goes to the panel's heading.
    await page.locator('[data-results-tab="chiffres"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-results-panel="chiffres"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Mes chiffres" })).toBeFocused();

    // « Classement », then « Comment ça marche ? » and back.
    await page.locator('[data-results-tab="classement"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-rank-row]").first()).toBeVisible();
    const how = page.getByRole("button", { name: "Comment ça marche ?" });
    await how.focus();
    await expectRing(how, "Comment ça marche ?");
    await page.keyboard.press("Enter");
    const ranking = page.getByRole("dialog", { name: "Le classement" });
    await expect(ranking).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(ranking).toHaveCount(0);
    await expectRing(how, "Comment ça marche ?, après Échap");
  });
});
