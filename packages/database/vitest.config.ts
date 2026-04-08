import { defineConfig, type UserConfig } from "vitest/config";
import rootConfig from "../../vitest.config";

export default defineConfig({
  // Use a type cast to ensure we're spreading a plain object, not a potential Promise
  ...(rootConfig as UserConfig),
  test: {
    ...(rootConfig as UserConfig).test,
    include: ["src/test/unit/**/*.spec.ts", "src/test/*.spec.ts"],
    setupFiles: ["./src/test/setup.ts"],
    // Increase timeout to tolerate TypeORM/NestJS module initialisation under
    // high I/O load during concurrent `test:all` runs.
    // pool:forks ensures open handles (pino SonicBoom, OTel gRPC) are killed
    // when the child process exits, preventing intermittent timeout failures.
    pool: "forks",
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
