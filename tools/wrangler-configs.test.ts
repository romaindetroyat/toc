// The two deploy configs (wrangler.jsonc with the assets upload, wrangler.embarque.jsonc with the assets
// embedded in the script) deploy the same Worker « toc »: they must declare the same Durable Object,
// the same migrations and the same compatibility date, or one deploy would drop the GameRoom class
// (02-RESEARCH Pitfall 8). Neither may switch on the test-only shortcuts (T-02-07, Pitfall 11).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
};

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

  it("never sets TOC_TEST_MODE in a deploy config", () => {
    for (const config of [upload, embedded]) {
      expect(config.vars?.TOC_TEST_MODE).toBeUndefined();
    }
  });
});
