import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { encode } from "uqr";
import { deviceOptions, seatTile } from "./online.ts";

// « Inviter à la table » (plan 02-05, D-02): it opens by itself for the creator right after the
// creation; its QR code is the table link's (same module count as uqr's own encoding), « Copier le
// lien » puts the link in the clipboard and says « Lien copié. », « Partager le lien » hands the link
// to the device's share sheet when it has one (else only « Copier le lien », as primary). The copied
// link brings a second device to the same waiting room.

const toast = (page: Page) => page.locator("[data-toast]");

/** A device that may read and write the clipboard (Chromium asks otherwise). */
async function clipboardDevice(context: BrowserContext, baseURL: string): Promise<Page> {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  return context.newPage();
}

/** From the home: « Créer une table en ligne », the first name, then the new table's id. */
async function createFromHome(page: Page, name: string): Promise<string> {
  await page.goto("/");
  await page.locator('[data-home-choice="table"]').click();
  const prompt = page.locator("[data-name-prompt]");
  await prompt.getByRole("textbox", { name: "Ton prénom" }).fill(name);
  await prompt.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/#\/table\/[A-Za-z0-9_-]{22}$/);
  return new URL(page.url()).hash.slice("#/table/".length);
}

test("the sheet opens after the creation, its QR is the link's, copy and share hand the link over", async ({
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  const baseURL = testInfo.project.use.baseURL as string;
  const anaDevice = await browser.newContext(deviceOptions(testInfo));
  // A device that can share: the share sheet is stood in for, and records what it was given.
  await anaDevice.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "share", {
      configurable: true,
      value: async (data: unknown) => {
        (window as unknown as { shared: unknown[] }).shared ??= [];
        (window as unknown as { shared: unknown[] }).shared.push(data);
      },
    });
  });
  const ana = await clipboardDevice(anaDevice, baseURL);
  const id = await createFromHome(ana, "Ana");
  const link = `${baseURL}/#/table/${id}`;

  const sheet = ana.getByRole("dialog", { name: "Inviter à la table" });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator("[data-invite-sheet]")).toBeVisible();
  await expect(sheet.getByText("Envoie ce lien à tes proches.")).toBeVisible();
  await expect(sheet.getByRole("textbox", { name: "Lien de la table" })).toHaveValue(link);

  // The QR code: one path, as many modules as uqr finds for the link.
  const qr = sheet.locator("[data-qr]");
  await expect(qr).toHaveAttribute("data-qr", "ready");
  await expect(qr.locator("path")).toHaveCount(1);
  await expect(sheet.getByRole("img", { name: "Code QR du lien de la table" })).toBeVisible();
  await expect(qr).toHaveAttribute(
    "data-modules",
    String(encode(link, { ecc: "L", border: 0 }).size),
  );
  await expect(qr).toContainText("À scanner avec l’appareil photo");
  // A square of whole-pixel modules (at least 4 px each), at most 196 px.
  await expect(qr.locator("svg")).toBeVisible();
  const size = await qr.locator("svg").evaluate((svg) => ({
    width: Number(svg.getAttribute("width")),
    height: Number(svg.getAttribute("height")),
    side: Number(svg.getAttribute("viewBox")?.split(" ")[2]),
  }));
  expect(size.width).toBe(size.height);
  expect(size.width).toBeLessThanOrEqual(196);
  expect(size.width % size.side).toBe(0);
  expect(size.width / size.side).toBeGreaterThanOrEqual(4);

  // « Partager le lien » is the primary; the share sheet gets the title, the text and the link.
  const shareButton = sheet.getByRole("button", { name: "Partager le lien" });
  await expect(shareButton).toHaveClass(/btn-primary/);
  await shareButton.click();
  await expect
    .poll(() => ana.evaluate(() => (window as unknown as { shared?: unknown[] }).shared))
    .toEqual([{ title: "TOC", text: "Ana t’invite à une partie de TOC !", url: link }]);

  // « Copier le lien »: the clipboard holds the link and the toast says so.
  const copyButton = sheet.getByRole("button", { name: "Copier le lien" });
  await expect(copyButton).toHaveClass(/btn-secondary/);
  await copyButton.click();
  await expect(toast(ana)).toHaveText(/^Lien copié\.\s*$/);
  const copied = await ana.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(link);

  // « Fermer », then « Inviter » opens it again; closing gives the focus back to « Inviter ».
  await sheet.getByRole("button", { name: "Fermer" }).click();
  await expect(sheet).toHaveCount(0);
  const inviteButton = ana.getByRole("button", { name: "Inviter" });
  await inviteButton.click();
  await expect(sheet).toBeVisible();
  await ana.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(inviteButton).toBeFocused();

  // The copied link brings a second device to the same waiting room.
  const benDevice = await browser.newContext(deviceOptions(testInfo));
  const ben = await benDevice.newPage();
  await ben.goto(copied);
  const prompt = ben.locator("[data-name-prompt]");
  await expect(prompt).toContainText("Ana t’invite à une partie de TOC.");
  await prompt.getByRole("textbox", { name: "Ton prénom" }).fill("Ben");
  await prompt.getByRole("button", { name: "Continuer" }).click();
  await expect(ben.locator("[data-waiting-room]")).toBeVisible();
  await expect(ben.getByRole("heading", { name: "Table de Ana" })).toBeVisible();
  // Not the creator: no sheet of its own, but « Inviter » opens it for Ben too.
  await expect(ben.getByRole("dialog", { name: "Inviter à la table" })).toHaveCount(0);
  await seatTile(ben, "jaune").click();
  await expect(seatTile(ana, "jaune")).toHaveAttribute("data-seat-state", "human");
  await ben.getByRole("button", { name: "Inviter" }).click();
  await expect(
    ben.getByRole("dialog", { name: "Inviter à la table" }).getByRole("textbox"),
  ).toHaveValue(link);
});

test("without a share sheet only « Copier le lien » shows, as the primary", async ({
  browser,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL as string;
  const context = await browser.newContext(deviceOptions(testInfo));
  await context.addInitScript(() => {
    delete (Navigator.prototype as { share?: unknown }).share;
  });
  const page = await clipboardDevice(context, baseURL);
  await createFromHome(page, "Ana");
  const sheet = page.getByRole("dialog", { name: "Inviter à la table" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Partager le lien" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Copier le lien" })).toHaveClass(/btn-primary/);
  // A refused copy says so and selects the link for a manual copy.
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error("refused"));
  });
  await sheet.getByRole("button", { name: "Copier le lien" }).click();
  await expect(toast(page)).toHaveText(
    /^Impossible de copier\. Sélectionne le lien ci-dessus\.\s*$/,
  );
  const field = sheet.getByRole("textbox", { name: "Lien de la table" });
  await expect(field).toBeFocused();
  expect(
    await field.evaluate(
      (input: HTMLInputElement) => (input.selectionEnd ?? 0) - (input.selectionStart ?? 0),
    ),
  ).toBe((await field.inputValue()).length);
  // It does not open by itself a second time after a reload.
  await sheet.getByRole("button", { name: "Fermer" }).click();
  await page.reload();
  await expect(page.locator("[data-waiting-room]")).toBeVisible();
  await expect(sheet).toHaveCount(0);
});
