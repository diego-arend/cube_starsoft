import { EnvSchema } from "./schema";
export { EnvSchema } from "./schema";
import type { DynamicModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

/**
 * Node.js specific entry point.
 * This file is for server-side use only and supports NestJS integration.
 */

export type { Env } from "./schema";

/**
 * Returns a function that parses process.env against EnvSchema.
 * Useful for NestJS ConfigModule 'load' property.
 */
export function createNestConfigLoad() {
  return () => EnvSchema.parse(process.env);
}

/**
 * Returns a `ConfigModule` configured with the parsed `env` from this package.
 */
export function createNestConfigModule():
  | DynamicModule
  | Promise<DynamicModule> {
  return ConfigModule.forRoot({
    isGlobal: true,
    load: [createNestConfigLoad()],
  });
}
