import { expect, type Page, test } from "@playwright/test";
import {
  copyPasskey,
  mintInvitation,
  passkeyContext,
  RP_ID,
  signInFromHome,
  signUp,
  uniquePseudo,
} from "./comptes.ts";
import { createTable, seatTile } from "./online.ts";

// « Se connecter » on a new device (plan 04-09, ACCT-02; 04-UI-SPEC « Small tiles », « Sign-in
// sheet », « Mes parties en cours »), end to end against `wrangler dev`: A signs up on a first device
// and sits at a table; the passkey is copied to a second device (a synced passkey); there the guest
// home offers « Se connecter », the sheet's « Utiliser ma clé d’accès » signs in, and A's table is in
// « Mes parties en cours ». A passkey TOC does not know says so. A 20-character pseudo never spills.

const tile = (page: Page, kind: string) => page.locator(`[data-small-tile="${kind}"]`);
const row = (page: Page, id: string) => page.locator(`[data-table-row="${id}"]`);

test("se connecter sur un nouvel appareil avec sa clé, et y retrouver ses parties", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const id = await createTable(request, { pace: "zero" });

  // Device 1: A signs up and sits at the table under the pseudo.
  const first = await passkeyContext(browser, testInfo);
  const one = await first.newPage();
  const pseudo = uniquePseudo("Anouk");
  await signUp(one, await mintInvitation(request), pseudo);
  await one.goto(`/#/table/${id}?vitesse=test`);
  await seatTile(one, "bleu").click();
  await expect(seatTile(one, "bleu")).toHaveAttribute("data-seat-state", "you");

  // Device 2: the passkey synced, nothing else. The guest home: « Se connecter » / « Créer un compte ».
  const second = await passkeyContext(browser, testInfo);
  expect(await copyPasskey(first, second)).toBe(1);
  const two = await second.newPage();
  await two.goto("/");
  await expect(tile(two, "connexion")).toContainText("Se connecter");
  await expect(tile(two, "connexion")).toContainText("Créer un compte");
  await expect(tile(two, "connexion")).toHaveAccessibleName("Se connecter ou créer un compte");
  await expect(tile(two, "connexion")).toHaveAttribute("aria-haspopup", "dialog");
  await expect(tile(two, "compte")).toHaveCount(0);
  await expect(row(two, id)).toHaveCount(0);

  // The sheet: its text, the computer's note, the recovery link and the hint.
  await tile(two, "connexion").click();
  const sheet = two.locator("[data-signin-sheet]");
  await expect(two.getByRole("dialog", { name: "Se connecter" })).toBeVisible();
  await expect(sheet).toContainText("Utilise la clé d’accès de ton compte TOC.");
  await expect(sheet).toContainText("Sur un ordinateur, tu peux choisir ton téléphone comme clé");
  await expect(
    sheet.getByRole("link", { name: "J’ai perdu ma clé : code de secours" }),
  ).toBeVisible();
  await expect(sheet).toContainText("Il faut l’invitation d’un proche qui a déjà un compte");

  // « Utiliser ma clé d’accès »: signed in, the toast, the two tiles, the focus on « Mon compte ».
  await sheet.getByRole("button", { name: "Utiliser ma clé d’accès" }).click();
  await expect(two.locator("[data-toast]")).toContainText(`Bonjour ${pseudo}`);
  await expect(sheet).toHaveCount(0);
  await expect(tile(two, "amis")).toContainText("Mes amis");
  await expect(tile(two, "amis")).toContainText("Inviter un proche");
  await expect(tile(two, "compte")).toHaveAccessibleName(`Mon compte (${pseudo})`);
  await expect(tile(two, "compte")).toBeFocused();
  await expect(tile(two, "connexion")).toHaveCount(0);
  await expect(two.locator('[data-home-choice="table"]')).toContainText(
    "Invite tes amis ou partage un lien",
  );

  // A's table, played on device 1, is in « Mes parties en cours » on device 2.
  await expect(row(two, id)).toBeVisible();
  await expect(row(two, id).getByRole("link")).toHaveAttribute("href", `#/table/${id}`);

  // Signed out (D-12): the account's rows hide but stay on the device; they come back at sign-in.
  await one.goto("/");
  await expect(row(one, id)).toBeVisible();
  expect(
    await one.evaluate(async () => {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      localStorage.removeItem("toc.me.v1");
      return response.status;
    }),
  ).toBe(204);
  await one.reload();
  await expect(tile(one, "connexion")).toBeVisible();
  await expect(row(one, id)).toHaveCount(0);
  const kept = await one.evaluate(() => localStorage.getItem("toc.tables.v1") ?? "");
  expect(kept).toContain(id);
  await signInFromHome(one);
  await expect(one.locator("[data-toast]")).toContainText(`Bonjour ${pseudo}`);
  await expect(row(one, id)).toBeVisible();

  await second.close();
  await first.close();
});

test("une clé d’accès que TOC ne connaît pas le dit", async ({ browser }, testInfo) => {
  const context = await passkeyContext(browser, testInfo);
  // A passkey for this address that no TOC account ever registered.
  await context.credentials.create(RP_ID);
  const page = await context.newPage();
  await signInFromHome(page);
  const sheet = page.locator("[data-signin-sheet]");
  await expect(sheet.locator("[data-signin-line]")).toHaveText(
    /^Cette clé d’accès n’ouvre aucun compte TOC\. Elle a peut-être été retirée\. Essaie une autre clé ou ton code de secours\.$/,
  );
  await expect(sheet).toBeVisible();
  await expect(tile(page, "connexion")).toBeVisible();
  await context.close();
});

test("un pseudo de 20 caractères ne déborde jamais de sa petite tuile", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const context = await passkeyContext(browser, testInfo);
  const page = await context.newPage();
  const pseudo = uniquePseudo("Marie-Madeleine");
  expect(pseudo).toHaveLength(20);
  await signUp(page, await mintInvitation(request), pseudo);
  for (const size of [
    { width: 844, height: 390, tile: 136 },
    { width: 480, height: 320, tile: null },
    { width: 1280, height: 800, tile: 152 },
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/");
    const compte = tile(page, "compte");
    await expect(compte).toHaveAccessibleName(`Mon compte (${pseudo})`);
    await expect(compte).toHaveAttribute("title", pseudo);
    const fit = await compte.evaluate((el) => {
      const sub = el.querySelector<HTMLElement>("[data-small-tile-sub]");
      const box = el.getBoundingClientRect();
      return {
        width: box.width,
        height: box.height,
        right: box.right,
        cut: sub !== null && sub.scrollWidth > sub.clientWidth,
        ellipsis: sub === null ? "" : getComputedStyle(sub).textOverflow,
        page: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(fit.height).toBe(48);
    // 136 and 152 cut the pseudo with an ellipsis; one column (480 × 320) has wider tiles.
    if (size.tile !== null) {
      expect(fit.width).toBe(size.tile);
      expect(fit.cut, `${size.width} × ${size.height}`).toBe(true);
    }
    expect(fit.ellipsis).toBe("ellipsis");
    expect(fit.right).toBeLessThanOrEqual(size.width);
    expect(fit.page).toBe(0);
  }
  await context.close();
});
