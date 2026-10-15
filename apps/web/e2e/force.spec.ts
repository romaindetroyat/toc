import { expect, type Page, test } from "@playwright/test";
import { exchange, playSimpleMove, untilOwnTurn } from "./jouer.ts";

// The computer's strength on the launch screen (phase 3, D-01 to D-03): one row per computer seat, the
// five horse names, Galopeur on a first visit, the choice remembered per role, and a game played at
// the chosen levels.

const KEY = "toc.settings.v1";
const SEED = "1234567890abcdef1234567890abcdef";

const row = (page: Page, role: "partner" | "left" | "right") =>
  page.locator(`[data-strength-row="${role}"]`);
const level = (page: Page, role: "partner" | "left" | "right", name: string) =>
  row(page, role).getByRole("radio", { name, exact: true });

async function stored(page: Page): Promise<Record<string, unknown>> {
  const text = await page.evaluate((key) => localStorage.getItem(key), KEY);
  return JSON.parse(text ?? "{}") as Record<string, unknown>;
}

test("force: une rangée par place de l’ordinateur, Galopeur la première fois", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Force de l’ordinateur" })).toBeVisible();
  const rows = page.locator("[data-strength-row]");
  await expect(rows).toHaveCount(3);
  // The partner, then the opponent on the left (next seat clockwise), then the one on the right.
  expect(
    await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-strength-row"))),
  ).toEqual(["partner", "left", "right"]);
  await expect(row(page, "partner").getByRole("radiogroup")).toHaveAccessibleName(
    "Force de Rouge, ton partenaire",
  );
  await expect(row(page, "left").getByRole("radiogroup")).toHaveAccessibleName(
    "Force de Jaune, adversaire",
  );
  await expect(row(page, "right").getByRole("radiogroup")).toHaveAccessibleName(
    "Force de Vert, adversaire",
  );
  await expect(row(page, "partner")).toContainText("Partenaire");
  await expect(row(page, "left")).toContainText("Adversaire");
  for (const role of ["partner", "left", "right"] as const) {
    await expect(row(page, role).getByRole("radio")).toHaveText([
      "Poulain",
      "Trotteur",
      "Galopeur",
      "Pur-sang",
      "Champion",
    ]);
    await expect(level(page, role, "Galopeur")).toHaveAttribute("aria-checked", "true");
    await expect(row(page, role).locator('[aria-checked="true"]')).toHaveCount(1);
  }
});

test("force: « Trotteur » pour le partenaire est retenu, aussi quand la couleur change", async ({
  page,
}) => {
  await page.goto("/");
  await level(page, "partner", "Trotteur").click();
  await expect(level(page, "partner", "Trotteur")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "partner", "Galopeur")).toHaveAttribute("aria-checked", "false");
  expect((await stored(page)).botLevels).toEqual({ partner: 2, left: 3, right: 3 });

  await page.reload();
  await expect(level(page, "partner", "Trotteur")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "left", "Galopeur")).toHaveAttribute("aria-checked", "true");

  // Another colour: the partner is now Vert, and it keeps the partner's level.
  await page.getByRole("radio", { name: "Jaune", exact: true }).click();
  await expect(row(page, "partner").getByRole("radiogroup")).toHaveAccessibleName(
    "Force de Vert, ton partenaire",
  );
  await expect(level(page, "partner", "Trotteur")).toHaveAttribute("aria-checked", "true");
  await expect(row(page, "left").getByRole("radiogroup")).toHaveAccessibleName(
    "Force de Rouge, adversaire",
  );
  expect((await stored(page)).botLevels).toEqual({ partner: 2, left: 3, right: 3 });
});

test("force: des niveaux abîmés en mémoire donnent Galopeur, sans erreur", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    KEY,
    JSON.stringify({ botLevels: { partner: "5", left: 99, right: 4 } }),
  ] as const);
  await page.goto("/");
  await expect(level(page, "partner", "Galopeur")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "left", "Galopeur")).toHaveAttribute("aria-checked", "true");
  await expect(level(page, "right", "Pur-sang")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("force: une partie avec trois Trotteurs se joue sans erreur", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
    KEY,
    JSON.stringify({ botLevels: { partner: 2, left: 2, right: 2 } }),
  ] as const);
  await page.goto("/");
  await page.goto(`/#/partie?graine=${SEED}&vitesse=test`);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await exchange(page);
  for (let turn = 0; turn < 2; turn++) {
    await untilOwnTurn(page);
    await playSimpleMove(page);
  }
  await expect(page.locator("[data-error-screen]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("force: « Jouer la partie » avec un Champion ouvre la partie sans erreur", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await level(page, "right", "Champion").click();
  await expect(level(page, "right", "Champion")).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Jouer la partie" }).click();
  await expect(page).toHaveURL(/#\/partie$/);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(page.locator("[data-action-zone]")).toHaveAttribute("data-state", "exchange");
  await expect(page.locator("[data-error-screen]")).toHaveCount(0);
  expect(errors).toEqual([]);
});
