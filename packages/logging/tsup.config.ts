import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  sourcemap: true,
  external: [
    "@nestjs/common",
    "next/server",
    "@opentelemetry/sdk-node",
    "@opentelemetry/resources",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/exporter-metrics-otlp-http",
    "@opentelemetry/instrumentation-pino",
  ],
});
