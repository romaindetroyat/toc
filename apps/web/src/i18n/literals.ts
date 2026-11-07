// String literals of a TypeScript source, for the catalogue checks (typography.test.ts, plan 05-10's
// denyList.test.ts): moved here from typography.test.ts so that both tests share it without one test
// file importing the other.

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
