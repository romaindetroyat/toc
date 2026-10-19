import { expect, type Page, test } from "@playwright/test";
import { mintInvitation, passkeyContext, signUp, uniquePseudo } from "./comptes.ts";

// « Retrouver mon compte » on a new device (plan 04-09, D-02, SC1; 04-UI-SPEC « Recovery »), end to
// end against `wrangler dev`: A signs up on a first device and keeps the code; a second device with a
// fresh authenticator types the pseudo and the code (lower case, no dashes), creates its passkey, gets
// a new code, and lands signed in with « Compte retrouvé. … ». The first device's session has ended.
// A wrong pseudo and a wrong code read the same; five wrong codes lock the account for 15 minutes.

const step = (page: Page, n: number) => page.locator(`[data-recover-step="${n}"]`);
const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

async function typeCode(page: Page, pseudo: string, code: string): Promise<void> {
  const form = step(page, 1);
  await form.getByLabel("Ton pseudo").fill(pseudo);
  await form.getByLabel("Code de secours").fill("");
  await form.getByLabel("Code de secours").pressSequentially(code);
  await form.getByRole("button", { name: "Vérifier le code" }).click();
}

test("retrouver son compte avec le code de secours sur un nouvel appareil", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const first = await passkeyContext(browser, testInfo);
  const one = await first.newPage();
  const pseudo = uniquePseudo("Romane");
  const code = await signUp(one, await mintInvitation(request), pseudo);

  // A new device, nothing on it: the sign-in sheet's « J’ai perdu ma clé : code de secours ».
  const second = await passkeyContext(browser, testInfo);
  const two = await second.newPage();
  await two.goto("/");
  await two.locator('[data-small-tile="connexion"]').click();
  await two.getByRole("link", { name: "J’ai perdu ma clé : code de secours" }).click();
  await expect(two).toHaveURL(/#\/secours$/);
  await expect(step(two, 1)).toBeVisible();
  await expect(h1(two)).toHaveText("Retrouver mon compte");
  await expect(two.locator("[data-signin-sheet]")).toHaveCount(0);

  // Empty, then a code too short.
  await step(two, 1).getByRole("button", { name: "Vérifier le code" }).click();
  await expect(step(two, 1).locator("[data-recover-error]")).toHaveText(
    "Écris ton pseudo et ton code.",
  );
  await typeCode(two, pseudo, "k7qm2");
  await expect(step(two, 1).locator("[data-recover-error]")).toHaveText(
    "Un code de secours a 20 caractères, comme K7QM-2XRA-P9DW-HT4E-NB6Z.",
  );

  // The code typed in lower case without its dashes: the field adds them.
  const typed = code.replace(/-/g, "").toLowerCase();
  await step(two, 1).getByLabel("Code de secours").fill("");
  await step(two, 1).getByLabel("Code de secours").pressSequentially(typed);
  await expect(step(two, 1).getByLabel("Code de secours")).toHaveValue(code);
  await step(two, 1).getByLabel("Code de secours").press("Enter");

  // Step 2: « Code accepté », then the new passkey.
  await expect(step(two, 2)).toBeVisible();
  await expect(h1(two)).toHaveText("Code accepté");
  await expect(step(two, 2)).toContainText(
    `Crée maintenant une clé d’accès sur cet appareil pour ${pseudo}.`,
  );
  await step(two, 2).getByRole("button", { name: "Créer ma clé d’accès" }).click();

  // Step 3: the new code, with the recovery line; the old one no longer works.
  const screen = two.locator('[data-backup-code="recovery"]');
  await expect(screen).toBeVisible();
  await expect(screen.getByRole("heading", { level: 1 })).toHaveText("Ton nouveau code de secours");
  await expect(screen).toContainText(
    "L’ancien code ne marche plus, et tes autres appareils ont été déconnectés.",
  );
  const fresh = (await screen.locator("[data-code]").innerText()).replace(/\s/g, "");
  expect(fresh).not.toBe(code);
  await expect(two.locator("[data-home-strip]")).toHaveCount(0);
  await screen.getByRole("button", { name: "J’ai gardé mon code" }).click();
  await two.getByRole("button", { name: "Oui, je l’ai gardé" }).click();

  // « Mon compte » (plan 04-10), signed in, with the toast; « Clés d’accès » lists the lost key too.
  await expect(two).toHaveURL(/#\/compte$/);
  await expect(two.locator("[data-toast]")).toContainText(
    "Compte retrouvé. Retire la clé de l’appareil perdu dans",
  );
  await expect(two.locator("[data-account-pseudo]")).toHaveText(pseudo);
  await expect(two.locator("[data-passkey-row]")).toHaveCount(2);

  // Device 1: its session ended; its next account call says so, once, with « Se connecter ».
  await one.reload();
  await expect(one.locator("[data-toast]")).toContainText(
    "Ta session a pris fin : connecte-toi de nouveau.",
  );
  await expect(
    one.locator("[data-toast]").getByRole("button", { name: "Se connecter" }),
  ).toBeVisible();
  await expect(one.locator('[data-small-tile="connexion"]')).toBeVisible();

  // The old code no longer opens the account.
  const third = await passkeyContext(browser, testInfo);
  const three = await third.newPage();
  await three.goto("/#/secours");
  await typeCode(three, pseudo, code);
  await expect(step(three, 1).locator("[data-recover-error]")).toHaveText(
    "Pseudo ou code incorrect. Vérifie, puis réessaie.",
  );

  await first.close();
  await second.close();
  await third.close();
});

test("un pseudo ou un code faux disent la même chose ; cinq essais faux bloquent 15 minutes", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const first = await passkeyContext(browser, testInfo);
  const one = await first.newPage();
  const pseudo = uniquePseudo("Victor");
  const code = await signUp(one, await mintInvitation(request), pseudo);
  // A code of the right shape that is not this account's.
  const wrong = code.startsWith("0") ? `1${code.slice(1)}` : `0${code.slice(1)}`;

  const context = await passkeyContext(browser, testInfo);
  const page = await context.newPage();
  await page.goto("/#/secours");
  const error = step(page, 1).locator("[data-recover-error]");

  await typeCode(page, uniquePseudo("Personne"), code);
  await expect(error).toHaveText("Pseudo ou code incorrect. Vérifie, puis réessaie.");
  const unknownPseudo = await error.textContent();
  await expect(step(page, 1).getByLabel("Ton pseudo")).toHaveAttribute("aria-invalid", "true");
  await expect(step(page, 1).getByLabel("Code de secours")).toHaveAttribute("aria-invalid", "true");

  for (let attempt = 1; attempt <= 4; attempt++) {
    await typeCode(page, pseudo, wrong);
    await expect(error).toHaveText("Pseudo ou code incorrect. Vérifie, puis réessaie.");
    expect(await error.textContent()).toBe(unknownPseudo);
  }
  await typeCode(page, pseudo, wrong);
  await expect(error).toHaveText("Trop d’essais. Réessaie dans 15 minutes.");
  // Even the right code waits now.
  await typeCode(page, pseudo, code);
  await expect(error).toHaveText("Trop d’essais. Réessaie dans 15 minutes.");

  await first.close();
  await context.close();
});
