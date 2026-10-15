import { defineConfig } from "vitest/config";

export default defineConfig({
  // Same compile-time switch as apps/web/vite.config.ts: modules that import debug.ts load in Node.
  define: { __TOC_DEBUG__: false },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/web/src/**/*.test.ts", "tools/**/*.test.ts"],
  },
});
