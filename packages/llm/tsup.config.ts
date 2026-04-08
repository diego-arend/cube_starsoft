import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // Treat all workspace packages as external so the DTS worker does not
  // attempt to resolve/inline their declarations (which requires their
  // dist/ to be present in the same Turbo run).
  external: [/^@turborepo\/.*/, /^@repo\/.*/],
});
