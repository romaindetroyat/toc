import { expect, type Page, test } from "@playwright/test";

// Romain's logo (2026-10-17, plan 02-04b): the favicon, the Apple touch icon and the manifest icons
// answer with images of the announced size, and the home shows the logo before « TOC » without
// changing its fit (02-UI-SPEC « Home « Accueil » »).

const DEVICE = JSON.stringify({ token: "a".repeat(43), name: "Marie-Charlotte" });

const view = (body: Uint8Array) => new DataView(body.buffer, body.byteOffset, body.byteLength);

/** Width and height of a PNG, from its IHDR chunk. */
function pngSize(body: Uint8Array) {
  expect(String.fromCharCode(...body.subarray(1, 4))).toBe("PNG");
  return { width: view(body).getUint32(16), height: view(body).getUint32(20) };
}

async function fetched(page: Page, href: string) {
  const response = await page.request.get(href);
  expect(response.status(), href).toBe(200);
  return { type: response.headers()["content-type"] ?? "", body: await response.body() };
}

test("les icônes et le manifeste répondent avec les bonnes images", async ({ page }) => {
  await page.goto("/");
  const links = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        rel: element.getAttribute("rel"),
        href: (element as HTMLLinkElement).href,
        sizes: element.getAttribute("sizes"),
      })),
    );
  expect(links.map((link) => link.rel).sort()).toEqual([
    "apple-touch-icon",
    "icon",
    "icon",
    "manifest",
  ]);

  for (const link of links) {
    const { type, body } = await fetched(page, link.href);
    if (link.rel === "manifest") {
      expect(type).toContain("manifest+json");
      continue;
    }
    if (link.href.endsWith(".ico")) {
      expect(type).toMatch(/^image\/(x-icon|vnd\.microsoft\.icon)/);
      // ICONDIR: reserved 0, type 1 (icon), then the number of images.
      const header = view(body);
      expect([0, 2, 4].map((at) => header.getUint16(at, true))).toEqual([0, 1, 3]);
      continue;
    }
    expect(type).toContain("image/png");
    const size = pngSize(body);
    if (link.rel === "apple-touch-icon") expect(size).toEqual({ width: 180, height: 180 });
    else expect(`${size.width}x${size.height}`).toBe(link.sizes);
  }

  const href = links.find((link) => link.rel === "manifest")?.href ?? "";
  const manifest = JSON.parse(new TextDecoder().decode((await fetched(page, href)).body));
  expect(manifest).toMatchObject({
    name: "TOC",
    short_name: "TOC",
    lang: "fr",
    display: "standalone",
    start_url: "/",
    background_color: "#2B1D12",
    theme_color: "#2B1D12",
  });
  const icons = manifest.icons as { src: string; sizes: string; type: string; purpose: string }[];
  expect(icons.map((icon) => `${icon.sizes} ${icon.purpose}`).sort()).toEqual([
    "192x192 any",
    "512x512 any",
    "512x512 maskable",
  ]);
  for (const icon of icons) {
    const { type, body } = await fetched(page, new URL(icon.src, href).href);
    expect(type).toContain(icon.type);
    const size = pngSize(body);
    expect(`${size.width}x${size.height}`).toBe(icon.sizes);
  }
});

const SIZES = [
  { width: 1280, height: 800, layout: "computer", side: 64, fits: true },
  { width: 844, height: 390, layout: "two", side: 34, fits: true },
  { width: 750, height: 342, layout: "two", side: 34, fits: true },
  { width: 480, height: 320, layout: "one", side: 34, fits: false },
] as const;

for (const size of SIZES) {
  test(`accueil : le logo devant « TOC » (${size.width} × ${size.height})`, async ({ page }) => {
    await page.addInitScript((device) => {
      localStorage.setItem("toc.device.v1", device);
    }, DEVICE);
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/");
    await expect(page.locator("main[data-home]")).toHaveAttribute("data-layout", size.layout);

    const logo = page.locator("[data-home-logo]");
    await expect(logo).toHaveCount(1);
    await expect(logo).toBeVisible();
    await expect(logo).toBeInViewport({ ratio: 1 });
    // Loaded (not a broken image), decorative, at its size.
    expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(
      128,
    );
    await expect(logo).toHaveAttribute("alt", "");
    const box = await logo.boundingBox();
    expect(box?.width).toBe(size.side);
    expect(box?.height).toBe(size.side);

    // Beside the title, never under the gear; the title keeps its accessible name.
    const title = page.getByRole("heading", { level: 1, name: "TOC" });
    const titleBox = await title.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(titleBox?.x ?? 0);
    const gear = await page.getByRole("button", { name: "Réglages" }).boundingBox();
    const apart =
      (box?.x ?? 0) + (box?.width ?? 0) <= (gear?.x ?? 0) ||
      (box?.y ?? 0) >= (gear?.y ?? 0) + (gear?.height ?? 0);
    expect(apart).toBe(true);

    const scroll = await page.evaluate(() => ({
      sideways: document.documentElement.scrollWidth - window.innerWidth,
      down: document.documentElement.scrollHeight - window.innerHeight,
    }));
    expect(scroll.sideways).toBe(0);
    if (size.fits) expect(scroll.down).toBe(0);
  });
}
