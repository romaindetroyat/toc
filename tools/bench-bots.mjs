// Decision time of the computer levels on the fixed bench positions (03-RESEARCH Pitfall 1, BOT-05).
//
//   node tools/bench-bots.mjs [--level N] [--repeat 3] [--check] [--slice N]
//
// For each level (default 2 to 5), chooseAction runs on every position of benchPositions() with the
// real budget of levels.ts, `--repeat` times (each repeat with its own fixed rng), after one warm-up
// pass. Prints per level: the decisions, ms p50 / p95 / max (performance.now, this machine) and the work
// units per decision. The bots never read a clock; this tool does, around them.
// --check exits 1 when level 5's p95 exceeds 250 ms or its max 600 ms on this machine: the phone
// target of 03-UI-SPEC (p95 ≤ 1 s, max ≤ 2 s) divided by research A1's 3 to 5 times.
// --slice N (level 5, plan 02-03, D-11): every decision is stepped N units at a time as the online
// table runs it across alarms: each slice resumes a new thinker from the previous slice's checkpoint
// (JSON round trip, as through SQLite), steps N units and takes its checkpoint. Prints ms per slice
// p50 / p95 / max (resume and checkpoint included) and the slices per decision, and checks that every
// sliced decision equals the one-go decision (exit 1 otherwise).
// Exit codes: 0 OK, 1 check failed, 2 bad arguments.
// The engine and the bots are TypeScript files imported directly by Node (type stripping).

import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const load = (path) => import(pathToFileURL(resolve(root, path)).href);

const NAMES = { 1: "Poulain", 2: "Trotteur", 3: "Galopeur", 4: "Pur-sang", 5: "Champion" };
/** This machine's ceiling for level 5 (the phone's p95 1 s and max 2 s, divided by 4 and 3.3). */
const CHECK_P95_MS = 250;
const CHECK_MAX_MS = 600;

function usage(message) {
  console.error(`bench-bots: ${message}`);
  console.error("usage: node tools/bench-bots.mjs [--level N] [--repeat 3] [--check] [--slice N]");
  process.exit(2);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let levels = [2, 3, 4, 5];
  let repeat = 3;
  let check = false;
  let slice = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--check") {
      check = true;
    } else if (arg === "--slice") {
      const n = Number(args[i + 1]);
      i++;
      if (!Number.isInteger(n) || n < 1 || n > 1000) usage("--slice expects 1 to 1000 units");
      slice = n;
    } else if (arg === "--level" || arg === "--repeat") {
      const n = Number(args[i + 1]);
      i++;
      if (arg === "--level") {
        if (!Number.isInteger(n) || n < 1 || n > 5) usage("--level expects 1 to 5");
        levels = [n];
      } else {
        if (!Number.isInteger(n) || n < 1 || n > 100) usage("--repeat expects 1 to 100");
        repeat = n;
      }
    } else {
      usage(`unknown option ${arg}`);
    }
  }
  if (check && !levels.includes(5)) usage("--check measures level 5");
  if (slice !== null && (levels.length !== 1 || levels[0] !== 5)) usage("--slice needs --level 5");
  return { levels, repeat, check, slice };
}

function percentile(sorted, q) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

/** Level 5 stepped `slice` units at a time with a checkpoint round trip at every boundary. */
function slicedRun(bots, positions, repeat, slice) {
  const { chooseAction, createThinker } = bots;
  const rngOf = (r, i) => [r * 7919 + 1, i * 104729 + 3, r + i + 5, 0x9e3779b9];
  const think = (view, seat, rng) => {
    const ms = [];
    let from = null;
    for (;;) {
      const started = performance.now();
      const thinker = createThinker(view, seat, 5, rng, undefined, from);
      const done = thinker.step(slice);
      const stored = done ? null : JSON.stringify(thinker.checkpoint());
      const thought = done ? thinker.result() : null;
      ms.push(performance.now() - started);
      if (done) return { ms, thought };
      from = JSON.parse(stored);
    }
  };
  // Warm-up pass (JIT), not counted.
  for (const [i, { view, seat }] of positions.entries()) think(view, seat, rngOf(0, i));
  const ms = [];
  const counts = [];
  let mismatches = 0;
  for (let r = 0; r < repeat; r++) {
    for (const [i, { view, seat }] of positions.entries()) {
      const rng = rngOf(r, i);
      const sliced = think(view, seat, rng);
      ms.push(...sliced.ms);
      counts.push(sliced.ms.length);
      const whole = chooseAction(view, seat, 5, rng);
      if (JSON.stringify(whole) !== JSON.stringify(sliced.thought)) mismatches++;
    }
  }
  const sorted = Float64Array.from(ms).sort();
  const slices = Float64Array.from(counts).sort();
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  console.log(
    `level 5 in slices of ${slice} units: ${ms.length} slices over ${counts.length} decisions, ` +
      `ms per slice p50 ${percentile(sorted, 0.5).toFixed(2)}, p95 ${percentile(sorted, 0.95).toFixed(2)}, ` +
      `max ${sorted[sorted.length - 1].toFixed(2)}; slices per decision mean ${mean.toFixed(1)}, ` +
      `max ${slices[slices.length - 1]}; ${mismatches === 0 ? "every sliced decision equals the one-go decision" : `${mismatches} MISMATCHES`}`,
  );
  return mismatches === 0;
}

async function main() {
  const { levels, repeat, check, slice } = parseArgs();
  const bots = await load("packages/bots/src/index.ts");
  const { benchPositions, chooseAction, CHAMPION_BUDGET } = bots;
  const positions = benchPositions();
  console.log(
    `bench: ${positions.length} positions, repeat ${repeat}, level 5 budget ${CHAMPION_BUDGET.plies} units`,
  );
  if (slice !== null) process.exit(slicedRun(bots, positions, repeat, slice) ? 0 : 1);
  let failed = false;
  for (const level of levels) {
    // Warm-up pass (JIT), not counted.
    for (const { view, seat } of positions) chooseAction(view, seat, level, [1, 2, 3, 4]);
    const ms = [];
    let units = 0;
    let slowest = { ms: 0, label: "" };
    for (let r = 0; r < repeat; r++) {
      for (const [i, { view, seat, label }] of positions.entries()) {
        const rng = [r * 7919 + 1, i * 104729 + 3, r + i + 5, 0x9e3779b9];
        const started = performance.now();
        const thought = chooseAction(view, seat, level, rng);
        const spent = performance.now() - started;
        ms.push(spent);
        units += thought.units;
        if (spent > slowest.ms) slowest = { ms: spent, label };
      }
    }
    const sorted = Float64Array.from(ms).sort();
    const p50 = percentile(sorted, 0.5);
    const p95 = percentile(sorted, 0.95);
    const max = sorted[sorted.length - 1];
    console.log(
      `level ${level} (${NAMES[level]}): ${ms.length} decisions, p50 ${p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, max ${max.toFixed(1)} ms, units ${(units / ms.length).toFixed(1)} per decision`,
    );
    console.log(`  slowest: ${slowest.label}`);
    if (check && level === 5) {
      const ok = p95 <= CHECK_P95_MS && max <= CHECK_MAX_MS;
      console.log(
        `check: ${ok ? "OK" : "FAIL"} (level 5 p95 ≤ ${CHECK_P95_MS} ms and max ≤ ${CHECK_MAX_MS} ms on this machine)`,
      );
      if (!ok) failed = true;
    }
  }
  process.exit(failed ? 1 : 0);
}

await main();
