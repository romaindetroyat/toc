// Traceability gate RULES.md <-> scenario fixtures <-> pictures (RULE-20).
//
//   node tools/rules-trace.mjs            rules and fixtures agree
//   node tools/rules-trace.mjs --images   also requires docs/regles/<id>.webp for every fixture
//
// RULES.md: each rule is a heading `### R-NN Titre`; the scenarios of a rule are the bullet lines
// `- R-NN.k — titre` placed after the `**Scénarios**` marker of that section.
// Fixtures: packages/engine/scenarios/index.ts, imported directly by Node (type stripping).
// Output: one French line per problem (exit 1), or `rules-trace: OK (N règles, M scénarios)`.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const withImages = process.argv.includes("--images");

const { scenarios } = await import(
  pathToFileURL(resolve(root, "packages/engine/scenarios/index.ts")).href
);

const problems = [];
const lines = readFileSync(resolve(root, "RULES.md"), "utf8").split(/\r?\n/);

const HEADING = /^### (R-\d{2})\s+\S/;
const SCENARIO_LINE = /^[-*]\s+(R-\d{2}\.\d+)\s+—/;
const ID = /^R-\d{2}\.\d+$/;

/** rule -> { hasRegle, hasCas, hasScenarios, ids: string[] } */
const rules = new Map();
let current = null;
let inScenarios = false;
for (const line of lines) {
  const heading = HEADING.exec(line);
  if (heading) {
    const rule = heading[1];
    if (rules.has(rule)) problems.push(`La règle ${rule} apparaît deux fois dans RULES.md.`);
    current = { hasRegle: false, hasCas: false, hasScenarios: false, ids: [] };
    rules.set(rule, current);
    inScenarios = false;
    continue;
  }
  if (/^#{1,3}\s/.test(line)) {
    // another heading (section break): the current rule block is over
    current = null;
    inScenarios = false;
    continue;
  }
  if (!current) continue;
  if (line.startsWith("**Règle**")) current.hasRegle = true;
  if (line.startsWith("**Cas limites**")) current.hasCas = true;
  if (line.startsWith("**Scénarios**")) {
    current.hasScenarios = true;
    inScenarios = true;
    continue;
  }
  if (inScenarios) {
    const m = SCENARIO_LINE.exec(line);
    if (m) current.ids.push(m[1]);
  }
}

// Structure of each rule section
for (const [rule, block] of rules) {
  if (!block.hasRegle) problems.push(`La règle ${rule} n’a pas de bloc « Règle ».`);
  if (!block.hasCas) problems.push(`La règle ${rule} n’a pas de bloc « Cas limites ».`);
  if (!block.hasScenarios) problems.push(`La règle ${rule} n’a pas de bloc « Scénarios ».`);
  if (block.ids.length === 0) problems.push(`La règle ${rule} ne liste aucun scénario.`);
}

// Duplicates in RULES.md
const seenInRules = new Map();
for (const [rule, block] of rules) {
  for (const id of block.ids) {
    if (!id.startsWith(`${rule}.`)) {
      problems.push(`Le scénario ${id} est listé sous la règle ${rule}, qui n’est pas la sienne.`);
    }
    if (seenInRules.has(id)) {
      problems.push(`Le scénario ${id} est listé deux fois dans RULES.md.`);
    }
    seenInRules.set(id, rule);
  }
}

// Fixtures
const fixtureById = new Map();
const fixturesByRule = new Map();
for (const s of scenarios) {
  if (!ID.test(s.id)) problems.push(`Le scénario « ${s.id} » n’a pas la forme R-NN.k.`);
  if (fixtureById.has(s.id))
    problems.push(`Le scénario ${s.id} est défini deux fois dans les fixtures.`);
  fixtureById.set(s.id, s);
  if (!s.id.startsWith(`${s.rule}.`)) {
    problems.push(
      `Le scénario ${s.id} déclare la règle ${s.rule}, qui ne correspond pas à son identifiant.`,
    );
  }
  if (!fixturesByRule.has(s.rule)) fixturesByRule.set(s.rule, []);
  fixturesByRule.get(s.rule).push(s.id);
}

for (const [rule, ids] of fixturesByRule) {
  if (!rules.has(rule)) {
    problems.push(`Les scénarios ${ids.join(", ")} citent la règle ${rule}, absente de RULES.md.`);
  }
}
for (const rule of rules.keys()) {
  if (!fixturesByRule.has(rule)) problems.push(`La règle ${rule} n’a aucune fixture de scénario.`);
}
for (const [id, s] of fixtureById) {
  const listedUnder = seenInRules.get(id);
  if (listedUnder === undefined) {
    if (rules.has(s.rule)) problems.push(`Le scénario ${id} n’est pas listé dans RULES.md.`);
  } else if (listedUnder !== s.rule) {
    problems.push(
      `Le scénario ${id} est listé sous ${listedUnder} dans RULES.md mais appartient à ${s.rule}.`,
    );
  }
}
for (const id of seenInRules.keys()) {
  if (!fixtureById.has(id)) problems.push(`Le scénario ${id} de RULES.md n’a pas de fixture.`);
}

if (withImages) {
  for (const id of fixtureById.keys()) {
    const file = resolve(root, "docs", "regles", `${id}.webp`);
    if (!existsSync(file)) problems.push(`L’image docs/regles/${id}.webp est absente.`);
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`rules-trace: OK (${rules.size} règles, ${fixtureById.size} scénarios)`);
