import { initObservability } from "@turborepo/observability";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Minimal environment loading just for tracing configuration
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const serviceName =
  process.env.WORKER_OTEL_SERVICE_NAME ??
  process.env.OTEL_SERVICE_NAME ??
  "backend-worker-notification";

// Force the correct service name in the environment for OTel resource detection
process.env.OTEL_SERVICE_NAME = serviceName;

// Map only necessary OTel configuration before the full environment is validated
initObservability({
  OTEL_ENABLED:
    process.env.WORKER_OTEL_ENABLED === "true" ||
    process.env.OTEL_ENABLED === "true"
      ? "true"
      : "false",
  OTEL_SERVICE_NAME: serviceName,
  OTEL_SERVICE_NAMESPACE: process.env.OTEL_SERVICE_NAMESPACE,
  OTEL_SERVICE_VERSION: process.env.OTEL_SERVICE_VERSION,
  OTEL_METRIC_EXPORT_INTERVAL: process.env.OTEL_METRIC_EXPORT_INTERVAL
    ? Number(process.env.OTEL_METRIC_EXPORT_INTERVAL)
    : undefined,
  OTEL_EXPORTER_OTLP_HEADERS: process.env.OTEL_EXPORTER_OTLP_HEADERS,
  OTEL_EXPORTER_OTLP_ENDPOINT:
    process.env.WORKER_OTEL_EXPORTER_OTLP_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  OTEL_EXPORTER_OTLP_PROTOCOL:
    process.env.WORKER_OTEL_EXPORTER_OTLP_PROTOCOL ??
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL,
  LOG_EXPORTER_ENABLED:
    process.env.LOG_EXPORTER_ENABLED === "true" ? "true" : "false",
  NODE_ENV: process.env.NODE_ENV as "development" | "production" | "test",
});
