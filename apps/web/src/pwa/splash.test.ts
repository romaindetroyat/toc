import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEVICES, splashName } from "../../../../tools/build-icons.mjs";

// The iOS launch screens (plan 04-08, APP-01, D-09; 04-UI-SPEC « Manifest, icons, splash »;
// 04-RESEARCH Pattern 8, A8): iOS does not build one from the manifest, it needs one
// apple-touch-startup-image per screen size. tools/build-icons.mjs draws them (the logo centred on the
// walnut, no text) for its DEVICES list, held sideways; index.html links each one, in that order.

const WEB = fileURLToPath(new URL("../..", import.meta.url));
const SPLASH = join(WEB, "public/splash");
const html = readFileSync(join(WEB, "index.html"), "utf8");

type Device = { name: string; width: number; height: number; ratio: number };
const devices = DEVICES as readonly Device[];

/** Every <link rel="apple-touch-startup-image"> of index.html: its media query and its file. */
const links = [...html.matchAll(/<link\s+rel="apple-touch-startup-image"\s+([^>]*)\/?>/g)].map(
  (m) => {
    const attrs = m[1] ?? "";
    return {
      media: /media="([^"]*)"/.exec(attrs)?.[1] ?? "",
      href: /href="([^"]*)"/.exec(attrs)?.[1] ?? "",
    };
  },
);

/** The width and height written in a PNG's header. */
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  expect(bytes.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("iOS splash images", () => {
  it("lists current iPhone and iPad sizes, each once", () => {
    expect(devices.length).toBeGreaterThanOrEqual(10);
    const keys = devices.map((d) => `${d.width}x${d.height}@${d.ratio}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of devices) {
      expect(d.width).toBeLessThan(d.height); // portrait CSS size, as iOS reports device-width
      expect([2, 3]).toContain(d.ratio);
    }
  });

  it("links one image per device, in the order of DEVICES, held sideways", () => {
    expect(links.map((l) => l.href)).toEqual(devices.map((d) => `/splash/${splashName(d)}`));
    devices.forEach((d, i) => {
      const media = links[i]?.media ?? "";
      expect(media).toContain(`(device-width: ${d.width}px)`);
      expect(media).toContain(`(device-height: ${d.height}px)`);
      expect(media).toContain(`(-webkit-device-pixel-ratio: ${d.ratio})`);
      expect(media).toContain("(orientation: landscape)");
    });
    for (const link of links) expect(link.media).toContain("(orientation: landscape)");
  });

  it("every linked file exists, and every file of public/splash is linked once", () => {
    expect(existsSync(SPLASH)).toBe(true);
    const files = readdirSync(SPLASH).sort();
    const linked = links.map((l) => l.href.replace(/^\/splash\//, "")).sort();
    expect(files).toEqual(linked);
    expect(new Set(linked).size).toBe(linked.length);
  });

  it("each image is the device's screen in pixels, held sideways", () => {
    for (const d of devices) {
      expect(pngSize(join(SPLASH, splashName(d)))).toEqual({
        width: d.height * d.ratio,
        height: d.width * d.ratio,
      });
    }
  });

  it("names the installed app TOC and lets the board run under the status bar", () => {
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="TOC" />');
    expect(html).toContain(
      '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
    );
  });
});

describe("manifest.webmanifest (D-09)", () => {
  const manifest = JSON.parse(readFileSync(join(WEB, "public/manifest.webmanifest"), "utf8"));

  it("adds the landscape orientation, an id and the games category", () => {
    expect(manifest.orientation).toBe("landscape");
    expect(manifest.id).toBe("/");
    expect(manifest.categories).toEqual(["games"]);
  });

  it("keeps the 02-04b fields", () => {
    expect(manifest).toMatchObject({
      name: "TOC",
      short_name: "TOC",
      description: "Le jeu de petits chevaux à cartes",
      lang: "fr",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#2B1D12",
      theme_color: "#2B1D12",
    });
    expect(manifest.icons.map((i: { src: string }) => i.src)).toEqual([
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/maskable-512.png",
    ]);
  });
});
