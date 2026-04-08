/**
 * Define the standard prefixes used for namespacing environment variables.
 */
export const Prefixes = {
  BACKEND: "BACKEND_",
  WORKER: "WORKER_",
  FRONTEND: "FRONTEND_",
  NEXT: "NEXT", // Matches NEXT_PUBLIC, NEXTAUTH, etc.
  LLM: "LLM_",
  S3: "S3_",
  AUTH: "AUTH_",
  JWT: "JWT_",
  DATABASE: "DATABASE_",
  REDIS: "REDIS_",
  RABBITMQ: "RABBITMQ_",
  SMTP: "SMTP_",
} as const;

/**
 * Define which variable categories (prefixes/keys) should be EXCLUDED
 * for each service type to keep their .env files clean and secure.
 */
export const ServiceExclusions = {
  BACKEND: [
    Prefixes.NEXT,
    Prefixes.WORKER,
    Prefixes.FRONTEND,
    Prefixes.AUTH + "SECRET",
    Prefixes.AUTH + "TRUST_HOST",
  ],
  WORKER: [
    Prefixes.NEXT,
    Prefixes.BACKEND,
    Prefixes.FRONTEND,
    Prefixes.AUTH,
    Prefixes.JWT,
    Prefixes.S3,
    "CORS_ORIGIN",
    "API_URL",
    "SWAGGER_ENABLED",
    "PORT",
  ],
  DATABASE: [
    // Database generator usually uses a strict whitelist (filter),
    // but we define it here for completeness if needed.
  ],
} as const;
