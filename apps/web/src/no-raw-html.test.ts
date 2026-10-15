import { describe, expect, it } from "vitest";

// Threat T-01-03: nothing in apps/web/src may turn data into markup. The search tokens are built
// from fragments so that this file does not match itself.
const sources = import.meta.glob<string>(["./**/*.svelte", "./**/*.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});
const AT_HTML = new RegExp(`\\{@${"ht"}${"ml"}\\b`);
const INNER = `inner${"HT"}${"ML"}`;
const OUTER = `outer${"HT"}${"ML"}`;
const SINK_ASSIGNMENT = new RegExp(`(?:${INNER}|${OUTER})\\s*(?:\\+=|=(?!=))`);
const SINK_BINDING = new RegExp(`bind:(?:${INNER}|${OUTER})`);
const SINK_METHOD = new RegExp(`insertAdjacent${"HT"}${"ML"}\\s*\\(`);

/** Sinks found in one source text. */
export function rawHtmlSinks(text: string): string[] {
  const found: string[] = [];
  if (AT_HTML.test(text)) found.push("raw-HTML template tag");
  if (SINK_ASSIGNMENT.test(text)) found.push("assignment to an HTML-string property");
  if (SINK_BINDING.test(text)) found.push("binding to an HTML-string property");
  if (SINK_METHOD.test(text)) found.push("insertAdjacent-style HTML method");
  return found;
}

describe("raw-HTML sink detector", () => {
  it("flags each sink", () => {
    expect(rawHtmlSinks(`<div>{@${"ht"}${"ml"} text}</div>`)).not.toEqual([]);
    expect(rawHtmlSinks(`el.${INNER} = value;`)).not.toEqual([]);
    expect(rawHtmlSinks(`el.${OUTER} += value;`)).not.toEqual([]);
    expect(rawHtmlSinks(`<div bind:${INNER}={v}></div>`)).not.toEqual([]);
    expect(rawHtmlSinks(`el.insertAdjacent${"HT"}${"ML"}("beforeend", v);`)).not.toEqual([]);
  });

  it("lets safe code through", () => {
    expect(rawHtmlSinks("el.textContent = value; if (a == b) {}")).toEqual([]);
    expect(rawHtmlSinks(`const s = el.${INNER} === "";`)).toEqual([]);
  });
});

describe("apps/web/src", () => {
  const files = Object.entries(sources);

  it("has Svelte and TypeScript sources to scan", () => {
    expect(files.some(([file]) => file.endsWith(".svelte"))).toBe(true);
    expect(files.some(([file]) => file.endsWith(".ts"))).toBe(true);
  });

  it("has no raw-HTML template tag and no innerHTML or outerHTML assignment", () => {
    const offenders = files.flatMap(([file, text]) =>
      rawHtmlSinks(text).map((sink) => `${file}: ${sink}`),
    );
    expect(offenders).toEqual([]);
  });
});
