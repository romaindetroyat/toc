import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { mintInvitation, passkeyContext, signUp, uniquePseudo } from "./comptes.ts";

// An account invitation link in every case (plan 04-09, ACCT-01, D-03, D-04, D-06, D-11; 04-UI-SPEC
// « Invitation »), end to end against `wrangler dev`: expired, used (« Se connecter »), unknown,
// offline then « Réessayer », a signed-in player who adds the inviter (then is already a friend), the
// inviter's own link, a pseudo taken under another case and accents, the device's first name and
// guest tables, « J’ai déjà un compte », and a browser signed in meanwhile (the server's refusal).

const invitation = (page: Page, kind: string) => page.locator(`[data-invitation="${kind}"]`);
const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

/** A's own invitation link, made from A's signed-in page (POST /api/invitations). */
async function inviteFrom(page: Page): Promise<string> {
  const made = await page.evaluate(async () => {
    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: "{}",
    });
    return { status: response.status, body: (await response.json()) as { code?: string } };
  });
  expect(made.status).toBe(201);
  expect(made.body.code).toMatch(/^[A-Za-z0-9_-]{22}$/);
  return made.body.code as string;
}

/** A signed-up account in its own context. */
async function account(
  browser: Parameters<typeof passkeyContext>[0],
  testInfo: Parameters<typeof passkeyContext>[1],
  code: string,
  prefix: string,
): Promise<{ context: BrowserContext; page: Page; pseudo: string }> {
  const context = await passkeyContext(browser, testInfo);
  const page = await context.newPage();
  const pseudo = uniquePseudo(prefix);
  await signUp(page, code, pseudo);
  return { context, page, pseudo };
}

test("une invitation expirée, déjà servie ou inconnue le dit", async ({
  browser,
  request,
}, testInfo) => {
  const context = await passkeyContext(browser, testInfo);
  const page = await context.newPage();

  await page.goto(`/#/invitation/${await mintInvitation(request, { expired: true })}`);
  await expect(invitation(page, "expired")).toBeVisible();
  await expect(h1(page)).toHaveText("Cette invitation a expiré");
  await expect(invitation(page, "expired")).toContainText("Un lien d’invitation marche 7 jours.");
  await expect(page.getByRole("button", { name: "Retour à l’accueil" })).toBeVisible();

  // Used: « Se connecter » (primary) opens the sign-in sheet, and « Retour à l’accueil ».
  await page.goto(`/#/invitation/${await mintInvitation(request, { used: true })}`);
  await expect(invitation(page, "used")).toBeVisible();
  await expect(h1(page)).toHaveText("Cette invitation a déjà servi");
  await expect(page.getByRole("button", { name: "Retour à l’accueil" })).toBeVisible();
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator("[data-signin-sheet]")).toBeVisible();
  await page.getByRole("button", { name: "Fermer" }).click();
  await expect(page.locator("[data-signin-sheet]")).toHaveCount(0);

  // A random code of the right shape: unknown.
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let random = "";
  for (let i = 0; i < 22; i++) random += letters[Math.floor(Math.random() * letters.length)];
  await page.goto(`/#/invitation/${random}`);
  await expect(invitation(page, "unknown")).toBeVisible();
  await expect(h1(page)).toHaveText("Cette invitation n’existe pas");
  await context.close();
});

test("hors ligne, l’invitation le dit, puis « Réessayer » ouvre l’étape du pseudo", async ({
  browser,
  request,
}, testInfo) => {
  const context = await passkeyContext(browser, testInfo);
  const page = await context.newPage();
  const code = await mintInvitation(request);
  await page.goto("/");
  await context.setOffline(true);
  await page.goto(`/#/invitation/${code}`);
  await expect(invitation(page, "offline")).toBeVisible();
  await expect(h1(page)).toHaveText("Pas de connexion");
  await expect(invitation(page, "offline")).toContainText("L’invitation a besoin d’Internet.");
  await context.setOffline(false);
  await page.getByRole("button", { name: "Réessayer" }).click();
  await expect(invitation(page, "ok")).toBeVisible();
  await expect(h1(page)).toContainText("Choisis ton pseudo");
  await context.close();
});

test("connecté par ailleurs : ajouter l’inviteur à ses amis, puis il y est déjà ; son propre lien", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const a = await account(browser, testInfo, await mintInvitation(request), "Anouk");
  const b = await account(browser, testInfo, await mintInvitation(request), "Basile");
  const link = await inviteFrom(a.page);

  // A opens their own link: « C’est ton invitation », with its date; « Mes amis ».
  await a.page.goto(`/#/invitation/${link}`);
  await expect(invitation(a.page, "own")).toBeVisible();
  await expect(h1(a.page)).toHaveText("C’est ton invitation");
  await expect(invitation(a.page, "own")).toContainText("il sert une fois, jusqu’au ");
  await expect(a.page.getByRole("button", { name: "Mes amis" })).toBeVisible();

  // B, signed in: « Ajouter A à tes amis ? » → « Ajouter à mes amis » → the toast.
  await b.page.goto(`/#/invitation/${link}`);
  await expect(invitation(b.page, "add-friend")).toBeVisible();
  await expect(h1(b.page)).toHaveText(new RegExp(`^Ajouter ${a.pseudo} à tes amis\\s\\?$`));
  await expect(invitation(b.page, "add-friend")).toContainText(
    `${a.pseudo} t’a envoyé ce lien. Vous pourrez vous inviter à vos tables.`,
  );
  await expect(b.page.locator("[data-pseudo-form]")).toHaveCount(0);
  await b.page.getByRole("button", { name: "Ajouter à mes amis" }).click();
  await expect(b.page.locator("[data-toast]")).toContainText(
    `${a.pseudo} est maintenant dans tes amis.`,
  );
  await expect(b.page).toHaveURL(/#\/amis$/);

  // A second link of A: B already has A in their friends; the link stays for someone else.
  const second = await inviteFrom(a.page);
  await b.page.goto(`/#/invitation/${second}`);
  await expect(invitation(b.page, "already-friend")).toBeVisible();
  await expect(h1(b.page)).toHaveText(`${a.pseudo} est déjà dans tes amis`);
  await expect(invitation(b.page, "already-friend")).toContainText(
    "Ce lien reste valable pour un autre proche jusqu’au ",
  );

  await a.context.close();
  await b.context.close();
});

test("le pseudo : prérempli avec le prénom, déjà pris (casse et accents), « J’ai déjà un compte »", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const first = await account(browser, testInfo, await mintInvitation(request), "Élodie");

  // A new device with a first name and a guest table.
  const context = await passkeyContext(browser, testInfo);
  await context.addInitScript(() => {
    localStorage.setItem(
      "toc.device.v1",
      JSON.stringify({ token: "b".repeat(43), name: "Marie-Charlotte" }),
    );
    localStorage.setItem(
      "toc.tables.v1",
      JSON.stringify([{ id: "AAAAAAAAAAAAAAAAAAAAAA", seat: "bleu", joinedAt: 1 }]),
    );
  });
  const page = await context.newPage();
  await page.goto(`/#/invitation/${await mintInvitation(request)}`);
  const form = page.locator("[data-pseudo-form]");
  await expect(form.getByRole("textbox")).toHaveValue("Marie-Charlotte");
  await expect(invitation(page, "ok")).toContainText(
    "Tes parties en cours sur cet appareil passeront sur ton compte.",
  );

  // The first account's pseudo, in other case and without its accents: taken.
  const twin = first.pseudo.toUpperCase().normalize("NFD").replace(/\p{M}/gu, "");
  await form.getByRole("textbox").fill(twin);
  await form.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(form.locator("[data-pseudo-error]")).toHaveText(
    "Ce pseudo est déjà pris. Essaie une variante, par exemple avec ton initiale.",
  );
  await expect(form.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  await expect(form.getByRole("textbox")).toBeFocused();

  // « J’ai déjà un compte » opens the sign-in sheet.
  await page.getByRole("button", { name: "J’ai déjà un compte" }).click();
  await expect(page.locator("[data-signin-sheet]")).toBeVisible();
  await page.getByRole("button", { name: "Fermer" }).click();

  await first.context.close();
  await context.close();
});

test("créer son compte par le lien d’un ami : le toast le nomme ; connecté entre-temps, on l’ajoute", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const a = await account(browser, testInfo, await mintInvitation(request), "Anouk");

  // B signs up through A's link: the welcome names A, now in B's friends (D-06).
  const context = await passkeyContext(browser, testInfo);
  const page = await context.newPage();
  const pseudo = uniquePseudo("Basile");
  await page.goto(`/#/invitation/${await inviteFrom(a.page)}`);
  await expect(invitation(page, "ok")).toContainText(`${a.pseudo} t’invite sur TOC.`);
  await page.locator("[data-pseudo-form]").getByRole("textbox").fill(pseudo);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page
    .locator("[data-backup-code]")
    .getByRole("button", { name: "J’ai gardé mon code" })
    .click();
  await page.getByRole("button", { name: "Oui, je l’ai gardé" }).click();
  await expect(page.locator("[data-toast]")).toContainText(
    `Bienvenue, ${pseudo} ! ${a.pseudo} est maintenant dans tes amis.`,
  );

  // A third device opens another link of A at the pseudo step, then signs up elsewhere in the same
  // browser (another tab): « Créer mon compte » is refused by the server, the signed-in row shows.
  const c = await passkeyContext(browser, testInfo);
  const tab = await c.newPage();
  await tab.goto(`/#/invitation/${await inviteFrom(a.page)}`);
  await expect(invitation(tab, "ok")).toBeVisible();
  const other = await c.newPage();
  await signUp(other, await mintInvitation(request), uniquePseudo("Côme"));
  await tab.locator("[data-pseudo-form]").getByRole("textbox").fill(uniquePseudo("Second"));
  await tab.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(invitation(tab, "add-friend")).toBeVisible();
  await expect(h1(tab)).toHaveText(new RegExp(`^Ajouter ${a.pseudo} à tes amis\\s\\?$`));

  await a.context.close();
  await context.close();
  await c.close();
});
