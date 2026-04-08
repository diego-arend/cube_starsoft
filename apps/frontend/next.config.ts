import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { loadConfig } from "@turborepo/config/load";

const configAll = loadConfig();
const { NODE_ENV: _NODE_ENV, ...configEnv } = configAll;
void _NODE_ENV;

// Inject config into process.env so that EnvSchema.parse(process.env) works
// when imported by application code during build.
for (const [key, value] of Object.entries(configEnv)) {
  if (process.env[key] === undefined) {
    process.env[key] = String(value);
  }
}

const stringifiedConfigEnv = Object.entries(configEnv).reduce(
  (acc, [key, value]) => {
    if (value !== undefined && value !== null) {
      acc[key] = String(value);
    }
    return acc;
  },
  {} as Record<string, string>
);

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  transpilePackages: [
    "@opentelemetry/sdk-trace-base",
    "@opentelemetry/sdk-trace-web",
  ],
  serverExternalPackages: [
    "pino",
    "pino-pretty",
    "@turborepo/logging",
    "@turborepo/observability",
    "@opentelemetry/api",
    "@opentelemetry/api-logs",
    "@opentelemetry/resources",
    "@opentelemetry/sdk-node",
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/sdk-metrics",
    "@opentelemetry/sdk-logs",
    "@opentelemetry/instrumentation",
    "@opentelemetry/core",
    "@opentelemetry/semantic-conventions",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/exporter-trace-otlp-grpc",
    "@opentelemetry/exporter-metrics-otlp-http",
    "@opentelemetry/exporter-metrics-otlp-grpc",
    "@opentelemetry/exporter-logs-otlp-http",
    "@opentelemetry/exporter-logs-otlp-grpc",
    "@opentelemetry/auto-instrumentations-node",
    "@opentelemetry/instrumentation-http",
    "@opentelemetry/instrumentation-grpc",
    "@opentelemetry/instrumentation-undici",
    "@opentelemetry/instrumentation-pg",
    "@opentelemetry/instrumentation-ioredis",
    "@opentelemetry/instrumentation-pino",
    "@opentelemetry/instrumentation-nestjs-core",
    "@opentelemetry/instrumentation-aws-sdk",
    "@vercel/otel",
    "import-in-the-middle",
    "require-in-the-middle",
  ],
  // Set turbopack.root to the monorepo root to avoid Next.js root inference
  // warnings when running under a workspace with multiple lockfiles. Use an
  // absolute path as Next.js prefers that.
  turbopack: {
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../"),
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        tls: false,
        net: false,
        child_process: false,
        crypto: false,
      };
      config.resolve.alias = {
        ...config.resolve.alias,
        "@turborepo/logging": false,
        pino: false,
        "thread-stream": false,
      };
    }
    return config;
  },
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
    ...stringifiedConfigEnv,
  },

  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
