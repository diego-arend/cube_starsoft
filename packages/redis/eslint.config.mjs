// @ts-check
import tseslint from "typescript-eslint";
import { nestConfig } from "@repo/eslint-config/nest";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
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
  }
);
