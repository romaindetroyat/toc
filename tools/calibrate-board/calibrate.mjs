// Detects every cell of the board on the 4 quarter images (no manual clicking).
// Library: `import { calibrate } from './calibrate.mjs'`.
// CLI: `node tools/calibrate-board/calibrate.mjs [dir]` prints the checks and writes
// packages/board/layout.json (normalised by 2560).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OFF = { jaune: [0, 0], rouge: [1280, 0], bleu: [0, 1280], vert: [1280, 1280] };
const COLOR = { bleu: [1, 0, 214], jaune: [255, 255, 0], rouge: [212, 1, 0], vert: [1, 156, 1] };
const NAMES = ["bleu", "jaune", "rouge", "vert"];
const W = 1280;
const SIZE = 2560;

function blobs(mask, minArea) {
  // 4-connected components, iterative flood fill
  const seen = new Uint8Array(mask.length);
  const out = [];
  const stack = new Int32Array(mask.length);
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    let sp = 0;
    let n = 0;
    let sx = 0;
    let sy = 0;
    let x0 = W;
    let y0 = W;
    let x1 = 0;
    let y1 = 0;
    stack[sp++] = s;
    seen[s] = 1;
    while (sp) {
      const i = stack[--sp];
      const x = i % W;
      const y = (i / W) | 0;
      n++;
      sx += x;
      sy += y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= mask.length || seen[j] || !mask[j]) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
        seen[j] = 1;
        stack[sp++] = j;
      }
    }
    if (n >= minArea) out.push({ cx: sx / n, cy: sy / n, w: x1 - x0 + 1, h: y1 - y0 + 1, area: n });
  }
  return out;
}

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const r1 = (v) => Math.round(v * 10) / 10;

export async function calibrate(dir = path.join(ROOT, "assets/plateau")) {
  const cells = [];
  const pieces = {};
  for (const q of Object.keys(OFF)) {
    const { data } = await sharp(path.join(dir, `quart-${q}.webp`))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const col = new Uint8Array(W * W);
    const dark = new Uint8Array(W * W);
    const c = COLOR[q];
    for (let i = 0; i < W * W; i++) {
      const r = data[i * 3];
      const g = data[i * 3 + 1];
      const b = data[i * 3 + 2];
      col[i] = Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]) < 60 ? 1 : 0;
      dark[i] = r + g + b < 150 ? 1 : 0;
    }
    const [ox, oy] = OFF[q];
    const P = (b) => [b.cx + ox, b.cy + oy];
    // the felt (426 px) is excluded
    for (const b of blobs(dark, 800)) {
      if (b.w < 100 && b.h < 100) cells.push({ q, kind: "circle", p: P(b) });
    }
    const cb = blobs(col, 300);
    const diamond = cb.find((b) => b.w > 130);
    const square = cb.find((b) => b.w > 100 && b.w <= 130);
    if (!diamond || !square) throw new Error(`quarter ${q}: diamond or entry square not found`);
    cells.push({ q, kind: "diamond", p: P(diamond) }, { q, kind: "square", p: P(square) });
    const round = cb.filter((b) => b.w < 100).map(P); // 8 coloured circles = 4 stables + 4 home
    if (round.length !== 8)
      throw new Error(`quarter ${q}: expected 8 coloured circles, got ${round.length}`);
    const spread = (pts) => {
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    };
    let best = null; // stables = the 4 aligned on an axis, home = the 4 on the diagonal
    for (let m = 0; m < 256; m++) {
      const A = [];
      const B = [];
      for (let k = 0; k < 8; k++) ((m >> k) & 1 ? A : B).push(round[k]);
      if (A.length !== 4) continue;
      const s = spread(A);
      if (!best || s < best.s) best = { s, A, B };
    }
    pieces[q] = { diamond: P(diamond), square: P(square), stable: best.A, home: best.B };
  }
  if (cells.length !== 72) throw new Error(`expected 72 ring cells, got ${cells.length}`);

  // ring order: start on the blue diamond, first step to blue "1", then nearest-neighbour chain
  const start = cells.findIndex((c) => c.q === "bleu" && c.kind === "diamond");
  const used = new Set([start]);
  const order = [start];
  const first = cells
    .map((c, i) => [i, d2(c.p, [207, 1280 + 618])])
    .sort((a, b) => a[1] - b[1])[0][0];
  used.add(first);
  order.push(first);
  while (order.length < 72) {
    const last = cells[order.at(-1)].p;
    const nxt = cells
      .map((c, i) => [i, d2(c.p, last)])
      .filter(([i]) => !used.has(i))
      .sort((a, b) => a[1] - b[1])[0][0];
    used.add(nxt);
    order.push(nxt);
  }
  const ring = order.map((i) => cells[i].p.map(r1));
  const exitsAndEntriesOk = [0, 18, 36, 54].every(
    (e, k) =>
      cells[order[e]].kind === "diamond" &&
      cells[order[e]].q === NAMES[k] &&
      cells[order[(e + 70) % 72]].kind === "square" &&
      cells[order[(e + 70) % 72]].q === NAMES[k],
  );
  const pitch = ring.map((p, i) => d2(p, ring[(i + 1) % 72]));
  const checks = {
    exitsAndEntriesOk,
    pitchMin: Math.min(...pitch),
    pitchMax: Math.max(...pitch),
  };
  if (!exitsAndEntriesOk) throw new Error(`topology check failed: ${JSON.stringify(checks)}`);

  const out = {};
  for (const q of NAMES) {
    const p = pieces[q];
    out[q] = {
      // stable slots sorted by distance to the diamond, home slot 0 nearest the entry square
      stable: [...p.stable]
        .sort((a, b) => d2(a, p.diamond) - d2(b, p.diamond))
        .map((v) => v.map(r1)),
      home: [...p.home].sort((a, b) => d2(a, p.square) - d2(b, p.square)).map((v) => v.map(r1)),
      diamond: p.diamond.map(r1),
      square: p.square.map(r1),
    };
  }
  return { ring, pieces: out, checks };
}

function normalise(pt) {
  return pt.map((v) => Math.round((v / SIZE) * 1e5) / 1e5);
}

async function main() {
  const dir = process.argv[2];
  const { ring, pieces, checks } = await calibrate(dir);
  console.log(JSON.stringify(checks));
  const layout = {
    size: SIZE,
    ring: ring.map(normalise),
    pieces: Object.fromEntries(
      NAMES.map((q) => {
        const p = pieces[q];
        return [
          q,
          {
            stable: p.stable.map(normalise),
            home: p.home.map(normalise),
            diamond: normalise(p.diamond),
            square: normalise(p.square),
          },
        ];
      }),
    ),
  };
  const target = path.join(ROOT, "packages/board/layout.json");
  fs.writeFileSync(target, `${JSON.stringify(layout)}\n`);
  console.log(`wrote ${path.relative(ROOT, target)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
