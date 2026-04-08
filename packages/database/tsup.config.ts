import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/client.ts",
    "src/test/mock-factory.ts",
    // CLI scripts compiled to JS so they can run with plain `node` in production
    // (no ts-node or TypeScript source needed in the container)
    "src/cli/run-migrations.ts",
    "src/cli/seed-admin.ts",
    "src/cli/seed-users.ts",
    // Migration files compiled to dist/migrations/ so the production CLI runner
    // (dist/cli/run-migrations.cjs) can discover them via TypeORM's glob.
    "src/migrations/*.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  external: ["@nestjs/*", "typeorm", "pg", "reflect-metadata"],
  splitting: false,
});
