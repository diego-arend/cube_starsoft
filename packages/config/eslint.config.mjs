// @ts-check
import tseslint from "typescript-eslint";
import { config as baseConfig } from "@repo/eslint-config/base";

export default tseslint.config(
  {
    ignores: ["dist/**", "eslint.config.mjs"],
  },
  ...baseConfig
);
