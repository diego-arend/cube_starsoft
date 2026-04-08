import { EnvSchema, type Env } from "@turborepo/config";
export type { Env };
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { ConfigModule } from "@nestjs/config";
import type { DynamicModule } from "@nestjs/common";

/**
 * Local environment loader for the Backend application.
 * This loads the local .env file (generated or manual) and validates it against the shared schema.
 */

// Load .env from the current directory if it exists
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Map process.env to the schema
const result = EnvSchema.partial().safeParse(process.env);

if (!result.success) {
  console.error("❌ Invalid environment configuration for Backend:");
  console.error(JSON.stringify(result.error.format(), null, 2));
  process.exit(1);
}

export const typedEnv: Env = result.data as Env;

export function createNestConfigModule():
  | DynamicModule
  | Promise<DynamicModule> {
  return ConfigModule.forRoot({
    isGlobal: true,
    load: [() => ({ ...typedEnv }) as Record<string, unknown>],
  });
}
