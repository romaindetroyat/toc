import type { Scenario } from "../src/types.ts";
import { r06, r07, r08 } from "./cartes.ts";
import { r14, r15, r16 } from "./fin.ts";
import { r11, r12, r13 } from "./prises-maison.ts";
import { r01, r02, r03, r04, r05 } from "./table.ts";
import { r09, r10 } from "./valet-sept.ts";

/** Every scenario of every fixture file, in rule order. */
export const scenarios: Scenario[] = [
  ...r01,
  ...r02,
  ...r03,
  ...r04,
  ...r05,
  ...r06,
  ...r07,
  ...r08,
  ...r09,
  ...r10,
  ...r11,
  ...r12,
  ...r13,
  ...r14,
  ...r15,
  ...r16,
];
