import { z } from "zod";

export * from "./parser";
export * from "./annotations";

/**
 * Main Environment Variable Schema.
 * Defines all supported variables, their types, and validation rules.
 */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  HOSTNAME: z.string(),
  PORT: z.coerce.number(),
  DATABASE_URL: z.string(),

  DATABASE_HOST: z.string(),
  DATABASE_PORT: z.coerce.number(),
  DATABASE_USER: z.string(),
  DATABASE_PASSWORD: z.string(),
  DATABASE_NAME: z.string(),
  DATABASE_SSL: z.string(),
  DATABASE_MAX_CONNECTIONS: z.coerce.number(),
  DATABASE_IDLE_TIMEOUT: z.coerce.number(),
  DATABASE_CONNECTION_TIMEOUT: z.coerce.number(),
  DATABASE_MIGRATIONS_RUN: z.string().optional(),
  DATABASE_SYNCHRONIZE: z.string().optional(),
  PGVECTOR_ENABLED: z.string(),

  SHUTDOWN_TIMEOUT: z.coerce.number().optional(),
  SWAGGER_ENABLED: z.string().optional(),

  LOG_LEVEL: z.string().default("info"),
  LOG_FORMAT: z.string().default("json"),
  CORS_ORIGIN: z.string(),

  FRONTEND_AUTH_SECRET: z.string(),
  AUTH_SECRET: z.string(),
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string(),
  JWT_REFRESH_EXPIRES_IN: z.string(),
  JWT_ISSUER: z.string().optional(),
  JWT_AUDIENCE: z.string().optional(),
  AUTH_TRUST_HOST: z.string().optional(),

  // Redis
  REDIS_ENABLED: z.string().default("true"),
  REDIS_URL: z.string(),
  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number(),
  REDIS_PASSWORD: z.string(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_FALLBACK_ENABLED: z.string().optional(),
  REDIS_FAILURE_THRESHOLD: z.coerce.number().optional(),
  REDIS_RESET_TIMEOUT_MS: z.coerce.number().optional(),

  // Mail
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  SMTP_FROM: z.string().optional(),
  SMTP_FROM_EMAIL: z.string(),
  SMTP_FROM_NAME: z.string(),

  // LLM
  LLM_ENABLED: z.string().default("false"),
  LLM_PROVIDER: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  LLM_OPENAI_API_KEY: z.string().optional(),
  LLM_ANTHROPIC_API_KEY: z.string().optional(),
  LLM_GROQ_API_KEY: z.string().optional(),
  LLM_CEREBRAS_API_KEY: z.string().optional(),
  LLM_DEEPSEEK_API_KEY: z.string().optional(),
  LLM_FIREWORKS_API_KEY: z.string().optional(),
  LLM_GEMINI_API_KEY: z.string().optional(),
  LLM_GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  LLM_AZURE_OPENAI_API_KEY: z.string().optional(),
  LLM_AZURE_OPENAI_API_INSTANCE_NAME: z.string().optional(),
  LLM_AZURE_OPENAI_API_DEPLOYMENT_NAME: z.string().optional(),
  LLM_AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME: z.string().optional(),
  LLM_AZURE_OPENAI_API_VERSION: z.string().optional(),
  LLM_MISTRAL_API_KEY: z.string().optional(),
  LLM_COHERE_API_KEY: z.string().optional(),

  LLM_EMBEDDINGS_PROVIDER: z.string().optional(),
  LLM_EMBEDDINGS_MODEL: z.string().optional(),
  LLM_EMBEDDINGS_DIMENSIONS: z.coerce.number().optional(),
  LLM_MULTIMODAL_PROVIDER: z.string().optional(),
  LLM_MULTIMODAL_MODEL: z.string().optional(),

  // LangGraph / LangChain
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_TRACING: z.string().optional(),
  LANGSMITH_ENDPOINT: z.string().optional(),
  LANGSMITH_PROJECT: z.string().optional(),

  // Storage (S3 / R2 / Minio)
  S3_ENDPOINT: z.string(),
  S3_REGION: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string(),
  S3_PUBLIC_URL: z.string(),
  S3_FORCE_PATH_STYLE: z
    .preprocess((v) => v === "true" || v === true, z.boolean())
    .optional(),

  // Rate Limit
  RATE_LIMIT_ENABLED: z.string().default("true"),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_FAILOVER_STRATEGY: z
    .enum(["in-memory", "passthrough"])
    .default("in-memory"),

  // Auth Login Rate Limit
  AUTH_LOGIN_RATE_LIMIT_ENABLED: z.string().default("true"),
  AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(5),
  AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(5),
  AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes

  // Observability
  OTEL_ENABLED: z.string().default("false"),
  OTEL_SERVICE_NAME: z.string(),
  OTEL_SERVICE_NAMESPACE: z.string().optional(),
  OTEL_SERVICE_VERSION: z.string(),
  OTEL_METRIC_EXPORT_INTERVAL: z.coerce.number().optional(),
  OTEL_METRIC_EXPORT_TIMEOUT: z.coerce.number().optional(),
  OTEL_TRACES_EXPORTER: z.string().optional(),
  OTEL_METRICS_EXPORTER: z.string().optional(),
  OTEL_LOGS_EXPORTER: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string(),
  OTEL_EXPORTER_OTLP_HTTP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_PROTOCOL: z.string().default("grpc"),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  OTEL_INGESTION_BEARER_TOKEN: z.string().optional(),
  // Set by the OTEL SDK to opt-in to stable semantic conventions for HTTP spans.
  // Required by Grafana dashboards that rely on stable HTTP semconv attribute names.
  OTEL_SEMCONV_STABILITY_OPT_IN: z.string().optional(),
  // Arbitrary key=value resource attributes, e.g. "deployment.environment=production,service.version=1.0.0"
  OTEL_RESOURCE_ATTRIBUTES: z.string().optional(),

  // Specific OTEL variables for individual components
  BACKEND_OTEL_ENABLED: z.string().optional(),
  BACKEND_OTEL_SERVICE_NAME: z.string().optional(),
  BACKEND_OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  BACKEND_OTEL_EXPORTER_OTLP_PROTOCOL: z.string().optional(),

  WORKER_OTEL_ENABLED: z.string().optional(),
  WORKER_OTEL_SERVICE_NAME: z.string().optional(),
  WORKER_OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  WORKER_OTEL_EXPORTER_OTLP_PROTOCOL: z.string().optional(),

  FRONTEND_OTEL_ENABLED: z.string().optional(),
  FRONTEND_OTEL_SERVICE_NAME: z.string().optional(),
  FRONTEND_OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  FRONTEND_OTEL_EXPORTER_OTLP_PROTOCOL: z.string().optional(),

  // Logging
  LOG_EXPORTER_ENABLED: z.string().default("false"),
  LOG_EXPORTER_TYPE: z.string().optional(),
  LOG_COLLECTOR_ENDPOINT: z.string().optional(),
  LOG_COLLECTOR_HEADERS: z.string().optional(),

  // RabbitMQ / Messaging
  MESSAGING_RABBITMQ_URL: z.string(),
  RABBITMQ_URL: z.string().optional(),
  RABBITMQ_HOST: z.string().optional(),
  RABBITMQ_PORT: z.coerce.number().optional(),
  RABBITMQ_USER: z.string().optional(),
  RABBITMQ_PASSWORD: z.string().optional(),
  RABBITMQ_PREFETCH: z.coerce.number().optional(),
  RABBITMQ_RECONNECT_TIMEOUT_MS: z.coerce.number().optional(),

  // Frontend related (also needed by server in some cases)
  NEXT_PUBLIC_API_URL: z.string().optional(),
  NEXT_PUBLIC_SOCKET_URL: z.string().optional(),
  API_URL: z.string().optional(),
  NEXT_PUBLIC_OTEL_ENABLED: z.string().optional(),
  NEXT_PUBLIC_OTEL_SERVICE_NAME: z.string().optional(),
  // Grafana Faro SDK (browser observability)
  NEXT_PUBLIC_FARO_URL: z.string().optional(),
  NEXT_PUBLIC_APP_VERSION: z.string().optional(),
  NEXT_PUBLIC_ENV: z.string().optional(),

  // LLM specific keys from annotations
  LLM_MULTIMODAL_OPENAI_API_KEY: z.string().optional(),
  LLM_MULTIMODAL_BASE_URL: z.string().optional(),
  LLM_EMBEDDINGS_OPENAI_API_KEY: z.string().optional(),
  LLM_EMBEDDINGS_BASE_URL: z.string().optional(),
  LLM_EMBEDDINGS_S3_BUCKET: z.string().optional(),

  // Next.js variables (subset needed by Node, though mostly browser)
  NEXTAUTH_URL: z.string().optional(),
  NEXTAUTH_URL_INTERNAL: z.string().optional(),

  // Internal/Build time
  SKIP_ENV_VALIDATION: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;
