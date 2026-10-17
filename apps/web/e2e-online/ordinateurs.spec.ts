import { expect, test } from "@playwright/test";
import { exchange, zone } from "../e2e/jouer.ts";
import { createTable, join, playOneMove, seatTile } from "./online.ts";

// The computer players of an online table (02-03, SC1): one person opens a table alone; the three other
// seats are computers inside the Durable Object, at the natural pace of the local game (decide first,
// then wait the think time), the Champion searching in slices across alarms. Once the person has passed
// a card, the list of givers shows the computer still choosing with the « réfléchit » sign
// (data-thinking) before its give is counted (their gives are staggered by their own think times);
// then the person plays two turns with the computers playing in between.

/** A computer giver breathing with the thinking sign while its give is not counted yet. */
type Giver = { seat: string; done: string | null };

test("alone at an online table, the computers think with the sign and play in between", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const id = await createTable(request, {
    pace: "normal",
    levels: { jaune: 5, rouge: 3, vert: 4 },
  });
  await join(page, id, "Ana");
  await seatTile(page, "bleu").click();
  await expect(seatTile(page, "bleu")).toHaveAttribute("data-seat-state", "you");
  await page.getByRole("button", { name: "Lancer la partie" }).click();
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
  await expect(zone(page)).toHaveAttribute("data-state", "exchange", { timeout: 20_000 });
  // The person passes a card first: the givers' list replaces the prompt (exchangeWaiting).
  await exchange(page);

  // The thinking sign on a computer seat, read in one go with its giver line (a think is short).
  const handle = await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-givers] [data-thinking]");
      if (el === null) return null;
      const giver = el.closest("[data-giver]");
      return {
        seat: el.getAttribute("data-thinking") ?? "",
        done: giver?.getAttribute("data-done") ?? null,
      };
    },
    undefined,
    { timeout: 20_000, polling: 20 },
  );
  const giver = (await handle.jsonValue()) as Giver;
  expect(["jaune", "rouge", "vert"]).toContain(giver.seat);
  expect(giver.done).toBe("false");

  // Two turns of the person; the computers play by themselves in between.
  for (let turn = 0; turn < 2; turn++) {
    await expect(page.locator("[data-error-screen]")).toHaveCount(0);
    let mine = false;
    for (let i = 0; i < 1200 && !mine; i++) {
      const state = await zone(page).getAttribute("data-state");
      if (state === "idle" || state === "finishedPrompt" || state === "deadHand") mine = true;
      else if (state === "exchange") await exchange(page);
      else await page.waitForTimeout(100);
    }
    if (!mine) throw new Error(`the person's turn ${turn + 1} never came`);
    await playOneMove(page);
    // The move is accepted: the action zone leaves the person's turn.
    await expect(zone(page)).not.toHaveAttribute("data-state", /^(idle|preview)$/, {
      timeout: 20_000,
    });
  }
  await expect(page.locator("[data-error-screen]")).toHaveCount(0);
  await expect(page.locator("[data-notice]")).toHaveCount(0);
});
