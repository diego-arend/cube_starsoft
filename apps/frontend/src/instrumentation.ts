export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PUBLIC_OTEL_ENABLED === "true"
  ) {
    const { initObservability } = await import("@turborepo/observability");

    const serviceName =
      process.env.FRONTEND_OTEL_SERVICE_NAME ||
      process.env.OTEL_SERVICE_NAME ||
      process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME ||
      "frontend-server";

    // FRONTEND_OTEL_EXPORTER_OTLP_ENDPOINT must always point to the OTLP/HTTP port (4318).
    // Fallback chain: frontend-specific → http-specific → generic (may be gRPC port) → default HTTP
    const endpoint =
      process.env.FRONTEND_OTEL_EXPORTER_OTLP_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_HTTP_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      "http://localhost:4318";

    initObservability({
      OTEL_ENABLED: "true",
      OTEL_SERVICE_NAME: serviceName,
      OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
      // FRONTEND_OTEL_EXPORTER_OTLP_PROTOCOL takes priority over the global
      // OTEL_EXPORTER_OTLP_PROTOCOL (which defaults to grpc and would break
      // HTTP-only port 4318 used by the frontend server)
      OTEL_EXPORTER_OTLP_PROTOCOL:
        process.env.FRONTEND_OTEL_EXPORTER_OTLP_PROTOCOL ||
        process.env.OTEL_EXPORTER_OTLP_PROTOCOL ||
        "http/protobuf",
      LOG_EXPORTER_ENABLED:
        process.env.LOG_EXPORTER_ENABLED === "true" ? "true" : "false",
      OTEL_SERVICE_NAMESPACE: process.env.OTEL_SERVICE_NAMESPACE || "saas",
      OTEL_SERVICE_VERSION: process.env.OTEL_SERVICE_VERSION || "1.0.0",
      NODE_ENV: process.env.NODE_ENV || "development",
    });

    const { setupCrashMonitor } = await import("./lib/crash-monitor");
    setupCrashMonitor();
  }
}
