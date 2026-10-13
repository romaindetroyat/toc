// Draws every rules scenario on Romain's real board: docs/regles/<id>.webp, 1280 x 640.
//
//   node tools/render-scenarios.mjs
//
// Left half = the position before the move, right half = the position after it (expect.after).
// A scenario with no `after` shows the same position on the right, with the pawns concerned by
// the action ringed in white, by the moves that must be allowed in green and by the moves that
// must be refused in red.
// The board art comes from composeBoard(640): scaled, never altered. Pawns are discs drawn on
// top. The script writes nothing outside docs/regles/.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { composeBoard } from "./build-board.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "docs", "regles");

const { scenarios } = await import(
  pathToFileURL(resolve(root, "packages/engine/scenarios/index.ts")).href
);
const { placeXY } = await import(pathToFileURL(resolve(root, "packages/board/src/layout.ts")).href);
const { COLORS, ringIndex } = await import(
  pathToFileURL(resolve(root, "packages/engine/src/topology.ts")).href
);

const BOARD_PX = 640;
const SCALE = BOARD_PX / 2560;
const RADIUS = 18;
const INK = "#2B1D12";
// Pawn body colours and a letter colour that stays readable on each (UI-SPEC identity table).
const BODY = { bleu: "#1A22E0", jaune: "#F5D000", rouge: "#D40100", vert: "#019C01" };
const LETTER = { bleu: "#FFFFFF", jaune: INK, rouge: "#FFFFFF", vert: "#FFFFFF" };
const HALO = { action: "#FFFFFF", include: "#18B03A", exclude: "#FF3B30" };

/** A pawn placement (PawnSpec) as a board place. */
function placeOf(color, index, spec) {
  if (spec === "S") return { z: "stable", color, slot: index };
  if (spec && typeof spec === "object" && "p" in spec) {
    return { z: "ring", cell: ringIndex(color, spec.p) };
  }
  if (spec && typeof spec === "object" && "h" in spec) return { z: "home", color, slot: spec.h };
  throw new Error(`placement inconnu: ${JSON.stringify(spec)}`);
}

/** The 16 pawns of a position as { id, color, index, spec }, missing pawns being in the stable. */
function position(pawnsByColor, forcedStable = []) {
  const out = [];
  for (const color of COLORS) {
    for (let index = 0; index < 4; index++) {
      const id = `${color}${index}`;
      const spec = forcedStable.includes(id) ? "S" : (pawnsByColor?.[color]?.[index] ?? "S");
      out.push({ id, color, index, spec });
    }
  }
  return out;
}

/** The pawn ids named by a list of actions. */
function pawnsOfActions(actions = []) {
  const ids = new Set();
  for (const a of actions) {
    if (a.pawn) ids.add(a.pawn);
    if (a.target) ids.add(a.target);
    if (a.plan) for (const step of a.plan) ids.add(step.pawn);
  }
  return ids;
}

/** SVG layer of one half: pawns, halos and the « avant » / « après » label. */
function layerSvg(pawns, halos, label) {
  const parts = [];
  const pillWidth = 24 + label.length * 8;
  // Pawns on the ring or in the home first, stable pawns underneath: stable discs are many
  // and must never hide a pawn in play.
  const order = [...pawns].sort((a, b) => (a.spec === "S" ? 0 : 1) - (b.spec === "S" ? 0 : 1));
  for (const pawn of order) {
    const [x, y] = placeXY(placeOf(pawn.color, pawn.index, pawn.spec)).map((v) => v * SCALE);
    const halo = halos.get(pawn.id);
    if (halo) {
      parts.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${RADIUS + 5}" fill="none" stroke="${INK}" stroke-width="7"/>`,
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${RADIUS + 5}" fill="none" stroke="${halo}" stroke-width="4"/>`,
      );
    }
    parts.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${RADIUS}" fill="${BODY[pawn.color]}" stroke="${INK}" stroke-width="2"/>`,
      `<text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="17" font-weight="700" fill="${LETTER[pawn.color]}">${"ABCD"[pawn.index]}</text>`,
    );
  }
  parts.push(
    `<rect x="8" y="8" width="${pillWidth}" height="24" rx="12" fill="#FFF8E1" stroke="${INK}" stroke-width="2"/>`,
    `<text x="${8 + pillWidth / 2}" y="25" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" font-weight="700" fill="${INK}">${label}</text>`,
  );
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BOARD_PX}" height="${BOARD_PX}" viewBox="0 0 ${BOARD_PX} ${BOARD_PX}">${parts.join("")}</svg>`,
  );
}

function afterPosition(scenario) {
  const merged = {};
  for (const color of COLORS) {
    merged[color] = scenario.expect.after?.pawns?.[color] ?? scenario.before.pawns?.[color];
  }
  return position(merged, scenario.expect.captured ?? []);
}

mkdirSync(outDir, { recursive: true });
const board = await composeBoard(BOARD_PX);

let written = 0;
for (const scenario of scenarios) {
  const before = position(scenario.before.pawns);

  const beforeHalos = new Map();
  let right;
  if (scenario.expect.after) {
    right = layerSvg(afterPosition(scenario), new Map(), "après");
  } else {
    const halos = new Map();
    for (const id of pawnsOfActions(scenario.expect.legalExclude)) halos.set(id, HALO.exclude);
    for (const id of pawnsOfActions(scenario.expect.legalInclude)) halos.set(id, HALO.include);
    const concerned = [...pawnsOfActions(scenario.action ? [scenario.action] : [])];
    for (const step of scenario.script ?? []) {
      for (const id of pawnsOfActions([step.action])) concerned.push(id);
    }
    for (const id of concerned) halos.set(id, HALO.action);
    right = layerSvg(before, halos, "le coup");
  }
  const left = layerSvg(before, beforeHalos, "avant");

  const image = await sharp({
    create: { width: BOARD_PX * 2, height: BOARD_PX, channels: 3, background: "#000000" },
  })
    .composite([
      { input: board, left: 0, top: 0 },
      { input: left, left: 0, top: 0 },
      { input: board, left: BOARD_PX, top: 0 },
      { input: right, left: BOARD_PX, top: 0 },
    ])
    .webp({ quality: 70 })
    .toBuffer();
  writeFileSync(resolve(outDir, `${scenario.id}.webp`), image);
  written++;
}
console.log(`render-scenarios: ${written} images dans docs/regles/`);
