// Checks the output of `wrangler deploy --dry-run --outdir <dir> -c wrangler.embarque.jsonc`
// (02-RESEARCH Pitfall 9, T-02-10): in the embedded variant, the module rules decide which imported
// files become separate modules (Text, Data) instead of being bundled into the entry. Only files of
// the web build (apps/web/dist) may be separate modules; a server dependency (zod, @toc/*) caught by a
// glob would be shipped as a string and break at run time.
//
//   node tools/check-bundle.mjs <outdir> [--dist <web build dir>]
//
// Wrangler writes each separate module as `<sha1 of its content>-<file name>` next to `index.js`. A
// module passes when its content hash matches a file of the web build with the same name. The entry
// must import only those modules and `cloudflare:` built-ins (everything else inlined) and must define
// both Durable Object classes, GameRoom and PlayerHub (plan 04-03, 04-RESEARCH Pitfall 11), one message
// per missing class. Exit 0 when all of that holds; exit 1 listing the offending paths otherwise.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);

/** Every file under `dir`, as absolute paths. */
function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const sha1 = (path) => createHash("sha1").update(readFileSync(path)).digest("hex");

/**
 * The Durable Object classes both configs declare: GameRoom (migration v1) and PlayerHub (v2, plan
 * 04-03). A bundle missing one would deploy a migration or a binding for a class it does not export.
 */
const DURABLE_OBJECTS = ["GameRoom", "PlayerHub"];

/** Files of the dry-run output that are not modules: the entry, its source map, wrangler's note. */
const NOT_MODULES = new Set(["index.js", "index.js.map", "README.md"]);

/**
 * The problems of a dry-run output directory, as readable lines (empty when it passes).
 * `dist` is the web build the separate modules must come from.
 */
export function bundleProblems(outdir, dist) {
  const problems = [];
  if (!existsSync(join(outdir, "index.js")))
    return [`${outdir}: no index.js (not a dry-run output)`];
  if (!existsSync(dist)) return [`${dist}: no web build`];

  const shown = dist.startsWith(`${ROOT}/`) ? relative(ROOT, dist) : dist;

  // The web build by content: sha1 → file names.
  const web = new Map();
  for (const path of filesUnder(dist)) {
    const hash = sha1(path);
    web.set(hash, [...(web.get(hash) ?? []), basename(path)]);
  }

  const modules = new Set();
  for (const path of filesUnder(outdir)) {
    const name = relative(outdir, path);
    if (NOT_MODULES.has(name)) continue;
    modules.add(name);
    const match = /^([0-9a-f]{40})-(.+)$/.exec(name);
    const hash = sha1(path);
    if (match === null || match[1] !== hash) {
      problems.push(`${name}: not a module written by wrangler (name is not <sha1>-<file>)`);
      continue;
    }
    const fromWeb = web.get(hash)?.includes(match[2]) ?? false;
    if (!fromWeb) {
      const kind = name.endsWith(".js") ? "a script" : "a file";
      problems.push(`${name}: ${kind} outside ${shown} became a separate module`);
    }
  }

  const entry = readFileSync(join(outdir, "index.js"), "utf8");
  const specifiers = [...entry.matchAll(/^\s*import\s[^;]*?\sfrom\s+"([^"]+)"/gm)].map((m) => m[1]);
  for (const specifier of specifiers) {
    if (specifier.startsWith("cloudflare:")) continue;
    const local = specifier.startsWith("./") ? specifier.slice(2) : null;
    if (local === null || !modules.has(local)) {
      problems.push(`index.js imports ${specifier}: everything but the web build must be inlined`);
    }
  }
  // esbuild writes a class as `var GameRoom = class extends DurableObject` (or keeps `class X`), and
  // renames the base of the second module importing it: `class extends DurableObject2`.
  for (const name of DURABLE_OBJECTS) {
    const defined = new RegExp(
      `\\b(?:class\\s+${name}|${name}\\s*=\\s*class)\\s+extends\\s+DurableObject\\d*\\b`,
    );
    if (!defined.test(entry)) problems.push(`index.js does not define the ${name} class`);
  }
  return problems;
}

function main(argv) {
  const args = argv.slice(2);
  const at = args.indexOf("--dist");
  const dist = resolve(at === -1 ? join(ROOT, "apps/web/dist") : (args[at + 1] ?? ""));
  const outdir = args.find((arg, i) => !arg.startsWith("--") && (at === -1 || i !== at + 1));
  if (outdir === undefined) {
    console.error("usage: node tools/check-bundle.mjs <outdir> [--dist <web build dir>]");
    return 2;
  }
  const problems = bundleProblems(resolve(outdir), dist);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    return 1;
  }
  const count = filesUnder(resolve(outdir)).filter(
    (path) => !NOT_MODULES.has(relative(resolve(outdir), path)),
  ).length;
  console.log(`bundle OK: ${count} separate modules, all from the web build; the rest is inlined`);
  return 0;
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exit(main(process.argv));
}
