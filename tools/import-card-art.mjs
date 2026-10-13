// Imports the 12 court figures (Valet, Dame, Roi x pique, coeur, carreau, trefle) of the card art
// Romain chose in plan 01-07 (assets/cartes/CHOIX.md, decision D-24). Run it to refresh the files:
//
//   node tools/import-card-art.mjs
//
// The option recorded in CHOIX.md decides what happens:
//   svg-cards      `npm pack svg-cards@<version>` into a scratch directory OUTSIDE the repository
//                  (never installed as a dependency, install scripts disabled), the tarball is
//                  checked against the pinned digest below, the archive is extracted there, and
//                  only the licence text and the 12 figures are copied.
//   jeu-de-romain, autre-source
//                  the 12 files of assets/cartes/source/ ({rank}{suit}.png|jpg|webp|svg, rank
//                  11 12 13, suit S H D C) are converted with sharp to webp (quality 85, card
//                  ratio 1:1.41) and the licence text Romain provided is copied.
//
// Outputs (committed): apps/web/src/assets/cartes/{11,12,13}{S,H,D,C}.(svg|webp) and the licence
// text. The licence row lives in assets/audio/LICENSES.md (type « cartes »).
//
// svg-cards ships one sprite sheet in which every card is a <g> referring to shared <g> parts. Each
// figure becomes a standalone SVG file: the shared parts it needs are copied in, the card
// background, the frame and the corner indices (our card draws its own; the indices are text in a
// font the browser may not have) are left out, and the view box is cropped to the figure. Nothing else is changed: that is a modification in the
// sense of the LGPL-2.1, and every output says so in its header.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const choixPath = path.join(root, "assets/cartes/CHOIX.md");
const sourceDir = path.join(root, "assets/cartes/source");
const outDir = path.join(root, "apps/web/src/assets/cartes");

/** dist.integrity of svg-cards@4.0.2 on the npm registry, checked against the downloaded tarball. */
const SVG_CARDS_INTEGRITY =
  "sha512-YQVC0+bVQtvGbKoQZAHPgVSrKUymPK+aG9NQjJul9jp/a+lFcm8aWKh7YmKVinSjpaBTbogTLKAPi5YQEFRYLg==";

const RANKS = [
  { rank: 11, name: "jack" },
  { rank: 12, name: "queen" },
  { rank: 13, name: "king" },
];
const SUITS = [
  { suit: "S", name: "spade" },
  { suit: "H", name: "heart" },
  { suit: "D", name: "diamond" },
  { suit: "C", name: "club" },
];

/** The option and, for svg-cards, the version recorded in CHOIX.md. */
function readChoice() {
  const text = readFileSync(choixPath, "utf8");
  const option = /\*\*Option retenue\s*:\*\*\s*`([^`]+)`/.exec(text)?.[1];
  if (!option) throw new Error(`${choixPath}: no « Option retenue » line`);
  const version = /`svg-cards`,\s*version\s*([0-9]+\.[0-9]+\.[0-9]+)/.exec(text)?.[1];
  return { option, version };
}

// ---------------------------------------------------------------------------------------------
// svg-cards
// ---------------------------------------------------------------------------------------------

/** Top-level blocks of <defs>: id -> text, lines at a 4-space indent. */
function defsBlocks(svg) {
  const blocks = new Map();
  const lines = svg.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const open = /^ {4}<g id="([^"]+)"(.*)>$/.exec(lines[i]);
    if (!open) continue;
    if (lines[i].endsWith("/>")) {
      blocks.set(open[1], lines[i]);
      continue;
    }
    let j = i;
    while (j < lines.length && lines[j] !== "    </g>") j++;
    blocks.set(open[1], lines.slice(i, j + 1).join("\n"));
    i = j;
  }
  return blocks;
}

/** Children of a card group: chunks that start at a 6-space indent. */
function childrenOf(block) {
  const lines = block.split("\n").slice(1, -1);
  const children = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^ {6}<[a-z]/.test(line)) throw new Error(`unexpected line in a card group: ${line}`);
    if (line.endsWith("/>") || !/^ {6}<g\b/.test(line)) {
      children.push(line);
      continue;
    }
    let j = i;
    while (j < lines.length && lines[j] !== "      </g>") j++;
    children.push(lines.slice(i, j + 1).join("\n"));
    i = j;
  }
  return children;
}

const hrefsOf = (text) => [...text.matchAll(/xlink:href="#([^"]+)"/g)].map((m) => m[1]);

/** Extent of the frame drawn by the group of four stroked lines (relative path data). */
function frameBounds(children) {
  const frame = children.find((c) =>
    /^ {6}<g style="fill:none;stroke:#000000;stroke-width:1">/.test(c),
  );
  if (!frame) throw new Error("no frame in the card group");
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const m of frame.matchAll(/<path d="m ([^"]+)"/g)) {
    const numbers = m[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    let x = numbers[0];
    let y = numbers[1];
    for (let k = 0; k < numbers.length; k += 2) {
      if (k > 0) {
        x += numbers[k];
        y += numbers[k + 1];
      }
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

const round = (value) => Math.round(value * 1000) / 1000;

function standaloneSvg(blocks, id, packageVersion) {
  const block = blocks.get(id);
  if (!block) throw new Error(`${id} not found in the sprite sheet`);
  const head = block.split("\n")[0];
  const translate = /transform="translate\(([-0-9.]+),([-0-9.]+)\)"/.exec(head);
  if (!translate) throw new Error(`${id}: no translate on the card group`);
  const tx = Number(translate[1]);
  const ty = Number(translate[2]);

  const children = childrenOf(block);
  const bounds = frameBounds(children);
  const pad = 2;
  const x = round(bounds.minX + tx - pad);
  const y = round(bounds.minY + ty - pad);
  const width = round(bounds.maxX - bounds.minX + 2 * pad);
  const height = round(bounds.maxY - bounds.minY + 2 * pad);

  // Left out: the card background, the thin frame, the corner indices (a rank letter or a suit pip
  // used directly by the card group) and the large corner pips with the white patch behind them.
  // Our card draws its own background and corners; the figure itself stays untouched.
  const index = /^ {6}<use xlink:href="#(base|jack|queen|king|club|diamond|heart|spade)"/;
  const frame = /^ {6}<g style="fill:none;stroke:#000000;stroke-width:1">/;
  const cornerPip = (c) =>
    /^ {6}<g>/.test(c) &&
    /<use xlink:href="#(club|diamond|heart|spade)"/.test(c) &&
    c.includes("<rect ");
  const kept = children.filter((c) => !index.test(c) && !frame.test(c) && !cornerPip(c));
  // The parts the kept children need, and the parts those need.
  const needed = new Set();
  const visit = (text) => {
    for (const ref of hrefsOf(text)) {
      if (needed.has(ref)) continue;
      const part = blocks.get(ref);
      if (!part) throw new Error(`${id}: reference to unknown part ${ref}`);
      needed.add(ref);
      visit(part);
    }
  };
  for (const child of kept) visit(child);

  const parts = [...needed].map((ref) => blocks.get(ref)).join("\n");
  const body = [`    <g id="${id}" transform="translate(${tx},${ty})">`, ...kept, "    </g>"].join(
    "\n",
  );

  const svg = [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="${x} ${y} ${width} ${height}">`,
    `  <!-- ${id} from SVG-cards ${packageVersion} (https://github.com/htdebeer/SVG-cards) -->`,
    "  <!-- Copyright (C) 2005 David Bellot, (C) 2016, 2017 Huub de Beer and contributors -->",
    "  <!-- Licence: GNU Lesser General Public License 2.1, text in LGPL-2.1.txt next to this file -->",
    "  <!-- Modified for TOC: extracted from the sprite sheet as a standalone file, card background and corner -->",
    "  <!-- indices, frame and corner pips left out, view box cropped to the figure. Replace this file to change the figure. -->",
    "  <defs>",
    parts,
    "  </defs>",
    body,
    `  <use xlink:href="#${id}"/>`,
    "</svg>",
    "",
  ].join("\n");
  return svg;
}

function integrityOfFile(file) {
  return `sha512-${createHash("sha512").update(readFileSync(file)).digest("base64")}`;
}

function importSvgCards(version) {
  if (!version) throw new Error("CHOIX.md does not state the svg-cards version");
  const scratch = mkdtempSync(path.join(tmpdir(), "toc-svg-cards-"));
  try {
    // Fetch only: no install, no lifecycle script, nothing written inside the repository.
    execFileSync("npm", ["pack", `svg-cards@${version}`, "--ignore-scripts", "--silent"], {
      cwd: scratch,
      stdio: ["ignore", "ignore", "inherit"],
    });
    const tarball = path.join(scratch, `svg-cards-${version}.tgz`);
    if (version === "4.0.2") {
      const digest = integrityOfFile(tarball);
      if (digest !== SVG_CARDS_INTEGRITY) {
        throw new Error(`svg-cards-${version}.tgz has an unexpected digest: ${digest}`);
      }
    }
    const extracted = path.join(scratch, "x");
    mkdirSync(extracted);
    execFileSync("tar", ["-xzf", tarball, "-C", extracted], { stdio: "inherit" });
    const pkg = path.join(extracted, "package");
    const packageJson = JSON.parse(readFileSync(path.join(pkg, "package.json"), "utf8"));
    if (packageJson.name !== "svg-cards" || packageJson.version !== version) {
      throw new Error(`the archive is not svg-cards@${version}`);
    }
    const scripts = packageJson.scripts ?? {};
    for (const hook of ["preinstall", "install", "postinstall", "prepare"]) {
      if (hook in scripts) throw new Error(`svg-cards declares a ${hook} script`);
    }
    const blocks = defsBlocks(readFileSync(path.join(pkg, "svg-cards-indented.svg"), "utf8"));

    mkdirSync(outDir, { recursive: true });
    copyFileSync(path.join(pkg, "LICENSE"), path.join(outDir, "LGPL-2.1.txt"));
    copyFileSync(path.join(pkg, "AUTHORS"), path.join(outDir, "AUTHORS-svg-cards.txt"));
    for (const { rank, name: rankName } of RANKS) {
      for (const { suit, name: suitName } of SUITS) {
        const svg = standaloneSvg(blocks, `${suitName}_${rankName}`, version);
        writeFileSync(path.join(outDir, `${rank}${suit}.svg`), svg);
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------------------------
// Romain's own files, or another source
// ---------------------------------------------------------------------------------------------

async function importFromSource() {
  if (!existsSync(sourceDir)) throw new Error(`${sourceDir} is missing`);
  const { default: sharp } = await import("sharp");
  const files = readdirSync(sourceDir);
  mkdirSync(outDir, { recursive: true });
  for (const { rank } of RANKS) {
    for (const { suit } of SUITS) {
      const file = files.find((f) =>
        new RegExp(`^${rank}${suit}\\.(png|jpe?g|webp|svg)$`, "i").test(f),
      );
      if (!file) throw new Error(`assets/cartes/source/${rank}${suit}.* is missing`);
      // Card ratio 1:1.41, the file is fitted inside and never stretched.
      await sharp(path.join(sourceDir, file))
        .resize({
          width: 400,
          height: 564,
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 85 })
        .toFile(path.join(outDir, `${rank}${suit}.webp`));
    }
  }
  const licence = files.find((f) => /^(licen[cs]e|licence)(\.[a-z]+)?$/i.test(f));
  if (!licence) throw new Error("assets/cartes/source/ has no LICENCE file");
  copyFileSync(path.join(sourceDir, licence), path.join(outDir, "LICENCE-cartes.txt"));
}

const { option, version } = readChoice();
if (option === "svg-cards") importSvgCards(version);
else if (option === "jeu-de-romain" || option === "autre-source") await importFromSource();
else throw new Error(`unknown option « ${option} » in CHOIX.md`);
console.log(`court figures imported (${option}) into ${path.relative(root, outDir)}`);
