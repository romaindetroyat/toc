// Draws every rules scenario on the landscape galet: docs/regles/<id>.webp, 1200 x 1200.
//
//   node tools/render-scenarios.mjs
//
// Top half = the position before the move, bottom half = the position after it (expect.after).
// A scenario with no `after` shows the same position below, with the pawns concerned by the
// action ringed in white, by the moves that must be allowed in green and by the moves that must be
// refused in red.
// Plateau: the galet in landscape, the one board of the game since Romain's decision of 2026-10-14
// (« oblige à jouer en format paysage », then « Oui, paysage obligatoire »: the phone is held
// sideways, so the computer and the phone draw the same galet), SCENE of packages/board. Two 2:1
// boards stacked make a square picture, which RULES.md shows at its full width.
// Each half is 1200 x 600: the galet drawing of packages/board (artSvg(boardArt(k)) with Romain's
// four riders from apps/web/src/assets/plateau as data URIs, rasterised by sharp), with the seat
// whose turn it is at the bottom, k = quarterTurnsFor(before.turn), as the game's debug scenario
// view does. Pawns are discs drawn on top at sceneXY(place, k).
// The script reads only repository files and writes nothing outside docs/regles/.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "docs", "regles");

const { scenarios } = await import(
  pathToFileURL(resolve(root, "packages/engine/scenarios/index.ts")).href
);
const { artSvg, boardArt, quarterTurnsFor, SCENE, sceneXY } = await import(
  pathToFileURL(resolve(root, "packages/board/src/index.ts")).href
);
const { COLORS, ringIndex } = await import(
  pathToFileURL(resolve(root, "packages/engine/src/topology.ts")).href
);

const HALF_W = 1200;
const SCALE = HALF_W / SCENE.width;
const HALF_H = Math.round(SCENE.height * SCALE);
const RADIUS = Math.round(0.46 * SCENE.step * SCALE * 10) / 10;
const FONT = "DejaVu Sans, Arial, sans-serif";
// The cell numbers are drawn in Caveat when librsvg finds it, else in the fallback family.
const HAND = "Caveat, DejaVu Sans, Arial, sans-serif";
// Romain's riders, one picture per colour, inlined as data URIs (artSvg escapes them).
const RIDERS = Object.fromEntries(
  COLORS.map((color) => [
    color,
    `data:image/png;base64,${readFileSync(resolve(root, "apps/web/src/assets/plateau", `cav-${color}.png`)).toString("base64")}`,
  ]),
);
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
function layerSvg(pawns, halos, label, k) {
  const parts = [];
  const pillWidth = 24 + label.length * 8;
  // The label sits at the top of the felt, where no pawn ever stands.
  const pillX = HALF_W / 2 - pillWidth / 2;
  const pillY = Math.round(SCENE.felt.y * SCALE) + 14;
  // Pawns on the ring or in the home first, stable pawns underneath: stable discs are many
  // and must never hide a pawn in play.
  const order = [...pawns].sort((a, b) => (a.spec === "S" ? 0 : 1) - (b.spec === "S" ? 0 : 1));
  for (const pawn of order) {
    const [x, y] = sceneXY(placeOf(pawn.color, pawn.index, pawn.spec), k).map((v) => v * SCALE);
    const halo = halos.get(pawn.id);
    if (halo) {
      parts.push(
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${RADIUS + 5}" fill="none" stroke="${INK}" stroke-width="7"/>`,
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${RADIUS + 5}" fill="none" stroke="${halo}" stroke-width="4"/>`,
      );
    }
    parts.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${RADIUS}" fill="${BODY[pawn.color]}" stroke="${INK}" stroke-width="2"/>`,
      `<text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="16" font-weight="700" fill="${LETTER[pawn.color]}">${"ABCD"[pawn.index]}</text>`,
    );
  }
  parts.push(
    `<rect x="${pillX}" y="${pillY}" width="${pillWidth}" height="24" rx="12" fill="#FFF8E1" stroke="${INK}" stroke-width="2"/>`,
    `<text x="${HALF_W / 2}" y="${pillY + 17}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="700" fill="${INK}">${label}</text>`,
  );
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${HALF_W}" height="${HALF_H}" viewBox="0 0 ${HALF_W} ${HALF_H}">${parts.join("")}</svg>`,
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

/** The landscape galet for seat k, riders included, rasterised once per k. */
const boards = new Map();
async function boardFor(k) {
  if (!boards.has(k)) {
    const svg = artSvg(boardArt(k), {
      width: HALF_W,
      height: HALF_H,
      fontFamily: FONT,
      handFamily: HAND,
      images: RIDERS,
    });
    boards.set(k, await sharp(Buffer.from(svg)).png().toBuffer());
  }
  return boards.get(k);
}

let written = 0;
for (const scenario of scenarios) {
  const before = position(scenario.before.pawns);
  const k = quarterTurnsFor(scenario.before.turn);
  const board = await boardFor(k);

  const beforeHalos = new Map();
  let below;
  if (scenario.expect.after) {
    below = layerSvg(afterPosition(scenario), new Map(), "après", k);
  } else {
    const halos = new Map();
    for (const id of pawnsOfActions(scenario.expect.legalExclude)) halos.set(id, HALO.exclude);
    for (const id of pawnsOfActions(scenario.expect.legalInclude)) halos.set(id, HALO.include);
    const concerned = [...pawnsOfActions(scenario.action ? [scenario.action] : [])];
    for (const step of scenario.script ?? []) {
      for (const id of pawnsOfActions([step.action])) concerned.push(id);
    }
    for (const id of concerned) halos.set(id, HALO.action);
    below = layerSvg(before, halos, "le coup", k);
  }
  const above = layerSvg(before, beforeHalos, "avant", k);

  const image = await sharp({
    create: { width: HALF_W, height: HALF_H * 2, channels: 3, background: "#FFFFFF" },
  })
    .composite([
      { input: board, left: 0, top: 0 },
      { input: above, left: 0, top: 0 },
      { input: board, left: 0, top: HALF_H },
      { input: below, left: 0, top: HALF_H },
    ])
    .webp({ quality: 70 })
    .toBuffer();
  writeFileSync(resolve(outDir, `${scenario.id}.webp`), image);
  written++;
}
console.log(`render-scenarios: ${written} images dans docs/regles/`);
