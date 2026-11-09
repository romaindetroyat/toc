import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { completeSignUp, mintInvitation, passkeyContext, uniquePseudo } from "./comptes.ts";

// « J’ai une invitation » (plan 04-13; Romain's iPhone, 2026-10-18), end to end against `wrangler dev`:
// on iOS a tapped link opens Safari, never the installed app, so a person who installed TOC first
// pastes the link received from a relative into the sign-in sheet. From a fresh signed-out home: the
// « Se connecter » tile, the sheet, a real paste (the clipboard written by the test, then Ctrl/Cmd+V)
// of the whole link or of the bare code, « Continuer », the pseudo step, and the sign-up finished
// with the virtual authenticator. A value that is no invitation says so and goes nowhere. The app
// never reads the clipboard by itself (navigator.clipboard.readText is counted).

/** The production link of an invitation: the origin of a pasted link is ignored by the app. */
const SITE = "https://toc.romaindetroyat.workers.dev";

/** A signed-out device with the virtual authenticator, a clipboard it may use, and readText counted. */
async function freshDevice(
  browser: Parameters<typeof passkeyContext>[0],
  testInfo: Parameters<typeof passkeyContext>[1],
  baseURL: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await passkeyContext(browser, testInfo);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  await context.addInitScript(() => {
    const clipboard = navigator.clipboard;
    if (!clipboard) return;
    const read = clipboard.readText.bind(clipboard);
    (window as unknown as { tocReads: number }).tocReads = 0;
    clipboard.readText = () => {
      (window as unknown as { tocReads: number }).tocReads += 1;
      return read();
    };
  });
  const page = await context.newPage();
  return { context, page };
}

/** The home signed out, then the sign-in sheet from its « Se connecter » tile. */
async function openSheet(page: Page) {
  await page.goto("/");
  const tile = page.locator('[data-small-tile="connexion"]');
  await expect(tile).toContainText("Créer un compte");
  await expect(page.locator('[data-small-tile="compte"]')).toHaveCount(0);
  await tile.click();
  await expect(page.getByRole("dialog", { name: "Se connecter" })).toBeVisible();
  const sheet = page.locator("[data-signin-sheet]");
  await expect(sheet).toContainText("Pas encore de compte ?");
  await expect(sheet).toContainText(
    "Sur iPhone, ouvre ton lien d’invitation dans Safari, ou colle-le ici dans l’application.",
  );
  return sheet;
}

/** What the person does: copy the text elsewhere, then paste it into the focused field. */
async function paste(page: Page, field: ReturnType<Page["locator"]>, text: string) {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  await field.click();
  await page.keyboard.press("ControlOrMeta+V");
  await expect(field).toHaveValue(text);
}

async function readsByApp(page: Page): Promise<number> {
  // The test's own writeText is not a read; only the app could have called readText.
  return page.evaluate(() => (window as unknown as { tocReads: number }).tocReads);
}

test("coller le lien complet d’une invitation, puis créer son compte avec la clé d’accès", async ({
  browser,
  request,
  baseURL,
}, testInfo) => {
  test.setTimeout(90_000);
  const code = await mintInvitation(request);
  const { context, page } = await freshDevice(browser, testInfo, baseURL as string);
  const sheet = await openSheet(page);

  const field = sheet.getByLabel("J’ai une invitation");
  await paste(page, field, `${SITE}/#/invitation/${code}`);
  await sheet.getByRole("button", { name: "Continuer" }).click();

  // The sheet closes and the app opens its own invitation route: the 04-09 flow takes over.
  await expect(page.getByRole("dialog", { name: "Se connecter" })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/#/invitation/${code}$`));
  await expect(page.locator('[data-invitation="ok"]')).toBeVisible();
  const pseudo = uniquePseudo("Collé");
  await completeSignUp(page, pseudo);
  await expect(page.locator('[data-small-tile="compte"]')).toContainText(pseudo);
  expect(await readsByApp(page)).toBe(0);
  await context.close();
});

test("coller le code seul, ou le message reçu autour du lien, marche aussi", async ({
  browser,
  request,
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000);

  // The bare code, with the spaces a copy often carries, and Entrée instead of « Continuer ».
  const code = await mintInvitation(request);
  const first = await freshDevice(browser, testInfo, baseURL as string);
  let sheet = await openSheet(first.page);
  let field = sheet.getByLabel("J’ai une invitation");
  await paste(first.page, field, `  ${code} `);
  await field.press("Enter");
  await expect(first.page).toHaveURL(new RegExp(`/#/invitation/${code}$`));
  const pseudo = uniquePseudo("Code");
  await completeSignUp(first.page, pseudo);
  await expect(first.page.locator('[data-small-tile="compte"]')).toContainText(pseudo);
  expect(await readsByApp(first.page)).toBe(0);
  await first.context.close();

  // The whole shared message, as WhatsApp copies it, from the local origin.
  const other = await mintInvitation(request);
  const second = await freshDevice(browser, testInfo, baseURL as string);
  sheet = await openSheet(second.page);
  field = sheet.getByLabel("J’ai une invitation");
  await paste(
    second.page,
    field,
    `Marie t’invite sur TOC, le jeu de petits chevaux à cartes. Ce lien marche une fois, pendant 7 jours. ${baseURL}/#/invitation/${other}`,
  );
  await sheet.getByRole("button", { name: "Continuer" }).click();
  await expect(second.page).toHaveURL(new RegExp(`/#/invitation/${other}$`));
  await expect(second.page.locator("[data-pseudo-form]")).toBeVisible();
  await second.context.close();
});

test("un lien qui n’est pas une invitation le dit, et l’accueil reste", async ({
  browser,
  baseURL,
}, testInfo) => {
  const { context, page } = await freshDevice(browser, testInfo, baseURL as string);
  const sheet = await openSheet(page);
  const field = sheet.getByLabel("J’ai une invitation");
  const error = "Ce lien d’invitation n’est pas reconnu. Colle le lien complet reçu de ton proche.";

  // Nothing typed, then a table's link, then a truncated code.
  await sheet.getByRole("button", { name: "Continuer" }).click();
  await expect(sheet.locator("[data-invite-paste-error]")).toHaveText(error);
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await paste(page, field, `${SITE}/#/table/AAAAAAAAAAAAAAAAAAAAAA`);
  // Typing again clears the line until the next try.
  await expect(sheet.locator("[data-invite-paste-error]")).toHaveCount(0);
  await expect(field).toHaveAttribute("aria-invalid", "false");
  await sheet.getByRole("button", { name: "Continuer" }).click();
  await expect(sheet.locator("[data-invite-paste-error]")).toHaveText(error);
  await field.fill(`${SITE}/#/invitation/AAAAAAAAAAAAAAAAAAAA`);
  await field.press("Enter");
  await expect(sheet.locator("[data-invite-paste-error]")).toHaveText(error);

  // Still the home, the sheet still open; the field is described by the error.
  await expect(page).toHaveURL(/\/(#\/?)?$/);
  await expect(page.getByRole("dialog", { name: "Se connecter" })).toBeVisible();
  await expect(field).toHaveAttribute("aria-describedby", "invite-paste-error");
  expect(await readsByApp(page)).toBe(0);
  await context.close();
});
