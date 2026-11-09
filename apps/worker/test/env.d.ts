// The binding the workerd tests add (vitest.config.ts): the migrations of the D1 database of finished
// games (DB, declared by worker-configuration.d.ts), applied by test/apply-migrations.ts before each test file.

declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
    /** Plan 04-01: the two account secrets, with fixed test-only values (vitest.config.ts). */
    TOC_PEPPER?: string;
    TOC_BOOTSTRAP?: string;
    /** Plan 04-07: a test-only VAPID pair, generated when vitest.config.ts loads. */
    VAPID_PRIVATE_KEY?: string;
  }
}
