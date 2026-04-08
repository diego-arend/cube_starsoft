// @ts-check
import tseslint from "typescript-eslint";
import { config as baseConfig } from "@repo/eslint-config/base";
import { config as reactInternalConfig } from "@repo/eslint-config/react-internal";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  ...baseConfig,
  ...reactInternalConfig
);
