import { defineConfig } from "vitest/config";

export default defineConfig({
  assetsInclude: ["**/*.hbs"],
  test: {
    environment: "node",
    globals: true,
    passWithNoTests: true,
    // Each test FILE runs in its own child process (fork). When the process
    // exits, the OS kills all open handles (e.g. pino SonicBoom setImmediate
    // queues, OTel gRPC channels) unconditionally, preventing the intermittent
    // 5 s testTimeout failures that occurred with the default thread pool.
    pool: "forks",
    testTimeout: 30000,
    hookTimeout: 30000,
    include: [
      "packages/**/src/test/**/*.spec.{ts,tsx}",
      "packages/**/src/test/*.spec.{ts,tsx}",
      "packages/**/src/**/*.spec.{ts,tsx}",
      "apps/**/src/test/**/*.spec.{ts,tsx}",
      "apps/**/src/test/*.spec.{ts,tsx}",
      "apps/**/src/**/*.spec.{ts,tsx}"
    ],
    server: { deps: { inline: ["@turborepo/*"] } },
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcov", "json"],
      reportsDirectory: "./coverage",
      // @ts-ignore - 'all' is supported at runtime but missing from types in this version
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/test/**",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/*.d.ts"
      ]
    }
  }
});
