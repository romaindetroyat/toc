import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// The GameRoom Durable Object and the router, inside workerd with real SQLite and hibernatable sockets
// (@cloudflare/vitest-plugin, the successor of @cloudflare/vitest-pool-workers). The deploy config is
// the real one; TOC_TEST_MODE is set here only, never in a wrangler file.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "../../wrangler.jsonc" },
      miniflare: { bindings: { TOC_TEST_MODE: "1" } },
    }),
  ],
  test: {
    name: "worker",
    include: ["test/**/*.test.ts"],
  },
});
