import { describe, expect, it } from "vitest";

// French typography guard over the string catalogue (RESEARCH Pitfalls 4 and 12): thin no-break
// space U+202F before ? ! ; » and after «, no-break space U+00A0 before :, typographic apostrophe.
// Nothing here asserts that a font contains U+202F (it does not; the browser falls back).
const catalogue = import.meta.glob<string>("./fr/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

// Plan 04-07: the push texts are built by the Worker from packages/protocol (one shared module).
const pushCatalogue = import.meta.glob<string>("../../../../packages/protocol/src/push-fr.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

const NNBSP = " ";
const NBSP = " ";

/** Contents of every string literal of a TypeScript source (comments skipped, `${}` scanned as code). */
export function stringLiterals(src: string): string[] {
  const out: string[] = [];
  let i = 0;

  function quoted(quote: string): void {
    let text = "";
    i++;
    while (i < src.length && src[i] !== quote) {
      if (src[i] === "\\") {
        text += src.slice(i, i + 2);
        i += 2;
      } else {
        text += src[i++];
      }
    }
    i++;
    out.push(text);
  }

  function template(): void {
    let text = "";
    i++;
    while (i < src.length && src[i] !== "`") {
      if (src[i] === "\\") {
        text += src.slice(i, i + 2);
        i += 2;
      } else if (src[i] === "$" && src[i + 1] === "{") {
        i += 2;
        code(true);
      } else {
        text += src[i++];
      }
    }
    i++;
    out.push(text);
  }

  function code(insideExpression: boolean): void {
    let depth = 0;
    while (i < src.length) {
      const c = src[i];
      const next = src[i + 1];
      if (c === "/" && next === "/") {
        while (i < src.length && src[i] !== "\n") i++;
      } else if (c === "/" && next === "*") {
        const end = src.indexOf("*/", i + 2);
        i = end === -1 ? src.length : end + 2;
      } else if (c === '"' || c === "'") {
        quoted(c);
      } else if (c === "`") {
        template();
      } else if (c === "{") {
        depth++;
        i++;
      } else if (c === "}") {
        i++;
        if (insideExpression && depth === 0) return;
        depth--;
      } else {
        i++;
      }
    }
  }

  code(false);
  return out;
}

/** Typography problems of one French string; empty when it is correct. */
export function typographyProblems(text: string): string[] {
  const problems: string[] = [];
  if (/ [?!;:»]/.test(text)) problems.push("plain space before ? ! ; : or »");
  if (/« /.test(text)) problems.push("plain space after «");
  if (new RegExp(`${NBSP}[?!;»]`).test(text)) problems.push("U+00A0 before ? ! ; » (use U+202F)");
  if (new RegExp(`${NNBSP}:`).test(text)) problems.push("U+202F before : (use U+00A0)");
  if (new RegExp(`«(?!${NNBSP})`).test(text)) problems.push("« not followed by U+202F");
  if (new RegExp(`(?<!${NNBSP})»`).test(text)) problems.push("» not preceded by U+202F");
  if (/\p{L}\\?'\p{L}/u.test(text))
    problems.push("straight apostrophe between two letters (use ’)");
  return problems;
}

describe("typography detector", () => {
  it("accepts correct French", () => {
    for (const ok of [
      `Jouer${NNBSP}?`,
      `Attention${NBSP}: le cavalier`,
      `Dis${NNBSP}!`,
      `${"«"}${NNBSP}Réessayer${NNBSP}${"»"}`,
      "Le plateau n’a pas pu se charger.",
    ]) {
      expect(typographyProblems(ok), ok).toEqual([]);
    }
  });

  it("flags every kind of violation", () => {
    for (const bad of [
      "Jouer ?",
      "Dis !",
      "Un ; deux",
      "Attention : le cavalier",
      `Attention${NNBSP}: le cavalier`,
      `Jouer${NBSP}?`,
      `« ${"x"}${NNBSP}»`,
      `«${NNBSP}x »`,
      "Le plateau n'a pas pu se charger.",
      "Le plateau n\\'a pas",
    ]) {
      expect(typographyProblems(bad), bad).not.toEqual([]);
    }
  });

  it("reads literals but not comments, and descends into template expressions", () => {
    const src = [
      "// don't flag ? this",
      "const a = 'x'; /* it's a comment */",
      'const b = "y ?";',
      ["const c = `n=$", '{ok ? "p" : "q"} z`;'].join(""),
    ].join("\n");
    expect(stringLiterals(src)).toEqual(["x", "y ?", "p", "q", "n= z"]);
  });
});

describe("apps/web/src/i18n/fr", () => {
  const files = Object.entries(catalogue);

  it("contains catalogue files with string literals to check", () => {
    expect(files.length).toBeGreaterThan(0);
    const total = files.reduce((n, [, text]) => n + stringLiterals(text).length, 0);
    expect(total).toBeGreaterThan(0);
  });

  for (const [file, text] of files) {
    it(`${file} uses French typography`, () => {
      const found = stringLiterals(text).flatMap((literal) =>
        typographyProblems(literal).map((problem) => `${problem}: ${JSON.stringify(literal)}`),
      );
      expect(found).toEqual([]);
    });
  }
});

describe("packages/protocol/src/push-fr.ts", () => {
  const files = Object.entries(pushCatalogue);

  it("is read, with string literals to check", () => {
    expect(files.length).toBe(1);
    const total = files.reduce((n, [, text]) => n + stringLiterals(text).length, 0);
    expect(total).toBeGreaterThan(0);
  });

  for (const [file, text] of files) {
    it(`${file} uses French typography`, () => {
      const found = stringLiterals(text).flatMap((literal) =>
        typographyProblems(literal).map((problem) => `${problem}: ${JSON.stringify(literal)}`),
      );
      expect(found).toEqual([]);
    });
  }
});
