import path from "path";
import { spawnSync } from "child_process";
import fs from "fs";

export function runGenerateMigration(
  migrationName: string,
  spawnExec?: typeof spawnSync
) {
  const executor = spawnExec ?? spawnSync;
  if (!migrationName) {
    throw new Error("Usage: pnpm run migrate:generate <Name>");
  }

  const sanitized = migrationName.replace(/\s+/g, "_");
  // Resolve path to the TypeORM CLI `cli.js` script. Running it via Node with
  // `ts-node/register` ensures TypeScript DataSource files load properly.
  const nodeExec = process.execPath;
  let cliScriptPath: string | null = null;
  try {
    cliScriptPath = require.resolve("typeorm/cli.js", {
      paths: [path.resolve(__dirname, "../../node_modules")],
    });
  } catch {
    try {
      cliScriptPath = require.resolve("typeorm/cli.js", {
        paths: [path.resolve(__dirname, "../../../node_modules")],
      });
    } catch {
      cliScriptPath = null;
    }
  }
  console.log(`Generating migration: ${sanitized}`);

  // TypeORM v0.3+ expects a destination *path* (not just a name). Provide a
  // concrete path under ../migrations so the output location is deterministic.
  const destPath = path.resolve(__dirname, `../migrations/${sanitized}`);
  if (cliScriptPath) {
    executor(
      nodeExec,
      [
        "-r",
        "ts-node/register",
        "-r",
        "tsconfig-paths/register",
        cliScriptPath,
        "migration:generate",
        destPath,
        "-d",
        path.resolve(__dirname, "../data-source.ts"),
      ],
      { stdio: "inherit" }
    );
  } else {
    const candidateBin = path.resolve(
      __dirname,
      "../../node_modules/.bin/typeorm"
    );
    const candidateBinWorkspace = path.resolve(
      __dirname,
      "../../../node_modules/.bin/typeorm"
    );
    const bin = fs.existsSync(candidateBin)
      ? candidateBin
      : candidateBinWorkspace;
    executor(
      bin,
      [
        "migration:generate",
        destPath,
        "-d",
        path.resolve(__dirname, "../data-source.ts"),
      ],
      { stdio: "inherit" }
    );
  }
}

if (typeof require !== "undefined" && require.main === module) {
  // Remove flags passed by pnpm (e.g. --silent) and only treat non-flag
  // args as the migration name. This keeps the script tolerant of pnpm
  // behavior and ensures migrations use the intended name.
  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  if (args.length === 0) {
    console.error("Usage: pnpm run migrate:generate <Name>");
    process.exit(1);
  }
  const name = args.join(" ");
  runGenerateMigration(name);
}
