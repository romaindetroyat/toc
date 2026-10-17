import { expect, type Page, test } from "@playwright/test";
import { structuralProblems } from "../../../packages/table/src/oracle.ts";
import {
  createTable,
  deviceOptions,
  join,
  listenFrames,
  playTogether,
  type Received,
  type Seat,
  seatTile,
} from "./online.ts";

// A whole game between four browsers (plan 02-10, SC1 and SC2): four devices open one table's link,
// take bleu, jaune, rouge and vert, and the chef de table starts with no computer seat. The server
// deals and judges every move; each page taps through the screen alone (jouer.ts's plainest player)
// until all four show the end plank, each from its own side. Every WebSocket frame each page received
// passes the structural part of the leak oracle for its seat: handDealt and cardsExchanged show only
// that page's cards. Runs once on each project (four desktops, then four phones held sideways).

const SEATS: { seat: Seat; name: string }[] = [
  { seat: "bleu", name: "Ana" },
  { seat: "jaune", name: "Bruno" },
  { seat: "rouge", name: "Chloé" },
  { seat: "vert", name: "David" },
];

/** bleu and rouge play together, jaune and vert together. */
const TEAM: Record<Seat, "bleu-rouge" | "jaune-vert"> = {
  bleu: "bleu-rouge",
  rouge: "bleu-rouge",
  jaune: "jaune-vert",
  vert: "jaune-vert",
};

test("quatre navigateurs jouent une partie entière à la même table, chacun ne voit que sa main", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(20 * 60_000);
  const id = await createTable(request, { pace: "zero" });

  const players: { seat: Seat; name: string; page: Page; frames: Received[]; sat: boolean }[] = [];
  for (const { seat, name } of SEATS) {
    const device = await browser.newContext(deviceOptions(testInfo));
    const page = await device.newPage();
    const player = { seat, name, page, frames: [] as Received[], sat: false };
    player.frames = listenFrames(page, () => (player.sat ? seat : null));
    players.push(player);
  }

  // Each opens the link, types a first name and takes a colour. Ana, the first in, is chef de table.
  for (const player of players) {
    await join(player.page, id, player.name);
    player.sat = true;
    await seatTile(player.page, player.seat).click();
    await expect(seatTile(player.page, player.seat)).toHaveAttribute("data-seat-state", "you");
  }
  const ana = (players[0] as (typeof players)[number]).page;
  // Four people at the table: no computer.
  await expect(ana.getByText("Quatre joueurs à la table : pas d’ordinateur.")).toBeVisible();
  await ana.getByRole("button", { name: "Lancer la partie" }).click();
  for (const { page } of players) {
    await expect(page.locator("[data-hand] [data-card]")).toHaveCount(5);
  }

  const { stats, taps, retaps, ms } = await playTogether(players.map(({ page }) => page));

  // Every page shows the plank, each from its own side, and the two sides agree on the winner.
  const results: Record<string, string | null> = {};
  for (const { seat, page } of players) {
    const end = page.locator("[data-end-screen]");
    await expect(end).toBeVisible();
    await expect(page.locator("[data-end-plank]").getByRole("heading")).toHaveText(
      /^(Victoire\s!|Défaite)$/,
    );
    results[seat] = await end.getAttribute("data-result");
  }
  expect(results.bleu).toBe(results.rouge);
  expect(results.jaune).toBe(results.vert);
  expect(results.bleu).not.toBe(results.jaune);
  const winner = results.bleu === "win" ? TEAM.bleu : TEAM.jaune;
  // A screenshot of each plank when TOC_SHOTS names a directory.
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?.env;
  if (env?.TOC_SHOTS) {
    for (const { seat, page } of players) {
      await page.screenshot({
        path: `${env.TOC_SHOTS}/02-10-quatre-${testInfo.project.name}-${seat}.png`,
      });
    }
  }

  // Every frame of every page passes the structural oracle for its reader (SC2).
  let checked = 0;
  for (const { seat, frames } of players) {
    expect(frames.length, seat).toBeGreaterThan(20);
    for (const [index, { seat: reader, frame }] of frames.entries()) {
      expect(structuralProblems(frame, reader), `${seat} frame ${index}`).toEqual([]);
      checked += 1;
    }
    // The opening deal: its own five cards, the three other hands hidden.
    const deal = frames.find(({ frame }) => frame.t === "events" && frame.seq === 1);
    const dealt = (
      (deal?.frame.events ?? []) as { t: string; seat: string; cards: unknown }[]
    ).filter((event) => event.t === "handDealt");
    expect(dealt, seat).toHaveLength(4);
    for (const event of dealt) {
      if (event.seat === seat) expect(event.cards).toHaveLength(5);
      else expect(event.cards).toBeNull();
    }
  }

  // Every page took its turns: a real game, the server taking each move.
  for (const [i, tally] of stats.entries()) expect(tally.plays, SEATS[i]?.seat).toBeGreaterThan(5);
  const plays = stats.reduce((sum, tally) => sum + tally.plays, 0);
  const deals = Math.max(...stats.map((tally) => tally.dealSizes.length));
  const posed = stats.reduce((sum, tally) => sum + tally.posed, 0);
  const sevens = stats.reduce((sum, tally) => sum + tally.sevens, 0);
  const valets = stats.reduce((sum, tally) => sum + tally.valets, 0);
  const line = `${testInfo.project.name}: ${plays} coups joués (${sevens} sept, ${valets} valets), ${posed} mains posées, ${deals} donnes, ${taps} touchers (${retaps} repris), ${checked} trames vérifiées, gagnants ${winner}, ${Math.round(ms / 1000)} s`;
  test.info().annotations.push({ type: "partie", description: line });
  console.log(`quatre.spec: ${line}`);

  for (const { page } of players) await page.context().close();
});
