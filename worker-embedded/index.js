// Worker serving the built app from files bundled into the script (see wrangler.embarque.jsonc).
import files from "./manifest.js";

const TYPES = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  webp: "image/webp",
  woff2: "font/woff2",
  json: "application/json",
  webmanifest: "application/manifest+json",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
};

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    let path = pathname === "/" ? "/index.html" : pathname;
    if (!(path in files)) {
      // Repli SPA : une route sans fichier renvoie l'application.
      if (path.includes(".")) return new Response("Introuvable", { status: 404 });
      path = "/index.html";
    }
    const ext = path.slice(path.lastIndexOf(".") + 1);
    const hashed = path.startsWith("/assets/");
    return new Response(files[path], {
      headers: {
        "content-type": TYPES[ext] ?? "application/octet-stream",
        "cache-control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
      },
    });
  },
};
