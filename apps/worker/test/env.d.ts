// The binding the workerd tests add (vitest.config.ts): the migrations of the D1 database of finished
// games (DB, declared by worker-configuration.d.ts), applied by test/apply-migrations.ts before each test file.

declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
