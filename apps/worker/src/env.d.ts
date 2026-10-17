// The D1 database of finished games (plan 02-09, D-14), optional: it exists only once the database
// is created and bound as DB in both wrangler configs (plan 02-10). Until then `wrangler types` does
// not list it, and the Durable Object writes nothing (src/record.ts answers "skipped").
// When plan 02-10 adds the d1_databases block and regenerates worker-configuration.d.ts (which then
// declares DB: D1Database), delete this file: an optional DB here would clash with the generated one.

interface Env {
  DB?: D1Database;
}
