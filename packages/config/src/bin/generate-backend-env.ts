#!/usr/bin/env node
import { generateNodeEnv } from "./lib/generate-node-env";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultOutputPath = path.resolve(
  __dirname,
  "../../../../apps/backend/.env"
);

const outputPath = process.argv[2] || defaultOutputPath;

try {
  generateNodeEnv({
    outputPath,
    override: true,
    appName: "Backend",
    serviceType: "BACKEND",
  });
} catch (error) {
  console.error("❌ Failed to generate backend .env file:");
  console.error(error);
  process.exit(1);
}
