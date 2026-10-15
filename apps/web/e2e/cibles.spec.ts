import { devices, expect, type Locator, type Page, test } from "@playwright/test";
import { etatParam } from "./position.ts";

// Touch targets (UI-SPEC « Touch targets »): every button, card slice, step chip, tray chip and candidate
// knight hit circle measures at least 44 x 44 screen px on the smallest phones, held sideways (Romain's
// « paysage obligatoire »: the board on the full height with a strip at each side, plan 01-47; a
// screen taller than wide leaves the game in 01-38). Explicit viewports on the desktop project.

const VIEWPORTS = [
  { width: 480, height: 320 },
  { width: 568, height: 320 },
  { width: 667, height: 375 },
  // The window Playwright emulates for an iPhone 13 held sideways (750 x 342 with Playwright 1.64).
  devices["iPhone 13 landscape"].viewport,
  { width: 844, height: 390 },
] as const;
const MIN = 44;
/** Layout rounding: a box of 43.9 px is a 44 px box. */
const TOLERANCE = 0.2;

const zone = (page: Page) => page.locator("[data-action-zone]");
const SEED = "1234567890abcdef1234567890abcdef";

async function open(page: Page, query: string, state?: string) {
  await page.goto("/");
  await page.goto(`/#/partie?${query}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  if (state !== undefined) await expect(zone(page)).toHaveAttribute("data-state", state);
}

const openPosition = (page: Page, position: unknown, state = "idle") =>
  open(page, `etat=${etatParam(position)}`, state);

/** Every locator match that is visible measures at least 44 x 44. Returns how many were measured. */
async function expectTargets(what: string, locator: Locator): Promise<number> {
  const all = await locator.all();
  let measured = 0;
  for (const [i, each] of all.entries()) {
    if (!(await each.isVisible())) continue;
    const box = await each.boundingBox();
    if (box === null) continue;
    expect(box.width, `${what} #${i} width`).toBeGreaterThanOrEqual(MIN - TOLERANCE);
    expect(box.height, `${what} #${i} height`).toBeGreaterThanOrEqual(MIN - TOLERANCE);
    measured += 1;
  }
  return measured;
}

/** All the buttons on screen, then the named kinds of target that must be there. */
async function expectAllButtons(page: Page) {
  await expectTargets("button", page.locator("button, [role='button']:not([data-hit])"));
}

for (const viewport of VIEWPORTS) {
  test.describe(`cibles tactiles à ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport });
    test.skip(({ isMobile }) => isMobile, "explicit viewports: desktop project only");

    test("l’échange : les cartes de la main et « Passer cette carte »", async ({ page }) => {
      await open(page, `graine=${SEED}`, "exchange");
      const cards = page.locator("[data-hand] [data-card]");
      expect(await cards.count()).toBe(5);
      await expectTargets("card", cards);
      await expectAllButtons(page);

      // Each visible slice of the hand is at least 44 px: the next card starts 44 px or more on, along
      // the hand (across in a fan, down in the column of the left strip, plan 01-47).
      const boxes = await Promise.all((await cards.all()).map((card) => card.boundingBox()));
      for (let i = 1; i < boxes.length; i++) {
        const gap = Math.max(
          Math.abs((boxes[i]?.x ?? 0) - (boxes[i - 1]?.x ?? 0)),
          Math.abs((boxes[i]?.y ?? 0) - (boxes[i - 1]?.y ?? 0)),
        );
        expect(gap, `slice ${i - 1}`).toBeGreaterThanOrEqual(MIN - TOLERANCE);
      }
      await cards.first().click();
      await expectAllButtons(page);
    });

    test("As et Roi, chevaux serrés, chevaux éclairés et le 7 réparti", async ({ page }) => {
      await openPosition(page, {
        turn: "bleu",
        pawns: { bleu: [{ p: 5 }, { p: 6 }, "S", "S"] },
        hands: { bleu: ["1S", "3S", "5S", "7H", "13H"] },
      });
      await expectTargets("card", page.locator("[data-hand] [data-card]"));
      await expectAllButtons(page);

      // The question and its two buttons.
      await page.getByRole("button", { name: "As de pique, jouable" }).click();
      await expect(zone(page)).toHaveAttribute("data-state", "modeChoice");
      expect(await expectTargets("mode", page.locator("button[data-mode]"))).toBe(2);
      await expectAllButtons(page);

      // Lit knights: each hit circle is 44 px across at least.
      await page.getByRole("button", { name: "Sortir un cheval" }).click();
      await page.getByRole("button", { name: "Annuler ce coup" }).click();
      await page.getByRole("button", { name: "3 de pique, jouable" }).click();
      expect(await expectTargets("hit circle", page.locator("[data-hit] circle:not(.ring)"))).toBe(
        2,
      );
      await expectAllButtons(page);

      // The tray: two chips of 44 x 56.
      await page.locator('[data-hit="bleu0"]').click({ force: true });
      await expect(zone(page)).toHaveAttribute("data-state", "tray");
      expect(await expectTargets("tray chip", page.locator("[data-tray-option]"))).toBe(2);
      await expectAllButtons(page);
      await page.getByRole("button", { name: "Choisir un autre cheval" }).click();

      // The 7: step chips, the three buttons, the hit circles of the knights.
      await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
      await expect(page.locator("[data-seven-panel]")).toBeVisible();
      expect(await expectTargets("hit circle", page.locator("[data-hit] circle:not(.ring)"))).toBe(
        2,
      );
      await page.locator('[data-hit="bleu1"]').click({ force: true });
      await expect(page.locator("[data-seven-panel] [data-tray-option]")).toHaveCount(2);
      expect(await expectTargets("tray chip", page.locator("[data-tray-option]"))).toBe(2);
      await page.locator('[data-tray-option="bleu1"]').click();
      expect(await expectTargets("step chip", page.locator("[data-step]"))).toBe(7);
      for (const label of ["Retirer le dernier pas", "Tout annuler", "Jouer"]) {
        await expectTargets(label, page.getByRole("button", { name: label, exact: true }));
      }
      await page.getByRole("button", { name: "3 pas" }).click();
      expect(await expectTargets("step chip", page.locator("[data-step]"))).toBe(4);
      await expectAllButtons(page);
      await page.getByRole("button", { name: "Retirer le dernier pas" }).isEnabled();
    });

    test("la main morte : « Poser mes cartes »", async ({ page }) => {
      await openPosition(
        page,
        {
          turn: "bleu",
          pawns: { bleu: ["S", "S", "S", "S"] },
          hands: { bleu: ["8S", "9S"] },
        },
        "deadHand",
      );
      await expectAllButtons(page);
      await expectTargets("card", page.locator("[data-hand] [data-card]"));
    });
  });
}

test.describe("le 7 autour du plateau à 667 x 375, le téléphone tenu en largeur", () => {
  test.use({ viewport: { width: 667, height: 375 } });
  test.skip(({ isMobile }) => isMobile, "explicit viewport: desktop project only");

  /** The boxes of the 7's three parts around the board (plan 01-47), and the board's. */
  async function sevenParts(page: Page) {
    const boxOf = async (selector: string) => {
      const box = await page.locator(selector).boundingBox();
      if (box === null) throw new Error(`no box for ${selector}`);
      return box;
    };
    return {
      board: await boxOf("[data-board]"),
      line: await boxOf("[data-seven-line]"),
      buttons: await boxOf("[data-seven-buttons]"),
    };
  }

  test("le galet en largeur reste 2:1 et dans l’écran, l’assistant autour de lui", async ({
    page,
  }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
      hands: { bleu: ["7H"] },
    });
    await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
    // Three micro-moves: the plan is full, the assistant must not grow past the screen.
    for (const [pawn, steps] of [
      ["bleu0", 3],
      ["bleu1", 2],
      ["bleu0", 1],
    ] as const) {
      await page.locator(`[data-hit="${pawn}"]`).click({ force: true });
      await page.getByRole("button", { name: `${steps} pas` }).click();
    }
    await expect(page.locator("[data-seven-row]")).toHaveCount(3);

    const { board, line, buttons } = await sevenParts(page);
    expect(Math.abs(board.height - 0.5 * board.width)).toBeLessThan(2);
    expect(board.width).toBeGreaterThan(90);
    expect(board.x).toBeGreaterThanOrEqual(0);
    expect(board.x + board.width).toBeLessThanOrEqual(667 + 0.5);
    expect(board.y + board.height).toBeLessThanOrEqual(375 + 0.5);
    // The line over the board, the buttons in the right strip: none covers the board, everything is
    // on screen, no scrolling to reach « Jouer ».
    expect(line.y + line.height).toBeLessThanOrEqual(board.y + 0.5);
    expect(buttons.x).toBeGreaterThanOrEqual(board.x + board.width - 0.5);
    expect(buttons.y + buttons.height).toBeLessThanOrEqual(375 + 0.5);
    const play = await page.getByRole("button", { name: "Jouer", exact: true }).boundingBox();
    expect((play?.y ?? 0) + (play?.height ?? 0)).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
      375,
    );
  });

  test("beaucoup d’étapes : la ligne de consigne garde une ligne, le plan entier dans son titre", async ({
    page,
  }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"] },
      hands: { bleu: ["7H"] },
    });
    await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
    const before = await sevenParts(page);
    // One step at a time with alternating knights: seven rows.
    for (let i = 0; i < 7; i++) {
      await page.locator(`[data-hit="bleu${i % 2}"]`).click({ force: true });
      await page.getByRole("button", { name: "1 pas" }).click();
    }
    await expect(page.locator("[data-seven-row]")).toHaveCount(7);
    const after = await sevenParts(page);
    // Nothing grows: the line, the buttons and the board keep their boxes.
    expect(after.line).toEqual(before.line);
    expect(after.buttons).toEqual(before.buttons);
    expect(after.board).toEqual(before.board);
    // In the 24 px prompt row the plan is one line ending in « … » (UI-SPEC addendum « Recette 3 de
    // Romain »): the whole plan, the newest row included, is in its title and read out.
    const line = page.locator("[data-seven-line]");
    expect(
      await line.evaluate((el) => {
        const text = el.firstElementChild as HTMLElement;
        return text.scrollWidth > text.clientWidth;
      }),
    ).toBe(true);
    const last = await page.locator("[data-seven-row]").last().textContent();
    await expect(line).toHaveAttribute("title", new RegExp(`${(last ?? "").trim()}$`));
  });
});

test.describe("mouvement réduit", () => {
  test.use({ viewport: { width: 667, height: 375 } });
  test.skip(({ isMobile }) => isMobile, "explicit viewport: desktop project only");

  test("les halos n’ont aucune animation en cours", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"] },
      hands: { bleu: ["3S", "7H"] },
    });
    await page.getByRole("button", { name: "3 de pique, jouable" }).click();
    await expect(page.locator("[data-halo]")).toHaveCount(2);
    const running = () =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => {
              const target = (animation.effect as KeyframeEffect | null)?.target;
              return target instanceof Element && target.closest("[data-halo]") !== null;
            })
            .filter((animation) => animation.playState === "running").length,
      );
    await page.waitForTimeout(300);
    expect(await running()).toBe(0);

    // The halos of the 7 are as still as the others.
    await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
    await expect(page.locator("[data-halo]")).toHaveCount(2);
    await page.waitForTimeout(300);
    expect(await running()).toBe(0);
  });

  test("sans la préférence, les halos pulsent (le contrôle voit bien les animations)", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"] },
      hands: { bleu: ["3S"] },
    });
    await page.getByRole("button", { name: "3 de pique, jouable" }).click();
    await expect(page.locator("[data-halo]")).toHaveCount(2);
    await page.waitForTimeout(300);
    const running = await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          return (
            target instanceof Element &&
            target.closest("[data-halo]") !== null &&
            animation.playState === "running"
          );
        }).length,
    );
    expect(running).toBeGreaterThan(0);
  });
});
