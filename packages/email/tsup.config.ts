import { defineConfig } from "tsup";

export default defineConfig({
  // Include template files so they are copied into `dist/templates` during build
  // Explicitly avoid picking up stray .js or .js.map files in src
  entry: ["src/index.ts", "src/templates/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  external: ["@turborepo/config", "@nestjs/common", "nodemailer", "handlebars"],
  clean: true,
  outDir: "dist",
  sourcemap: true,
  esbuildOptions(options) {
    options.loader = {
      ...(options.loader ?? {}),
      ".hbs": "text",
    };
  },
});
