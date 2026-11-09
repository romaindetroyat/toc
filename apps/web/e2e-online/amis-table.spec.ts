import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import {
  accountContext,
  apiInvitation,
  copyPasskey,
  listenNotices,
  mintInvitation,
  signInFromHome,
  signOutHere,
  signUp,
  uniquePseudo,
} from "./comptes.ts";
import { createTable, seatTile } from "./online.ts";

// A friend invited to a table in one tap, then told that the table waits (plan 04-11, ACCT-04,
// APP-03 in the app, D-07, D-08, D-12), end to end against `wrangler dev`:
//   invite      A and B are friends through A's link; A's « Inviter » opens on « Mes amis »; one tap
//               on « Inviter » next to B; B, on the home, gets « {A} t’invite à sa table. » and
//               « Rejoindre » brings B to the waiting room; B's row now reads « Déjà à la table »; the
//               phase-2 room is driven as before (a seat moved, two strengths, the start)
//   turn        B's game page closes: A's pause; B2 (B's account on another device, on the home)
//               gets « La table de {A} t’attend : c’est ton tour. », once; « Revenir à la table »
//               brings B2 to jaune and the pause ends
//   held        an invitation that comes during a local game waits for the home, while its table
//               still waits; one whose table has started meanwhile is dropped
//   signed out  a signed-out device asks « Connecte-toi pour reprendre ta place » before any socket;
//               « Se connecter » gives jaune back
//   fit         the link tab keeps « Partager le lien » and « Copier le lien » in sight at 844 x 390;
//               the card at 480 x 320 is stacked inside the viewport

/** A literal for a RegExp (pseudos carry a space and letters only, but never trust that). */
const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const card = (page: Page) => page.locator("[data-notice-card]");
const plate = (page: Page) => page.locator("[data-plate]");

/** Saves the page at 844 x 390 and 1280 x 800 when TOC_SHOTS names a directory, then its own size. */
async function shots(page: Page, name: string): Promise<void> {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?.env;
  const dir = env?.TOC_SHOTS;
  if (!dir) return;
  const own = page.viewportSize();
  for (const size of [
    { width: 844, height: 390 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${dir}/04-11-${name}-${size.width}x${size.height}.png` });
  }
  if (own !== null) await page.setViewportSize(own);
  await page.waitForTimeout(200);
}

/** A device that can share: the share sheet is stood in for (as in invitation.spec.ts). */
async function canShare(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "share", {
      configurable: true,
      value: async () => {},
    });
  });
}

/** Opens the table's waiting room (test pace), signed in: no first-name prompt. */
async function openTable(page: Page, id: string): Promise<void> {
  await page.goto("/");
  await page.goto(`/#/table/${id}?vitesse=test`);
  await expect(seatTile(page, "bleu")).toBeVisible();
  await expect(page.locator("[data-name-prompt]")).toHaveCount(0);
}

/** « Inviter » in the waiting room: the sheet « Inviter à la table ». */
async function openInvite(page: Page): Promise<Locator> {
  await page.locator("[data-room-actions] [data-invite]").click();
  const sheet = page.getByRole("dialog", { name: "Inviter à la table" });
  await expect(sheet).toBeVisible();
  return sheet;
}

/** « Inviter » next to the friend, in one tap: « Invitation envoyée ». */
async function inviteFriend(sheet: Locator, pseudo: string): Promise<void> {
  const row = sheet.locator(`[data-friend-row="${pseudo}"]`);
  await expect(row).toHaveAttribute("data-friend-invite", "invite");
  await row.getByRole("button", { name: `Inviter ${pseudo} à la table` }).click();
  await expect(row).toHaveAttribute("data-friend-invite", "sent");
  await expect(row).toContainText("Invitation envoyée");
  await expect(row.getByRole("button")).toHaveCount(0);
}

/** The hash changes inside the app (the hub's socket stays as it is). */
async function goHash(page: Page, hash: string): Promise<void> {
  await page.evaluate((next) => {
    location.hash = next;
  }, hash);
}

test("un ami invité en un geste rejoint la table, puis apprend que c’est son tour", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(300_000);
  const started = Date.now();

  // A and B: B signs up through A's invitation link, so they are friends (D-06).
  const contextA = await accountContext(browser, testInfo);
  await canShare(contextA);
  const pageA = await contextA.newPage();
  const pseudoA = uniquePseudo("Romain");
  await signUp(pageA, await mintInvitation(request), pseudoA);
  const link = await apiInvitation(pageA);
  const contextB = await accountContext(browser, testInfo);
  const pageB = await contextB.newPage();
  const pseudoB = uniquePseudo("Sœur");
  await signUp(pageB, link.code, pseudoB);

  // --- invite: A creates a table and invites B in one tap from « Mes amis » ---
  const id = await createTable(request, { pace: "zero", pauseMs: 2000, notifyMs: 1500 });
  await openTable(pageA, id);
  await seatTile(pageA, "bleu").click();
  await expect(seatTile(pageA, "bleu")).toHaveAttribute("data-seat-state", "you");
  let sheet = await openInvite(pageA);
  await expect(sheet.getByRole("radio", { name: "Mes amis" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(sheet.locator('[data-invite-tab="amis"]')).toBeVisible();
  await shots(pageA, "inviter-mes-amis");
  await inviteFriend(sheet, pseudoB);
  await shots(pageA, "invitation-envoyee");

  // The link tab keeps both buttons in sight without scrolling at 844 x 390 (UI-SPEC backstop).
  const own = pageA.viewportSize();
  await pageA.setViewportSize({ width: 844, height: 390 });
  await sheet.getByRole("radio", { name: "Lien et QR code" }).click();
  await expect(sheet.locator('[data-invite-tab="lien"]')).toBeVisible();
  await pageA.waitForTimeout(300);
  const fit = await pageA.evaluate(() => {
    const body = document.querySelector("[data-sheet-body]");
    const share = document.querySelector("[data-invite-share]")?.getBoundingClientRect();
    const copy = document.querySelector("[data-invite-copy]")?.getBoundingClientRect();
    if (!body || !share || !copy) return null;
    const box = body.getBoundingClientRect();
    return {
      top: box.top,
      bottom: box.bottom,
      scroll: body.scrollTop,
      share: { top: share.top, bottom: share.bottom },
      copy: { top: copy.top, bottom: copy.bottom },
      height: box.height,
    };
  });
  if (fit === null) throw new Error("no sheet body or no buttons");
  expect(fit.scroll).toBe(0);
  for (const button of [fit.share, fit.copy]) {
    expect(button.top).toBeGreaterThanOrEqual(fit.top - 0.5);
    expect(button.bottom).toBeLessThanOrEqual(fit.bottom + 0.5);
  }
  testInfo.annotations.push({
    type: "fit",
    description: `link tab at 844x390: body ${fit.height.toFixed(1)} px, « Copier le lien » ends ${(fit.copy.bottom - fit.top).toFixed(1)} px into it`,
  });
  await shots(pageA, "inviter-lien");
  if (own !== null) await pageA.setViewportSize(own);
  await pageA.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  // B, on the home, gets the card at once; A, at the table, never does.
  const invite = card(pageB);
  await expect(invite).toHaveAttribute("data-notice-card", "invite");
  await expect(invite).toHaveText(
    new RegExp(`^\\s*${literal(pseudoA)} t’invite à sa table\\.\\s*Plus tard\\s*Rejoindre\\s*$`),
  );
  await expect(invite).toHaveAccessibleName(`${pseudoA} t’invite à sa table.`);
  await expect(pageB.locator("[data-notice-card-live]")).toHaveText(
    `${pseudoA} t’invite à sa table.`,
  );
  await expect(card(pageA)).toHaveCount(0);

  // The card at 480 x 320: stacked (the buttons under the text) and inside the viewport.
  const ownB = pageB.viewportSize();
  await pageB.setViewportSize({ width: 480, height: 320 });
  await pageB.waitForTimeout(300);
  const stacked = await pageB.evaluate(() => {
    const box = document.querySelector("[data-notice-card]")?.getBoundingClientRect();
    const text = document.querySelector("[data-notice-card] p")?.getBoundingClientRect();
    const join = [...document.querySelectorAll("[data-notice-card] button")]
      .at(-1)
      ?.getBoundingClientRect();
    if (!box || !text || !join) return null;
    return {
      box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
      textBottom: text.bottom,
      joinTop: join.top,
      vw: innerWidth,
      vh: innerHeight,
    };
  });
  if (stacked === null) throw new Error("no card");
  expect(stacked.joinTop).toBeGreaterThanOrEqual(stacked.textBottom);
  expect(stacked.box.left).toBeGreaterThanOrEqual(0);
  expect(stacked.box.top).toBeGreaterThanOrEqual(0);
  expect(stacked.box.right).toBeLessThanOrEqual(stacked.vw);
  expect(stacked.box.bottom).toBeLessThanOrEqual(stacked.vh);
  await pageB.screenshot({ path: testInfo.outputPath("carte-480x320.png") });
  const shotDir = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?.env.TOC_SHOTS;
  if (shotDir) await pageB.screenshot({ path: `${shotDir}/04-11-carte-invitation-480x320.png` });
  if (ownB !== null) await pageB.setViewportSize(ownB);
  await shots(pageB, "carte-invitation");

  // « Rejoindre »: B in the waiting room, under the pseudo, without a first-name prompt.
  await invite.getByRole("button", { name: "Rejoindre" }).click();
  await expect(card(pageB)).toHaveCount(0);
  await expect(pageB).toHaveURL(new RegExp(`#/table/${id}$`));
  await expect(seatTile(pageB, "bleu")).toBeVisible();
  await expect(pageB.locator("[data-name-prompt]")).toHaveCount(0);
  await expect(seatTile(pageB, "bleu")).toContainText(pseudoA);

  // A opens « Inviter » again: B's row reads « Déjà à la table », with no button.
  await expect(pageA.locator("[data-unseated]")).toContainText(pseudoB);
  sheet = await openInvite(pageA);
  const here = sheet.locator(`[data-friend-row="${pseudoB}"]`);
  await expect(here).toHaveAttribute("data-friend-invite", "here");
  await expect(here).toContainText("Déjà à la table");
  await expect(here.getByRole("button")).toHaveCount(0);
  await pageA.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  // The phase-2 room with a friend: B sits, A moves B to jaune, sets the two computers, starts.
  await seatTile(pageB, "rouge").click();
  await expect(seatTile(pageB, "rouge")).toHaveAttribute("data-seat-state", "you");
  await seatTile(pageA, "rouge").click();
  const move = pageA.getByRole("dialog", { name: `Déplacer ${pseudoB}` });
  await move.getByRole("button", { name: "Vers Jaune (place libre)" }).click();
  await expect(seatTile(pageB, "jaune")).toHaveAttribute("data-seat-state", "you");
  await pageA
    .getByRole("radiogroup", { name: "Force de Rouge, ordinateur" })
    .getByRole("radio", { name: "Champion" })
    .click();
  await pageA
    .getByRole("radiogroup", { name: "Force de Vert, ordinateur" })
    .getByRole("radio", { name: "Poulain" })
    .click();
  await expect(pageB.locator('[data-computer-line="rouge"]')).toContainText("Champion");
  await expect(pageB.locator('[data-computer-line="vert"]')).toContainText("Poulain");
  await pageA.getByRole("button", { name: "Lancer la partie" }).click();
  await expect(pageA.locator("[data-hand] [data-card]")).toHaveCount(5);
  await expect(pageB.locator("[data-hand] [data-card]")).toHaveCount(5, { timeout: 20_000 });
  const inviteDone = Date.now();

  // --- turn: B2 is B's account on another device, on the home ---
  const contextB2 = await accountContext(browser, testInfo);
  expect(await copyPasskey(contextB, contextB2)).toBeGreaterThan(0);
  const pageB2 = await contextB2.newPage();
  const notices = listenNotices(pageB2);
  await signInFromHome(pageB2);
  await expect(pageB2.locator('[data-small-tile="compte"]')).toBeVisible();

  // B's game page closes: A's pause; after notifyMs, B2's card, once.
  await pageB.close();
  await expect(plate(pageA)).toHaveAttribute("data-plate", "pause");
  const turn = card(pageB2);
  await expect(turn).toHaveAttribute("data-notice-card", "turn", { timeout: 15_000 });
  await expect(turn).toHaveText(
    new RegExp(
      `^\\s*La table de ${literal(pseudoA)} t’attend\\s: c’est ton tour\\.\\s*Plus tard\\s*Revenir à la table\\s*$`,
    ),
  );
  await expect(card(pageA)).toHaveCount(0);
  await shots(pageB2, "carte-tour");
  expect(notices.filter((each) => each.kind === "turn" && each.table === id)).toHaveLength(1);

  // « Revenir à la table »: B2 on jaune, the pause ends for A.
  await turn.getByRole("button", { name: "Revenir à la table" }).click();
  await expect(card(pageB2)).toHaveCount(0);
  await expect(pageB2.locator("[data-board]")).toHaveAttribute("data-bottom", "jaune", {
    timeout: 20_000,
  });
  await expect(plate(pageA)).toHaveCount(0, { timeout: 15_000 });
  await expect(card(pageB2)).toHaveCount(0);
  expect(notices.filter((each) => each.kind === "turn" && each.table === id)).toHaveLength(1);
  const turnDone = Date.now();

  // --- held: B2 plays a local game; A, now at a second table, invites B ---
  await goHash(pageB2, "#/partie?vitesse=test");
  await expect(pageB2.locator("main.game [data-board]")).toBeVisible();
  // B2 left the first table: A gets the choices (after the turn notice is due), and saves the game.
  await expect(plate(pageA)).toHaveAttribute("data-plate", "choices", { timeout: 15_000 });
  await pageA.getByRole("button", { name: "Sauvegarder et arrêter" }).click();
  await expect(plate(pageA)).toHaveAttribute("data-plate", "saved");

  const second = await createTable(request, { pace: "zero" });
  const pageA2 = await contextA.newPage();
  await openTable(pageA2, second);
  const before = notices.length;
  sheet = await openInvite(pageA2);
  await inviteFriend(sheet, pseudoB);
  await pageA2.keyboard.press("Escape");
  await expect
    .poll(() => notices.slice(before).some((n) => n.kind === "invite" && n.table === second))
    .toBe(true);
  // The frame came during the game: no card over it.
  await pageB2.waitForTimeout(500);
  await expect(card(pageB2)).toHaveCount(0);

  // Back on the home: the table still waits in its lobby, so the card shows.
  await goHash(pageB2, "#/");
  const held = card(pageB2);
  await expect(held).toHaveAttribute("data-notice-card", "invite");
  await expect(held).toContainText(`${pseudoA} t’invite à sa table.`);
  await held.getByRole("button", { name: "Plus tard" }).click();
  await expect(card(pageB2)).toHaveCount(0);

  // Another invitation during a game, to a table that starts before B2 is back: dropped.
  await goHash(pageB2, "#/partie?vitesse=test");
  await expect(pageB2.locator("main.game [data-board]")).toBeVisible();
  const third = await createTable(request, { pace: "zero" });
  await openTable(pageA2, third);
  await seatTile(pageA2, "bleu").click();
  await expect(seatTile(pageA2, "bleu")).toHaveAttribute("data-seat-state", "you");
  const beforeThird = notices.length;
  sheet = await openInvite(pageA2);
  await inviteFriend(sheet, pseudoB);
  await pageA2.keyboard.press("Escape");
  await expect
    .poll(() => notices.slice(beforeThird).some((n) => n.kind === "invite" && n.table === third))
    .toBe(true);
  await pageA2.getByRole("button", { name: "Lancer la partie" }).click();
  await expect(pageA2.locator("[data-hand] [data-card]")).toHaveCount(5);
  const asked = pageB2.waitForResponse((response) =>
    response.url().endsWith(`/api/tables/${third}`),
  );
  await goHash(pageB2, "#/");
  expect((await asked).status()).toBe(200);
  await pageB2.waitForTimeout(500);
  await expect(card(pageB2)).toHaveCount(0);
  const heldDone = Date.now();

  // --- signed out: B2 signs out, then opens the first table's link ---
  await signOutHere(pageB2);
  let tableSockets = 0;
  pageB2.on("websocket", (ws) => {
    if (ws.url().includes("/ws/table/")) tableSockets += 1;
  });
  await pageB2.goto("/");
  await pageB2.goto(`/#/table/${id}?vitesse=test`);
  const notice = pageB2.locator('[data-notice="compte"]');
  await expect(notice).toBeVisible();
  await expect(notice.getByRole("heading")).toHaveText("Connecte-toi pour reprendre ta place");
  await expect(notice).toContainText("Ta place dans cette partie est liée à ton compte.");
  await expect(notice.getByRole("button", { name: "Retour à l’accueil" })).toBeVisible();
  await pageB2.waitForTimeout(500);
  expect(tableSockets).toBe(0);
  await shots(pageB2, "connecte-toi");

  // « Se connecter » with its passkey: the table connects, B2 is back on jaune (the saved game).
  await notice.getByRole("button", { name: "Se connecter" }).click();
  const signIn = pageB2.locator("[data-signin-sheet]");
  await expect(signIn).toBeVisible();
  await signIn.getByRole("button", { name: "Utiliser ma clé d’accès" }).click();
  await expect(pageB2.locator("[data-board]")).toHaveAttribute("data-bottom", "jaune", {
    timeout: 20_000,
  });
  await expect(plate(pageB2)).toHaveAttribute("data-plate", "saved");
  expect(tableSockets).toBeGreaterThan(0);

  testInfo.annotations.push({
    type: "durations",
    description: `invite ${Math.round((inviteDone - started) / 1000)} s, turn ${Math.round((turnDone - inviteDone) / 1000)} s, held ${Math.round((heldDone - turnDone) / 1000)} s, signed out ${Math.round((Date.now() - heldDone) / 1000)} s`,
  });

  await contextA.close();
  await contextB.close();
  await contextB2.close();
});
