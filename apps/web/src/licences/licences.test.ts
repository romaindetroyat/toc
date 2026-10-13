import { describe, expect, it } from "vitest";
import raw from "../../../../assets/audio/LICENSES.md?raw";
import { SOUND_IDS } from "../audio/sounds.ts";
import { LICENCES, parseLicences } from "./licences.ts";

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
