/**
 * Explicit annotations for environment keys.
 *
 * Use this map to describe whether a validated env key is safe to export to the
 * frontend (.env that will be embedded into the browser). This enforces a
 * descriptive, explicit opt-in policy — no automatic exports.
 */
export const EnvAnnotations: Record<
  string,
  { safeForFrontend?: boolean; description?: string }
> = {
  // Example annotations (add entries here explicitly when a key should be exported)
  NEXT_PUBLIC_API_URL: {
    safeForFrontend: true,
    description: "Public API URL used by the browser to call backend APIs",
  },
  NEXT_PUBLIC_SOCKET_URL: {
    safeForFrontend: true,
    description:
      "WebSocket URL used by the browser for assistant and real-time features",
  },
  FRONTEND_PORT: {
    safeForFrontend: true,
    description: "Specific port for the frontend defined in its context",
  },
  BACKEND_PORT: {
    description: "Specific port for the backend defined in its context",
  },
  PORT: {
    safeForFrontend: true,
    description: "Port used by the application (backend or frontend)",
  },
  API_URL: {
    safeForFrontend: true,
    description: "Internal API URL used by Next.js Server Components",
  },
  NEXTAUTH_URL: {
    safeForFrontend: true,
    description: "Base URL for NextAuth.js authentication",
  },
  NEXTAUTH_URL_INTERNAL: {
    safeForFrontend: true,
    description:
      "Internal URL for NextAuth.js (used for server-to-server calls in Docker/K8s)",
  },
  AUTH_TRUST_HOST: {
    safeForFrontend: true,
    description:
      "Whether to trust the forwarded host header (required for Auth.js behind proxy)",
  },
  NEXT_PUBLIC_OTEL_ENABLED: {
    safeForFrontend: true,
    description:
      "Whether OpenTelemetry server-side proxy (/api/otel) is enabled",
  },
  NEXT_PUBLIC_OTEL_SERVICE_NAME: {
    safeForFrontend: true,
    description: "Service name for OpenTelemetry and Faro SDK app.name",
  },
  // Grafana Faro SDK (browser observability)
  NEXT_PUBLIC_FARO_URL: {
    safeForFrontend: true,
    description:
      "Grafana Faro SDK collector URL (Alloy endpoint: http://<host>:12347/collect)",
  },
  NEXT_PUBLIC_APP_VERSION: {
    safeForFrontend: true,
    description: "Application version embedded in Faro SDK telemetry",
  },
  NEXT_PUBLIC_ENV: {
    safeForFrontend: true,
    description:
      "Environment name (development/production) embedded in Faro SDK telemetry",
  },
  LLM_MULTIMODAL_OPENAI_API_KEY: {
    description: "API Key for Multimodal LLM (OpenAI compatible)",
  },
  LLM_MULTIMODAL_BASE_URL: {
    description: "Base URL for Multimodal LLM (defaults to OpenAI if empty)",
  },
  LLM_STT_OPENAI_API_KEY: {
    description: "API Key for Speech-to-Text (OpenAI compatible)",
  },
  LLM_STT_BASE_URL: {
    description: "Base URL for Speech-to-Text (defaults to OpenAI if empty)",
  },
  LLM_TTS_API_KEY: {
    description: "API Key for Text-to-Speech (OpenAI compatible)",
  },
  LLM_TTS_BASE_URL: {
    description: "Base URL for Text-to-Speech (defaults to OpenAI if empty)",
  },
  LLM_EMBEDDINGS_OPENAI_API_KEY: {
    description: "API Key for Embeddings (OpenAI compatible)",
  },
  LLM_EMBEDDINGS_BASE_URL: {
    description: "Base URL for Embeddings (defaults to OpenAI if empty)",
  },
  LLM_EMBEDDINGS_S3_BUCKET: {
    description:
      "Specific S3 bucket for storing knowledge base files/embeddings",
  },
  OTEL_EXPORTER_OTLP_ENDPOINT: {
    safeForFrontend: true,
    description:
      "Server-side OTLP exporter endpoint for the frontend application",
  },
  OTEL_SERVICE_NAME: {
    safeForFrontend: true,
    description: "Server-side Service name for OpenTelemetry",
  },
  OTEL_ENABLED: {
    safeForFrontend: true,
    description: "Whether OpenTelemetry is enabled globally",
  },
  OTEL_EXPORTER_OTLP_HTTP_ENDPOINT: {
    safeForFrontend: true,
    description:
      "Server-side OTLP/HTTP exporter endpoint for the frontend proxy",
  },
  FRONTEND_OTEL_SERVICE_NAME: {
    safeForFrontend: true,
    description: "Specific service name for frontend",
  },
  FRONTEND_OTEL_EXPORTER_OTLP_ENDPOINT: {
    safeForFrontend: true,
    description: "Specific OTLP endpoint for frontend",
  },
  FRONTEND_OTEL_EXPORTER_OTLP_PROTOCOL: {
    safeForFrontend: true,
    description: "Specific OTLP protocol for frontend",
  },
  OTEL_EXPORTER_OTLP_PROTOCOL: {
    safeForFrontend: true,
    description: "Server-side OTLP exporter protocol",
  },
  OTEL_EXPORTER_OTLP_HEADERS: {
    safeForFrontend: true,
    description:
      "OTLP exporter headers (e.g. Authorization=Bearer token) sent by Next.js server to the backend proxy",
  },
  OTEL_SERVICE_NAMESPACE: {
    safeForFrontend: true,
    description: "Service namespace for OpenTelemetry resource attributes",
  },
  LOG_EXPORTER_ENABLED: {
    safeForFrontend: true,
    description: "Whether OTLP log exporter is enabled for the frontend server",
  },
  AUTH_SECRET: {
    safeForFrontend: true,
    description: "Authentication secret required by NextAuth server-side",
  },
  // NOTE: To export any key to the frontend generated .env, you MUST add an
  // explicit entry here with `safeForFrontend: true` and a short description.
};

/**
 * Checks if a given environment key is safe to be exported to the frontend.
 */
export function isSafeForFrontend(key: string): boolean {
  return !!EnvAnnotations[key]?.safeForFrontend;
}
