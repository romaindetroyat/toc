import { expect, type Page, test } from "@playwright/test";
import { exchange } from "./jouer.ts";

// Who starts the deal (Romain, 2026-10-17: « Il faut aussi savoir quel joueur va jouer le premier la
// donne actuelle », plan 03-11). The player after the dealer, clockwise, starts each deal (RULES.md
// R-03, G9). The deal banner ends with « Tu commences. » or « {Nom} commence. », a « 1er » token stands
// on the wood just outside the felt on that player's side for the whole deal, and the computer's
// bottom bar and the phone's sheet « Infos de la partie » say « Commence : {Nom} ». The token never
// covers a knight, the piles or the felt.

/** The clockwise seat order of the engine (COLORS): bleu, jaune, rouge, vert. */
const NEXT: Record<string, string> = { bleu: "jaune", jaune: "rouge", rouge: "vert", vert: "bleu" };

/** Seeds whose first deal is started by each seat (the player is bleu, at the bottom). */
const SEEDS: Record<string, string> = {
  bleu: "05".repeat(16),
  jaune: "04".repeat(16),
  rouge: "02".repeat(16),
  vert: "00".repeat(16),
};

async function open(page: Page, seed: string): Promise<void> {
  await page.goto("/");
  await page.goto(`/#/partie?graine=${seed}`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
}

/** The text of the line « Commence : … » of this project: the bottom bar, or the pill's sheet. */
async function starterLine(page: Page, project: string): Promise<string> {
  if (project === "phone") {
    await page.locator('[data-info-bar][data-form="pill"]').click();
    const line = page.locator("[data-info-sheet] [data-starter]");
    await expect(line).toBeVisible();
    const text = (await line.textContent()) ?? "";
    await page.getByRole("button", { name: "Fermer" }).click();
    await expect(page.locator("[data-info-sheet]")).toHaveCount(0);
    return text;
  }
  const line = page.locator('[data-info-bar][data-form="column"] [data-starter]');
  await expect(line).toBeVisible();
  return (await line.textContent()) ?? "";
}

type Box = { x: number; y: number; width: number; height: number };
const meet = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Whether the token's box meets a shape of the ring or a dot of the drawing, a knight, the talon, the
 * défausse or the felt (an ellipse inscribed in the felt button's box). Returns what it meets.
 */
async function overlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    const token = document.querySelector("[data-felt] [data-starter] rect");
    const felt = document.querySelector("[data-felt-button]");
    if (token === null || felt === null) return ["no token or no felt"];
    const t = box(token);
    const hit: string[] = [];
    const meets = (b: DOMRect) =>
      t.left < b.right && b.left < t.right && t.top < b.bottom && b.top < t.bottom;
    // The drawing's small shapes: the ring's discs, losanges, carrés and numbers, the home and
    // stable dots (the wood's grain and the riders are larger than 80 px, the felt is checked below).
    for (const el of document.querySelectorAll(
      ".art-layer circle, .art-layer rect, .art-layer polygon, .art-layer text",
    )) {
      const b = box(el);
      if (b.width > 0 && b.width < 80 && b.height < 80 && meets(b)) {
        hit.push(`dessin ${el.tagName} ${Math.round(b.left)},${Math.round(b.top)}`);
      }
    }
    for (const el of document.querySelectorAll("[data-pawn], [data-talon], [data-discard]")) {
      const b = box(el);
      if (b.width > 0 && meets(b)) {
        hit.push(
          el.getAttribute("data-pawn") ?? (el.hasAttribute("data-talon") ? "talon" : "défausse"),
        );
      }
    }
    const f = box(felt);
    const cx = f.left + f.width / 2;
    const cy = f.top + f.height / 2;
    for (const [x, y] of [
      [t.left, t.top],
      [t.right, t.top],
      [t.left, t.bottom],
      [t.right, t.bottom],
    ] as const) {
      if (((x - cx) / (f.width / 2)) ** 2 + ((y - cy) / (f.height / 2)) ** 2 <= 1) hit.push("tapis");
    }
    return hit;
  });
}

test("the deal says who starts: banner, « 1er » token, « Commence : … »", async ({ page }, info) => {
  // Pégase, Ourasi…: a computer seat starts (rouge, the player's partner at the top).
  await open(page, SEEDS.rouge as string);
  const banner = page.locator("[data-deal-banner]");
  await expect(banner).toBeVisible();
  const starts = page.locator("[data-deal-banner] [data-banner-starts]");
  await expect(starts).toHaveText(/^\S.* commence\.$/);
  const name = ((await starts.textContent()) ?? "").replace(/ commence\.$/, "");
  // The banner's region is polite and live: a screen reader hears the line with the deal.
  await expect(page.locator(".wrap[aria-live='polite']").filter({ has: banner })).toHaveCount(1);

  const dealer = await page.locator("[data-felt] [data-dealer]").getAttribute("data-dealer");
  const token = page.locator("[data-felt] [data-starter]");
  await expect(token).toHaveAttribute("data-starter", NEXT[dealer as string] as string);
  await expect(token).toHaveAttribute("data-starter", "rouge");
  await expect(token).toHaveText("1er");
  await expect(banner).toHaveCount(0, { timeout: 8_000 });

  expect(await starterLine(page, info.project.name)).toBe(`Commence : ${name}`);

  // The token stays all deal long: after the exchange, while the play goes on.
  await exchange(page);
  await expect(page.locator("[data-action-zone]")).not.toHaveAttribute("data-state", "exchange");
  await expect(token).toHaveAttribute("data-starter", "rouge");
});

test("the player is told « Tu commences. » and « Commence : toi »", async ({ page }, info) => {
  await open(page, SEEDS.bleu as string);
  await expect(page.locator("[data-deal-banner] [data-banner-starts]")).toHaveText("Tu commences.");
  await expect(page.locator("[data-felt] [data-starter]")).toHaveAttribute("data-starter", "bleu");
  await expect(page.locator("[data-felt] [data-dealer]")).toHaveAttribute("data-dealer", "vert");
  await expect(page.locator("[data-deal-banner]")).toHaveCount(0, { timeout: 8_000 });
  expect(await starterLine(page, info.project.name)).toBe("Commence : toi");
});

test("the « 1er » token covers no knight, pile or felt, on every side and size", async ({
  page,
}, info) => {
  const sizes =
    info.project.name === "phone"
      ? [
          { width: 844, height: 390 },
          { width: 750, height: 342 },
          { width: 480, height: 320 },
        ]
      : [{ width: 1280, height: 800 }];
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const [seat, seed] of Object.entries(SEEDS)) {
      await open(page, seed);
      const token = page.locator("[data-felt] [data-starter]");
      await expect(token).toHaveAttribute("data-starter", seat);
      const box = (await token.boundingBox()) as Box;
      expect(box.width, `${seat} ${size.width}x${size.height}`).toBeGreaterThan(20);
      const board = (await page.locator("[data-board]").boundingBox()) as Box;
      expect(meet(box, board)).toBe(true);
      expect(await overlaps(page), `${seat} ${size.width}x${size.height}`).toEqual([]);
    }
  }
});
