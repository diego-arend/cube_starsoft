import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  clean: true,
  dts: true,
  format: ["cjs", "esm"],
  outDir: "dist",
  sourcemap: true,
  // Treat all workspace packages as external so the DTS worker does not
  // attempt to resolve/inline their declarations.
  external: [/^@turborepo\/.*/, /^@repo\/.*/],
});
