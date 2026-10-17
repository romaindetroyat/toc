// Guard: the table core is a pure reducer (02-RESEARCH Pattern 1). The clock is the `now` of its
// context and the deck seed comes from the context's `seed()`: no file of packages/table/src may read
// the wall clock, start a timer, draw from Math's random function or crypto, touch storage or the
// network, or import a node: module. The Durable Object shell does all of that around it.
// The forbidden tokens are assembled from fragments so this file does not match itself.

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
      `\\b(${"local"}${"Storage"}|${"session"}${"Storage"}|${"indexed"}${"DB"}|${"sto"}${"rage"}\\s*\\.)`,
    ),
  },
  {
    label: "network",
    pattern: new RegExp(`\\b(${"fe"}${"tch"}|${"XMLHttp"}${"Request"}|${"Web"}${"Socket"})\\b`),
  },
  { label: "node import", pattern: new RegExp(`["']${"no"}${"de:"}`) },
  { label: "process", pattern: new RegExp(`\\b${"pro"}${"cess"}\\s*\\.`) },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Source text without comments, so prose can use any word. */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/.*$/gm, "");
}

function violations(file: string, text: string): string[] {
  const code = stripComments(text);
  return FORBIDDEN.filter(({ pattern }) => pattern.test(code)).map(
    ({ label }) => `${file}: ${label}`,
  );
}

describe("table core purity (it runs inside the Durable Object, which owns the clock and I/O)", () => {
  it("scans the table sources", () => {
    expect(sourceFiles(SRC).length).toBeGreaterThanOrEqual(4);
  });

  it("uses no clock, timer, randomness, crypto, storage, network or node: module in packages/table/src", () => {
    const found = sourceFiles(SRC).flatMap((file) =>
      violations(file.slice(SRC.length + 1), readFileSync(file, "utf8")),
    );
    expect(found).toEqual([]);
  });

  it("fails on a forbidden API (the guard is not blind)", () => {
    for (const line of [
      `const x = ${"Math"}.${"ran"}${"dom"}();`,
      `const t = ${"Da"}${"te"}.now();`,
      `${"set"}${"Timeout"}(f, 1);`,
      `${"set"}${"Interval"}(f, 1);`,
      `import fs from "${"no"}${"de:"}fs";`,
      `${"local"}${"Storage"}.getItem("a");`,
      `this.${"sto"}${"rage"}.put(1);`,
      `await ${"fe"}${"tch"}("/x");`,
      `${"cry"}${"pto"}.getRandomValues(a);`,
      `${"perfor"}${"mance"}.now();`,
    ]) {
      expect(violations("bad.ts", line), line).toHaveLength(1);
    }
    expect(
      violations("ok.ts", "// Date.now() in a comment\nconst a = Math.floor(ctx.now);"),
    ).toEqual([]);
  });
});
