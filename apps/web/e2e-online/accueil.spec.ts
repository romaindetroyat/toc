import { expect, type Page, test } from "@playwright/test";
import { deviceOptions, join, seatTile } from "./online.ts";

// « Accueil » and « Mes parties en cours » against the real Worker and GameRoom (plan 02-04, D-01,
// D-02, D-06): a table created from the home after the first-name prompt, its row on the home, the
// row that names the others once they sit, « Retirer » then « Remettre », and an entry the server no
// longer knows, removed with one « effacée » toast.

const row = (page: Page, id: string) => page.locator(`[data-table-row="${id}"]`);
const toast = (page: Page) => page.locator("[data-toast]");

test("créer une table depuis l’accueil, la retrouver dans « Mes parties en cours »", async ({
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const anaDevice = await browser.newContext(deviceOptions(testInfo));
  const ana = await anaDevice.newPage();

  // No first name yet: the prompt comes first, with the creation's context line.
  await ana.goto("/");
  await expect(ana.locator("[data-tables-empty]")).toContainText("Aucune partie en cours");
  await ana.locator('[data-home-choice="table"]').click();
  const prompt = ana.locator("[data-name-prompt]");
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText("Les autres joueurs le verront à la table.");
  await expect(prompt).toContainText("Cet appareil s’en souviendra.");
  await prompt.getByRole("textbox", { name: "Ton prénom" }).fill("Ana");
  await prompt.getByRole("button", { name: "Continuer" }).click();

  // The table is created and its waiting room opens; Ana is its creator.
  await expect(ana).toHaveURL(/#\/table\/[A-Za-z0-9_-]{22}$/);
  const id = new URL(ana.url()).hash.slice("#/table/".length);
  await expect(seatTile(ana, "bleu")).toBeVisible();
  await seatTile(ana, "bleu").click();
  await expect(seatTile(ana, "bleu")).toHaveAttribute("data-seat-state", "you");

  // Back home: the row, alone at the table, in the waiting room; the name line shows « Ana ».
  await ana.goto("/");
  await expect(ana.locator("[data-name-line]")).toContainText("Ana");
  await expect(row(ana, id)).toContainText("Personne d’autre pour l’instant");
  await expect(row(ana, id)).toContainText("Salle d’attente");
  await expect(row(ana, id).getByRole("link")).toHaveAttribute("href", `#/table/${id}`);
  await expect(row(ana, id).getByRole("link")).toHaveAccessibleName(
    /^Reprendre la partie\s: Personne d’autre pour l’instant, Salle d’attente · .+\. Ta couleur\s: Bleu\.$/,
  );

  // Ben opens the link: the prompt says who invites him; he sits on Jaune.
  const benDevice = await browser.newContext(deviceOptions(testInfo));
  const ben = await benDevice.newPage();
  await ben.goto(`/#/table/${id}`);
  await expect(ben.locator("[data-name-prompt]")).toContainText(
    "Ana t’invite à une partie de TOC.",
  );
  await join(ben, id, "Ben");
  await seatTile(ben, "jaune").click();
  await expect(seatTile(ben, "jaune")).toHaveAttribute("data-seat-state", "you");

  // Ana's home, reloaded, names Ben; a row opens its table.
  await ana.reload();
  await expect(row(ana, id)).toContainText("Avec Ben");
  await expect(row(ana, id)).toContainText("Salle d’attente");

  // « Retirer cette partie de la liste », then « Remettre » puts it back.
  await row(ana, id).getByRole("button", { name: "Retirer cette partie de la liste" }).click();
  await expect(row(ana, id)).toHaveCount(0);
  await expect(toast(ana)).toContainText("Partie retirée de la liste.");
  await toast(ana).getByRole("button", { name: "Remettre" }).click();
  await expect(row(ana, id)).toContainText("Avec Ben");

  await row(ana, id).getByRole("link").click();
  await expect(ana).toHaveURL(new RegExp(`#/table/${id}$`));
  await expect(seatTile(ana, "bleu")).toHaveAttribute("data-seat-state", "you");

  await anaDevice.close();
  await benDevice.close();
});

test("une partie que le serveur ne connaît plus quitte la liste, avec un seul message", async ({
  page,
}) => {
  const unknown = ["Zz_unknown-accueil-01a", "Zz_unknown-accueil-02b"];
  await page.addInitScript((ids) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem(
      "toc.tables.v1",
      JSON.stringify(ids.map((id, n) => ({ id, seat: "bleu", joinedAt: Date.now() - n }))),
    );
  }, unknown);
  await page.goto("/");
  await expect(toast(page)).toContainText(
    "2 parties arrêtées depuis plus de 30 jours ont été effacées.",
  );
  for (const id of unknown) await expect(row(page, id)).toHaveCount(0);
  await expect(page.locator("[data-tables-empty]")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("toc.tables.v1"))).toBe("[]");
});

test("hors ligne, « Créer une table en ligne » ne fait que le dire", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.locator('[data-home-choice="table"]')).toBeVisible();
  await context.setOffline(true);
  await page.locator('[data-home-choice="table"]').click();
  await expect(toast(page)).toContainText(
    "Pas de connexion\u00a0: la table en ligne a besoin d’Internet.",
  );
  await expect(page).toHaveURL(/#?\/?$/);
  await expect(page.locator("[data-name-prompt]")).toHaveCount(0);
  await context.setOffline(false);
});
