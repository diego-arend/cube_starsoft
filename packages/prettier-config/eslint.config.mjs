// @ts-check
import tseslint from "typescript-eslint";
import { config as baseConfig } from "@repo/eslint-config/base";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
    languageOptions: {
      globals: {
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
  },
  ...baseConfig
);
