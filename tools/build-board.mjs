// Composites Romain's four board quarters into one square board image.
// The quarters are only placed side by side and scaled: never redrawn, recoloured or cropped.
// Library: `composeBoard(size)` returns webp bytes.
// CLI: `node tools/build-board.mjs` writes apps/web/public/plateau-{640,1280,2560}.webp,
// skipping files newer than every quarter.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "assets/plateau");
const OUT = path.join(ROOT, "apps/web/public");
const OFFSETS = { jaune: [0, 0], rouge: [1280, 0], bleu: [0, 1280], vert: [1280, 1280] };
const SIZES = [640, 1280, 2560];

export async function composeBoard(size) {
  const inputs = Object.entries(OFFSETS).map(([q, [left, top]]) => ({
    input: path.join(SRC, `quart-${q}.webp`),
    left,
    top,
  }));
  const canvas = sharp({
    create: { width: 2560, height: 2560, channels: 3, background: "#000000" },
  }).composite(inputs);
  const resized = size === 2560 ? canvas : sharp(await canvas.png().toBuffer()).resize(size, size);
  return resized.webp({ quality: 80 }).toBuffer();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const newestQuarter = Math.max(
    ...Object.keys(OFFSETS).map((q) => fs.statSync(path.join(SRC, `quart-${q}.webp`)).mtimeMs),
  );
  for (const size of SIZES) {
    const target = path.join(OUT, `plateau-${size}.webp`);
    if (fs.existsSync(target) && fs.statSync(target).mtimeMs > newestQuarter) continue;
    fs.writeFileSync(target, await composeBoard(size));
    console.log(`wrote ${path.relative(ROOT, target)}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
