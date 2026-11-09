// The words no screen of this French game may show or read out (05-UI-SPEC « The audit », « French
// everywhere », plan 05-10): English interface words and leaked values. One list for the unit test
// over the catalogue (denyList.test.ts) and for the audit of the pages (e2e/audit.ts).

export const DENY_LIST = [
  "Loading",
  "Error",
  "Close",
  "Cancel",
  "Submit",
  "OK",
  "undefined",
  "null",
  "NaN",
  "[object",
] as const;

/**
 * The deny-list words found in a text, each as a whole word whatever its case (« Error » but not
 * « Erreur », « null » but not « nulle »), and « [object » as it is.
 */
export function deniedWords(text: string): string[] {
  return DENY_LIST.filter((word) =>
    word === "[object"
      ? text.includes(word)
      : new RegExp(`(?<![\\p{L}\\p{N}_])${word}(?![\\p{L}\\p{N}_])`, "iu").test(text),
  );
}
