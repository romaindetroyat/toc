import { PALETTE } from "@toc/board";
import { describe, expect, it } from "vitest";

// Plan 05-10 (05-UI-SPEC « Color », « The audit » contrast row, APP-05): every declared text and
// background pair of app.css passes WCAG's contrast, computed from the tokens' hex values: 4.5:1 for
// text, 3:1 for large text (24 px, or Heading 20 / 700) and for meaningful graphics (the focus ring,
// the guide halo, a secondary button's border). axe's color-contrast checks the rendered pages
// (e2e/accessibilite.spec.ts). The board drawing's numbers are decorative and exempt (UI-SPEC).

/** app.css as written (read from disk: the web tsconfig has no Node types, so fs comes untyped). */
type Fs = { readFileSync(path: URL, encoding: "utf8"): string };
const fs = (
  globalThis as unknown as { process: { getBuiltinModule(id: string): unknown } }
).process.getBuiltinModule("node:fs") as Fs;
const css = fs.readFileSync(new URL("./app.css", import.meta.url), "utf8");

/** The colour tokens of :root, name → #rrggbb. */
function tokens(source: string): Record<string, string> {
  const root = /:root\s*\{([^}]*)\}/.exec(source)?.[1] ?? "";
  const out: Record<string, string> = {};
  for (const match of root.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    out[match[1] as string] = (match[2] as string).toLowerCase();
  }
  return out;
}

const TOKENS = tokens(css);

/** WCAG 2.x relative luminance of #rrggbb. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const token = (name: string): string => {
  const hex = TOKENS[name];
  if (hex === undefined) throw new Error(`no token --${name} in app.css`);
  return hex;
};

type Pair = { what: string; fg: string; bg: string; min: 4.5 | 3 };

/** The UI-SPEC's pairs and the other text/background pairs the components use, with their minimum. */
const PAIRS: Pair[] = [
  // Text on the app's surfaces.
  { what: "crème sur noyer (page)", fg: token("creme"), bg: token("noyer"), min: 4.5 },
  {
    what: "crème sur bois sombre (rangées, tuiles)",
    fg: token("creme"),
    bg: token("bois-sombre"),
    min: 4.5,
  },
  {
    what: "crème atténuée sur bois sombre (ligne 2, notes)",
    fg: token("creme-attenuee"),
    bg: token("bois-sombre"),
    min: 4.5,
  },
  { what: "crème atténuée sur noyer", fg: token("creme-attenuee"), bg: token("noyer"), min: 4.5 },
  {
    what: "noyer sur crème (bulle, puces de cartes, onglet choisi, étiquettes)",
    fg: token("noyer"),
    bg: token("creme"),
    min: 4.5,
  },
  {
    what: "noyer sur chêne (ronds, tuiles de couleur)",
    fg: token("noyer"),
    bg: token("chene"),
    min: 4.5,
  },
  { what: "noyer sur ambre (bouton principal)", fg: token("noyer"), bg: token("ambre"), min: 4.5 },
  {
    what: "crème sur brique (bouton destructeur)",
    fg: token("creme"),
    bg: token("brique"),
    min: 4.5,
  },
  { what: "crème sur le tapis", fg: token("creme"), bg: token("tapis"), min: 4.5 },
  // The cards.
  { what: "rouge des cartes sur la carte", fg: token("carte-rouge"), bg: token("carte"), min: 4.5 },
  { what: "noir des cartes sur la carte", fg: token("carte-noire"), bg: token("carte"), min: 4.5 },
  // The planks (end of game, « Bravo ! »): the galet's oak.
  { what: "encre sur le chêne de la planche", fg: PALETTE.ink, bg: PALETTE.board, min: 4.5 },
  {
    what: "PALETTE.track sur le chêne de la planche",
    fg: PALETTE.track,
    bg: PALETTE.board,
    min: 4.5,
  },
  { what: "encre sur la crème des marques", fg: PALETTE.ink, bg: PALETTE.cream, min: 4.5 },
  // Meaningful graphics: 3:1.
  { what: "anneau du focus (ambre) sur noyer", fg: token("ambre"), bg: token("noyer"), min: 3 },
  {
    what: "anneau du focus (ambre) sur bois sombre",
    fg: token("ambre"),
    bg: token("bois-sombre"),
    min: 3,
  },
  { what: "halo du guide (crème) sur noyer", fg: token("creme"), bg: token("noyer"), min: 3 },
  {
    what: "bord du bouton secondaire (crème) sur bois sombre",
    fg: token("creme"),
    bg: token("bois-sombre"),
    min: 3,
  },
];

/** Each rule of app.css that sets both a text colour and a background from the tokens. */
function declaredPairs(source: string): Pair[] {
  const out: Pair[] = [];
  for (const rule of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = rule[2] as string;
    const fg = /(?:^|;|\s)color:\s*var\(--([a-z0-9-]+)\)/.exec(body)?.[1];
    const bg = /background(?:-color)?:\s*var\(--([a-z0-9-]+)\)/.exec(body)?.[1];
    if (fg === undefined || bg === undefined) continue;
    if (TOKENS[fg] === undefined || TOKENS[bg] === undefined) continue;
    out.push({
      what: `${(rule[1] as string).trim()} (app.css)`,
      fg: token(fg),
      bg: token(bg),
      min: 4.5,
    });
  }
  return out;
}

describe("contrast of the colour tokens", () => {
  it("computes WCAG's ratio", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // The UI-SPEC's own figures (« ≈ 15:1 », « ≈ 11.6:1 », « ≈ 6.4:1 », « ≈ 9.8:1 »).
    expect(contrast(token("noyer"), token("creme"))).toBeGreaterThan(15);
    expect(contrast(token("creme"), token("bois-sombre"))).toBeCloseTo(11.5, 0);
    expect(contrast(token("creme-attenuee"), token("bois-sombre"))).toBeCloseTo(6.4, 0);
    expect(contrast(token("noyer"), token("chene"))).toBeCloseTo(9.8, 0);
  });

  it("reads the tokens of app.css", () => {
    for (const name of [
      "noyer",
      "bois-sombre",
      "chene",
      "ambre",
      "brique",
      "creme",
      "creme-attenuee",
    ]) {
      expect(TOKENS[name], name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("finds the pairs app.css declares in one rule (body, the buttons)", () => {
    const declared = declaredPairs(css).map((pair) => pair.what);
    expect(declared.some((what) => what.startsWith("body"))).toBe(true);
    expect(declared.some((what) => what.includes(".btn-primary"))).toBe(true);
    expect(declared.some((what) => what.includes(".btn-destructive"))).toBe(true);
  });

  it("every pair passes its minimum", () => {
    const failing = [...PAIRS, ...declaredPairs(css)]
      .map((pair) => ({ ...pair, ratio: contrast(pair.fg, pair.bg) }))
      .filter((pair) => pair.ratio < pair.min)
      .map((pair) => `${pair.what}: ${pair.ratio.toFixed(2)} < ${pair.min}`);
    expect(failing).toEqual([]);
  });
});
