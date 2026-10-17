// The two deploy configs (wrangler.jsonc with the assets upload, wrangler.embarque.jsonc with the assets
// embedded in the script) deploy the same Worker « toc »: they must declare the same Durable Object,
// the same migrations and the same compatibility date, or one deploy would drop the GameRoom class
// (02-RESEARCH Pitfall 8). Neither may switch on the test-only shortcuts (T-02-07, Pitfall 11).

import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bundleProblems } from "./check-bundle.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** JSONC to a value: comments outside strings are dropped, trailing commas are not used here. */
function parseJsonc(text: string): unknown {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inString) {
      out += c;
      if (c === "\\") out += text[++i] ?? "";
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
    } else {
      out += c;
    }
  }
  return JSON.parse(out);
}

type Config = {
  name?: string;
  main?: string;
  compatibility_date?: string;
  durable_objects?: unknown;
  migrations?: unknown;
  vars?: Record<string, unknown>;
  assets?: { binding?: string; run_worker_first?: unknown };
  rules?: { type: string; globs: string[]; fallthrough?: boolean }[];
};

/**
 * Wrangler turns each glob of a module rule into a regular expression (glob-to-regexp, no globstar:
 * `*` matches any run of characters, slashes included) tested against the import specifier as written,
 * here the `../apps/web/dist/...` paths of worker-embedded/manifest.js.
 */
function globMatches(glob: string, specifier: string): boolean {
  const pattern = glob.replace(/[.+^${}()|[\]\\/=!?]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${pattern}$`).test(specifier);
}

const read = (file: string) => parseJsonc(readFileSync(join(ROOT, file), "utf8")) as Config;

describe("wrangler configs", () => {
  const upload = read("wrangler.jsonc");
  const embedded = read("wrangler.embarque.jsonc");

  it("parses JSONC with comments and keeps // inside strings", () => {
    expect(parseJsonc('{\n  // note\n  "a": "http://x", /* b */ "c": 1\n}')).toEqual({
      a: "http://x",
      c: 1,
    });
  });

  it("declares the GameRoom Durable Object and its SQLite migration in both files", () => {
    for (const config of [upload, embedded]) {
      expect(config.name).toBe("toc");
      expect(config.durable_objects).toEqual({
        bindings: [{ name: "GAME_ROOM", class_name: "GameRoom" }],
      });
      expect(config.migrations).toEqual([{ tag: "v1", new_sqlite_classes: ["GameRoom"] }]);
    }
  });

  it("keeps the Durable Object, the migrations and the compatibility date identical", () => {
    expect(embedded.durable_objects).toEqual(upload.durable_objects);
    expect(embedded.migrations).toEqual(upload.migrations);
    expect(embedded.compatibility_date).toEqual(upload.compatibility_date);
  });

  it("routes /api and /ws to the Worker before the assets", () => {
    expect(upload.main).toBe("./apps/worker/src/index.ts");
    expect(upload.assets?.binding).toBe("ASSETS");
    expect(upload.assets?.run_worker_first).toEqual(["/api/*", "/ws/*"]);
    expect(embedded.main).toBe("./worker-embedded/index.js");
  });

  it("embeds as text scripts only the web build's files (Pitfall 9, T-02-10)", () => {
    const text = embedded.rules?.find((rule) => rule.type === "Text");
    const scripts = (text?.globs ?? []).filter((glob) => glob.endsWith(".js"));
    expect(scripts.length).toBeGreaterThan(0);
    for (const glob of scripts) {
      expect(glob).toContain("apps/web/dist/");
      expect(glob).not.toBe("**/dist/**/*.js");
    }
    const isTextScript = (specifier: string) =>
      scripts.some((glob) => globMatches(glob, specifier));
    expect(isTextScript("../apps/web/dist/assets/index-Bb0tp_DN.js")).toBe(true);
    expect(isTextScript("../apps/web/dist/sw.js")).toBe(true);
    // What the old glob also caught: any dependency shipping its code under a dist/ directory.
    expect(globMatches("**/dist/**/*.js", "../node_modules/some-lib/dist/esm/index.js")).toBe(true);
    expect(isTextScript("../node_modules/some-lib/dist/esm/index.js")).toBe(false);
    expect(isTextScript("./dist/esm/index.js")).toBe(false);
    expect(isTextScript("zod/mini")).toBe(false);
  });

  it("never sets TOC_TEST_MODE in a deploy config", () => {
    for (const config of [upload, embedded]) {
      expect(config.vars?.TOC_TEST_MODE).toBeUndefined();
    }
  });
});

describe("tools/check-bundle.mjs", () => {
  /** A fake web build and a fake dry-run output, as wrangler writes it: <sha1>-<name> next to index.js. */
  function fixture(): {
    dir: string;
    dist: string;
    out: string;
    module(name: string, body: string): void;
  } {
    const dir = mkdtempSync(join(tmpdir(), "toc-bundle-"));
    const dist = join(dir, "dist");
    const out = join(dir, "out");
    mkdirSync(join(dist, "assets"), { recursive: true });
    mkdirSync(out);
    return {
      dir,
      dist,
      out,
      module(name, body) {
        const hash = createHash("sha1").update(body).digest("hex");
        writeFileSync(join(out, `${hash}-${name}`), body);
      },
    };
  }

  const entry = (imports: string[]) =>
    [
      'import { DurableObject } from "cloudflare:workers";',
      ...imports.map((file, i) => `import m${i} from "./${file}";`),
      "var GameRoom = class extends DurableObject {};",
      "export { GameRoom };",
    ].join("\n");

  it("passes when every separate module is a file of the web build", () => {
    const f = fixture();
    const app = "console.log('app');";
    writeFileSync(join(f.dist, "assets", "index-abc.js"), app);
    writeFileSync(join(f.dist, "index.html"), "<html></html>");
    f.module("index-abc.js", app);
    f.module("index.html", "<html></html>");
    const hash = (body: string) => createHash("sha1").update(body).digest("hex");
    writeFileSync(
      join(f.out, "index.js"),
      entry([`${hash(app)}-index-abc.js`, `${hash("<html></html>")}-index.html`]),
    );
    expect(bundleProblems(f.out, f.dist)).toEqual([]);
    rmSync(f.dir, { recursive: true });
  });

  it("names a dependency's script that became a separate module, and a bare import", () => {
    const f = fixture();
    writeFileSync(join(f.dist, "assets", "index-abc.js"), "app");
    const lib = "export const z = 1;";
    f.module("index.js.mjs", lib);
    const libName = `${createHash("sha1").update(lib).digest("hex")}-index.js.mjs`;
    writeFileSync(join(f.out, "index.js"), `${entry([libName])}\nimport { z } from "zod";`);
    const problems = bundleProblems(f.out, f.dist);
    expect(problems).toContain(`${libName}: a file outside ${f.dist} became a separate module`);
    expect(problems).toContain(
      "index.js imports zod: everything but the web build must be inlined",
    );
    rmSync(f.dir, { recursive: true });
  });

  it("refuses an entry without the GameRoom class, and a directory that is not a dry run", () => {
    const f = fixture();
    writeFileSync(join(f.out, "index.js"), "export default {};");
    expect(bundleProblems(f.out, f.dist)).toEqual(["index.js does not define the GameRoom class"]);
    expect(bundleProblems(f.dist, f.dist)).toEqual([
      `${f.dist}: no index.js (not a dry-run output)`,
    ]);
    rmSync(f.dir, { recursive: true });
  });
});
