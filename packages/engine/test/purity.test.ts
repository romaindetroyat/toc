// Guard: the engine has no randomness, clock, timer, storage, network or DOM, and imports no node:
// module. The forbidden tokens are assembled from fragments so this file does not match itself.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

const FORBIDDEN: { label: string; pattern: RegExp }[] = [
  { label: "Math random", pattern: new RegExp(`\\bMath\\s*\\.\\s*${"ran"}${"dom"}\\b`) },
  { label: "Date", pattern: new RegExp(`\\b${"Da"}${"te"}\\b`) },
  { label: "performance", pattern: new RegExp(`\\b${"perfor"}${"mance"}\\b`) },
  { label: "crypto", pattern: new RegExp(`\\b${"cry"}${"pto"}\\b`) },
  {
    label: "timers",
    pattern: new RegExp(
      `\\b(${"set"}${"Timeout"}|${"set"}${"Interval"}|${"set"}${"Immediate"}|${"requestAnimation"}${"Frame"}|${"queue"}${"Microtask"})\\b`,
    ),
  },
  {
    label: "storage",
    pattern: new RegExp(
      `\\b(${"local"}${"Storage"}|${"session"}${"Storage"}|${"indexed"}${"DB"})\\b`,
    ),
  },
  {
    label: "network",
    pattern: new RegExp(`\\b(${"fe"}${"tch"}|${"XMLHttp"}${"Request"}|${"Web"}${"Socket"})\\b`),
  },
  {
    label: "DOM",
    pattern: new RegExp(`\\b(${"win"}${"dow"}|${"docu"}${"ment"}|${"navi"}${"gator"})\\b`),
  },
  { label: "node import", pattern: new RegExp(`["']${"no"}${"de:"}`) },
  { label: "process", pattern: new RegExp(`\\b${"pro"}${"cess"}\\s*\\.`) },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

/** Source text without comments, so prose about the rules can use any word. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/.*$/gm, "");
}

/** Returns "file: label" for each forbidden use found in `text`. */
function violations(file: string, text: string): string[] {
  const code = stripComments(text);
  return FORBIDDEN.filter(({ pattern }) => pattern.test(code)).map(
    ({ label }) => `${file}: ${label}`,
  );
}

describe("engine purity", () => {
  it("scans the engine sources", () => {
    expect(sourceFiles(SRC).length).toBeGreaterThan(5);
  });

  it("uses no randomness, clock, timer, storage, network, DOM or node: module in packages/engine/src", () => {
    const found = sourceFiles(SRC).flatMap((file) =>
      violations(file.slice(SRC.length + 1), readFileSync(file, "utf8")),
    );
    expect(found).toEqual([]);
  });

  it("fails on a forbidden API (the guard is not blind)", () => {
    const bad = [
      `const x = ${"Math"}.${"ran"}${"dom"}();`,
      `const t = ${"Da"}${"te"}.now();`,
      `${"set"}${"Timeout"}(f, 1);`,
      `import fs from "${"no"}${"de:"}fs";`,
      `${"local"}${"Storage"}.getItem("a");`,
      `await ${"fe"}${"tch"}("/x");`,
      `${"cry"}${"pto"}.getRandomValues(a);`,
    ];
    for (const line of bad) expect(violations("bad.ts", line)).toHaveLength(1);
    expect(
      violations(
        "ok.ts",
        "// Math.floor and Date in a comment are fine\nconst a = Math.floor(2.5);",
      ),
    ).toEqual([]);
  });
});
