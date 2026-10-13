// Cuts Romain's four knights (assets/cavaliers/cavaliers-source.webp, transparent background,
// left to right: bleu, jaune, rouge, vert, heads facing left) into one sprite per colour.
// Each sprite is mirrored so the head faces right (the Pawn convention) and fitted into the
// 110 x 190 pawn footprint at 3x, feet on the bottom edge. The source file is never modified.
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "assets/cavaliers/cavaliers-source.webp");
const OUT = join(ROOT, "apps/web/public/cavaliers");
const COLORS = ["bleu", "jaune", "rouge", "vert"];
const SCALE = 3;
const W = 110 * SCALE;
const H = 190 * SCALE;

export async function buildKnights() {
  const { data, info } = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const alpha = (x, y) => data[(y * width + x) * 4 + 3];
  // Columns that hold any opaque pixel, grouped into runs: one run per knight.
  const runs = [];
  let start = -1;
  for (let x = 0; x <= width; x++) {
    let filled = false;
    if (x < width)
      for (let y = 0; y < height; y += 2)
        if (alpha(x, y) > 20) {
          filled = true;
          break;
        }
    if (filled && start < 0) start = x;
    if (!filled && start >= 0) {
      runs.push([start, x]);
      start = -1;
    }
  }
  if (runs.length !== COLORS.length) throw new Error(`expected 4 knights, found ${runs.length}`);
  await mkdir(OUT, { recursive: true });
  for (const [i, [x0, x1]] of runs.entries()) {
    let top = height,
      bottom = 0;
    for (let x = x0; x < x1; x++)
      for (let y = 0; y < height; y++)
        if (alpha(x, y) > 20) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
    const crop = { left: x0, top, width: x1 - x0, height: bottom - top + 1 };
    const fit = Math.min(W / crop.width, H / crop.height);
    const w = Math.round(crop.width * fit);
    const h = Math.round(crop.height * fit);
    const piece = await sharp(SOURCE).extract(crop).flop().resize(w, h).png().toBuffer();
    const file = join(OUT, `${COLORS[i]}.webp`);
    await sharp({
      create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: piece, left: Math.round((W - w) / 2), top: H - h }])
      .webp({ quality: 88, alphaQuality: 100 })
      .toFile(file);
    console.log(`${COLORS[i]}: ${w}x${h} -> ${file}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildKnights();
