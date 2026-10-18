import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// The GameRoom Durable Object and the router, inside workerd with real SQLite and hibernatable sockets
// (@cloudflare/vitest-plugin, the successor of @cloudflare/vitest-pool-workers). The deploy config is
// the real one; TOC_TEST_MODE is set here only, never in a wrangler file.
// Plan 02-09: a local D1 database bound as DB (the deploy configs have none until plan 02-10), with
// the migrations of ./migrations applied before each test file (test/apply-migrations.ts); 04-01 adds
// 0002, the accounts.
const migrations = await readD1Migrations(fileURLToPath(new URL("./migrations", import.meta.url)));

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "../../wrangler.jsonc" },
      miniflare: {
        // Plan 04-01: fixed TEST-ONLY values of the two account secrets (the production ones exist
        // only as Worker secrets). The bootstrap code has the shape of an invitation code.
        bindings: {
          TOC_TEST_MODE: "1",
          TEST_MIGRATIONS: migrations,
          TOC_PEPPER: "workerd-test-only-pepper-not-a-secret",
          TOC_BOOTSTRAP: "WorkerdTestBootstrap00",
        },
        d1Databases: { DB: "toc-games-test" },
      },
    }),
  ],
  test: {
    name: "worker",
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
