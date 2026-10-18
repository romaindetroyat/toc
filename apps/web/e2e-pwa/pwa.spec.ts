import { cpSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { type BrowserContext, type CDPSession, expect, type Page, test } from "@playwright/test";
import { newStats, playStep, snapshot } from "../e2e/jouer.ts";

// The installable app with its service worker (plan 04-08; APP-01, APP-02, APP-03, ACCT-05): the one
// suite where service workers are allowed (playwright.pwa.config.ts).

const DIST = fileURLToPath(new URL("../dist", import.meta.url));

/** Waits until sw.js is active, then reloads once so that it controls the page. */
async function controlled(page: Page): Promise<string> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null))
    .not.toBeNull();
  return page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? "");
}

test("le service worker s’installe et contrôle la page après un rechargement", async ({ page }) => {
  await page.goto("/");
  const ready = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return { scope: registration.scope, active: registration.active?.scriptURL ?? null };
  });
  expect(new URL(ready.scope).pathname).toBe("/");
  expect(ready.active).toMatch(/\/sw\.js$/);
  expect(await controlled(page)).toMatch(/\/sw\.js$/);
  // The precache holds the app shell and the game's files, not the bench nor the splash images.
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
    }
    return urls;
  });
  expect(cached).toContain("/index.html");
  expect(cached.some((url) => /^\/assets\/index-.*\.js$/.test(url))).toBe(true);
  expect(cached.some((url) => url.includes("nunito"))).toBe(true);
  expect(cached.some((url) => url.startsWith("/cavaliers/"))).toBe(true);
  expect(cached.some((url) => url.includes("Bench-"))).toBe(false);
  expect(cached.some((url) => url.startsWith("/splash/"))).toBe(false);
  expect(cached.some((url) => url.startsWith("/api/"))).toBe(false);
  test.info().annotations.push({ type: "precache", description: `${cached.length} entrées` });
});

test("sans réseau, l’application démarre et la partie contre l’ordinateur se joue (ACCT-05)", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await controlled(page);

  await context.setOffline(true);
  const started = Date.now();
  await page.reload();
  const strip = page.locator('[data-home-strip="offline"]');
  await expect(strip).toBeVisible();
  test.info().annotations.push({
    type: "démarrage hors ligne",
    description: `${Date.now() - started} ms jusqu’au bandeau`,
  });
  await expect(strip).toHaveText("Pas de connexion : seul le jeu contre l’ordinateur marche.");
  await expect(strip).toHaveAttribute("role", "status");

  await page.locator('[data-home-choice="ordinateur"]').click();
  await expect(page).toHaveURL(/#\/ordinateur$/);
  await page.getByRole("button", { name: "Jouer la partie" }).click();
  await expect(page).toHaveURL(/#\/partie$/);
  await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
  await expect(page.locator("[data-hand] [data-card]").first()).toBeVisible();

  // A few moves of the player, the computers playing theirs in between.
  const stats = newStats();
  const until = Date.now() + 90_000;
  while (stats.plays + stats.posed < 2 && Date.now() < until) {
    const s = await snapshot(page);
    if (!(await playStep(page, s, stats))) await page.waitForTimeout(50);
  }
  expect(stats.plays + stats.posed).toBeGreaterThanOrEqual(2);
  await context.setOffline(false);
});

/** A copy of the build served by a small static server of the test's own, on a free port. */
async function serveCopy(): Promise<{ root: string; origin: string; server: Server }> {
  const root = mkdtempSync(join(tmpdir(), "toc-pwa-"));
  cpSync(DIST, root, { recursive: true });
  const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
  };
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname));
    let file = join(root, path === "/" ? "index.html" : path);
    if (!file.startsWith(root)) file = join(root, "index.html");
    try {
      if (!statSync(file).isFile()) throw new Error("not a file");
    } catch {
      if (extname(path) !== "") {
        response.writeHead(404).end();
        return;
      }
      file = join(root, "index.html");
    }
    response.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-cache",
    });
    response.end(readFileSync(file));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { root, origin: `http://127.0.0.1:${port}`, server };
}

/** Asks the controlling worker for the test-only version answer added to the copy's sw.js. */
function workerVersion(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const controller = navigator.serviceWorker.controller;
        if (controller === null) {
          resolve("none");
          return;
        }
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => resolve(String(event.data));
        setTimeout(() => resolve("v1"), 1000);
        controller.postMessage("VERSION?", [channel.port2]);
      }),
  );
}

test("une nouvelle version attend la fin de la partie, puis « Mettre à jour » sur l’accueil (APP-02)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const copy = await serveCopy();
  try {
    await page.goto(`${copy.origin}/#/partie`);
    await controlled(page);
    await expect(page.locator("[data-board]")).toHaveClass(/loaded/);
    expect(await workerVersion(page)).toBe("v1");
    await page.evaluate(() => {
      (window as Window & { __sameDocument?: boolean }).__sameDocument = true;
    });

    // A new build: the copy's sw.js changes (and answers « v2 »).
    const sw = join(copy.root, "sw.js");
    writeFileSync(
      sw,
      `${readFileSync(sw, "utf8")}\n;self.addEventListener("message", (e) => { if (e.data === "VERSION?") e.ports[0]?.postMessage("v2"); });\n`,
    );
    // The app looks for it when it comes back to the foreground.
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.waiting !== null && registration?.waiting !== undefined;
        }),
      )
      .toBe(true);

    // In the game: no strip, no reload; « Réglages » says it will install back on the home.
    await expect(page.locator("[data-home-strip]")).toHaveCount(0);
    await page
      .getByRole("button", { name: /^Réglages/ })
      .first()
      .click();
    await expect(page.locator("[data-update-line]")).toHaveText(
      "Une nouvelle version est prête : elle s’installera quand tu reviendras à l’accueil.",
    );
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(() => (window as Window & { __sameDocument?: boolean }).__sameDocument),
    ).toBe(true);
    expect(await workerVersion(page)).toBe("v1");

    // Back on the home: « Nouvelle version disponible ».
    await page.evaluate(() => {
      location.hash = "#/";
    });
    const strip = page.locator('[data-home-strip="update"]');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("Nouvelle version disponible");
    await expect(strip).toHaveAttribute("role", "status");
    expect(
      await page.evaluate(() => (window as Window & { __sameDocument?: boolean }).__sameDocument),
    ).toBe(true);

    // « Mettre à jour »: the page reloads under the new worker.
    await strip.getByRole("button", { name: "Mettre à jour" }).click();
    // The reload destroys the page's context while it is asked: such a poll counts as « not yet ».
    await expect
      .poll(() =>
        page
          .evaluate(() => (window as Window & { __sameDocument?: boolean }).__sameDocument ?? false)
          .catch(() => true),
      )
      .toBe(false);
    await expect.poll(() => workerVersion(page).catch(() => "reloading")).toBe("v2");
    // Up to date (the phone, an iPhone, may now see the install strip instead).
    await expect(page.locator('[data-home-strip="update"]')).toHaveCount(0);
  } finally {
    copy.server.close();
    rmSync(copy.root, { recursive: true, force: true });
  }
});

/** A CDP session with the ServiceWorker domain on, and the id of this origin's registration. */
async function serviceWorkerDomain(
  context: BrowserContext,
  page: Page,
): Promise<{ cdp: CDPSession; registrationId: string }> {
  const cdp = await context.newCDPSession(page);
  const scope = new URL("/", page.url()).href;
  const found = new Promise<string>((resolve) => {
    cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
      const mine = registrations.find((r) => r.scopeURL === scope && !r.isDeleted);
      if (mine) resolve(mine.registrationId);
    });
  });
  await cdp.send("ServiceWorker.enable");
  return { cdp, registrationId: await found };
}

test("une notification reçue est toujours affichée (APP-03)", async ({ page, context }) => {
  await page.goto("/");
  await controlled(page);
  const origin = new URL(page.url()).origin;
  await context.grantPermissions(["notifications"], { origin });
  const { cdp, registrationId } = await serviceWorkerDomain(context, page);
  const payload = {
    t: "turn",
    title: "C’est ton tour !",
    body: "La table de Romain t’attend : la partie est en pause jusqu’à ton retour.",
    url: "/#/table/AbCdEfGhIjKlMnOpQrStUv",
    tag: "tour-AbCdEfGhIjKlMnOpQrStUv",
  };
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin,
    registrationId,
    data: JSON.stringify(payload),
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        const shown = await registration.getNotifications();
        return shown.map((n) => ({ title: n.title, body: n.body, tag: n.tag, data: n.data }));
      }),
    )
    .toEqual([
      { title: payload.title, body: payload.body, tag: payload.tag, data: { url: payload.url } },
    ]);
});

test("le manifeste servi : paysage, id, catégorie, et ses icônes répondent", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const manifest = (await response.json()) as {
    orientation: string;
    id: string;
    lang: string;
    display: string;
    categories: string[];
    icons: { src: string }[];
  };
  expect(manifest).toMatchObject({
    orientation: "landscape",
    id: "/",
    lang: "fr",
    display: "standalone",
    categories: ["games"],
  });
  for (const icon of manifest.icons) {
    const answer = await request.get(icon.src);
    expect(answer.status(), icon.src).toBe(200);
    expect(answer.headers()["content-type"]).toContain("image/png");
  }
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["content-type"]).toContain("javascript");
});
