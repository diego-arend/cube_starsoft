import rootConfig from "../../vitest.config";

export default {
  ...rootConfig,
  test: {
    ...rootConfig.test,
    include: ["src/**/*.spec.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
};
