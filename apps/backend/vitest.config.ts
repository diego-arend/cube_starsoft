import path from "path";
import rootConfig from "../../vitest.config";

export default {
  ...rootConfig,
  test: {
    ...rootConfig.test,
    include: ["src/**/*.spec.ts"],
    setupFiles: ["./src/test/setup.ts"],
    pool: "forks",
    testTimeout: 30000,
    hookTimeout: 30000,
  },
};
