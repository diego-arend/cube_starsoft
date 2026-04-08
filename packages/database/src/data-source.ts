import { DataSource } from "typeorm";
import path from "path";
import { EnvSchema } from "@turborepo/config";
import dotenv from "dotenv";
import fs from "fs";

// The database package does not maintain its own .env.
// It always consumes apps/backend/.env as the single source of truth for
// database credentials. This ensures migrations and seeds use the same
// connection config as the backend application.
//
// Resolution order (first match wins):
//   1. packages/database/src/../../../apps/backend/.env  (ts-node from src/)
//   2. packages/database/dist/cli/../../../apps/backend/.env (compiled dist/cli/)
//   3. packages/database/dist/../../apps/backend/.env    (compiled dist/)
//   4. <cwd>/apps/backend/.env                           (invoked from workspace root)
//   5. <cwd>/../../apps/backend/.env                     (invoked from packages/database)
const _cjsDirname = (() => {
  try {
    return typeof __dirname !== "undefined" ? __dirname : null;
  } catch {
    return null;
  }
})();

const backendEnvCandidates = [
  _cjsDirname ? path.resolve(_cjsDirname, "../../../apps/backend/.env") : null,
  _cjsDirname
    ? path.resolve(_cjsDirname, "../../../../apps/backend/.env")
    : null,
  _cjsDirname ? path.resolve(_cjsDirname, "../../apps/backend/.env") : null,
  path.resolve(process.cwd(), "apps/backend/.env"),
  path.resolve(process.cwd(), "../../apps/backend/.env"),
].filter((p): p is string => p !== null);

const resolvedBackendEnv = backendEnvCandidates.find((p) => fs.existsSync(p));
if (resolvedBackendEnv) {
  dotenv.config({ path: resolvedBackendEnv });
}

// Use the typed env accessor. Note: lint may not infer the cross-package
// types correctly; we keep a local typed reference and disable the specific
// unsafe assignment rule here to reduce noise.
import { fileURLToPath } from "url";

// Resolve a cross-runtime __dirname that works both with CommonJS (where
// __dirname exists) and ESM (where import.meta.url is available). This is
// necessary because the TypeORM CLI may load the data-source in either
// environment and `__dirname` may be undefined in ESM.
const moduleDir = (() => {
  // Prefer CommonJS `__dirname` when available.
  try {
    if (typeof __dirname !== "undefined") return __dirname;
  } catch {
    void 0;
  }

  // If we don't have __dirname, try dynamic import.meta.url
  // Using a constructor reference to bypass static analysis of both lint and TS.
  try {
    const Fn = Function;
    const metaUrl = new Fn("return import.meta.url")() as string;

    return path.dirname(fileURLToPath(metaUrl));
  } catch {
    // Fallback to the current working directory if neither method works.
    return process.cwd();
  }
})();

const cfg = EnvSchema.partial().parse(process.env);

// Resolve migrations directory robustly for both development and production.
//
// In development (ts-node from src/):
//   moduleDir = /app/packages/database/src
//   → migrations at src/migrations/
//
// In production (tsup-compiled dist/cli/run-migrations.js):
//   moduleDir = /app/packages/database/dist/cli
//   → navigate up to dist/ root → migrations at dist/migrations/
//
// In production (tsup-compiled dist/index.js):
//   moduleDir = /app/packages/database/dist
//   → migrations at dist/migrations/
const migrationsDir = (() => {
  const parts = moduleDir.split(path.sep);
  const distIdx = parts.lastIndexOf("dist");
  if (distIdx !== -1) {
    // Inside a compiled dist/ tree — always resolve migrations from dist root.
    const distRoot = parts.slice(0, distIdx + 1).join(path.sep);
    return path.join(distRoot, "migrations");
  }
  // Development: migrations live alongside the source files.
  return path.join(moduleDir, "migrations");
})();

// Restrict the glob to a single format to avoid TypeORM loading both CJS (.js)
// and ESM (.mjs) outputs simultaneously and raising "Duplicate migrations".
// In development ts-node resolves .ts; in production tsup emits CJS as .js.
const isCompiled = moduleDir.includes(`${path.sep}dist`);
const migrationGlob = isCompiled
  ? path.join(migrationsDir, "*.js")
  : path.join(migrationsDir, "*.ts");

export const AppDataSource = new DataSource({
  type: "postgres",
  host: cfg.DATABASE_HOST ?? "localhost",
  port: cfg.DATABASE_PORT ?? 5432,
  username: cfg.DATABASE_USER ?? "postgres",
  password: cfg.DATABASE_PASSWORD ?? "password",
  database: cfg.DATABASE_NAME ?? "turborepo_crew_agents",
  migrations: [migrationGlob],
  entities: [
    path.join(moduleDir, "./entities/*{.ts,.js}"),
    path.join(__dirname, "../dist/entities/*{.js}"),
  ],
  // Ensure migrations/synchronize behavior is controlled by the typed env so
  // runtime does not accidentally change schema in production; prefer CI/CD
  // migration scripts for controlled schema changes.
  // Enforced to `false` to prevent any schema changes at startup.
  migrationsRun: false,
  synchronize: false,
  // Don't allow TypeORM to install postgres extensions automatically on
  // application startup. Installing extensions requires superuser-like
  // privileges and should be part of controlled migrations or DB setup.
  installExtensions: false,
});
