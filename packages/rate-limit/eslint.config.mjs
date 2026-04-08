// @ts-check
import tseslint from "typescript-eslint";
import { nestConfig } from "@repo/eslint-config/nest";

export default tseslint.config(
  {
    ignores: ["dist/**", "eslint.config.mjs"],
  },
  ...nestConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
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
  },
  {
    rules: {},
  }
);
