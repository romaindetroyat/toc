// Level ladder (D-07, 03-RESEARCH Pattern 10): team matches between two computer levels on paired seeds,
// with the real @toc/bots and their real per-level parameters.
//
//   node tools/ladder.mjs --a N --b M [--games 400] [--seed 1] [--workers 4] [--min 0.60] [--lower 0.55]
//                         [--give-a board|deal] [--give-b board|deal]
//
// Pair i takes a deal seed and a bot seed from one seeded sfc32 stream (ladderSeeds) and is played
// twice: level A as bleu-rouge, then level A as jaune-vert, so the luck of the deal and of the seats
// cancels. The pairs are split across node:worker_threads workers (this same file); each worker times
// the decisions with performance.now through playGame's `time` hook.
//
// Prints the win rate of A, its Wilson 95 % interval, the pair outcomes 2–0 / 1–1 / 0–2, the decision
// time of each side (mean, p95, max) and its work units, the time of its exchange decisions alone, the wall time and a verdict. The bar
// (« nettement »): p̂ ≥ --min and the Wilson lower bound > --lower (--min 0 --lower 0: a probe that
// reports without judging; a failed game still fails it).
// --give-a / --give-b (plan 04-15) force how side A / side B chooses its exchange card (board: the give
// of D-09, deal: the give over the deal), whatever its level's own (levels.ts GIVE_METHOD), so the new
// give can be played against the old one at the same level: --a 5 --b 5 --give-a deal --give-b board.
// Exit codes: 0 PASS, 1 FAIL or a failed game (printed with its seeds), 2 bad arguments.
// The engine and the bots are TypeScript files imported directly by Node (type stripping).

import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const load = (path) => import(pathToFileURL(resolve(root, path)).href);

const NAMES = { 1: "Poulain", 2: "Trotteur", 3: "Galopeur", 4: "Pur-sang", 5: "Champion" };
const TEAMS = ["bleu-rouge", "jaune-vert"];
const Z = 1.96;

/** Wilson score interval at 95 % for `wins` successes out of `n`. */
function wilson(wins, n) {
  const p = wins / n;
  const z2 = Z * Z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const half = (Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return [centre - half, centre + half];
}

function usage(message) {
  console.error(`ladder: ${message}`);
  console.error(
    "usage: node tools/ladder.mjs --a N --b M [--games 400] [--seed 1] [--workers 4] [--min 0.60] [--lower 0.55] [--give-a board|deal] [--give-b board|deal]",
  );
  process.exit(2);
}

/** The raw value of --name, or undefined; a flag without a value is a bad argument. */
function raw(name) {
  const at = process.argv.indexOf(`--${name}`);
  if (at === -1) return undefined;
  const value = process.argv[at + 1];
  if (value === undefined || value.startsWith("--")) usage(`--${name} needs a value`);
  return value;
}

function integer(name, fallback, min, max) {
  const value = raw(name);
  if (value === undefined) {
    if (fallback === undefined) usage(`--${name} is required`);
    return fallback;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    usage(`--${name} expects a whole number from ${min} to ${max}`);
  }
  return n;
}

function fraction(name, fallback) {
  const value = raw(name);
  if (value === undefined) return fallback;
  const n = Number(value);
  // 0 is allowed: a probe that reports without judging (--min 0 --lower 0).
  if (!Number.isFinite(n) || n < 0 || n >= 1) usage(`--${name} expects a number from 0 to below 1`);
  return n;
}

/** --give-a / --give-b: "board" or "deal", or null (the level's own method). */
function method(name) {
  const value = raw(name);
  if (value === undefined) return null;
  if (value !== "board" && value !== "deal") usage(`--${name} expects board or deal`);
  return value;
}

function parseArgs() {
  const known = new Set(["a", "b", "games", "seed", "workers", "min", "lower", "give-a", "give-b"]);
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--") && !known.has(arg.slice(2))) usage(`unknown option ${arg}`);
  }
  const a = integer("a", undefined, 1, 5);
  const b = integer("b", undefined, 1, 5);
  const games = integer("games", 400, 2, 1_000_000);
  if (games % 2 !== 0) usage("--games must be even (each deal is played twice, teams swapped)");
  const seed = integer("seed", 1, 0, 0xffffffff);
  const workers = integer("workers", Math.max(1, Math.min(4, availableParallelism())), 1, 64);
  const min = fraction("min", 0.6);
  const lower = fraction("lower", 0.55);
  const giveA = method("give-a");
  const giveB = method("give-b");
  return { a, b, games, seed, workers, min, lower, giveA, giveB };
}

/** Worker: plays the pairs it is given and posts one record per game. */
async function work() {
  const { playGame } = await load("packages/bots/src/index.ts");
  const { a, b, pairs, giveA, giveB } = workerData;
  const time = () => performance.now();
  const results = [];
  for (const { index, dealSeed, botSeed } of pairs) {
    for (const aTeam of TEAMS) {
      const bTeam = aTeam === TEAMS[0] ? TEAMS[1] : TEAMS[0];
      try {
        const gives = {};
        if (giveA !== null) gives[aTeam] = giveA;
        if (giveB !== null) gives[bTeam] = giveB;
        const game = playGame({
          levels: { [aTeam]: a, [bTeam]: b },
          dealSeed,
          botSeed,
          time,
          gives,
        });
        results.push({
          index,
          aTeam,
          aWon: game.winner === aTeam,
          actions: game.actions,
          a: game.perTeam[aTeam],
          b: game.perTeam[bTeam],
        });
      } catch (error) {
        results.push({ index, aTeam, dealSeed, botSeed, error: String(error?.message ?? error) });
      }
    }
  }
  parentPort.postMessage(results);
}

function percentile(sorted, q) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function timing(ms) {
  if (ms.length === 0) return "no decisions";
  const sorted = Float64Array.from(ms).sort();
  let total = 0;
  for (const x of sorted) total += x;
  const mean = total / sorted.length;
  return `mean ${mean.toFixed(2)} ms, p95 ${percentile(sorted, 0.95).toFixed(2)} ms, max ${sorted[sorted.length - 1].toFixed(1)} ms`;
}

async function main() {
  const options = parseArgs();
  const { a, b, games, seed, workers, min, lower, giveA, giveB } = options;
  const { GIVE_METHOD, ladderSeeds } = await load("packages/bots/src/index.ts");
  const pairCount = games / 2;
  const pairs = ladderSeeds(seed, pairCount).map((p, index) => ({ index, ...p }));
  const started = performance.now();
  console.log(
    `ladder: A=${a} (${NAMES[a]}) vs B=${b} (${NAMES[b]}), ${games} games (${pairCount} pairs), seed ${seed}`,
  );
  console.log(
    `gives: A ${giveA ?? GIVE_METHOD[a]}${a === 1 ? " (randomLegal)" : ""}, B ${giveB ?? GIVE_METHOD[b]}${b === 1 ? " (randomLegal)" : ""}`,
  );

  const slices = Array.from({ length: Math.min(workers, pairCount) }, () => []);
  pairs.forEach((pair, i) => {
    slices[i % slices.length].push(pair);
  });
  const parts = await Promise.all(
    slices.map(
      (slice) =>
        new Promise((done, fail) => {
          const worker = new Worker(fileURLToPath(import.meta.url), {
            workerData: { a, b, pairs: slice, giveA, giveB },
          });
          worker.once("message", done);
          worker.once("error", fail);
          worker.once("exit", (code) => {
            if (code !== 0) fail(new Error(`worker exited with code ${code}`));
          });
        }),
    ),
  );
  const results = parts.flat().sort((x, y) => x.index - y.index || (x.aTeam < y.aTeam ? -1 : 1));

  const failed = results.filter((r) => r.error !== undefined);
  for (const f of failed) {
    console.error(
      `failed game: pair ${f.index}, A as ${f.aTeam}, deal seed ${JSON.stringify(f.dealSeed)}, bot seed ${JSON.stringify(f.botSeed)}: ${f.error}`,
    );
  }
  const played = results.filter((r) => r.error === undefined);
  const wins = played.filter((r) => r.aWon).length;
  const n = played.length;
  const p = n > 0 ? wins / n : 0;
  const [lo, hi] = n > 0 ? wilson(wins, n) : [0, 0];

  const byPair = new Map();
  for (const r of played) byPair.set(r.index, [...(byPair.get(r.index) ?? []), r.aWon]);
  let twoZero = 0;
  let oneOne = 0;
  let zeroTwo = 0;
  for (const outcome of byPair.values()) {
    if (outcome.length !== 2) continue;
    const w = outcome.filter(Boolean).length;
    if (w === 2) twoZero++;
    else if (w === 1) oneOne++;
    else zeroTwo++;
  }

  const side = (key) => {
    const ms = [];
    const giveMs = [];
    let units = 0;
    let decisions = 0;
    for (const r of played) {
      for (const x of r[key].ms) ms.push(x);
      for (const x of r[key].giveMs) giveMs.push(x);
      units += r[key].units;
      decisions += r[key].decisions;
    }
    return { ms, giveMs, units, decisions };
  };
  const sideA = side("a");
  const sideB = side("b");
  const seconds = (performance.now() - started) / 1000;

  console.log(`games: ${games} (${n} finished, ${failed.length} failed)`);
  console.log(`A wins: ${wins} / ${n}, p̂ = ${(100 * p).toFixed(1)} %`);
  console.log(`Wilson 95 %: [${(100 * lo).toFixed(1)} %, ${(100 * hi).toFixed(1)} %]`);
  console.log(`pairs: 2–0 ${twoZero}, 1–1 ${oneOne}, 0–2 ${zeroTwo}`);
  console.log(`A decisions: ${sideA.decisions}, ${timing(sideA.ms)}, units ${sideA.units}`);
  console.log(`B decisions: ${sideB.decisions}, ${timing(sideB.ms)}, units ${sideB.units}`);
  console.log(`A gives: ${sideA.giveMs.length}, ${timing(sideA.giveMs)}`);
  console.log(`B gives: ${sideB.giveMs.length}, ${timing(sideB.giveMs)}`);
  console.log(`wall time: ${seconds.toFixed(1)} s (${slices.length} workers)`);
  const pass = failed.length === 0 && p >= min && lo > lower;
  console.log(
    `verdict: ${pass ? "PASS" : "FAIL"} (bar: p̂ ≥ ${(100 * min).toFixed(0)} % and Wilson lower bound > ${(100 * lower).toFixed(0)} %${failed.length > 0 ? `; ${failed.length} failed games` : ""})`,
  );
  process.exit(pass ? 0 : 1);
}

if (isMainThread) {
  await main();
} else {
  await work();
}
