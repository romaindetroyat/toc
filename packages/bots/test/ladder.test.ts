// Smoke of the level ladder (D-07): playGame plays one pure game between two team levels from seeds,
// deterministically, with each seat on its own bot stream; on a few fixed pairs of seeds each level beats
// the one below; and tools/ladder.mjs refuses bad arguments with exit code 2.
// The full 400-game ladder is a verification step (node tools/ladder.mjs), not a unit test.

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COLORS } from "@toc/engine";
import { describe, expect, it } from "vitest";
import type { BotLevel } from "../src/levels.ts";
import { ladderSeeds, playGame, seatStreams } from "../src/match.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const LADDER = join(ROOT, "tools", "ladder.mjs");

/** Wins of level `a` over `pairs` pairs of seeds, each played twice with the teams swapped. */
function wins(
  a: BotLevel,
  b: BotLevel,
  pairs: number,
  seed: number,
): { won: number; games: number } {
  let won = 0;
  let games = 0;
  for (const { dealSeed, botSeed } of ladderSeeds(seed, pairs)) {
    for (const aTeam of ["bleu-rouge", "jaune-vert"] as const) {
      const bTeam = aTeam === "bleu-rouge" ? "jaune-vert" : "bleu-rouge";
      const levels = { [aTeam]: a, [bTeam]: b } as Record<typeof aTeam | typeof bTeam, BotLevel>;
      const result = playGame({ levels, dealSeed, botSeed });
      games++;
      if (result.winner === aTeam) won++;
    }
  }
  return { won, games };
}

describe("playGame", () => {
  const dealSeed: [number, number, number, number] = [11, 22, 33, 44];
  const botSeed: [number, number, number, number] = [5, 6, 7, 8];

  it("ends with a winner, every action accepted by apply, and is deterministic for its seeds", () => {
    const levels = { "bleu-rouge": 2, "jaune-vert": 1 } as const;
    const first = playGame({ levels, dealSeed, botSeed });
    const second = playGame({ levels, dealSeed, botSeed });
    expect(["bleu-rouge", "jaune-vert"]).toContain(first.winner);
    expect(first.actions).toBeGreaterThan(50);
    expect(second).toEqual(first);
    const decisions = first.perTeam["bleu-rouge"].decisions + first.perTeam["jaune-vert"].decisions;
    expect(decisions).toBe(first.actions);
    expect(first.perTeam["bleu-rouge"].units).toBeGreaterThan(0);
  }, 30_000);

  it("draws each seat from its own stream derived from the bot seed", () => {
    // One stream per seat: what a team draws never shifts the other team's random numbers.
    const streams = seatStreams(botSeed);
    const keys = COLORS.map((color) => streams[color].join(","));
    expect(new Set(keys).size).toBe(4);
    expect(seatStreams(botSeed)).toEqual(streams);
    const other = seatStreams([8, 7, 6, 5]);
    for (const color of COLORS) expect(other[color]).not.toEqual(streams[color]);
  });

  it("carries each decision's duration per team with an injected clock, none without", () => {
    const levels = { "bleu-rouge": 3, "jaune-vert": 2 } as const;
    let tick = 0;
    const timed = playGame({ levels, dealSeed, botSeed, time: () => tick++ });
    const plain = playGame({ levels, dealSeed, botSeed });
    for (const team of ["bleu-rouge", "jaune-vert"] as const) {
      expect(timed.perTeam[team].ms.length).toBe(timed.perTeam[team].decisions);
      expect(timed.perTeam[team].ms.every((ms) => ms === 1)).toBe(true);
      expect(plain.perTeam[team].ms).toEqual([]);
    }
    expect(timed.winner).toBe(plain.winner);
    expect(timed.actions).toBe(plain.actions);
  }, 30_000);
});

describe("the ladder smoke (fixed seeds, deterministic)", () => {
  it("level 2 beats level 1 in at least 8 of 10 paired games", () => {
    const { won, games } = wins(2, 1, 5, 7);
    expect(games).toBe(10);
    expect(won).toBeGreaterThanOrEqual(8);
  }, 120_000);

  it("level 3 beats level 2 in at least 7 of 10 paired games", () => {
    const { won, games } = wins(3, 2, 5, 7);
    expect(games).toBe(10);
    expect(won).toBeGreaterThanOrEqual(7);
  }, 120_000);

  it("level 4 against level 3 finishes every game", () => {
    const { games } = wins(4, 3, 5, 7);
    expect(games).toBe(10);
  }, 120_000);
});

describe("tools/ladder.mjs arguments", () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [LADDER, ...args], { encoding: "utf8", timeout: 30_000 });

  it("exits 2 on an odd game count, a level out of 1 to 5 or a missing --b", () => {
    expect(run("--a", "2", "--b", "1", "--games", "7").status).toBe(2);
    expect(run("--a", "6", "--b", "1", "--games", "4").status).toBe(2);
    expect(run("--a", "2", "--games", "4").status).toBe(2);
  });
});
