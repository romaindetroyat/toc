import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";
import {
  accountContext,
  copyPasskey,
  mintInvitation,
  type PushStubOptions,
  pushStubState,
  RP_ID,
  signInFromHome,
  signUp,
  uniquePseudo,
} from "./comptes.ts";
import { createTable, seatTile } from "./online.ts";

// « Mon compte » at #/compte (plan 04-10, D-02, D-08, D-12, APP-03; 04-UI-SPEC « Mon compte »), end
// to end against `wrangler dev`: the pseudo and the three sections in order; the notifications turned
// on only by the tap (the browser's push is stood in for: service workers are blocked here), off and
// on again, blocked; the passkeys (already on this device, a second one, the last one kept); a new
// backup code behind the passkey; « Se déconnecter » with a seat at a table; the fit.

const section = (page: Page, name: string) => page.locator(`[data-account-section="${name}"]`);
const notifications = (page: Page) => page.locator("[data-notifications]");

async function signedUp(
  browser: Browser,
  request: Parameters<typeof mintInvitation>[0],
  testInfo: Parameters<typeof accountContext>[1],
  prefix: string,
  push: PushStubOptions = {},
): Promise<{ context: BrowserContext; page: Page; pseudo: string; code: string }> {
  const context = await accountContext(browser, testInfo, push);
  const page = await context.newPage();
  const pseudo = uniquePseudo(prefix);
  const code = await signUp(page, await mintInvitation(request), pseudo);
  return { context, page, pseudo, code };
}

/** The server's answer to a DELETE of this endpoint (204: it held it; 404: it did not). */
function deleteEndpoint(page: Page, endpoint: string): Promise<number> {
  return page.evaluate(async (endpoint) => {
    const response = await fetch("/api/push/subscriptions", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
    return response.status;
  }, endpoint);
}

test("« Mon compte » : le pseudo, les trois sections, et les notifications seulement par le geste", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const phone = testInfo.project.name === "phone";
  // On the phone, first a Safari tab (not installed): the iPhone must install the app first.
  const { context, page, pseudo } = await signedUp(browser, request, testInfo, "Agathe", {
    standalone: false,
  });

  await page.locator('[data-small-tile="compte"]').click();
  await expect(page).toHaveURL(/#\/compte$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mon compte");
  const identity = page.locator("[data-account-identity]");
  await expect(identity).toContainText("Ton pseudo");
  await expect(identity.locator("[data-account-pseudo]")).toHaveText(pseudo);
  await expect(identity).toContainText(/Compte créé le \d{1,2} \p{L}+/u);
  await expect(identity.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
  await expect(identity).toContainText("Sur cet appareil seulement.");
  // The three sections, in this order, each with its h2.
  const order = await page
    .locator("[data-account-section]")
    .evaluateAll((all) => all.map((each) => each.getAttribute("data-account-section")));
  expect(order).toEqual(["notifications", "cles", "code"]);
  await expect(section(page, "notifications").getByRole("heading", { level: 2 })).toHaveText(
    "Notifications",
  );
  await expect(section(page, "cles").getByRole("heading", { level: 2 })).toHaveText("Clés d’accès");
  await expect(section(page, "code").getByRole("heading", { level: 2 })).toHaveText(
    "Code de secours",
  );
  await expect(section(page, "code")).toContainText(/Créé le \d{1,2} \p{L}+\./u);

  if (phone) {
    // An iPhone in a Safari tab: install first; « Installer l’application » opens the steps.
    await expect(notifications(page)).toHaveAttribute("data-notifications", "install-first");
    await expect(notifications(page)).toContainText(
      "les notifications marchent seulement dans l’application installée",
    );
    await notifications(page).getByRole("button", { name: "Installer l’application" }).click();
    await expect(page.locator("[data-install-sheet]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-install-sheet]")).toHaveCount(0);
    // The installed app: the same page, opened from the home screen.
    await page.evaluate(() => localStorage.setItem("test.standalone", "1"));
    await page.reload();
  }

  // Never asked before the tap: not at sign-up, not on the home, not on opening the page.
  await expect(notifications(page)).toHaveAttribute("data-notifications", "ask");
  expect((await pushStubState(page)).asks).toBe(0);
  const enable = notifications(page).getByRole("button", { name: "Activer les notifications" });
  await expect(enable).toBeVisible();

  // « Activer les notifications »: the permission, then the subscription, saved by the server.
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/push/subscriptions") && response.request().method() === "POST",
  );
  await enable.click();
  expect((await saved).status()).toBe(201);
  const toggle = notifications(page).getByRole("switch", { name: "Sur cet appareil" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(notifications(page)).toContainText(
    "Activées. Tu les reçois seulement quand TOC est fermé.",
  );
  await expect(page.locator("[data-toast]")).toContainText(
    "Notifications activées sur cet appareil.",
  );
  const on = await pushStubState(page);
  expect(on.asks).toBe(1);
  expect(on.endpoint).toMatch(/^https:\/\/push\.toc\.test\//);
  const endpoint = on.endpoint as string;
  // The server holds this device's subscription: a DELETE finds it (and it is saved again).
  expect(await deleteEndpoint(page, endpoint)).toBe(204);
  await page.reload();
  // Opening the page again saves the subscription the device holds.
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => deleteEndpoint(page, endpoint)).toBe(204);
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  // Off: the server forgets it and the device unsubscribes.
  const removed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/push/subscriptions") &&
      response.request().method() === "DELETE",
  );
  await toggle.click();
  expect((await removed).status()).toBe(204);
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(notifications(page)).toContainText("Désactivées sur cet appareil.");
  expect((await pushStubState(page)).endpoint).toBeNull();
  expect(await deleteEndpoint(page, endpoint)).toBe(404);
  // Still off after a reload.
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  // On again: no new prompt.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  const again = await pushStubState(page);
  expect(again.asks).toBe(1);
  expect(again.endpoint).not.toBeNull();

  // Blocked: bell-off, the line and this platform's way to allow them; nothing to press.
  await page.evaluate(() => {
    localStorage.setItem("test.permission", "denied");
  });
  await page.reload();
  await expect(notifications(page)).toHaveAttribute("data-notifications", "blocked");
  await expect(notifications(page)).toContainText(
    "Les notifications sont bloquées pour TOC sur cet appareil.",
  );
  await expect(notifications(page)).toContainText(
    phone ? "Réglages › Notifications › TOC." : "le cadenas à côté de l’adresse › Notifications.",
  );
  await expect(notifications(page)).toContainText("Reviens ici ensuite.");
  await expect(notifications(page).getByRole("button")).toHaveCount(0);
  expect((await pushStubState(page)).asks).toBe(1);

  await context.close();
});

test("« Clés d’accès » : déjà sur cet appareil, une deuxième clé, et jamais la dernière", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const one = await signedUp(browser, request, testInfo, "Bastien");
  await one.page.goto("/#/compte");
  const keys = section(one.page, "cles");
  const rows = keys.locator("[data-passkey-row]");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute("data-current", "true");
  await expect(rows.first()).toContainText("cet appareil");
  await expect(rows.first()).toContainText(/Ajoutée le \d{1,2} \p{L}+/u);
  // The only key: its remove button is disabled and the note says why.
  await expect(rows.first().getByRole("button", { name: /^Retirer la clé / })).toBeDisabled();
  await expect(keys).toContainText(
    "C’est ta seule clé : ajoute-en une autre avant de retirer celle-ci.".replace(" :", " :"),
  );

  // The same authenticator again: « Cet appareil a déjà une clé pour ton compte. »
  await keys.getByRole("button", { name: "Ajouter une clé d’accès" }).click();
  await expect(one.page.locator("[data-toast]")).toContainText(
    "Cet appareil a déjà une clé pour ton compte.",
  );
  await expect(rows).toHaveCount(1);

  // A second device, signed in with the synced key, then without it: a key of its own.
  const two = await accountContext(browser, testInfo);
  expect(await copyPasskey(one.context, two)).toBe(1);
  const page = await two.newPage();
  await signInFromHome(page);
  await expect(page.locator('[data-small-tile="compte"]')).toBeVisible();
  for (const held of await two.credentials.get({ rpId: RP_ID })) {
    await two.credentials.delete(held.id);
  }
  await page.goto("/#/compte");
  const theirs = section(page, "cles");
  const listed = theirs.locator("[data-passkey-row]");
  await expect(listed).toHaveCount(1);
  await theirs.getByRole("button", { name: "Ajouter une clé d’accès" }).click();
  await expect(page.locator("[data-toast]")).toContainText("Clé ajoutée.");
  await expect(listed).toHaveCount(2);
  await expect(listed.locator('[data-current="true"]')).toHaveCount(0);
  await expect(theirs.locator('[data-passkey-row][data-current="true"]')).toHaveCount(1);
  await expect(theirs.locator("[data-passkey-last]")).toHaveCount(0);

  // Remove the first device's key: « Retirer la clé ? », destructive; one row left, kept.
  const old = theirs.locator('[data-passkey-row]:not([data-current="true"])');
  await old.getByRole("button", { name: /^Retirer la clé / }).click();
  const confirm = page.getByRole("dialog", { name: /^Retirer la clé\s\?$/ });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Garder la clé" })).toBeFocused();
  await confirm.getByRole("button", { name: "Retirer la clé" }).click();
  await expect(listed).toHaveCount(1);
  await expect(listed.first()).toHaveAttribute("data-current", "true");
  await expect(listed.first().getByRole("button", { name: /^Retirer la clé / })).toBeDisabled();
  await expect(theirs.locator("[data-passkey-last]")).toBeVisible();
  // The focus moved to « Ajouter une clé d’accès » (no other remove button is enabled).
  await expect(theirs.getByRole("button", { name: "Ajouter une clé d’accès" })).toBeFocused();

  await two.close();
  await one.context.close();
});

test("« Créer un nouveau code » : la question, la clé d’accès, le nouveau code, puis le retour", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const { context, page, code } = await signedUp(browser, request, testInfo, "Capucine");
  await page.goto("/#/compte");
  await section(page, "code").getByRole("button", { name: "Créer un nouveau code" }).click();
  const confirm = page.getByRole("dialog", { name: /^Remplacer ton code de secours\s\?$/ });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText(
    "L’ancien code ne marchera plus. Ta clé d’accès te sera demandée.",
  );
  await expect(confirm.getByRole("button", { name: "Garder mon code" })).toBeFocused();
  await confirm.getByRole("button", { name: "Créer un nouveau code" }).click();

  // The virtual authenticator confirms the passkey; the new code shows once.
  const screen = page.locator('[data-backup-code="regeneration"]');
  await expect(screen).toBeVisible();
  await expect(screen.getByRole("heading", { level: 1 })).toHaveText("Ton nouveau code de secours");
  await expect(screen).toContainText("L’ancien code ne marche plus.");
  const fresh = (await screen.locator("[data-code]").innerText()).replace(/\s/g, "");
  expect(fresh).toHaveLength(24);
  expect(fresh).not.toBe(code);
  await expect(page.locator("[data-home-strip]")).toHaveCount(0);
  await screen.getByRole("button", { name: "J’ai gardé mon code" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Oui, je l’ai gardé" }).click();

  // Back on « Mon compte » with the toast.
  await expect(page).toHaveURL(/#\/compte$/);
  await expect(section(page, "code")).toBeVisible();
  await expect(page.locator("[data-toast]")).toContainText("Nouveau code enregistré.");
  await context.close();
});

test("« Se déconnecter » avec une place à une table : la question, puis l’accueil invité", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const { context, page } = await signedUp(browser, request, testInfo, "Dorian");

  // A seat at a table, under the pseudo.
  const id = await createTable(request, { pace: "zero" });
  await page.goto(`/#/table/${id}?vitesse=test`);
  await seatTile(page, "bleu").click();
  await expect(seatTile(page, "bleu")).toHaveAttribute("data-seat-state", "you");

  // The notifications on, so the sign-out must end them on this device.
  await page.goto("/#/compte");
  await notifications(page).getByRole("button", { name: "Activer les notifications" }).click();
  await expect(notifications(page).getByRole("switch")).toHaveAttribute("aria-checked", "true");
  expect((await pushStubState(page)).endpoint).not.toBeNull();

  const signOut = page.locator("[data-account-identity]").getByRole("button", {
    name: "Se déconnecter",
  });
  await signOut.click();
  const confirm = page.getByRole("dialog", { name: /^Se déconnecter de cet appareil\s\?$/ });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText(
    "Tes places dans les parties en cours ne seront plus jouables sur cet appareil jusqu’à ta prochaine connexion.",
  );
  await expect(confirm).toContainText("Parties concernées : 1.");
  await expect(confirm.getByRole("button", { name: "Rester sur mon compte" })).toBeFocused();
  // « Rester sur mon compte » keeps everything.
  await confirm.getByRole("button", { name: "Rester sur mon compte" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(signOut).toBeFocused();
  await signOut.click();
  await page
    .getByRole("dialog", { name: /^Se déconnecter de cet appareil\s\?$/ })
    .getByRole("button", { name: "Se déconnecter" })
    .click();

  // The guest home, the toast, no account row, no subscription on this device, no session.
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator('[data-small-tile="connexion"]')).toBeVisible();
  await expect(page.locator('[data-small-tile="compte"]')).toHaveCount(0);
  await expect(page.locator("[data-toast]")).toContainText("Session fermée sur cet appareil.");
  await expect(page.locator(`[data-table-row="${id}"]`)).toHaveCount(0);
  expect((await pushStubState(page)).endpoint).toBeNull();
  const me = await page.evaluate(
    async () => (await fetch("/api/me", { cache: "no-store" })).status,
  );
  expect(me).toBe(401);

  // #/compte signed out: the home, the sign-in sheet open, the session-ended toast.
  await page.goto("/#/compte");
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator("[data-signin-sheet]")).toBeVisible();
  await expect(page.locator("[data-toast]")).toContainText(
    "Ta session a pris fin : connecte-toi de nouveau.".replace(" :", " :"),
  );
  await context.close();
});

test("« Mon compte » tient dans l’écran : 844 × 390 et 1280 × 800", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const { context, page } = await signedUp(browser, request, testInfo, "Eugène");
  await page.goto("/#/compte");
  await expect(notifications(page)).toHaveAttribute("data-notifications", "ask");

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("[data-account]")).toHaveAttribute("data-layout", "two");
  const phone = await page.evaluate(() => {
    const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
    const identity = box("[data-account-identity]");
    const enable = box("[data-notifications] button");
    const right = box("[data-account-right]");
    return {
      sideways: document.documentElement.scrollWidth - innerWidth,
      identityWidth: identity?.width,
      identityBottom: identity?.bottom,
      enableBottom: enable?.bottom,
      rightWidth: right?.width,
    };
  });
  expect(phone.sideways).toBe(0);
  expect(phone.identityWidth).toBe(280);
  expect(phone.rightWidth).toBe(480);
  expect(phone.identityBottom).toBeLessThanOrEqual(390);
  expect(phone.enableBottom).toBeLessThanOrEqual(390);

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator("[data-account]")).toHaveAttribute("data-layout", "computer");
  const computer = await page.evaluate(() => {
    const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
    return {
      down: document.documentElement.scrollHeight - innerHeight,
      identityWidth: box("[data-account-identity]")?.width,
      rightWidth: box("[data-account-right]")?.width,
    };
  });
  expect(computer.down).toBeLessThanOrEqual(0);
  expect(computer.identityWidth).toBe(320);
  expect(computer.rightWidth).toBe(520);
  await context.close();
});
