// @ts-check
import tseslint from "typescript-eslint";
import { nestConfig } from "@repo/eslint-config/nest";

export default tseslint.config(
  {
    ignores: ["dist/**", "eslint.config.mjs", "tsup.config.*.mjs"],
  },
  // Disable the project service globally so TypeScript parsing doesn't fail
  // for config files or other artifacts; enable it only for source/test
  // files below.
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
  // Apply the TypeScript project only to source and test files via a
  // separate file-scoped config entry (flat config `files`), avoiding the
  // use of `overrides` which is not supported by the flat config loader.
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
