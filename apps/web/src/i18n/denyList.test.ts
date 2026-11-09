import { describe, expect, it } from "vitest";
import { DENY_LIST, deniedWords } from "./denyList.ts";
import { stringLiterals } from "./literals.ts";

// Plan 05-10 (05-UI-SPEC « French everywhere »): no string of the French catalogue equals or contains
// a deny-list word as a word; the pages themselves are checked by the audit (e2e/audit.ts).
const catalogue = import.meta.glob<string>("./fr/**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("the deny-list detector", () => {
  it("finds each word as a word, whatever its case", () => {
    expect(deniedWords("Loading…")).toEqual(["Loading"]);
    expect(deniedWords("une error ici")).toEqual(["Error"]);
    expect(deniedWords("Close")).toEqual(["Close"]);
    expect(deniedWords("Cancel this")).toEqual(["Cancel"]);
    expect(deniedWords("Submit")).toEqual(["Submit"]);
    expect(deniedWords("OK")).toEqual(["OK"]);
    expect(deniedWords("Bonjour undefined")).toEqual(["undefined"]);
    expect(deniedWords("null")).toEqual(["null"]);
    expect(deniedWords("NaN %")).toEqual(["NaN"]);
    expect(deniedWords("[object Object]")).toEqual(["[object"]);
  });

  it("leaves French words alone", () => {
    for (const text of [
      "Erreur",
      "Annuler ce coup",
      "Fermer",
      "nulle part",
      "Le plateau n’a pas pu se charger.",
      "Cookie",
      "Bloqué",
      "Valider",
      "Chargement de tes parties…",
    ]) {
      expect(deniedWords(text), text).toEqual([]);
    }
  });
});

describe("the French catalogue", () => {
  const files = Object.entries(catalogue);

  it("is found", () => {
    expect(files.length).toBeGreaterThan(15);
    expect(DENY_LIST.length).toBe(10);
  });

  it("holds no deny-list word in any string", () => {
    const found = files.flatMap(([file, text]) =>
      stringLiterals(text).flatMap((literal) =>
        deniedWords(literal).map((word) => `${file}: « ${word} » in ${JSON.stringify(literal)}`),
      ),
    );
    expect(found).toEqual([]);
  });
});
