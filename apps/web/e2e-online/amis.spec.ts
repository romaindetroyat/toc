import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";
import {
  apiInvitation,
  befriend,
  mintInvitation,
  passkeyContext,
  signUp,
  uniquePseudo,
} from "./comptes.ts";
import { deviceOptions } from "./online.ts";

// « Mes amis » at #/amis (plan 04-10, ACCT-03, D-06, D-11; 04-UI-SPEC « Mes amis », « Code-ami
// sheet »), end to end against `wrangler dev`: a link made in « Inviter un proche » signs a proche
// up and puts each in the other's list; a friend code given and typed; a removal on both sides; a
// disabled link; the 11th pending link refused; the fit at 844 × 390.

type Player = { context: BrowserContext; page: Page; pseudo: string };

async function player(
  browser: Browser,
  request: Parameters<typeof mintInvitation>[0],
  testInfo: Parameters<typeof passkeyContext>[1],
  prefix: string,
): Promise<Player> {
  const context = await passkeyContext(browser, testInfo);
  const page = await context.newPage();
  const pseudo = uniquePseudo(prefix);
  await signUp(page, await mintInvitation(request), pseudo);
  return { context, page, pseudo };
}

const row = (page: Page, pseudo: string) => page.locator(`[data-friend-row="${pseudo}"]`);
const sheet = (page: Page) => page.locator("[data-friend-code-sheet]");

/** « Ajouter avec un code » › « Donner mon code »: the code shown, TOC-XXXX-XXXX. */
async function giveCode(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Ajouter avec un code" }).click();
  await expect(sheet(page)).toBeVisible();
  await sheet(page).getByRole("radio", { name: "Donner mon code" }).click();
  const panel = sheet(page).locator("[data-friend-code]");
  await expect(panel).toHaveText(/^TOC-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  const code = (await panel.innerText()).trim();
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
  return code;
}

/** « Ajouter avec un code » › « Entrer un code »: types `typed` and taps « Ajouter ». */
async function enterCode(page: Page, typed: string): Promise<void> {
  if ((await sheet(page).count()) === 0) {
    await page.getByRole("button", { name: "Ajouter avec un code" }).click();
  }
  await expect(sheet(page)).toBeVisible();
  const field = sheet(page).getByLabel("Le code ami de ton proche");
  await field.fill("");
  await field.pressSequentially(typed);
  await sheet(page).getByRole("button", { name: "Ajouter", exact: true }).click();
}

test("un lien d’invitation : le proche s’inscrit, chacun est dans la liste de l’autre", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const a = await player(browser, request, testInfo, "Adèle");
  await a.page.goto("/#/amis");
  await expect(a.page.getByRole("heading", { level: 1 })).toHaveText("Mes amis");
  // Empty: the heading and the body of the Copywriting Contract; no pending link.
  await expect(a.page.locator("[data-friends-empty]")).toContainText("Pas encore d’amis sur TOC");
  await expect(a.page.locator("[data-friends-empty]")).toContainText(
    "Invite un proche avec un lien",
  );
  await expect(a.page.locator("[data-friends-right]")).toContainText(
    "Aucune invitation en attente.",
  );

  // « Inviter un proche »: the variant of the invite sheet, with the link, its QR code and its date.
  await a.page.getByRole("button", { name: "Inviter un proche" }).click();
  const invite = a.page.getByRole("dialog", { name: "Inviter un proche" });
  await expect(invite).toBeVisible();
  await expect(invite.locator('[data-invite-kind="proche"]')).toBeVisible();
  await expect(invite).toContainText(/Ce lien sert une fois, jusqu’au \d{1,2} \p{L}+/u);
  const field = invite.getByRole("textbox", { name: "Lien d’invitation" });
  const url = await field.inputValue();
  expect(url).toMatch(/\/#\/invitation\/[A-Za-z0-9_-]{22}$/);
  await expect(invite.getByRole("img", { name: "Code QR du lien d’invitation" })).toBeVisible();
  await a.page.keyboard.press("Escape");
  await expect(invite).toHaveCount(0);
  await expect(a.page.getByRole("button", { name: "Inviter un proche" })).toBeFocused();

  // The pending link, shareable again from this device.
  const links = a.page.locator("[data-invite-row]");
  await expect(links).toHaveCount(1);
  await expect(links.first()).toContainText(/Lien du \d{1,2} \p{L}+/u);
  await expect(links.first()).toContainText(/Valable jusqu’au \d{1,2} \p{L}+.* · une seule fois/u);
  await links.first().getByRole("button", { name: "Partager ce lien" }).click();
  await expect(
    a.page.getByRole("dialog", { name: "Inviter un proche" }).getByRole("textbox"),
  ).toHaveValue(url);
  await a.page.keyboard.press("Escape");

  // B signs up through it: each is in the other's list, and A's link is no longer pending.
  const context = await passkeyContext(browser, testInfo);
  const page = await context.newPage();
  const pseudo = uniquePseudo("Benoît");
  await signUp(page, url.slice(url.indexOf("#/invitation/") + "#/invitation/".length), pseudo);
  await page.goto("/#/amis");
  await expect(row(page, a.pseudo)).toBeVisible();
  await expect(row(page, a.pseudo)).toContainText(/Dans tes amis depuis \p{L}+ \d{4}/u);
  await a.page.reload();
  await expect(row(a.page, pseudo)).toBeVisible();
  await expect(row(a.page, pseudo).getByRole("button")).toHaveAccessibleName(
    `Retirer ${pseudo} de tes amis`,
  );
  await expect(a.page.locator("[data-invite-row]")).toHaveCount(0);
  await expect(a.page.locator("[data-friends-right]")).toContainText(
    "Aucune invitation en attente.",
  );

  await context.close();
  await a.context.close();
});

test("« Ajouter avec un code » : donner son code, le taper, chaque réponse", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const a = await player(browser, request, testInfo, "Alix");
  const c = await player(browser, request, testInfo, "Côme");
  await a.page.goto("/#/amis");
  await c.page.goto("/#/amis");

  // A gives the code; the same one comes back while it is valid; « Nouveau code » makes another.
  const first = await giveCode(a.page);
  expect(await giveCode(a.page)).toBe(first);
  await a.page.getByRole("button", { name: "Ajouter avec un code" }).click();
  await sheet(a.page).getByRole("radio", { name: "Donner mon code" }).click();
  await expect(sheet(a.page)).toContainText(
    "Valable 24 heures. Dis-le ou envoie-le à un proche qui a un compte TOC.",
  );
  await expect(sheet(a.page).getByRole("group")).toHaveAccessibleName(
    new RegExp(`^Code ami\\s: T O C, ${[...first.slice(4, 8)].join(" ")}, `),
  );
  await sheet(a.page).getByRole("button", { name: "Nouveau code" }).click();
  await expect(sheet(a.page).locator("[data-friend-code]")).not.toHaveText(first);
  await expect(sheet(a.page).locator("[data-friend-code]")).toHaveText(
    /^TOC-[0-9A-Z]{4}-[0-9A-Z]{4}$/,
  );
  const code = (await sheet(a.page).locator("[data-friend-code]").innerText()).trim();
  await a.page.keyboard.press("Escape");

  // C: « Entrer un code » first; the field adds « TOC- » and the dash.
  await c.page.getByRole("button", { name: "Ajouter avec un code" }).click();
  await expect(sheet(c.page).getByRole("radio", { name: "Entrer un code" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  const field = sheet(c.page).getByLabel("Le code ami de ton proche");
  // A code of the wrong shape never leaves the page.
  await enterCode(c.page, "abc");
  await expect(sheet(c.page).locator("[data-friend-code-error]")).toHaveText(
    "Un code ami ressemble à TOC-K7QM-2XRA.",
  );
  // The old code no longer works.
  await enterCode(c.page, first.slice(4).toLowerCase());
  await expect(sheet(c.page).locator("[data-friend-code-error]")).toContainText(
    "Ce code ne marche pas",
  );
  // A's code, in lower case without the prefix.
  await enterCode(c.page, code.slice(4).replace("-", "").toLowerCase());
  await expect(field).toHaveCount(0);
  await expect(c.page.locator("[data-toast]")).toContainText(
    `${a.pseudo} est maintenant dans tes amis.`,
  );
  await expect(sheet(c.page)).toHaveCount(0);
  await expect(row(c.page, a.pseudo)).toBeVisible();
  await a.page.reload();
  await expect(row(a.page, c.pseudo)).toBeVisible();

  // Again: already in the friends; then C's own code.
  await enterCode(c.page, code);
  await expect(sheet(c.page).locator("[data-friend-code-error]")).toHaveText(
    `${a.pseudo} est déjà dans tes amis.`,
  );
  await c.page.keyboard.press("Escape");
  const own = await giveCode(c.page);
  await enterCode(c.page, own);
  await expect(sheet(c.page).locator("[data-friend-code-error]")).toHaveText(
    "C’est ton propre code : donne-le à ton proche.".replace(" :", " :"),
  );

  await a.context.close();
  await c.context.close();
});

test("retirer un ami des deux côtés ; un lien désactivé ; un lien fait ailleurs", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const a = await player(browser, request, testInfo, "Armelle");
  const b = await player(browser, request, testInfo, "Bertrand");
  await befriend(a.page, b.page);
  await a.page.goto("/#/amis");
  await expect(row(a.page, b.pseudo)).toBeVisible();

  // « Retirer {B} de tes amis ? »: « Garder dans mes amis » is the focused safe answer.
  await row(a.page, b.pseudo)
    .getByRole("button", { name: `Retirer ${b.pseudo} de tes amis` })
    .click();
  const confirm = a.page.getByRole("dialog", {
    name: new RegExp(`^Retirer ${b.pseudo} de tes amis\\s\\?$`),
  });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText(
    `${b.pseudo} ne pourra plus t’inviter à une table, et toi non plus.`,
  );
  await expect(confirm.getByRole("button", { name: "Garder dans mes amis" })).toBeFocused();
  await confirm.getByRole("button", { name: "Retirer de mes amis" }).click();
  await expect(a.page.locator("[data-toast]")).toContainText(
    `${b.pseudo} n’est plus dans tes amis.`,
  );
  await expect(row(a.page, b.pseudo)).toHaveCount(0);
  await expect(a.page.getByRole("button", { name: "Inviter un proche" })).toBeFocused();
  await b.page.goto("/#/amis");
  await expect(b.page.locator("[data-friends-empty]")).toBeVisible();
  await expect(row(b.page, a.pseudo)).toHaveCount(0);

  // A link made on another device (here: through the API) cannot be shared from this one.
  const elsewhere = await apiInvitation(a.page);
  await a.page.reload();
  const other = a.page.locator(`[data-invite-row="${elsewhere.id}"]`);
  await expect(other).toBeVisible();
  await expect(other.getByRole("button", { name: "Partager ce lien" })).toHaveCount(0);

  // A link made here, then disabled: its address no longer opens anything.
  await a.page.getByRole("button", { name: "Inviter un proche" }).click();
  const url = await a.page
    .getByRole("dialog", { name: "Inviter un proche" })
    .getByRole("textbox")
    .inputValue();
  await a.page.keyboard.press("Escape");
  const links = a.page.locator("[data-invite-row]");
  await expect(links).toHaveCount(2);
  const mine = links.filter({ has: a.page.getByRole("button", { name: "Partager ce lien" }) });
  await expect(mine).toHaveCount(1);
  await mine.getByRole("button", { name: "Désactiver ce lien" }).click();
  const disable = a.page.getByRole("dialog", { name: /^Désactiver ce lien\s\?$/ });
  await expect(disable).toContainText("Le proche qui l’a reçu ne pourra plus s’en servir.");
  await expect(disable.getByRole("button", { name: "Garder le lien" })).toBeFocused();
  await disable.getByRole("button", { name: "Désactiver le lien" }).click();
  await expect(a.page.locator("[data-toast]")).toContainText("Lien désactivé.");
  await expect(links).toHaveCount(1);
  const fresh = await browser.newContext(deviceOptions(testInfo));
  const stranger = await fresh.newPage();
  await stranger.goto(url);
  await expect(stranger.getByRole("heading", { level: 1 })).toHaveText(
    "Cette invitation n’existe pas",
  );

  await fresh.close();
  await a.context.close();
  await b.context.close();
});

test("dix liens en attente : le onzième est refusé avec son message", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const a = await player(browser, request, testInfo, "Aurèle");
  for (let i = 0; i < 9; i++) await apiInvitation(a.page);
  await a.page.goto("/#/amis");
  await expect(a.page.locator("[data-invite-row]")).toHaveCount(9);
  await a.page.getByRole("button", { name: "Inviter un proche" }).click();
  await expect(a.page.getByRole("dialog", { name: "Inviter un proche" })).toBeVisible();
  await a.page.keyboard.press("Escape");
  await expect(a.page.locator("[data-invite-row]")).toHaveCount(10);
  await a.page.getByRole("button", { name: "Inviter un proche" }).click();
  await expect(a.page.locator("[data-toast]")).toContainText(
    "Tu as déjà 10 liens en attente. Désactive-en un pour en créer un autre.",
  );
  await expect(a.page.getByRole("dialog")).toHaveCount(0);
  await a.context.close();
});

test("« Mes amis » tient dans l’écran avec trois amis et un lien : 844 × 390 et 1280 × 800", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const a = await player(browser, request, testInfo, "Anatole");
  const others: Player[] = [];
  for (const prefix of ["Bérénice", "Clément", "Delphine-Marie"]) {
    const other = await player(browser, request, testInfo, prefix);
    await befriend(a.page, other.page);
    others.push(other);
  }
  await apiInvitation(a.page);
  await a.page.goto("/#/amis");
  await expect(a.page.locator("[data-friend-row]")).toHaveCount(3);
  await expect(a.page.locator("[data-invite-row]")).toHaveCount(1);
  // French alphabetical order.
  const names = await a.page
    .locator("[data-friend-row]")
    .evaluateAll((all) => all.map((each) => each.getAttribute("data-friend-row") ?? ""));
  expect(names).toEqual(
    [...names].sort((x, y) => x.localeCompare(y, "fr", { sensitivity: "base" })),
  );

  for (const size of [
    { width: 844, height: 390, layout: "two", left: 280, right: 480 },
    { width: 1280, height: 800, layout: "computer", left: 320, right: 520 },
  ]) {
    await a.page.setViewportSize({ width: size.width, height: size.height });
    await expect(a.page.locator("[data-friends]")).toHaveAttribute("data-layout", size.layout);
    const fit = await a.page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
      return {
        sideways: document.documentElement.scrollWidth - innerWidth,
        down: document.documentElement.scrollHeight - innerHeight,
        left: box("[data-friends-actions]")?.width,
        right: box("[data-friends-right]")?.width,
        row: box("[data-friend-row]")?.height,
      };
    });
    expect(fit.sideways).toBe(0);
    expect(fit.down).toBeLessThanOrEqual(0);
    expect(fit.left).toBe(size.left);
    expect(fit.right).toBe(size.right);
    expect(fit.row).toBe(56);
  }

  for (const other of others) await other.context.close();
  await a.context.close();
});
