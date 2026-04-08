import { defineConfig } from "tsup";

export default defineConfig([
  // library bundle: emit both CJS and ESM for consumers
  {
    entry: ["src/index.ts", "src/load.ts", "src/node.ts", "src/schema.ts"],
    // Emit type declarations: enable tsup dts; we've made the code DTS-friendly
    dts: true,
    format: ["cjs", "esm"],
    outDir: "dist",
    external: [],
    sourcemap: true,
    clean: true, // clean once for the main bundle
    splitting: false,
    minify: false,
  },
  // CLI bundle: ESM only (uses import.meta and must not be emitted as CJS)
  {
    entry: ["src/cli/validate-config.ts"],
    dts: false,
    format: ["esm"],
    outDir: "dist/cli",
    external: [],
    sourcemap: true,
    clean: false,
    splitting: false,
    minify: false,
  },
  {
    entry: ["src/bin/generate-env.ts"],
    dts: false,
    format: ["esm"],
    outDir: "dist/bin",
    external: [],
    bundle: true,
    platform: "node",
    sourcemap: true,
    clean: false,
    splitting: false,
    minify: false,
  },
]);
