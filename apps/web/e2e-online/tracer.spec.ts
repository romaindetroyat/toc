import { expect, type Page, test } from "@playwright/test";
import { exchange, zone } from "../e2e/jouer.ts";
import {
  createTable,
  deviceOptions,
  join,
  knightPlaces,
  playOneMove,
  seatTile,
  tablePicture,
} from "./online.ts";

// The phase-2 tracer (02-01): two browsers open the same table link, each types a first name, takes a
// colour (Bleu, Jaune), the creator starts, the server deals, and a move played in one browser shows
// up in the other. The two other seats are computer players inside the Durable Object, at once under
// the test pace.

test("two browsers join one table by its link and each sees the other's move", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const id = await createTable(request, { pace: "zero" });
  // Two browsers, each with its own storage: two devices.
  const anaDevice = await browser.newContext(deviceOptions(testInfo));
  const benDevice = await browser.newContext(deviceOptions(testInfo));
  const ana = await anaDevice.newPage();
  const ben = await benDevice.newPage();

  await join(ana, id, "Ana");
  await join(ben, id, "Ben");

  await seatTile(ana, "bleu").click();
  await expect(seatTile(ana, "bleu")).toHaveAttribute("data-seat-state", "you");
  await expect(seatTile(ben, "bleu")).toHaveAttribute("data-seat-state", "human");
  await seatTile(ben, "jaune").click();
  await expect(seatTile(ben, "jaune")).toHaveAttribute("data-seat-state", "you");
  await expect(seatTile(ana, "jaune")).toContainText("Ben");
  await expect(seatTile(ana, "rouge")).toHaveAttribute("data-seat-state", "free");

  // Only the creator may start.
  await expect(ben.getByRole("button", { name: "Lancer la partie" })).toHaveCount(0);
  await ana.getByRole("button", { name: "Lancer la partie" }).click();

  for (const page of [ana, ben]) {
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
  }

  // Each passes a card to the partner (the computers have given theirs).
  await exchange(ana);
  await exchange(ben);

  // The first person whose turn comes plays; the computers play by themselves in the Durable Object.
  let mover: Page | null = null;
  for (let i = 0; i < 600 && mover === null; i++) {
    for (const page of [ana, ben]) {
      const state = await zone(page).getAttribute("data-state");
      if (state === "idle" || state === "finishedPrompt" || state === "deadHand") {
        mover = page;
        break;
      }
    }
    if (mover === null) await ana.waitForTimeout(50);
  }
  if (mover === null) throw new Error("no human turn came");
  const before = await tablePicture(mover);
  await playOneMove(mover);

  // Both screens settle on the same table (knights and felt), and the move is on it: a knight moved,
  // or a card was played or a dead hand posed on the felt.
  await expect
    .poll(
      async () => {
        const [a, b] = [await tablePicture(ana), await tablePicture(ben)];
        return a === b && a !== before;
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  expect(Object.keys(await knightPlaces(ana))).toHaveLength(16);

  // Neither page shows a card of the other's hand: each hand comes from its own view.
  const handOf = (page: Page) =>
    page
      .locator("[data-hand] [data-card]")
      .evaluateAll((cards) => cards.map((card) => card.getAttribute("data-card")));
  const [anaHand, benHand] = [await handOf(ana), await handOf(ben)];
  expect(anaHand.filter((card) => benHand.includes(card))).toEqual([]);

  await anaDevice.close();
  await benDevice.close();
});
