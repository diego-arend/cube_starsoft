// @ts-check
import tseslint from "typescript-eslint";
import { nestConfig } from "@repo/eslint-config/nest";

export default tseslint.config(
  {
    ignores: ["eslint.config.mjs"],
  },
  ...nestConfig,
  {
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  }
);
