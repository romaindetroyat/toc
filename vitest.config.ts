import { defineConfig } from "vitest/config";

// Two projects: « node » (the engine, the bots, the board, the protocol, the table core, the web logic
// and the tools) and « worker » (the GameRoom Durable Object inside workerd, apps/worker/vitest.config.ts).
export default defineConfig({
  test: {
    projects: [
      {
        // Same compile-time switch as apps/web/vite.config.ts: modules that import debug.ts load in Node.
        define: { __TOC_DEBUG__: false },
        test: {
          name: "node",
          environment: "node",
          include: ["packages/**/*.test.ts", "apps/web/src/**/*.test.ts", "tools/**/*.test.ts"],
        },
      },
      "apps/worker/vitest.config.ts",
    ],
  },
});
