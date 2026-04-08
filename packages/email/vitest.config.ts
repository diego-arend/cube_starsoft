import rootConfig from "../../vitest.config";

export default {
  ...rootConfig,
  assetsInclude: ["**/*.hbs"],
  test: {
    ...rootConfig.test,
    include: ["src/test/unit/**/*.spec.ts", "src/test/*.spec.ts"],
  },
};
