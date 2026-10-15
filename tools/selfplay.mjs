// Self-play harness: four level-1 bots (randomLegal) play complete games and the length of a game is measured.
//
//   node tools/selfplay.mjs --games N [--seed S]
//
// Prints the number of games, deals per game (mean / median / max), actions per game (mean / max),
// the share of wins per team and the wall time. Exits 1 if a game throws or exceeds 5000 actions.
// The engine and the bots are TypeScript files imported directly by Node (type stripping).

import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const load = (path) => import(pathToFileURL(resolve(root, path)).href);
const { apply, COLORS, newGame, next, viewFor } = await load("packages/engine/src/index.ts");
const { randomLegal } = await load("packages/bots/src/index.ts");

const ACTION_CAP = 5000;

function option(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  if (at === -1) return fallback;
  const value = Number(process.argv[at + 1]);
  if (!Number.isInteger(value) || value < 0) {
    console.error(`selfplay: --${name} expects a whole number`);
    process.exit(2);
  }
  return value;
}

const games = option("games", 100);
const seed = option("seed", 1);
if (games < 1) {
  console.error("usage: node tools/selfplay.mjs --games N [--seed S]");
  process.exit(2);
}

/** Four 32-bit integers drawn from the sfc32 stream, and the new stream state. */
function draw4(rng) {
  const out = [];
  let r = rng;
  for (let i = 0; i < 4; i++) {
    let u;
    [u, r] = next(r);
    out.push(Math.floor(u * 4294967296) | 0);
  }
  return [out, r];
}

/** The seat that must act: the first seat that has not chosen its exchange card, else the seat to play. */
function actingSeat(state) {
  if (state.phase === "exchange") {
    return COLORS.find((color) => state.given[color] === null) ?? state.turn;
  }
  return state.turn;
}

/** Plays one game with four randomLegal bots; returns its length, or throws. */
function playOne(dealSeed, botSeed) {
  let state = newGame({ firstDealer: COLORS[(dealSeed[0] >>> 0) % 4] }, dealSeed);
  let rng = botSeed;
  let actions = 0;
  while (state.phase !== "won") {
    if (actions >= ACTION_CAP) throw new Error(`more than ${ACTION_CAP} actions`);
    const seat = actingSeat(state);
    const [action, after] = randomLegal(viewFor(state, seat), seat, rng);
    rng = after;
    state = apply(state, seat, action).state;
    actions++;
  }
  return { deals: state.dealsPlayed + 1, actions, winner: state.winner, captures: state.captures };
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const median = (xs) => {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const started = Date.now();
let stream = [seed, seed ^ 0x9e3779b9, seed ^ 0x85ebca6b, 0x1b873593];
for (let i = 0; i < 20; i++) [, stream] = next(stream);
const deals = [];
const actionCounts = [];
const wins = {};
let captured = 0;
let failures = 0;

for (let g = 0; g < games; g++) {
  let dealSeed;
  let botSeed;
  [dealSeed, stream] = draw4(stream);
  [botSeed, stream] = draw4(stream);
  try {
    const game = playOne(dealSeed, botSeed);
    deals.push(game.deals);
    actionCounts.push(game.actions);
    wins[game.winner] = (wins[game.winner] ?? 0) + 1;
    captured += game.captures["bleu-rouge"] + game.captures["jaune-vert"];
  } catch (error) {
    failures++;
    console.error(`game ${g} (deal seed ${JSON.stringify(dealSeed)}): ${error.message}`);
  }
  if ((g + 1) % 1000 === 0) console.error(`... ${g + 1} games`);
}

const seconds = (Date.now() - started) / 1000;
const played = deals.length;
console.log(`games: ${games} (${played} finished, ${failures} failed), seed ${seed}`);
if (played > 0) {
  console.log(`mean deals: ${(sum(deals) / played).toFixed(2)}`);
  console.log(`median deals: ${median(deals)}`);
  console.log(`max deals: ${Math.max(...deals)}`);
  console.log(`min deals: ${Math.min(...deals)}`);
  console.log(`mean actions: ${(sum(actionCounts) / played).toFixed(1)}`);
  console.log(`median actions: ${median(actionCounts)}`);
  console.log(`max actions: ${Math.max(...actionCounts)}`);
  console.log(`mean captures per game: ${(captured / played).toFixed(1)}`);
  console.log(
    `wins: ${Object.entries(wins)
      .map(([team, n]) => `${team} ${n}`)
      .join(", ")}`,
  );
}
console.log(`wall time: ${seconds.toFixed(1)} s`);
process.exit(failures > 0 ? 1 : 0);
