// The bindings the workerd tests add (vitest.config.ts): the D1 database of finished games, named DB
// as in plan 02-10, and its migrations, applied by test/apply-migrations.ts before each test file.

declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
