import rootConfig from "../../vitest.config";

export default {
  ...rootConfig,
  test: {
    ...rootConfig.test,
    include: ["src/test/**/*.spec.ts"],
    setupFiles: ["./src/test/setup.ts"],
  },
};
