import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { cardIdsIn, structuralProblems } from "../../../packages/table/src/oracle.ts";
import { exchange, zone } from "../e2e/jouer.ts";
import {
  accountContext,
  copyPasskey,
  listenNotices,
  mintInvitation,
  signInFromHome,
  signUp,
  uniquePseudo,
} from "./comptes.ts";
import {
  createTable,
  type Frame,
  listenFrames,
  playOneMove,
  type Received,
  type Seat,
  seatTile,
} from "./online.ts";

// The whole path of phase 4 across browsers (plan 04-12, SC1 to SC5, ACCT-01 to ACCT-05, APP-03 in
// the app), end to end against `wrangler dev`, with the frame check of phases 2 and 3:
//   A signs up (a minted invitation, the bootstrap's stand-in); in « Mes amis », A makes a link with
//   « Inviter un proche »; B opens it in another browser and signs up: each is in the other's list.
//   A's table (made through the test API, for its short pause and notice delays); A invites B with
//   « Inviter » in the « Mes amis » tab; B's home shows the card and « Rejoindre » brings B to the
//   waiting room; A seats B on jaune, sets rouge to Trotteur and vert to Pur-sang, and starts; the
//   exchange and three human turns are played; B's game page closes; B2 (B's synced passkey, on the
//   home) gets « c’est ton tour » after notifyMs and takes the seat back; A stops the game.
// Every frame A's, B's and B2's table pages received passes the structural leak oracle for its
// reader, with the two accounts' ids, WebAuthn handles and session tokens as forbidden strings; at
// the same seq no page holds a card of the other side's hand unless a public event shows it. No page
// logs a Svelte error (the toast loop this spec found on the phone, fixed in Toast.svelte).

/** A literal for a RegExp (pseudos carry a space and letters only, but never trust that). */
const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const card = (page: Page) => page.locator("[data-notice-card]");
const plate = (page: Page) => page.locator("[data-plate]");
const friendRow = (page: Page, pseudo: string) => page.locator(`[data-friend-row="${pseudo}"]`);

/** The highest seq a page has received (events or welcome), 0 before the game. */
function lastSeq(frames: Received[]): number {
  let seq = 0;
  for (const { frame } of frames) {
    if ((frame.t === "events" || frame.t === "welcome") && typeof frame.seq === "number") {
      seq = Math.max(seq, frame.seq);
    }
  }
  return seq;
}

/** The hand a page held at `seq`, from its own frame for that seq. */
function handAt(frames: Received[], seq: number): string[] | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const { frame } = frames[i] as Received;
    const view = frame.view as { hand?: string[] } | null | undefined;
    if ((frame.t === "events" || frame.t === "welcome") && frame.seq === seq && view?.hand) {
      return view.hand;
    }
  }
  return null;
}

/** The cards a frame's own public events announce. */
function announced(frame: Frame): Set<string> {
  const cards = new Set<string>();
  if (frame.t !== "events" || !Array.isArray(frame.events)) return cards;
  for (const event of frame.events as { t: string; card?: string; cards?: string[] }[]) {
    if (event.t === "cardPlayed" && event.card) cards.add(event.card);
    if (event.t === "handDiscarded") for (const each of event.cards ?? []) cards.add(each);
  }
  return cards;
}

/** What identifies an account and a device's session: none of it may reach a table frame. */
async function secretsOf(context: BrowserContext, page: Page): Promise<string[]> {
  const me = await page.evaluate(async () => {
    const response = await fetch("/api/me", { cache: "no-store" });
    return (await response.json()) as { id: string };
  });
  const handles = (await context.credentials.get({ rpId: "localhost" })).map(
    (each) => each.userHandle ?? "",
  );
  const cookies = (await context.cookies())
    .filter((each) => each.name.endsWith("toc_session"))
    .map((each) => each.value);
  const all = [me.id, ...handles, ...cookies].filter((each) => each.length >= 8);
  expect(all.length).toBeGreaterThanOrEqual(2);
  return all;
}

/** The Svelte errors a page logs (an effect that loops without end drops the update it came with). */
function listenSvelteErrors(page: Page, into: string[]): void {
  page.on("console", (message) => {
    if (message.type() === "error" && /svelte\.dev\/e\//.test(message.text())) {
      into.push(message.text().split("\n")[0] ?? "");
    }
  });
  page.on("pageerror", (error) => into.push(String(error)));
}

/** Opens the table's waiting room (test pace), signed in: no first-name prompt. */
async function openTable(page: Page, id: string): Promise<void> {
  await page.goto("/");
  await page.goto(`/#/table/${id}?vitesse=test`);
  await expect(seatTile(page, "bleu")).toBeVisible();
  await expect(page.locator("[data-name-prompt]")).toHaveCount(0);
}

test("le parcours de la phase 4 : un proche invité, une table entre amis, son tour sur un autre appareil", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(420_000);
  const started = Date.now();
  const marks: string[] = [];
  let lap = started;
  const mark = (name: string) => {
    marks.push(`${name} ${Math.round((Date.now() - lap) / 1000)} s`);
    lap = Date.now();
  };

  // --- A: the first account, then a link « Inviter un proche » in « Mes amis » ---
  const contextA = await accountContext(browser, testInfo);
  const pageA = await contextA.newPage();
  let seatA: Seat | null = null;
  const framesA = listenFrames(pageA, () => seatA);
  const svelteErrors: string[] = [];
  listenSvelteErrors(pageA, svelteErrors);
  const pseudoA = uniquePseudo("Romain");
  await signUp(pageA, await mintInvitation(request), pseudoA);
  await pageA.locator('[data-small-tile="amis"]').click();
  await expect(pageA.getByRole("heading", { level: 1 })).toHaveText("Mes amis");
  await pageA.getByRole("button", { name: "Inviter un proche" }).click();
  const share = pageA.getByRole("dialog", { name: "Inviter un proche" });
  await expect(share).toBeVisible();
  const url = await share.getByRole("textbox", { name: "Lien d’invitation" }).inputValue();
  expect(url).toMatch(/\/#\/invitation\/[A-Za-z0-9_-]{22}$/);
  await pageA.keyboard.press("Escape");
  await expect(share).toHaveCount(0);
  await expect(pageA.locator("[data-invite-row]")).toHaveCount(1);

  // --- B: opens the link in another browser and signs up; each is in the other's list ---
  const contextB = await accountContext(browser, testInfo);
  const pageB = await contextB.newPage();
  let seatB: Seat | null = null;
  const framesB = listenFrames(pageB, () => seatB);
  listenSvelteErrors(pageB, svelteErrors);
  const pseudoB = uniquePseudo("Sœur");
  await signUp(pageB, url.slice(url.indexOf("#/invitation/") + "#/invitation/".length), pseudoB);
  await pageB.goto("/#/amis");
  await expect(friendRow(pageB, pseudoA)).toBeVisible();
  await pageA.reload();
  await expect(friendRow(pageA, pseudoB)).toBeVisible();
  await expect(pageA.locator("[data-invite-row]")).toHaveCount(0);
  await pageB.goto("/");
  await expect(pageB.locator('[data-small-tile="compte"]')).toBeVisible();
  const forbidden = [...(await secretsOf(contextA, pageA)), ...(await secretsOf(contextB, pageB))];
  mark("comptes et amis");

  // --- the table: A invites B in one tap from the « Mes amis » tab ---
  const id = await createTable(request, { pace: "zero", pauseMs: 2000, notifyMs: 1500 });
  await openTable(pageA, id);
  seatA = "bleu";
  await seatTile(pageA, "bleu").click();
  await expect(seatTile(pageA, "bleu")).toHaveAttribute("data-seat-state", "you");
  await pageA.locator("[data-room-actions] [data-invite]").click();
  const sheet = pageA.getByRole("dialog", { name: "Inviter à la table" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "Mes amis" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  const row = sheet.locator(`[data-friend-row="${pseudoB}"]`);
  await row.getByRole("button", { name: `Inviter ${pseudoB} à la table` }).click();
  await expect(row).toContainText("Invitation envoyée");
  await pageA.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  // B's home: the card, then « Rejoindre » to the waiting room under the pseudo.
  const invite = card(pageB);
  await expect(invite).toHaveAttribute("data-notice-card", "invite");
  await expect(invite).toContainText(`${pseudoA} t’invite à sa table.`);
  await invite.getByRole("button", { name: "Rejoindre" }).click();
  await expect(pageB).toHaveURL(new RegExp(`#/table/${id}$`));
  await expect(seatTile(pageB, "bleu")).toContainText(pseudoA);
  await expect(pageB.locator("[data-name-prompt]")).toHaveCount(0);

  // A seats B: B takes rouge, A moves B to jaune; rouge Trotteur, vert Pur-sang; A starts.
  seatB = "rouge";
  await seatTile(pageB, "rouge").click();
  await expect(seatTile(pageB, "rouge")).toHaveAttribute("data-seat-state", "you");
  seatB = "jaune";
  await seatTile(pageA, "rouge").click();
  await pageA
    .getByRole("dialog", { name: `Déplacer ${pseudoB}` })
    .getByRole("button", { name: "Vers Jaune (place libre)" })
    .click();
  await expect(seatTile(pageB, "jaune")).toHaveAttribute("data-seat-state", "you");
  await pageA
    .getByRole("radiogroup", { name: "Force de Rouge, ordinateur" })
    .getByRole("radio", { name: "Trotteur" })
    .click();
  await pageA
    .getByRole("radiogroup", { name: "Force de Vert, ordinateur" })
    .getByRole("radio", { name: "Pur-sang" })
    .click();
  await expect(pageB.locator('[data-computer-line="rouge"]')).toContainText("Trotteur");
  await expect(pageB.locator('[data-computer-line="vert"]')).toContainText("Pur-sang");
  await pageA.getByRole("button", { name: "Lancer la partie" }).click();
  for (const page of [pageA, pageB]) {
    await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5, { timeout: 20_000 });
  }
  mark("table");

  // --- the exchange, then three human turns (a new deal on the way is passed again) ---
  await exchange(pageA);
  await exchange(pageB);
  const pages: [Page, Received[]][] = [
    [pageA, framesA],
    [pageB, framesB],
  ];
  let turns = 0;
  for (let i = 0; i < 1200 && turns < 3; i++) {
    let moved = false;
    for (const [page, frames] of pages) {
      const state = await zone(page).getAttribute("data-state");
      if (state === "exchange") {
        await exchange(page);
        moved = true;
        break;
      }
      if (state !== "idle" && state !== "finishedPrompt" && state !== "deadHand") continue;
      const before = lastSeq(frames);
      await playOneMove(page);
      await expect.poll(() => lastSeq(frames), { timeout: 20_000 }).toBeGreaterThan(before);
      turns += 1;
      moved = true;
      break;
    }
    if (!moved) await pageA.waitForTimeout(50);
  }
  expect(turns).toBe(3);
  mark("échange et trois tours");

  // --- B's game page closes; B2 (B's passkey on another device) is told, and comes back ---
  const contextB2 = await accountContext(browser, testInfo);
  expect(await copyPasskey(contextB, contextB2)).toBeGreaterThan(0);
  const pageB2 = await contextB2.newPage();
  let seatB2: Seat | null = null;
  const framesB2 = listenFrames(pageB2, () => seatB2);
  listenSvelteErrors(pageB2, svelteErrors);
  const notices = listenNotices(pageB2);
  await signInFromHome(pageB2);
  await expect(pageB2.locator('[data-small-tile="compte"]')).toBeVisible();
  forbidden.push(
    ...(await contextB2.cookies())
      .filter((each) => each.name.endsWith("toc_session"))
      .map((each) => each.value),
  );

  await pageB.close();
  await expect(plate(pageA)).toHaveAttribute("data-plate", "pause");
  const turn = card(pageB2);
  await expect(turn).toHaveAttribute("data-notice-card", "turn", { timeout: 15_000 });
  await expect(turn).toHaveText(
    new RegExp(`La table de ${literal(pseudoA)} t’attend\\s: c’est ton tour\\.`),
  );
  await expect(card(pageA)).toHaveCount(0);
  expect(notices.filter((each) => each.kind === "turn" && each.table === id)).toHaveLength(1);
  seatB2 = "jaune";
  await turn.getByRole("button", { name: "Revenir à la table" }).click();
  await expect(pageB2.locator("[data-board]")).toHaveAttribute("data-bottom", "jaune", {
    timeout: 20_000,
  });
  await expect(plate(pageA)).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(() => lastSeq(framesB2) === lastSeq(framesA), { timeout: 20_000 }).toBe(true);
  mark("son tour sur un autre appareil");

  // --- A stops the game: saved for everyone ---
  await pageA.locator("[data-settings-slot] button").first().click();
  await pageA.locator("[data-stop-game]").click();
  const confirm = pageA.getByRole("dialog", { name: "Arrêter la partie ?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Arrêter la partie" }).click();
  for (const page of [pageA, pageB2]) {
    await expect(plate(page)).toHaveAttribute("data-plate", "saved");
  }
  mark("partie arrêtée");

  // No page logged a Svelte error on the way (04-12: a looping effect lost a knight's move).
  expect(svelteErrors).toEqual([]);

  // --- the frame check: every frame of every table page, for its reader ---
  let checked = 0;
  for (const [name, frames] of [
    ["A", framesA],
    ["B", framesB],
    ["B2", framesB2],
  ] as const) {
    // B2 came back for the end only: its welcome and the stop at least.
    expect(frames.length, name).toBeGreaterThan(name === "B2" ? 1 : 5);
    for (const [index, { seat, frame, text }] of frames.entries()) {
      expect(structuralProblems(frame, seat, forbidden), `${name} frame ${index}`).toEqual([]);
      for (const secret of forbidden)
        expect(text.includes(secret), `${name} frame ${index}`).toBe(false);
      checked += 1;
    }
  }
  // The deal: A and B each saw their own five cards and three hidden hands.
  for (const [frames, seat] of [
    [framesA, "bleu"],
    [framesB, "jaune"],
  ] as const) {
    const deal = frames.find(({ frame }) => frame.t === "events" && frame.seq === 1);
    const dealt = (
      (deal?.frame.events ?? []) as { t: string; seat: string; cards: unknown }[]
    ).filter((event) => event.t === "handDealt");
    expect(dealt).toHaveLength(4);
    for (const event of dealt) {
      if (event.seat === seat) expect(event.cards).toHaveLength(5);
      else expect(event.cards).toBeNull();
    }
  }
  // Across the two sides: at the same seq, the other side's hand never shows up unannounced.
  let compared = 0;
  for (const [reader, other] of [
    [framesA, framesB],
    [framesA, framesB2],
    [framesB, framesA],
    [framesB2, framesA],
  ] as const) {
    for (const { text, frame } of reader) {
      if ((frame.t !== "events" && frame.t !== "welcome") || typeof frame.seq !== "number")
        continue;
      const otherHand = handAt(other, frame.seq);
      if (otherHand === null) continue;
      const open = announced(frame);
      const seen = cardIdsIn(text).filter((each) => otherHand.includes(each) && !open.has(each));
      expect(seen, `seq ${frame.seq}`).toEqual([]);
      compared += 1;
    }
  }
  expect(compared).toBeGreaterThan(5);

  const line = `${testInfo.project.name}: ${Math.round((Date.now() - started) / 1000)} s (${marks.join(", ")}), ${checked} trames vérifiées, ${compared} comparées`;
  testInfo.annotations.push({ type: "parcours", description: line });
  console.log(`parcours.spec: ${line}`);

  await contextA.close();
  await contextB.close();
  await contextB2.close();
});
