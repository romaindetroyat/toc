import { expect, type Locator, type Page, test } from "@playwright/test";
import { zone } from "./jouer.ts";
import { etatParam } from "./position.ts";

// « Règles du TOC » at any moment of a game (plan 05-04, PLAY-06, D-05): the book button (the phone's
// right strip under the gear, first in the computer's info row) and « R » open the large sheet on
// « Les cartes »; the cards list, the chosen card's row, the tabs, the solo computers that wait while
// it is open, and the fit at the reference sizes. Positions are made by hand with the `etat` debug
// parameter at test speed.

async function openPosition(page: Page, etat: unknown, state = "idle") {
  await page.goto("/");
  await page.goto(`/#/partie?etat=${etatParam(etat)}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(zone(page)).toHaveAttribute("data-state", state);
}

const book = (page: Page) => page.getByRole("button", { name: "Règles du jeu" });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Règles du TOC" });
const tab = (page: Page, id: string) => page.locator(`[data-rules-tab="${id}"]`);
const boardPawn = (page: Page, id: string) => page.locator(`[data-board] [data-pawn="${id}"]`);

// A Dame for Bleu's lone knight; Jaune holds a 3 and plays right after Bleu.
const QUEEN = {
  turn: "bleu",
  pawns: { bleu: [{ p: 10 }, "S", "S", "S"], jaune: [{ p: 20 }, "S", "S", "S"] },
  hands: { bleu: ["12H"], jaune: ["3S"] },
};
// The Valet with a knight to swap with.
const JACK = {
  turn: "bleu",
  pawns: { bleu: [{ p: 10 }, "S", "S", "S"], jaune: [{ p: 20 }, "S", "S", "S"] },
  hands: { bleu: ["11H", "5S"] },
};
// The 7 with two knights on the ring: its three buttons fill the phone's right strip.
const SEVEN = {
  turn: "bleu",
  pawns: { bleu: [{ p: 10 }, { p: 30 }, "S", "S"] },
  hands: { bleu: ["7H"] },
};

const TABS = [
  ["but", "Le but"],
  ["cartes", "Les cartes"],
  ["donne", "Une donne"],
  ["sortir", "Sortir un cheval"],
  ["sept", "Le 7"],
  ["valet", "Le Valet"],
  ["manger", "Manger"],
  ["maison", "Rentrer à la maison"],
  ["fini", "Quand tu as fini"],
  ["regles-maison", "Règles de la maison"],
] as const;

async function expectBox(locator: Locator, what: string, min = 44) {
  const box = await locator.boundingBox();
  expect(box, what).not.toBeNull();
  if (box === null) return;
  expect(box.width, `${what} width`).toBeGreaterThanOrEqual(min - 0.2);
  expect(box.height, `${what} height`).toBeGreaterThanOrEqual(min - 0.2);
}

test.describe("la feuille « Règles » en partie", () => {
  test("le livre ouvre « Règles du TOC » sur « Les cartes », et Échap rend la main au livre", async ({
    page,
    isMobile,
  }) => {
    await openPosition(page, QUEEN);

    await expect(book(page)).toHaveCount(1);
    await expect(book(page)).toBeVisible();
    await expect(book(page)).toHaveAttribute("aria-haspopup", "dialog");
    await expect(book(page)).toHaveAttribute("title", "Règles du jeu");
    await expect(book(page)).toHaveAttribute("aria-keyshortcuts", "R");
    await expectBox(book(page), "the book");

    const placed = await page.evaluate(() => {
      const button = document.querySelector("[data-rules-button]") as HTMLElement;
      const gear = document.querySelector("[data-settings-slot] button") as HTMLElement;
      const board = document.querySelector("[data-board]") as HTMLElement;
      const b = button.getBoundingClientRect();
      const g = gear.getBoundingClientRect();
      const s = board.getBoundingClientRect();
      return {
        inInfo: button.closest("[data-info-bar]") !== null,
        rightOfBoard: b.left >= s.right - 0.5,
        underGear: b.top >= g.bottom - 0.5 && Math.abs(b.left - g.left) < 1,
        firstOfRow: button.closest("[data-table-row-buttons]")?.querySelector("button") === button,
      };
    });
    if (isMobile) {
      // The phone: the right strip, under the gear.
      expect(placed.rightOfBoard).toBe(true);
      expect(placed.underGear).toBe(true);
    } else {
      // The computer: first in the info column's row of small buttons, alone in solo.
      expect(placed.inInfo).toBe(true);
      expect(placed.firstOfRow).toBe(true);
    }

    await book(page).click();
    await expect(sheet(page)).toBeVisible();
    await expect(page.locator("[data-rules-sheet]")).toBeVisible();
    await expect(tab(page, "cartes")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toBeVisible();
    await expect(page.getByRole("tabpanel").getByRole("heading", { level: 3 })).toHaveText(
      "Les cartes",
    );
    // The close button of the large sheet, and no bottom « Fermer ».
    await expect(sheet(page).getByRole("button", { name: "Fermer les règles" })).toBeVisible();
    await expectBox(sheet(page).getByRole("button", { name: "Fermer les règles" }), "close");

    // The ten tabs, in order.
    const tabs = sheet(page).getByRole("tab");
    await expect(tabs).toHaveCount(10);
    for (const [i, [id, name]] of TABS.entries()) {
      await expect(tabs.nth(i)).toHaveAttribute("data-rules-tab", id);
      await expect(tabs.nth(i)).toHaveText(name);
    }

    // Every card's effect: seven rows, the thirteen ranks as chips.
    const rows = page.locator("[data-card-rule]");
    await expect(rows).toHaveCount(7);
    await expect(page.locator("[data-card-rule] [data-card-chip]")).toHaveCount(13);
    await expect(page.locator('[data-card-rule="1"]')).toContainText(
      "Sort un cheval de l’écurie, ou avance de 1.",
    );
    await expect(page.locator('[data-card-rule="13"]')).toContainText("ou avance de 13.");
    await expect(page.locator('[data-card-rule="12"]')).toContainText("Avance de 12.");
    await expect(page.locator('[data-card-rule="4"]')).toContainText("Recule de 4");
    await expect(page.getByRole("listitem", { name: /^As\b/ })).toHaveCount(1);
    await expect(page.getByRole("listitem", { name: /^10, 9, 8, 6, 5, 3 et 2\b/ })).toHaveCount(1);
    // No card is chosen: no row is marked.
    await expect(page.locator("[data-card-rule][data-chosen]")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();
    await expect(book(page)).toBeFocused();
    // Nothing was added under the hand (D-05).
    await expect(page.locator("[data-hand] [data-card-rule], [data-card-help]")).toHaveCount(0);
  });

  test("la carte choisie : sa ligne entourée, « Voir « Le Valet » » ouvre l’onglet", async ({
    page,
  }) => {
    await openPosition(page, JACK);
    await page.locator('[data-hand] [data-card="11H"]').click();
    await expect(zone(page)).toHaveAttribute("data-state", /^(jackPick|jackTarget)$/);

    await book(page).click();
    await expect(sheet(page)).toBeVisible();
    const row = page.locator('[data-card-rule="11"]');
    await expect(row).toHaveAttribute("data-chosen", "");
    await expect(page.getByRole("listitem", { name: /, ta carte choisie\.$/ })).toHaveCount(1);
    await expect(
      page.getByRole("listitem", { name: /^Valet\b.*, ta carte choisie\.$/ }),
    ).toHaveCount(1);
    const outline = await row.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
    });
    expect(outline.style).toBe("solid");
    expect(outline.width).toBe("2px");
    expect(outline.color).toBe("rgb(255, 248, 225)");
    await expect(row).toBeInViewport();

    await row.getByRole("button", { name: "Voir « Le Valet »" }).click();
    await expect(tab(page, "valet")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel").getByRole("heading", { level: 3 })).toHaveText(
      "Le Valet",
    );
    await expect(page.getByRole("tabpanel")).toContainText("Le Valet échange un de tes chevaux");

    // The tab is kept for the rest of the game: closed and opened again, the sheet is on « Le Valet ».
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();
    await book(page).click();
    await expect(tab(page, "valet")).toHaveAttribute("aria-selected", "true");
  });

  test("les flèches, Début et Fin passent d’un onglet à l’autre", async ({ page }) => {
    await openPosition(page, QUEEN);
    await book(page).click();
    await expect(sheet(page)).toBeVisible();
    const list = page.getByRole("tablist");
    // Two columns from a 656 px dialog: both projects (718 and 880 wide).
    await expect(list).toHaveAttribute("aria-orientation", "vertical");

    // One tab stop: only the chosen tab is in the Tab order.
    await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    await tab(page, "cartes").focus();
    await page.keyboard.press("ArrowDown");
    await expect(tab(page, "donne")).toHaveAttribute("aria-selected", "true");
    await expect(tab(page, "donne")).toBeFocused();
    await expect(page.getByRole("tabpanel").getByRole("heading", { level: 3 })).toHaveText(
      "Une donne",
    );
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(tab(page, "but")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    await expect(tab(page, "regles-maison")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(tab(page, "but")).toHaveAttribute("aria-selected", "true");
    await expect(tab(page, "but")).toBeFocused();
    await page.keyboard.press("End");
    await expect(tab(page, "regles-maison")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("Ce qui change par rapport au TOC");
    await expect(page.getByRole("tabpanel").getByRole("listitem")).toHaveCount(7);
    // The panel is labelled by its tab.
    const labelled = await page.getByRole("tabpanel").getAttribute("aria-labelledby");
    expect(labelled).toBe(await tab(page, "regles-maison").getAttribute("id"));
  });

  test("« R » ouvre et ferme les règles (ordinateur)", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard shortcuts are for computers");
    await openPosition(page, QUEEN);
    await expect(page.locator('[data-rules-button] [data-key-hint="R"]')).toBeVisible();
    await page.keyboard.press("r");
    await expect(sheet(page)).toBeVisible();
    await expect(tab(page, "cartes")).toHaveAttribute("aria-selected", "true");
    // Game keys do nothing behind it.
    await page.keyboard.press("1");
    await expect(zone(page)).toHaveAttribute("data-state", "idle");
    await page.keyboard.press("R");
    await expect(sheet(page)).toBeHidden();
    // Under another sheet « R » does nothing.
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Raccourcis clavier" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Raccourcis clavier" })).toContainText(
      "Ouvrir les règles",
    );
    await page.keyboard.press("r");
    await expect(sheet(page)).toHaveCount(0);
  });

  test("contre l’ordinateur, personne ne joue tant que les règles sont ouvertes", async ({
    page,
  }) => {
    await openPosition(page, QUEEN);
    await page.locator('[data-hand] [data-card="12H"]').click();
    await expect(zone(page)).toHaveAttribute("data-state", "preview");
    const before = await boardPawn(page, "jaune0").getAttribute("data-place");
    // Bleu plays and opens the rules in the same instant: Jaune is due right after.
    await page.evaluate(() => {
      const play = [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
        /^Jouer/.test(button.textContent?.trim() ?? ""),
      );
      if (play === undefined) throw new Error("no « Jouer » button");
      play.click();
      (document.querySelector("[data-rules-button]") as HTMLButtonElement).click();
    });
    await expect(sheet(page)).toBeVisible();
    await expect(boardPawn(page, "bleu0")).toHaveAttribute("data-place", "ring:22");
    await page.waitForTimeout(3000);
    await expect(boardPawn(page, "jaune0")).toHaveAttribute("data-place", before ?? "");
    await expect(page.locator('[data-felt-last="jaune"]')).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();
    await expect(boardPawn(page, "jaune0")).not.toHaveAttribute("data-place", before ?? "");
  });
});

const FIT = [
  { width: 480, height: 320 },
  { width: 750, height: 342 },
  { width: 844, height: 390 },
  { width: 1280, height: 800 },
] as const;

for (const viewport of FIT) {
  test.describe(`la feuille « Règles » à ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport });
    test.skip(({ isMobile }) => isMobile, "explicit viewports: desktop project only");

    test("tout tient dans l’écran, rien ne défile de côté", async ({ page }) => {
      await openPosition(page, QUEEN);
      await book(page).click();
      await expect(sheet(page)).toBeVisible();
      // Wait for the slide in.
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document
                .querySelector("[data-rules-sheet]")
                ?.closest('[role="dialog"]')
                ?.getAnimations().length ?? -1,
          ),
        )
        .toBe(0);
      for (const id of ["cartes", "regles-maison", "sept", "but"]) {
        await tab(page, id).click();
        const fit = await page.evaluate(() => {
          const dialog = document.querySelector("[data-rules-sheet]")?.closest('[role="dialog"]');
          const panel = document.querySelector('[role="tabpanel"]') as HTMLElement;
          const nav = document.querySelector('[role="tablist"]') as HTMLElement;
          if (!dialog) throw new Error("no dialog");
          const d = dialog.getBoundingClientRect();
          return {
            dialog: { left: d.left, top: d.top, right: d.right, bottom: d.bottom },
            sideways:
              document.documentElement.scrollWidth > document.documentElement.clientWidth ||
              dialog.scrollWidth > dialog.clientWidth + 1 ||
              panel.scrollWidth > panel.clientWidth + 1,
            panelScrolls: ["auto", "scroll"].includes(getComputedStyle(panel).overflowY),
            navScrolls:
              ["auto", "scroll"].includes(getComputedStyle(nav).overflowY) ||
              ["auto", "scroll"].includes(getComputedStyle(nav).overflowX),
          };
        });
        expect(fit.dialog.left, id).toBeGreaterThanOrEqual(-0.5);
        expect(fit.dialog.top, id).toBeGreaterThanOrEqual(-0.5);
        expect(fit.dialog.right, id).toBeLessThanOrEqual(viewport.width + 0.5);
        expect(fit.dialog.bottom, id).toBeLessThanOrEqual(viewport.height + 0.5);
        expect(fit.sideways, `${id}: sideways scroll`).toBe(false);
        expect(fit.panelScrolls, `${id}: the panel scrolls on its own`).toBe(true);
        expect(fit.navScrolls, `${id}: the nav scrolls on its own`).toBe(true);
      }
      if (viewport.width >= 600) {
        const box = await sheet(page).boundingBox();
        expect(box?.width ?? 0).toBeLessThanOrEqual(880.5);
        expect(box?.height ?? 0).toBeLessThanOrEqual(720.5);
      }
      // One column under a 656 px dialog: a row of 44 px chips, the arrows Gauche / Droite.
      const orientation = await page.getByRole("tablist").getAttribute("aria-orientation");
      expect(orientation).toBe(viewport.width >= 688 ? "vertical" : "horizontal");
      if (orientation === "horizontal") {
        await tab(page, "but").focus();
        await page.keyboard.press("ArrowRight");
        await expect(tab(page, "cartes")).toHaveAttribute("aria-selected", "true");
        await page.keyboard.press("ArrowLeft");
        await expect(tab(page, "but")).toHaveAttribute("aria-selected", "true");
      }
      for (const [id] of TABS) {
        const box = await tab(page, id).boundingBox();
        expect(box?.height ?? 0, `${id} tab height`).toBeGreaterThanOrEqual(43.8);
      }
    });

    if (viewport.width === 480) {
      test("la bande de droite : la roue, le livre et les trois boutons du 7 gardent 44 px", async ({
        page,
      }) => {
        await openPosition(page, SEVEN);
        await page.locator('[data-hand] [data-card="7H"]').click();
        await expect(page.locator("[data-seven-panel]")).toBeVisible();
        const boxes = await page
          .locator(
            "[data-settings-slot] button, [data-rules-button], [data-fast], [data-seven-buttons] button",
          )
          .evaluateAll((nodes) =>
            nodes
              .map((node) => {
                const box = node.getBoundingClientRect();
                return {
                  name: node.getAttribute("aria-label") ?? node.textContent?.trim() ?? "",
                  x: box.x,
                  y: box.y,
                  width: box.width,
                  height: box.height,
                };
              })
              .filter((box) => box.width > 0 && box.height > 0),
          );
        expect(boxes.length).toBeGreaterThanOrEqual(5);
        for (const box of boxes) {
          expect(box.width, `${box.name} width`).toBeGreaterThanOrEqual(43.8);
          expect(box.height, `${box.name} height`).toBeGreaterThanOrEqual(43.8);
          expect(box.y, `${box.name} top`).toBeGreaterThanOrEqual(-0.5);
          expect(box.y + box.height, `${box.name} bottom`).toBeLessThanOrEqual(320.5);
        }
        for (const [i, a] of boxes.entries()) {
          for (const b of boxes.slice(i + 1)) {
            const overlap =
              a.x < b.x + b.width - 0.5 &&
              b.x < a.x + a.width - 0.5 &&
              a.y < b.y + b.height - 0.5 &&
              b.y < a.y + a.height - 0.5;
            expect(overlap, `${a.name} over ${b.name}`).toBe(false);
          }
        }
      });
    }
  });
}

// The fifteen rule figures (05-UI-SPEC « Figures », D-15): drawn live with the galet and the game's
// knights, « Avant » above « Après » (or « Le coup » for the five without an after), from Bleu's seat.
const FIGURES: Record<string, { id: string; caption: string; move?: true }[]> = {
  but: [
    {
      id: "R-01.1",
      caption: "Bleu joue avec Rouge, Jaune avec Vert : les partenaires sont face à face.",
      move: true,
    },
  ],
  cartes: [
    { id: "R-07.1", caption: "La Dame avance de 12." },
    { id: "R-08.1", caption: "Le 4 fait reculer un cheval qui vient de sortir." },
  ],
  donne: [
    {
      id: "R-04.2",
      caption: "Quand les quatre ont choisi, les cartes changent de main ensemble.",
      move: true,
    },
    { id: "R-14.2", caption: "Aucune carte jouable : la main est posée face visible.", move: true },
  ],
  sortir: [
    { id: "R-06.1", caption: "L’As sort un cheval, ou avance de 1.", move: true },
    {
      id: "R-12.1",
      caption: "Personne ne dépasse un cheval qui vient de sortir sur son losange.",
      move: true,
    },
  ],
  sept: [
    { id: "R-10.2", caption: "Le 7 partagé en 3 + 4 sur deux chevaux." },
    { id: "R-10.4", caption: "Le 7 mange l’adversaire qu’il dépasse." },
  ],
  valet: [
    { id: "R-09.1", caption: "Le Valet échange un de tes chevaux avec celui d’un adversaire." },
  ],
  manger: [{ id: "R-11.1", caption: "S’arrêter sur un adversaire le mange." }],
  maison: [
    { id: "R-13.1", caption: "Au compte exact, le cheval entre dans sa maison." },
    {
      id: "R-13.5",
      caption: "Si le compte dépasse le fond de la maison, le cheval refait un tour.",
    },
  ],
  fini: [
    {
      id: "R-15.1",
      caption: "Quand tes quatre chevaux sont rentrés, tu joues ceux de ton partenaire.",
    },
  ],
  "regles-maison": [
    { id: "R-13.12", caption: "Après avoir reculé de 4, le cheval entre sans refaire le tour." },
  ],
};

/** The ids that appear more than once in the page. */
function duplicateIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll("[id]")) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
}

test.describe("les figures des règles", () => {
  test("chaque onglet montre ses figures, dessinées sur le galet avec les chevaux du jeu", async ({
    page,
  }) => {
    await openPosition(page, QUEEN);
    await book(page).click();
    await expect(sheet(page)).toBeVisible();
    const panel = page.getByRole("tabpanel");
    for (const [id] of TABS) {
      await tab(page, id).click();
      const expected = FIGURES[id] ?? [];
      const figures = panel.locator("[data-rule-figure]");
      await expect(figures, id).toHaveCount(expected.length);
      for (const [i, want] of expected.entries()) {
        const figure = figures.nth(i);
        await expect(figure).toHaveAttribute("data-rule-figure", want.id);
        await expect(figure.locator("figcaption")).toHaveText(want.caption);
        const alt = want.move
          ? `${want.caption} En haut, la position ; en bas, le coup.`
          : `${want.caption} En haut, avant le coup ; en bas, après.`;
        await expect(figure.getByRole("img", { name: alt, exact: true })).toHaveCount(1);
        // Two halves of the galet, each a board of its own, with its knights.
        await expect(figure.locator("[data-figure-half]")).toHaveCount(2);
        await expect(figure.locator("[data-figure-half] [data-board-art]")).toHaveCount(2);
        await expect(
          figure.locator('[data-figure-half="before"] [data-figure-knight]'),
        ).toHaveCount(16);
        // Always from Bleu's seat.
        await expect(figure.locator("[data-board-art]").first()).toHaveAttribute(
          "data-bottom",
          "bleu",
        );
        const tags = await figure.locator("[data-figure-tag]").allTextContents();
        expect(tags).toEqual(want.move ? ["Avant", "Le coup"] : ["Avant", "Après"]);
        if (want.move) {
          await expect(figure.locator('[data-figure-half="move"]')).toHaveCount(1);
        } else {
          await expect(figure.locator('[data-figure-half="after"]')).toHaveCount(1);
        }
        const box = await figure.boundingBox();
        expect(box?.width ?? 0, want.id).toBeLessThanOrEqual(480.5);
      }
      expect(await duplicateIds(page), `${id}: duplicate ids`).toEqual([]);
    }

    // The positions are the scenarios': the Dame's knight on 15 after, the 7 split on 8 and 24.
    await tab(page, "cartes").click();
    const queen = panel.locator('[data-rule-figure="R-07.1"]');
    await expect(
      queen.locator('[data-figure-half="before"] [data-figure-knight="bleu0"]'),
    ).toHaveAttribute("data-place", "ring:3");
    await expect(
      queen.locator('[data-figure-half="after"] [data-figure-knight="bleu0"]'),
    ).toHaveAttribute("data-place", "ring:15");
    // The 4 of Jaune's knight just out, drawn from Bleu's seat.
    const back = panel.locator('[data-rule-figure="R-08.1"]');
    await expect(
      back.locator('[data-figure-half="after"] [data-figure-knight="jaune0"]'),
    ).toHaveAttribute("data-place", "ring:14");
    await tab(page, "sortir").click();
    // « Le coup »: the knights concerned are ringed.
    await expect(
      panel.locator('[data-rule-figure="R-06.1"] [data-figure-half="move"] [data-figure-ring]'),
    ).toHaveCount(2);
    // The marks follow the setting, on the figures as on the board.
    await expect(
      panel.locator('[data-rule-figure="R-06.1"] [data-figure-knight] [data-knight-mark]').first(),
    ).toBeAttached();
    // The game behind keeps its own board and knights.
    await expect(page.locator("[data-board] [data-pawn]")).toHaveCount(16);
  });
});

test.describe("une figure à 480 x 320", () => {
  test.use({ viewport: { width: 480, height: 320 } });
  test.skip(({ isMobile }) => isMobile, "explicit viewport: desktop project only");

  test("la figure tient dans le panneau", async ({ page }) => {
    await openPosition(page, QUEEN);
    await book(page).click();
    await tab(page, "sept").click();
    const figure = page.locator('[data-rule-figure="R-10.2"]');
    await figure.scrollIntoViewIfNeeded();
    const fit = await page.evaluate(() => {
      const panel = document.querySelector('[role="tabpanel"]') as HTMLElement;
      const one = document.querySelector('[data-rule-figure="R-10.2"]') as HTMLElement;
      const p = panel.getBoundingClientRect();
      const f = one.getBoundingClientRect();
      return {
        left: f.left - p.left,
        right: p.right - f.right,
        width: f.width,
        sideways: panel.scrollWidth > panel.clientWidth + 1,
      };
    });
    expect(fit.left).toBeGreaterThanOrEqual(-0.5);
    expect(fit.right).toBeGreaterThanOrEqual(-0.5);
    expect(fit.width).toBeGreaterThan(200);
    expect(fit.sideways).toBe(false);
  });
});
