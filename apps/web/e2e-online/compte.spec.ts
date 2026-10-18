import { expect, test } from "@playwright/test";
import { mintInvitation, passkeyContext, signUp, uniquePseudo } from "./comptes.ts";
import { deviceOptions } from "./online.ts";

// The first account, end to end against `wrangler dev` (plan 04-01, ACCT-01, ACCT-02, D-02, D-03):
// an invitation link, a pseudo, a passkey made by Playwright's virtual authenticator, the backup code
// shown once, the home signed in, still signed in after a reload, and the link refused the second time.

test("créer son compte par une invitation, et le garder après un rechargement", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const code = await mintInvitation(request);
  // Playwright's virtual authenticator answers navigator.credentials.create() (a resident ES256 key).
  const context = await browser.newContext(deviceOptions(testInfo));
  await context.credentials.install();
  const page = await context.newPage();
  const pseudo = uniquePseudo("Zoé");

  // The opening: the pseudo step, with the context line of an invitation.
  await page.goto(`/#/invitation/${code}`);
  await expect(page.locator('[data-invitation="ok"]')).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Choisis ton pseudo");
  await expect(page.locator("[data-pseudo-form]")).toContainText(
    "2 à 20 caractères. Les autres joueurs le verront.",
  );

  // A pseudo refused by the shared rules never leaves the page.
  const form = page.locator("[data-pseudo-form]");
  await form.getByRole("textbox").fill("Z");
  await form.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(form).toContainText("Ton pseudo doit avoir au moins 2 caractères.");
  await expect(form.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");

  // The whole sign-up: the code screen shows the code once, in five groups of four.
  await form.getByRole("textbox").fill(pseudo);
  await form.getByRole("button", { name: "Créer mon compte" }).click();
  const screen = page.locator("[data-backup-code]");
  await expect(screen).toBeVisible();
  await expect(screen.getByRole("heading", { level: 1 })).toHaveText("Ton code de secours");
  await expect(screen).toContainText("Étape 2 sur 2");
  const shown = await screen.locator("[data-code]").innerText();
  expect(shown.replace(/\s/g, "")).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
  expect(shown.replace(/\s/g, "")).toHaveLength(24);
  await expect(screen.getByRole("group")).toHaveAccessibleName(/^Code de secours\s: /);
  await expect(screen).toContainText("Il ne s’affichera plus jamais.");

  // « J’ai gardé mon code » asks first; « Revoir mon code » is the safe answer and has the focus.
  await screen.getByRole("button", { name: "J’ai gardé mon code" }).click();
  const confirm = page.getByRole("dialog", { name: /^Tu as bien gardé ton code\s\?$/ });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Revoir mon code" })).toBeFocused();
  await confirm.getByRole("button", { name: "Revoir mon code" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(screen).toBeVisible();
  await screen.getByRole("button", { name: "J’ai gardé mon code" }).click();
  await page
    .getByRole("dialog", { name: /^Tu as bien gardé ton code\s\?$/ })
    .getByRole("button", { name: "Oui, je l’ai gardé" })
    .click();

  // The home, signed in: the small tile « Mon compte » with the pseudo, and the welcome toast.
  await expect(page).toHaveURL(/#\/$/);
  const tile = page.locator('[data-small-tile="compte"]');
  await expect(tile).toBeVisible();
  await expect(tile).toContainText("Mon compte");
  await expect(tile).toContainText(pseudo);
  await expect(tile).toHaveAccessibleName(`Mon compte (${pseudo})`);
  await expect(page.locator("[data-toast]")).toContainText(`Bienvenue, ${pseudo}`);

  // Still signed in after a reload, and on a new page of the same browser (ACCT-02).
  await page.reload();
  await expect(page.locator('[data-small-tile="compte"]')).toContainText(pseudo);
  const again = await context.newPage();
  await again.goto("/");
  await expect(again.locator('[data-small-tile="compte"]')).toContainText(pseudo);
  const me = await again.evaluate(async () => {
    const response = await fetch("/api/me", { cache: "no-store" });
    return { status: response.status, body: (await response.json()) as { pseudo?: string } };
  });
  expect(me.status).toBe(200);
  expect(me.body.pseudo).toBe(pseudo);
  // The session cookie is HttpOnly: no script reads it.
  expect(await again.evaluate(() => document.cookie)).not.toContain("toc_session");

  // The same link again: already used.
  await again.goto(`/#/invitation/${code}`);
  await expect(again.locator('[data-invitation="used"]')).toBeVisible();
  await expect(again.getByRole("heading", { level: 1 })).toHaveText(
    "Cette invitation a déjà servi",
  );

  await context.close();
});

test("une invitation inconnue, déjà servie ou expirée le dit", async ({
  browser,
  request,
}, testInfo) => {
  const context = await passkeyContext(browser, testInfo);
  const page = await context.newPage();
  const cases: [string, string, string][] = [
    ["AAAAAAAAAAAAAAAAAAAAAA", "unknown", "Cette invitation n’existe pas"],
    [await mintInvitation(request, { used: true }), "used", "Cette invitation a déjà servi"],
    [await mintInvitation(request, { expired: true }), "expired", "Cette invitation a expiré"],
  ];
  for (const [code, state, heading] of cases) {
    await page.goto(`/#/invitation/${code}`);
    await expect(page.locator(`[data-invitation="${state}"]`)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
  await page.getByRole("button", { name: "Retour à l’accueil" }).click();
  await expect(page.locator("[data-home]")).toBeVisible();
  await context.close();
});

test("signUp() helper reaches the home signed in", async ({ browser, request }, testInfo) => {
  const context = await passkeyContext(browser, testInfo);
  const page = await context.newPage();
  const pseudo = uniquePseudo("Lou");
  const code = await signUp(page, await mintInvitation(request), pseudo);
  expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){4}$/);
  await expect(page.locator('[data-small-tile="compte"]')).toContainText(pseudo);
  await context.close();
});
