#!/usr/bin/env node
import { generateFrontendEnv } from "./lib/generate-frontend-env";
import path from "path";
import { fileURLToPath } from "url";

// Usage: generate-env [output-path]
// Default output path is apps/frontend/.env relative to workspace root

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// If running from src/bin/generate-env.ts (via tsx):
// __dirname is packages/config/src/bin
// apps/frontend/.env is ../../../../apps/frontend/.env
const defaultOutputPath = path.resolve(
  __dirname,
  "../../../../apps/frontend/.env"
);

const outputPath = process.argv[2] || defaultOutputPath;

try {
  generateFrontendEnv({
    outputPath,
    override: true,
  });
} catch (error) {
  console.error("❌ Failed to generate frontend .env file:");
  console.error(error);
  process.exit(1);
}
