import type { Env } from "./schema";
export { EnvSchema } from "./schema";

/**
 * Browser-safe entry point for @turborepo/config.
 * Does NOT import or use 'fs' or 'yaml'.
 *
 * In the browser (Next.js), it relies on process.env being populated
 * with NEXT_PUBLIC_ variables at build time.
 */

// We map the NEXT_PUBLIC_ variables to the standard Env keys
// so that code can use env.API_URL consistently across environments.
export const env = {
  get NODE_ENV() {
    return process.env.NODE_ENV || "development";
  },
  get OTEL_ENABLED() {
    return process.env.NEXT_PUBLIC_OTEL_ENABLED === "true";
  },
  get OTEL_EXPORTER_OTLP_ENDPOINT() {
    return process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT;
  },
  get API_URL() {
    return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
  },
  get FRONTEND_AUTH_SECRET() {
    return (
      process.env.FRONTEND_AUTH_SECRET ||
      process.env.AUTH_SECRET ||
      process.env.NEXTAUTH_SECRET
    );
  },
  get AUTH_TRUST_HOST() {
    return process.env.AUTH_TRUST_HOST === "true";
  },

  // Add these for compatibility with code expecting NEXT_PUBLIC_ prefix
  get NEXT_PUBLIC_OTEL_ENABLED() {
    return process.env.NEXT_PUBLIC_OTEL_ENABLED === "true";
  },
  get NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT() {
    return process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT;
  },
  get NEXT_PUBLIC_API_URL() {
    return process.env.NEXT_PUBLIC_API_URL;
  },
  get NEXT_PUBLIC_SOCKET_URL() {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  },
  get OTEL_INGESTION_BEARER_TOKEN() {
    return (
      process.env.OTEL_INGESTION_BEARER_TOKEN ||
      process.env.NEXT_PUBLIC_OTEL_INGESTION_BEARER_TOKEN
    );
  },
  get NEXT_PUBLIC_OTEL_INGESTION_BEARER_TOKEN() {
    return process.env.NEXT_PUBLIC_OTEL_INGESTION_BEARER_TOKEN;
  },
} as unknown as Env;

export type { Env } from "./schema";

// Placeholder for NestJS logic that cannot run in the browser
export function createNestConfigModule(): unknown {
  throw new Error(
    "createNestConfigModule is only available in the Node.js entry point (import from @turborepo/config/node)"
  );
}

export function createNestConfigLoad(): unknown {
  throw new Error(
    "createNestConfigLoad is only available in the Node.js entry point (import from @turborepo/config/node)"
  );
}
