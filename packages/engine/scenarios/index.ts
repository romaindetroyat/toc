import type { Scenario } from "../src/types.ts";
import { r06, r07, r08 } from "./cartes.ts";
import { r01, r02, r03, r04, r05 } from "./table.ts";

/** Every scenario of every fixture file, in rule order. Plan 01-05 adds its three files. */
export const scenarios: Scenario[] = [
  ...r01,
  ...r02,
  ...r03,
  ...r04,
  ...r05,
  ...r06,
  ...r07,
  ...r08,
];
