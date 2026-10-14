import { expect, type Locator, type Page, test } from "@playwright/test";
import { etatParam } from "./position.ts";

// Touch targets (UI-SPEC « Touch targets »): every button, card slice, step chip, tray chip and candidate
// knight hit circle measures at least 44 x 44 screen px on the smallest phones. Explicit viewports on the
// desktop project (the phone project already is one phone size).

const VIEWPORTS = [
  { width: 320, height: 480 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
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

      // Each visible slice of the fan is at least 44 px wide: the next card starts 44 px or more on.
      const boxes = await Promise.all((await cards.all()).map((card) => card.boundingBox()));
      for (let i = 1; i < boxes.length; i++) {
        const gap = (boxes[i]?.x ?? 0) - (boxes[i - 1]?.x ?? 0);
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

test.describe("le 7 sous le plateau à 375 x 667", () => {
  test.use({ viewport: { width: 375, height: 667 } });
  test.skip(({ isMobile }) => isMobile, "explicit viewport: desktop project only");

  test("le galet en largeur reste 2:1 et dans l’écran, le panneau avec lui", async ({ page }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
      hands: { bleu: ["7H"] },
    });
    await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
    // Three micro-moves: the plan list is full, the panel must not grow past the screen.
    for (const [pawn, steps] of [
      ["bleu0", 3],
      ["bleu1", 2],
      ["bleu0", 1],
    ] as const) {
      await page.locator(`[data-hit="${pawn}"]`).click({ force: true });
      await page.getByRole("button", { name: `${steps} pas` }).click();
    }
    await expect(page.locator("[data-seven-row]")).toHaveCount(3);

    const board = await page.locator("[data-board]").boundingBox();
    const seven = await page.locator("[data-seven-panel]").boundingBox();
    expect(board).not.toBeNull();
    expect(seven).not.toBeNull();
    if (board === null || seven === null) return;
    expect(Math.abs(board.height - 0.5 * board.width)).toBeLessThan(2);
    expect(board.width).toBeGreaterThan(90);
    expect(board.x).toBeGreaterThanOrEqual(0);
    expect(board.x + board.width).toBeLessThanOrEqual(375 + 0.5);
    expect(board.y + board.height).toBeLessThanOrEqual(seven.y + 1);
    // Bar 56 + the 2:1 landscape galet and its head room + panel: everything is on screen, no scrolling to
    // reach « Jouer ».
    expect(seven.y + seven.height).toBeLessThanOrEqual(667 + 0.5);
    const play = await page.getByRole("button", { name: "Jouer", exact: true }).boundingBox();
    expect((play?.y ?? 0) + (play?.height ?? 0)).toBeLessThanOrEqual(667);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
      667,
    );
  });

  test("beaucoup d’étapes : la liste défile dans le panneau, qui garde sa taille", async ({
    page,
  }) => {
    await openPosition(page, {
      turn: "bleu",
      pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"] },
      hands: { bleu: ["7H"] },
    });
    await page.getByRole("button", { name: "7 de cœur, jouable" }).click();
    const before = await page.locator("[data-seven-panel]").boundingBox();
    // One step at a time with alternating knights: seven rows.
    for (let i = 0; i < 7; i++) {
      await page.locator(`[data-hit="bleu${i % 2}"]`).click({ force: true });
      await page.getByRole("button", { name: "1 pas" }).click();
    }
    await expect(page.locator("[data-seven-row]")).toHaveCount(7);
    const after = await page.locator("[data-seven-panel]").boundingBox();
    expect(after?.height).toBe(before?.height);
    const region = page.locator("[data-seven-region]");
    expect(await region.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    // The newest row is the one in view.
    await expect(page.locator("[data-seven-row]").last()).toBeInViewport();
  });
});

test.describe("mouvement réduit", () => {
  test.use({ viewport: { width: 375, height: 667 } });
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
