import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: { NODE_ENV: "test" },
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
  },
});
