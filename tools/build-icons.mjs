// Builds the app icons and the home logo from Romain's logo (assets/logo/logo-source.webp, sent on
// 2026-10-17: « Utilise cette image comme logo »). The source file is never modified.
//
//   node tools/build-icons.mjs
//
// apps/web/public/icons: icon-32.png, icon-48.png (favicons), apple-touch-icon.png (180),
// icon-192.png and icon-512.png (manifest), maskable-512.png (manifest, purpose « maskable »: the board
// at 64 % on the source's blue so a circle mask keeps all of it); apps/web/public/favicon.ico
// (16, 32, 48, PNG entries); apps/web/src/assets/logo/logo-128.webp (the home, 64 CSS px at 2x).
//
// Plan 04-08 (D-09, APP-01): apps/web/public/splash, the iOS launch screens. iOS does not build one
// from the manifest: it shows the apple-touch-startup-image whose media query fits the screen. One PNG
// per DEVICES entry, held sideways (the board is landscape only): the logo centred on the walnut
// #2B1D12, its side 30 % of the screen's height, no text (04-UI-SPEC, à confirmer par Romain). The
// list is the iPhone and iPad screens of 2017 to 2025 (04-RESEARCH A8: to be checked on a device);
// index.html links them in this order (apps/web/src/pwa/splash.test.ts).
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "assets/logo/logo-source.webp");
const ICONS = join(ROOT, "apps/web/public/icons");
const PUBLIC = join(ROOT, "apps/web/public");
const LOGO = join(ROOT, "apps/web/src/assets/logo");
const SPLASH = join(PUBLIC, "splash");

/** The walnut of the app (--noyer, the manifest's background_color). */
const WALNUT = "#2B1D12";
/** The logo's side on a launch screen, as a share of the screen's height (held sideways). */
const SPLASH_LOGO = 0.3;

/**
 * iPhone and iPad screens: the CSS size held upright (as iOS reports device-width and device-height)
 * and the pixel ratio. Newest first; one entry per distinct size.
 */
export const DEVICES = [
  { name: "iPhone 16 Pro Max, 17 Pro Max", width: 440, height: 956, ratio: 3 },
  { name: "iPhone 16 Pro, 17, 17 Pro", width: 402, height: 874, ratio: 3 },
  { name: "iPhone Air", width: 420, height: 912, ratio: 3 },
  { name: "iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus", width: 430, height: 932, ratio: 3 },
  { name: "iPhone 14 Pro, 15, 15 Pro, 16", width: 393, height: 852, ratio: 3 },
  { name: "iPhone 12 Pro Max, 13 Pro Max, 14 Plus", width: 428, height: 926, ratio: 3 },
  { name: "iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e", width: 390, height: 844, ratio: 3 },
  { name: "iPhone X, XS, 11 Pro, 12 mini, 13 mini", width: 375, height: 812, ratio: 3 },
  { name: "iPhone XS Max, 11 Pro Max", width: 414, height: 896, ratio: 3 },
  { name: "iPhone XR, 11", width: 414, height: 896, ratio: 2 },
  { name: "iPhone 8 Plus", width: 414, height: 736, ratio: 3 },
  { name: "iPhone 8, SE (2e et 3e générations)", width: 375, height: 667, ratio: 2 },
  { name: "iPad Pro 13 pouces (M4), iPad Air 13 pouces (M2)", width: 1032, height: 1376, ratio: 2 },
  { name: "iPad Pro 12,9 pouces", width: 1024, height: 1366, ratio: 2 },
  { name: "iPad Pro 11 pouces (M4)", width: 834, height: 1210, ratio: 2 },
  { name: "iPad Pro 11 pouces", width: 834, height: 1194, ratio: 2 },
  { name: "iPad Air 10,9 et 11 pouces, iPad (10e génération)", width: 820, height: 1180, ratio: 2 },
  { name: "iPad Air 10,5 pouces", width: 834, height: 1112, ratio: 2 },
  { name: "iPad 10,2 pouces", width: 810, height: 1080, ratio: 2 },
  { name: "iPad mini (6e génération et suivantes)", width: 744, height: 1133, ratio: 2 },
  { name: "iPad mini 5, iPad 9,7 pouces", width: 768, height: 1024, ratio: 2 },
];

/** The file of a device's launch screen: its pixel size held sideways. */
export const splashName = (device) =>
  `splash-${device.height * device.ratio}x${device.width * device.ratio}.png`;

/** The media query of a device's launch screen, held sideways. */
export const splashMedia = (device) =>
  `(device-width: ${device.width}px) and (device-height: ${device.height}px) and ` +
  `(-webkit-device-pixel-ratio: ${device.ratio}) and (orientation: landscape)`;

/**
 * A launch screen: the walnut, the logo centred with the home's rounded corners (22 %), its side 30 %
 * of the height. A 16-colour palette (4 bits a pixel): the 21 images weigh about 0.8 MB instead of
 * 1.9 MB with 256 colours, which keeps the embedded Worker (wrangler.embarque.jsonc, every file of the
 * build inside the script) under the Free plan's 3 MB compressed. Shown for a second, the logo keeps
 * its look.
 */
async function splash(device) {
  const width = device.height * device.ratio;
  const height = device.width * device.ratio;
  const side = Math.round(height * SPLASH_LOGO);
  const radius = Math.round(side * 0.22);
  const corners = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}"><rect width="${side}" height="${side}" rx="${radius}" fill="#fff"/></svg>`,
  );
  const logo = await sharp(SOURCE)
    .resize(side, side)
    .composite([{ input: corners, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp({ create: { width, height, channels: 3, background: WALNUT } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ palette: true, colours: 16, effort: 10, compressionLevel: 9 })
    .toBuffer();
}

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
  await rm(SPLASH, { recursive: true, force: true });
  await mkdir(SPLASH, { recursive: true });
  for (const device of DEVICES)
    files.push([join(SPLASH, splashName(device)), await splash(device)]);
  for (const [file, data] of files) {
    await writeFile(file, data);
    console.log(`${file.slice(ROOT.length + 1)}: ${data.length} octets`);
  }
  console.log("index.html, dans <head> :");
  for (const device of DEVICES) {
    console.log(
      `    <link rel="apple-touch-startup-image" media="${splashMedia(device)}" href="/splash/${splashName(device)}" />`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildIcons();
