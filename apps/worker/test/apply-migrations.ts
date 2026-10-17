// Before each test file: the D1 migrations of apps/worker/migrations on the tests' DB (miniflare's
// D1, plan 02-09). applyD1Migrations records what it applied, so running it again does nothing.

import { applyD1Migrations, env } from "cloudflare:test";

if (env.DB === undefined) throw new Error("the tests' DB binding is missing (vitest.config.ts)");
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
