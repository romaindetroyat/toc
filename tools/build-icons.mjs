// Builds the app icons and the home logo from Romain's logo (assets/logo/logo-source.webp, sent on
// 2026-10-17: « Utilise cette image comme logo »). The source file is never modified.
//
//   node tools/build-icons.mjs
//
// apps/web/public/icons: icon-32.png, icon-48.png (favicons), apple-touch-icon.png (180),
// icon-192.png and icon-512.png (manifest), maskable-512.png (manifest, purpose « maskable »: the board
// at 64 % on the source's blue so a circle mask keeps all of it); apps/web/public/favicon.ico
// (16, 32, 48, PNG entries); apps/web/src/assets/logo/logo-128.webp (the home, 64 CSS px at 2x).
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "assets/logo/logo-source.webp");
const ICONS = join(ROOT, "apps/web/public/icons");
const PUBLIC = join(ROOT, "apps/web/public");
const LOGO = join(ROOT, "apps/web/src/assets/logo");

/** Share of the maskable icon taken by the board: its rounded corners stay inside the 80 % circle. */
const MASKABLE_BOARD = 0.64;
/** The source's background, top and bottom (sampled at its edges). */
const BLUE_TOP = "#1A62AE";
const BLUE_BOTTOM = "#061A4C";

/** The source scaled to `size` × `size`, as a small palette PNG. */
const square = (size) =>
  sharp(SOURCE).resize(size, size).png({ palette: true, quality: 90, effort: 10 }).toBuffer();

async function maskable(size) {
  const inner = Math.round(size * MASKABLE_BOARD);
  const radius = Math.round(inner * 0.16);
  const background = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BLUE_TOP}"/><stop offset="1" stop-color="${BLUE_BOTTOM}"/></linearGradient></defs><rect width="${size}" height="${size}" fill="url(#g)"/></svg>`,
  );
  const corners = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${inner}" height="${inner}"><rect width="${inner}" height="${inner}" rx="${radius}" fill="#fff"/></svg>`,
  );
  const board = await sharp(SOURCE)
    .resize(inner, inner)
    .composite([{ input: corners, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp(background)
    .composite([{ input: board, gravity: "center" }])
    .png({ palette: true, quality: 90, effort: 10 })
    .toBuffer();
}

/** An .ico file holding PNG images (supported by every current browser), one entry per size. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

export async function buildIcons() {
  await mkdir(ICONS, { recursive: true });
  await mkdir(LOGO, { recursive: true });
  const files = [
    [join(ICONS, "icon-32.png"), await square(32)],
    [join(ICONS, "icon-48.png"), await square(48)],
    [join(ICONS, "apple-touch-icon.png"), await square(180)],
    [join(ICONS, "icon-192.png"), await square(192)],
    [join(ICONS, "icon-512.png"), await square(512)],
    [join(ICONS, "maskable-512.png"), await maskable(512)],
    [
      join(PUBLIC, "favicon.ico"),
      ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await square(size) })))),
    ],
    [
      join(LOGO, "logo-128.webp"),
      await sharp(SOURCE).resize(128, 128).webp({ quality: 85, effort: 6 }).toBuffer(),
    ],
  ];
  for (const [file, data] of files) {
    await writeFile(file, data);
    console.log(`${file.slice(ROOT.length + 1)}: ${data.length} octets`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildIcons();
