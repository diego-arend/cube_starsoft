import rootConfig from "../../vitest.config";

export default {
  ...rootConfig,
  test: {
    ...rootConfig.test,
    environment: "jsdom",
    include: ["src/**/*.spec.{ts,tsx}"],
  },
};
