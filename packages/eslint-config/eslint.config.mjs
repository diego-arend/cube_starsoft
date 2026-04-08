// @ts-check
import tseslint from "typescript-eslint";
import { config as baseConfig } from "./base.js";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  ...baseConfig
);
