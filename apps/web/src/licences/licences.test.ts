import { describe, expect, it } from "vitest";
import raw from "../../../../assets/audio/LICENSES.md?raw";
import { SOUND_IDS, SOUNDS, type SoundDef, type SoundId } from "../audio/sounds.ts";
import { LICENCES, type LicenceRow, parseLicences, uncoveredAssets } from "./licences.ts";

const SAMPLE = [
  "# Licences",
  "",
  "Une phrase d’introduction avec un | dans le texte, hors tableau.",
  "",
  "| id | fichier | type | source | auteur | licence | url |",
  "|----|---------|------|--------|--------|---------|-----|",
  "| un | — | son |  Généré par le code  | Jeu TOC | Aucune œuvre tierce | — |",
  "| deux | a.woff2 | police | Fontsource | Les auteurs | OFL-1.1 | https://example.org |",
  "",
  "Texte après le tableau.",
  "| autre | table | ignorée | x | y | z | w |",
].join("\n");

describe("parseLicences", () => {
  it("returns one row per data row with trimmed cells, skipping the header and the separator", () => {
    const rows = parseLicences(SAMPLE);
    expect(rows).toEqual([
      {
        id: "un",
        fichier: "—",
        type: "son",
        source: "Généré par le code",
        auteur: "Jeu TOC",
        licence: "Aucune œuvre tierce",
        url: "—",
      },
      {
        id: "deux",
        fichier: "a.woff2",
        type: "police",
        source: "Fontsource",
        auteur: "Les auteurs",
        licence: "OFL-1.1",
        url: "https://example.org",
      },
    ]);
  });

  it("returns no row for a text without a table", () => {
    expect(parseLicences("Rien ici.\n\nNi ici.")).toEqual([]);
    expect(parseLicences("")).toEqual([]);
  });

  it("tolerates Windows line endings and missing outer pipes", () => {
    const rows = parseLicences(
      "id | fichier | type | source | auteur | licence | url\r\n--|--|--|--|--|--|--\r\nx | f | son | s | a | l | u\r\n",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("x");
    expect(rows[0]?.url).toBe("u");
  });

  it("gives empty strings for missing trailing cells", () => {
    const rows = parseLicences(
      "| id | fichier | type | source | auteur | licence | url |\n|--|--|--|--|--|--|--|\n| x | f | son | s |",
    );
    expect(rows).toEqual([
      { id: "x", fichier: "f", type: "son", source: "s", auteur: "", licence: "", url: "" },
    ]);
  });
});

describe("assets/audio/LICENSES.md", () => {
  const rows = parseLicences(raw);

  it("is what the application imports, and is not empty", () => {
    expect(LICENCES.length).toBeGreaterThan(0);
    expect(LICENCES).toEqual(rows);
  });

  it("has exactly one row for every sound of the catalogue", () => {
    for (const id of SOUND_IDS) {
      const found = rows.filter((row) => row.id === id && row.type === "son");
      expect(found, `sound ${id}`).toHaveLength(1);
    }
  });

  it("lists no sound outside the catalogue (the ambience was removed on 2026-10-14)", () => {
    const sounds = rows.filter((row) => row.type === "son").map((row) => row.id);
    expect([...sounds].sort()).toEqual([...SOUND_IDS].sort());
    expect(sounds).not.toContain("ambiance");
  });

  it("has no two rows with the same id", () => {
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a type, a source and a licence on every row", () => {
    for (const row of rows) {
      expect(row.id, "id").not.toBe("");
      expect(row.type, `type of ${row.id}`).not.toBe("");
      expect(row.source, `source of ${row.id}`).not.toBe("");
      expect(row.licence, `licence of ${row.id}`).not.toBe("");
    }
  });

  it("has the fonts, the icons and the board art", () => {
    const byType = (type: string) => rows.filter((row) => row.type === type);
    const fonts = byType("police");
    expect(fonts.map((row) => row.id).sort()).toEqual(["caveat", "nunito"]);
    for (const font of fonts) expect(font.licence).toContain("OFL-1.1");
    const icons = byType("icônes");
    expect(icons).toHaveLength(1);
    expect(icons[0]?.licence).toContain("ISC");
    expect(byType("plateau").length).toBeGreaterThanOrEqual(1);
  });

  it("shows no raw markup in any cell", () => {
    for (const row of rows) {
      for (const cell of Object.values(row)) expect(cell).not.toMatch(/[<>]/);
    }
  });
});

const row = (id: string, fichier: string): LicenceRow => ({
  id,
  fichier,
  type: "police",
  source: "s",
  auteur: "a",
  licence: "l",
  url: "—",
});

describe("uncoveredAssets", () => {
  const rows = [
    row("nunito", "nunito-latin.woff2, nunito-latin-ext.woff2"),
    row("cartes", "apps/web/src/assets/cartes/"),
    row("un-son", "apps/web/public/audio/pose.m4a"),
  ];

  it("accepts a file named in a row, by its name or by its path", () => {
    expect(uncoveredAssets(["apps/web/src/assets/fonts/nunito-latin.woff2"], rows)).toEqual([]);
    expect(uncoveredAssets(["apps/web/public/audio/pose.m4a"], rows)).toEqual([]);
  });

  it("accepts every file under a directory prefix of a row", () => {
    expect(
      uncoveredAssets(
        ["apps/web/src/assets/cartes/11S.svg", "apps/web/src/assets/cartes/a/b.svg"],
        rows,
      ),
    ).toEqual([]);
  });

  it("accepts a licence text, which is the licence itself", () => {
    expect(
      uncoveredAssets(
        ["apps/web/src/assets/fonts/OFL-Nunito.txt", "x/LICENSE", "x/LGPL-2.1.txt"],
        rows,
      ),
    ).toEqual([]);
  });

  it("does not take a font or a picture for a licence text because of its name", () => {
    expect(
      uncoveredAssets(["apps/web/src/assets/fonts/licensed-sans.woff2", "x/GPL.svg"], rows),
    ).toEqual(["apps/web/src/assets/fonts/licensed-sans.woff2", "x/GPL.svg"]);
  });

  it("lists a new asset file that has no row (temporary fixture list)", () => {
    const fixture = [
      "apps/web/src/assets/fonts/nunito-latin.woff2",
      "apps/web/src/assets/cartes/11S.svg",
      "apps/web/src/assets/fonts/nouvelle-police.woff2",
      "apps/web/public/audio/galop.m4a",
    ];
    expect(uncoveredAssets(fixture, rows)).toEqual([
      "apps/web/src/assets/fonts/nouvelle-police.woff2",
      "apps/web/public/audio/galop.m4a",
    ]);
  });

  it("does not let a directory prefix cover a sibling directory with a longer name", () => {
    expect(uncoveredAssets(["apps/web/src/assets/cartes-autres/x.svg"], rows)).toEqual([
      "apps/web/src/assets/cartes-autres/x.svg",
    ]);
  });
});

// Bundled asset files: the fonts and the card art under apps/web/src/assets, and the recorded sounds
// under apps/web/public/audio when that directory exists. Only the file names are listed (no import).
const bundled = [
  ...Object.keys(import.meta.glob("../assets/**/*")).map((file) => `apps/web/src/${file.slice(3)}`),
  ...Object.keys(import.meta.glob("../../public/audio/**/*")).map(
    (file) => `apps/web/${file.slice(6)}`,
  ),
];

describe("bundled asset files", () => {
  it("finds the fonts and the court figures", () => {
    expect(bundled.some((file) => file.endsWith("/fonts/nunito-latin.woff2"))).toBe(true);
    expect(bundled.filter((file) => /\/cartes\/1[123][SHDC]\.(svg|webp)$/.test(file))).toHaveLength(
      12,
    );
  });

  it("have a row in assets/audio/LICENSES.md (FX-05)", () => {
    expect(uncoveredAssets(bundled, parseLicences(raw))).toEqual([]);
  });

  it("have a « cartes » row for the court figures, with the author and the licence", () => {
    const cartes = parseLicences(raw).filter((entry) => entry.type === "cartes");
    expect(cartes.length).toBeGreaterThanOrEqual(1);
    for (const entry of cartes) {
      expect(entry.auteur, `auteur of ${entry.id}`).not.toBe("");
      expect(entry.licence, `licence of ${entry.id}`).not.toBe("");
    }
  });
});

/**
 * The rule of a recorded version (01-51): its `licence` names a « son » row of LICENSES.md, and that
 * row covers each of its files (served from apps/web/public). Returns what breaks the rule.
 */
function fileVersionProblems(catalogue: Record<SoundId, SoundDef>, rows: LicenceRow[]): string[] {
  const problems: string[] = [];
  for (const id of SOUND_IDS) {
    for (const variant of catalogue[id].variants) {
      if (variant.source.kind !== "file") continue;
      const { licence, files } = variant.source;
      const entry = rows.find((candidate) => candidate.id === licence);
      if (entry?.type !== "son") {
        problems.push(`${id}:${variant.key} has no « son » row ${licence}`);
        continue;
      }
      if (files.length === 0) problems.push(`${id}:${variant.key} lists no file`);
      for (const file of uncoveredAssets(
        files.map((url) => `apps/web/public${url}`),
        [entry],
      )) {
        problems.push(`${id}:${variant.key}: ${file} is not covered by ${licence}`);
      }
    }
  }
  return problems;
}

describe("sound versions and the register", () => {
  const sound = (id: string, fichier: string): LicenceRow => ({
    id,
    fichier,
    type: "son",
    source: "Freesound",
    auteur: "Quelqu’un",
    licence: "CC0 1.0",
    url: "https://freesound.org/x",
  });
  const withFile = (licence: string, files: string[]): Record<SoundId, SoundDef> => ({
    ...SOUNDS,
    sabot: {
      bus: "sfx",
      variants: [...SOUNDS.sabot.variants, { key: "d", source: { kind: "file", files, licence } }],
    },
  });

  it("accepts a recorded version whose own row covers each of its files", () => {
    const rows = [sound("sabot-galop", "apps/web/public/audio/galop.m4a, galop.mp3")];
    expect(
      fileVersionProblems(withFile("sabot-galop", ["/audio/galop.m4a", "/audio/galop.mp3"]), rows),
    ).toEqual([]);
  });

  it("refuses a recorded version without its row, or with a file its row does not cover", () => {
    const rows = [sound("sabot-galop", "galop.m4a")];
    expect(fileVersionProblems(withFile("inconnu", ["/audio/galop.m4a"]), rows)).toEqual([
      "sabot:d has no « son » row inconnu",
    ]);
    expect(
      fileVersionProblems(withFile("sabot-galop", ["/audio/galop.m4a", "/audio/galop.mp3"]), rows),
    ).toEqual(["sabot:d: apps/web/public/audio/galop.mp3 is not covered by sabot-galop"]);
  });

  it("holds for every recorded version of the catalogue", () => {
    expect(fileVersionProblems(SOUNDS, parseLicences(raw))).toEqual([]);
  });

  it("gives every sound at least its version « a », and the hooves four versions", () => {
    for (const id of SOUND_IDS) expect(SOUNDS[id].variants[0]?.key, id).toBe("a");
    expect(SOUNDS.sabot.variants.map((v) => v.key)).toEqual(["a", "b", "c", "d"]);
  });
});
