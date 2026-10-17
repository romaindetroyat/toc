import { type Browser, expect, type Page, type TestInfo, test } from "@playwright/test";
import { createTable, deviceOptions, join, seatTile } from "./online.ts";

// The waiting room (plan 02-05, D-03, D-12): each person takes a colour, the creator (« chef de
// table ») sets the computers' strength, moves people and starts; the toasts tell who arrived and who
// was moved; a person without a seat is asked first and then sees « La partie a déjà commencé »; a
// fifth person at a full table is told so. Then the layouts of the UI-SPEC fit table.

const toast = (page: Page) => page.locator("[data-toast]");

async function device(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const context = await browser.newContext(deviceOptions(testInfo));
  return context.newPage();
}

test("the creator arranges the table, moves a person, and starts without the unseated one", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const id = await createTable(request, { pace: "zero" });
  const romain = await device(browser, testInfo);
  const bruno = await device(browser, testInfo);
  const celine = await device(browser, testInfo);

  await join(romain, id, "Romain");
  await seatTile(romain, "bleu").click();
  await expect(seatTile(romain, "bleu")).toHaveAttribute("data-seat-state", "you");
  // The chef de table's crown is on the own tile's sentence.
  await expect(seatTile(romain, "bleu")).toContainText(/chef de table/);

  await join(bruno, id, "Bruno");
  await expect(toast(romain)).toHaveText("Bruno a rejoint la table.");
  await seatTile(bruno, "jaune").click();
  await expect(seatTile(bruno, "jaune")).toHaveAttribute("data-seat-state", "you");
  await expect(seatTile(romain, "jaune")).toHaveAttribute("data-seat-state", "human");
  // Only the creator has « Lancer la partie »; Bruno waits.
  await expect(bruno.getByRole("button", { name: "Lancer la partie" })).toHaveCount(0);
  await expect(bruno.getByRole("heading", { name: "En attente du départ" })).toBeVisible();

  // The creator sets Rouge to Champion: everyone sees it at once.
  await romain
    .getByRole("radiogroup", { name: "Force de Rouge, ordinateur" })
    .getByRole("radio", { name: "Champion" })
    .click();
  await expect(bruno.locator('[data-computer-line="rouge"]')).toHaveText(
    /^Rouge\s:\sordinateur, Champion$/,
  );
  await expect(seatTile(bruno, "rouge")).toContainText("Champion");

  // The creator moves Bruno to Vert; Bruno is told.
  await expect(seatTile(romain, "jaune")).toHaveAccessibleName("Déplacer Bruno (Jaune)");
  await seatTile(romain, "jaune").click();
  const sheet = romain.getByRole("dialog", { name: "Déplacer Bruno" });
  await expect(sheet.getByRole("button", { name: "Échanger avec Romain (Bleu)" })).toBeVisible();
  await sheet.getByRole("button", { name: "Vers Vert (place libre)" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(seatTile(bruno, "vert")).toHaveAttribute("data-seat-state", "you");
  await expect(toast(bruno)).toHaveText(/^Romain a changé ta place\s: tu es maintenant Vert\.\s*$/);
  await expect(seatTile(romain, "jaune")).toHaveAttribute("data-seat-state", "free");
  // Bruno may not move anyone: Romain's tile is not a button for him.
  await expect(bruno.locator('button[data-seat-tile="bleu"]')).toHaveCount(0);

  // Céline arrives and stays without a seat.
  await join(celine, id, "Céline");
  await expect(romain.locator("[data-unseated]")).toHaveText(/^Sans place\s: Céline\.$/);
  await expect(celine.getByRole("heading", { name: "Choisis ta place" })).toBeVisible();

  // Starting without her asks first; « Attendre » keeps the waiting room.
  await romain.getByRole("button", { name: "Lancer la partie" }).click();
  const confirm = romain.getByRole("dialog", { name: /^Lancer sans Céline\s\?$/ });
  await expect(confirm).toContainText(
    "Céline n’a pas de place et ne pourra pas jouer cette partie.",
  );
  await expect(confirm.getByRole("button", { name: "Attendre" })).toBeFocused();
  await confirm.getByRole("button", { name: "Attendre" }).click();
  await expect(confirm).toHaveCount(0);
  await romain.getByRole("button", { name: "Lancer la partie" }).click();
  await romain.getByRole("button", { name: "Lancer quand même" }).click();

  for (const page of [romain, bruno]) {
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
  }
  await expect(celine.locator('[data-notice="commencee"]')).toBeVisible();
  await expect(celine.getByRole("heading", { name: "La partie a déjà commencé" })).toBeVisible();
  await expect(
    celine.getByText("Seuls les joueurs de cette partie peuvent la rejoindre."),
  ).toBeVisible();
});

test("« Libérer ma place » and taking another seat; the creator unseated cannot start", async ({
  browser,
  request,
}, testInfo) => {
  const id = await createTable(request, { pace: "zero" });
  const romain = await device(browser, testInfo);
  await join(romain, id, "Romain");
  await expect(romain.getByRole("button", { name: "Lancer la partie" })).toBeDisabled();
  await expect(romain.getByText("Prends une place pour lancer la partie.")).toBeVisible();
  await seatTile(romain, "rouge").click();
  await expect(seatTile(romain, "rouge")).toHaveAttribute("data-seat-state", "you");
  await expect(seatTile(romain, "vert")).toHaveAttribute("data-seat-state", "free");
  await seatTile(romain, "vert").click();
  await expect(seatTile(romain, "vert")).toHaveAttribute("data-seat-state", "you");
  await expect(seatTile(romain, "rouge")).toHaveAttribute("data-seat-state", "free");
  await romain.getByRole("button", { name: "Libérer ma place" }).click();
  await expect(seatTile(romain, "vert")).toHaveAttribute("data-seat-state", "free");
  await expect(romain.getByRole("button", { name: "Libérer ma place" })).toHaveCount(0);
  await expect(romain.getByRole("button", { name: "Lancer la partie" })).toBeDisabled();

  // Bruno sits, then leaves the table from « Réglages » (confirmed); Romain is told, the seat is free.
  const bruno = await device(browser, testInfo);
  await join(bruno, id, "Bruno");
  await seatTile(bruno, "jaune").click();
  await expect(seatTile(romain, "jaune")).toHaveAttribute("data-seat-state", "human");
  await bruno.getByRole("button", { name: "Réglages" }).click();
  const settings = bruno.getByRole("dialog", { name: "Réglages" });
  await expect(settings.getByRole("link", { name: "Tester les sons" })).toHaveCount(0);
  await settings.getByRole("button", { name: "Quitter la table" }).click();
  const confirm = bruno.getByRole("dialog", { name: /^Quitter la table\s\?$/ });
  await expect(confirm.getByRole("button", { name: "Rester à la table" })).toBeFocused();
  await confirm.getByRole("button", { name: "Quitter la table" }).click();
  await expect(bruno).toHaveURL(/#\/$/);
  await expect(toast(romain)).toHaveText(/^Bruno a quitté la table\.\s*$/);
  await expect(seatTile(romain, "jaune")).toHaveAttribute("data-seat-state", "free");
});

test("a fifth person at a table of four sees « La table est complète »", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const id = await createTable(request, { pace: "zero" });
  const names = ["Romain", "Bruno", "Céline", "Paul"] as const;
  const colours = ["bleu", "jaune", "rouge", "vert"] as const;
  for (const [i, name] of names.entries()) {
    const page = await device(browser, testInfo);
    await join(page, id, name);
    await seatTile(page, colours[i] as string).click();
    await expect(seatTile(page, colours[i] as string)).toHaveAttribute("data-seat-state", "you");
  }
  const fifth = await device(browser, testInfo);
  await join(fifth, id, "Zoé");
  await expect(fifth.locator('[data-notice="complete"]')).toBeVisible();
  await expect(fifth.getByRole("heading", { name: "La table est complète" })).toBeVisible();
  await expect(
    fifth.getByText("Les quatre places sont prises. Une place peut se libérer avant le départ."),
  ).toBeVisible();
  await expect(fifth.getByRole("button", { name: "Retour à l’accueil" })).toBeVisible();
  await expect(fifth.getByRole("button", { name: "Inviter" })).toHaveCount(0);
  for (const colour of colours) {
    await expect(seatTile(fifth, colour)).toHaveAttribute("data-seat-state", "human");
  }
});

// --- Layouts (02-UI-SPEC « Waiting room » fit table, creator with three free seats) ---

async function scroll(page: Page) {
  return page.evaluate(() => ({
    sideways: document.documentElement.scrollWidth - window.innerWidth,
    down: document.documentElement.scrollHeight - window.innerHeight,
  }));
}

/** The action row lies entirely inside the viewport. */
async function actionsVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const row = document.querySelector("[data-room-actions]")?.getBoundingClientRect();
    return (
      row !== undefined &&
      row.height > 0 &&
      row.top >= 0 &&
      row.bottom <= window.innerHeight + 0.5 &&
      row.left >= 0 &&
      row.right <= window.innerWidth + 0.5
    );
  });
}

const FITS = [
  { width: 1280, height: 800, layout: "computer" },
  { width: 1024, height: 640, layout: "computer" },
  { width: 844, height: 390, layout: "two" },
  { width: 750, height: 342, layout: "two" },
  { width: 667, height: 375, layout: "two" },
  { width: 640, height: 360, layout: "two" },
] as const;

test("the waiting room fits the target sizes, scrolls in one column, and asks to turn upright", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(90_000);
  const id = await createTable(request, { pace: "zero" });
  const romain = await device(browser, testInfo);
  await join(romain, id, "Romain");
  await seatTile(romain, "bleu").click();
  await expect(seatTile(romain, "bleu")).toHaveAttribute("data-seat-state", "you");
  const room = romain.locator("[data-waiting-room]");

  for (const size of FITS) {
    await romain.setViewportSize({ width: size.width, height: size.height });
    await expect(room, `${size.width}x${size.height}`).toHaveAttribute("data-layout", size.layout);
    await expect(romain.locator("[data-strength-row]")).toHaveCount(3);
    expect(await scroll(romain), `${size.width}x${size.height}`).toEqual({ sideways: 0, down: 0 });
    expect(await actionsVisible(romain), `${size.width}x${size.height}`).toBe(true);
    // Two columns: the seats beside the right column.
    const seats = await romain.locator('[data-seat-tile="jaune"]').boundingBox();
    const actions = await romain.locator("[data-room-actions]").boundingBox();
    expect(seats && actions && actions.x > seats.x + seats.width).toBe(true);
  }

  for (const size of [
    { width: 568, height: 320 },
    { width: 480, height: 320 },
  ]) {
    await romain.setViewportSize(size);
    await expect(room).toHaveAttribute("data-layout", "one");
    const now = await scroll(romain);
    expect(now.sideways).toBe(0);
    expect(now.down).toBeGreaterThan(0);
    await romain.evaluate(() => window.scrollTo(0, 0));
    expect(await actionsVisible(romain), `${size.width} top`).toBe(true);
    await romain.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await actionsVisible(romain), `${size.width} bottom`).toBe(true);
    await romain.evaluate(() => window.scrollTo(0, 0));
  }

  await romain.setViewportSize({ width: 390, height: 844 });
  await expect(romain.locator("[data-rotate-prompt]")).toBeVisible();
  await expect(room).toHaveAttribute("inert", "");
  await romain.setViewportSize({ width: 844, height: 390 });
  await expect(romain.locator("[data-rotate-prompt]")).toHaveCount(0);
});
