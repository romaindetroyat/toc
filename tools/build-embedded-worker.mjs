// Generates worker-embedded/manifest.js: every file of apps/web/dist imported as a module,
// so the Worker can serve the app without the static-assets upload (used by
// wrangler.embarque.jsonc, for environments where that upload is blocked).
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "apps/web/dist");
const out = join(root, "worker-embedded");

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(relative(dist, path));
  }
};
walk(dist);
files.sort();

const lines = files.map((f, i) => `import f${i} from "../apps/web/dist/${f}";`);
lines.push("export default {");
for (const [i, f] of files.entries()) lines.push(`  ${JSON.stringify(`/${f}`)}: f${i},`);
lines.push("};");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "manifest.js"), `${lines.join("\n")}\n`);
console.log(`${files.length} fichiers embarqués`);
