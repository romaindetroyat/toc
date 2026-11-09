import { expect, test } from "@playwright/test";
import { mintInvitation, passkeyContext, signUp, uniquePseudo } from "./comptes.ts";
import { createTable, deviceOptions, join, seatTile } from "./online.ts";

// The account at the table (plan 04-04, D-05, ACCT-02), end to end against `wrangler dev`: Léo sits
// bleu as a guest, creates an account on the same device, and comes back to the table under his
// pseudo without typing a first name: bleu is still this device's, the others see the pseudo, the
// account knows the table (GET /api/me/tables), and the device's list entry is tagged with it.

test("une place prise en invité reste la sienne après la création du compte", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const id = await createTable(request, { pace: "zero" });
  const context = await passkeyContext(browser, testInfo);
  const page = await context.newPage();
  await join(page, id, "Léo");
  await seatTile(page, "bleu").click();
  await expect(seatTile(page, "bleu")).toHaveAttribute("data-seat-state", "you");

  // Bruno, a guest on another device, sees Léo on bleu.
  const other = await browser.newContext(deviceOptions(testInfo));
  const bruno = await other.newPage();
  await join(bruno, id, "Bruno");
  await expect(seatTile(bruno, "bleu")).toContainText("Léo");

  // Léo creates his account on this device (an invitation from a relative).
  const pseudo = uniquePseudo("Léonie");
  await signUp(page, await mintInvitation(request), pseudo);

  // Back on the table link: no first-name prompt, bleu is still this device's, under the pseudo.
  await page.goto(`/#/table/${id}?vitesse=test`);
  await expect(seatTile(page, "bleu")).toHaveAttribute("data-seat-state", "you");
  await expect(page.locator("[data-name-prompt]")).toHaveCount(0);
  await expect(seatTile(bruno, "bleu")).toContainText(pseudo);

  // The account knows the table on every device; the device's entry is tagged with the account.
  const known = await page.evaluate(async () => {
    const me = (await (await fetch("/api/me", { cache: "no-store" })).json()) as { id: string };
    const tables = (await (await fetch("/api/me/tables", { cache: "no-store" })).json()) as {
      tableId: string;
      seat: string | null;
    }[];
    const list = JSON.parse(localStorage.getItem("toc.tables.v1") ?? "[]") as {
      id: string;
      account?: string;
    }[];
    return { me: me.id, tables, list };
  });
  expect(known.tables).toContainEqual(expect.objectContaining({ tableId: id, seat: "bleu" }));
  expect(known.list.find((entry) => entry.id === id)?.account).toBe(known.me);

  await other.close();
  await context.close();
});
