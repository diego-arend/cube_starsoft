import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  outDir: "dist",
  external: ["@turborepo/config", "@nestjs/common", "ioredis"],
  clean: true,
  sourcemap: true,
});
