// @ts-check
import tseslint from "typescript-eslint";
import { nestConfig } from "@repo/eslint-config/nest";

export default tseslint.config(
  {
    ignores: ["dist/**", "eslint.config.mjs"],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
  },
  ...nestConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "turbo/no-undeclared-env-vars": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "src/**/*.spec.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
