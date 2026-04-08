import rootConfig from "../../vitest.config";

export default {
  ...rootConfig,
  test: {
    ...rootConfig.test,
    include: ["src/test/**/*.spec.ts", "src/test/**/*.spec.tsx"],
  },
};
