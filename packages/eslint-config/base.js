import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import onlyWarn from "eslint-plugin-only-warn";
import importX from "eslint-plugin-import-x";

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
      import: importX,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
      "import/no-default-export": "error",
    },
  },
  {
    // Allow default exports in configuration files
    files: [
      "**/*.config.{js,mjs,ts,cjs}",
      "**/*.config.*",
      "**/eslint.config.*",
      "**/tsup.config.*",
      "**/vitest.config.*",
      "**/vitest.setup.*",
      "packages/eslint-config/*.js",
      "packages/prettier-config/*.js",
      "base.js",
      "nest.js",
      "next.js",
      "react-internal.js",
      "index.js",
      "**/proxy.ts",
      "**/*.d.ts",
      "**/*.d.mts",
      "**/*.d.cts",
    ],
    rules: {
      "import/no-default-export": "off",
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    // Globally ignore build outputs and coverage html artifacts (lcov report)
    ignores: [
      "dist/**",
      "coverage/**",
      "**/coverage/**",
      "**/coverage/**/lcov-report/**",
    ],
  },
];
export default config;
