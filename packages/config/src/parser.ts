import YAML from "yaml";

/**
 * Parses a YAML configuration string into a flat record of environment variable keys.
 * Handles specialized mappings for auth, database, server, frontend, backend, worker,
 * llm, and observability contexts.
 */
export function parseYamlToFlatEnv(content: string) {
  const parsed = YAML.parse(content) as Record<string, unknown>;
  function flatten(obj: unknown, parentKey = ""): Record<string, string> {
    const results: Record<string, string> = {};
    if (typeof obj !== "object" || obj == null) return results;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = parentKey ? `${parentKey}_${k}` : `${k}`;
      if (v === null || v === undefined) continue;
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        Object.assign(results, flatten(v as Record<string, unknown>, key));
      } else {
        if (parentKey.toLowerCase() === "auth") {
          const lk = k.toLowerCase();
          if (lk === "jwt_secret") results[`JWT_SECRET`] = String(v);
          else if (lk === "jwt_refresh_secret")
            results[`JWT_REFRESH_SECRET`] = String(v);
          else if (lk === "frontend_auth_secret")
            results[`FRONTEND_AUTH_SECRET`] = String(v);
          else if (lk === "jwt_expires_in")
            results[`JWT_EXPIRES_IN`] = String(v);
          else if (lk === "jwt_refresh_expires_in")
            results[`JWT_REFRESH_EXPIRES_IN`] = String(v);
          else if (lk === "jwt_issuer") results[`JWT_ISSUER`] = String(v);
          else if (lk === "jwt_audience") results[`JWT_AUDIENCE`] = String(v);
          else if (lk === "auth_trust_host")
            results[`AUTH_TRUST_HOST`] = String(v);
          else if (lk === "auth_secret") {
            results[`AUTH_SECRET`] = String(v);
            if (!results[`FRONTEND_AUTH_SECRET`]) {
              results[`FRONTEND_AUTH_SECRET`] = String(v);
            }
          } else results[key.toUpperCase()] = String(v);
        } else if (parentKey.toLowerCase() === "database") {
          const lk = k.toLowerCase();
          if (lk === "pgvector_enabled") {
            results["PGVECTOR_ENABLED"] = String(v);
          } else if (lk === "migrations_run") {
            results["DATABASE_MIGRATIONS_RUN"] = String(v);
          } else if (lk === "synchronize") {
            results["DATABASE_SYNCHRONIZE"] = String(v);
          }
          results[`DATABASE_${k.toUpperCase()}`] = String(v);
        } else if (parentKey.toLowerCase() === "redis") {
          const lk = k.toLowerCase();
          if (lk === "enabled") results["REDIS_ENABLED"] = String(v);
          else if (lk === "fallback_enabled")
            results["REDIS_FALLBACK_ENABLED"] = String(v);
          else if (lk === "failure_threshold")
            results["REDIS_FAILURE_THRESHOLD"] = String(v);
          else if (lk === "reset_timeout_ms")
            results["REDIS_RESET_TIMEOUT_MS"] = String(v);
          results[`REDIS_${k.toUpperCase()}`] = String(v);
        } else if (parentKey.toLowerCase() === "server") {
          const lk = k.toLowerCase();
          if (lk === "port") {
            // results["PORT"] = String(v); // Removed to avoid global collision
          } else if (lk === "node_env") results["NODE_ENV"] = String(v);
          else if (lk === "hostname") results["HOSTNAME"] = String(v);
          else if (lk === "shutdown_timeout") {
            results["SHUTDOWN_TIMEOUT"] = String(v);
          } else if (lk === "log_level") {
            results["LOG_LEVEL"] = String(v);
          } else if (lk === "log_format") {
            results["LOG_FORMAT"] = String(v);
          } else if (lk === "cors_origin") {
            results["CORS_ORIGIN"] = String(v);
          }
        } else if (
          parentKey.toLowerCase() === "server_swagger" &&
          k.toLowerCase() === "enabled"
        ) {
          results["SWAGGER_ENABLED"] = String(v);
        } else if (parentKey.toLowerCase() === "frontend") {
          const ck = k.toUpperCase();
          const lk = k.toLowerCase();
          if (lk === "port") {
            results["FRONTEND_PORT"] = String(v);
          } else if (ck.startsWith("NEXT_PUBLIC_")) {
            results[ck] = String(v);
          } else if (lk === "api_url") {
            // Only set NEXT_PUBLIC_API_URL if not already set by next_public_api_url
            if (!results["NEXT_PUBLIC_API_URL"]) {
              results["NEXT_PUBLIC_API_URL"] = String(v);
            }
            results["API_URL"] = String(v);
          } else if (lk === "auth_url") {
            results["NEXTAUTH_URL"] = String(v);
          } else if (lk === "auth_url_internal") {
            results["NEXTAUTH_URL_INTERNAL"] = String(v);
          } else if (lk === "auth_trust_host") {
            results["AUTH_TRUST_HOST"] = String(v);
          } else if (lk === "auth_secret") {
            results["AUTH_SECRET"] = String(v);
            results["FRONTEND_AUTH_SECRET"] = String(v);
          } else if (lk === "otlp_endpoint") {
            results["FRONTEND_OTEL_EXPORTER_OTLP_ENDPOINT"] = String(v);
          } else if (lk === "otlp_headers") {
            results["OTEL_EXPORTER_OTLP_HEADERS"] = String(v);
          } else if (lk === "log_exporter_enabled") {
            results["LOG_EXPORTER_ENABLED"] = String(v);
          } else if (lk === "service_name") {
            results["FRONTEND_OTEL_SERVICE_NAME"] = String(v);
            results["NEXT_PUBLIC_OTEL_SERVICE_NAME"] = String(v);
          } else if (lk === "service_namespace") {
            results["OTEL_SERVICE_NAMESPACE"] = String(v);
          } else if (lk === "observability_protocol" || lk === "protocol") {
            results["FRONTEND_OTEL_EXPORTER_OTLP_PROTOCOL"] = String(v);
            results["NEXT_PUBLIC_OTEL_EXPORTER_OTLP_PROTOCOL"] = String(v);
          } else {
            results[key.toUpperCase()] = String(v);
          }
        } else if (parentKey.toLowerCase() === "backend") {
          const lk = k.toLowerCase();
          if (lk === "port") {
            results["BACKEND_PORT"] = String(v);
          } else if (lk === "otlp_endpoint") {
            results[`BACKEND_OTEL_EXPORTER_OTLP_ENDPOINT`] = String(v);
          } else if (lk === "service_name") {
            results[`BACKEND_OTEL_SERVICE_NAME`] = String(v);
          } else if (lk === "enabled") {
            results[`BACKEND_OTEL_ENABLED`] = String(v);
          } else if (lk === "observability_protocol" || lk === "protocol") {
            results[`BACKEND_OTEL_EXPORTER_OTLP_PROTOCOL`] = String(v);
          } else {
            results[`BACKEND_${k.toUpperCase()}`] = String(v);
          }
        } else if (parentKey.toLowerCase() === "worker") {
          const lk = k.toLowerCase();
          if (lk === "otlp_endpoint") {
            results[`WORKER_OTEL_EXPORTER_OTLP_ENDPOINT`] = String(v);
          } else if (lk === "service_name") {
            results[`WORKER_OTEL_SERVICE_NAME`] = String(v);
          } else if (lk === "enabled") {
            results[`WORKER_OTEL_ENABLED`] = String(v);
          } else if (lk === "observability_protocol" || lk === "protocol") {
            results[`WORKER_OTEL_EXPORTER_OTLP_PROTOCOL`] = String(v);
          } else {
            results[`WORKER_${k.toUpperCase()}`] = String(v);
          }
        } else if (parentKey.toLowerCase() === "llm") {
          results[`LLM_${k.toUpperCase()}`] = String(v);
        } else if (parentKey.toLowerCase() === "llm_embeddings") {
          results[`LLM_EMBEDDINGS_${k.toUpperCase()}`] = String(v);
        } else if (parentKey.toLowerCase() === "llm_multimodal") {
          results[`LLM_MULTIMODAL_${k.toUpperCase()}`] = String(v);
        } else if (parentKey.toLowerCase() === "auth_login_rate_limit") {
          const lk = k.toLowerCase();
          if (lk === "max") results["AUTH_LOGIN_RATE_LIMIT_MAX"] = String(v);
          results[`AUTH_LOGIN_RATE_LIMIT_${k.toUpperCase()}`] = String(v);
        } else if (parentKey.toLowerCase() === "s3") {
          const lk = k.toLowerCase();
          if (lk === "access_key_id") {
            results["S3_ACCESS_KEY"] = String(v);
            results["S3_ACCESS_KEY_ID"] = String(v);
          } else if (lk === "secret_access_key") {
            results["S3_SECRET_KEY"] = String(v);
            results["S3_SECRET_ACCESS_KEY"] = String(v);
          } else if (lk === "public_url") results["S3_PUBLIC_URL"] = String(v);
          else if (lk === "bucket") results["S3_BUCKET"] = String(v);
          else if (lk === "endpoint") results["S3_ENDPOINT"] = String(v);
          else if (lk === "region") results["S3_REGION"] = String(v);
          else if (lk === "force_path_style")
            results["S3_FORCE_PATH_STYLE"] = String(v);
          else results[key.toUpperCase()] = String(v);
        } else if (parentKey.toLowerCase() === "rabbitmq") {
          const lk = k.toLowerCase();
          if (lk === "url") {
            results["MESSAGING_RABBITMQ_URL"] = String(v);
            results["RABBITMQ_URL"] = String(v);
          } else if (lk === "host") {
            results["RABBITMQ_HOST"] = String(v);
          } else if (lk === "port") {
            results["RABBITMQ_PORT"] = String(v);
          } else if (lk === "user") {
            results["RABBITMQ_USER"] = String(v);
          } else if (lk === "password") {
            results["RABBITMQ_PASSWORD"] = String(v);
          } else if (lk === "prefetch") {
            results["RABBITMQ_PREFETCH"] = String(v);
          } else if (lk === "reconnect_timeout_ms") {
            results["RABBITMQ_RECONNECT_TIMEOUT_MS"] = String(v);
          }
          results[key.toUpperCase()] = String(v);
        } else {
          results[key.toUpperCase()] = String(v);
        }
        // Map server.rate_limit.* to RATE_LIMIT_* env keys
        if (parentKey.toLowerCase() === "server_rate_limit") {
          const lk = k.toLowerCase();
          if (lk === "enabled") {
            results[`RATE_LIMIT_ENABLED`] = String(v);
          } else if (lk === "max_requests") {
            results[`RATE_LIMIT_MAX_REQUESTS`] = String(v);
          } else if (lk === "window_ms") {
            results[`RATE_LIMIT_WINDOW_MS`] = String(v);
          } else if (lk === "failover_strategy") {
            results[`RATE_LIMIT_FAILOVER_STRATEGY`] = String(v);
          }
        }
        // Map auth.login_rate_limit.* to AUTH_LOGIN_RATE_LIMIT_* env keys
        if (parentKey.toLowerCase() === "auth_login_rate_limit") {
          results[`AUTH_LOGIN_RATE_LIMIT_${k.toUpperCase()}`] = String(v);
        }
        // Map auth.* to FRONTEND_AUTH_SECRET and AUTH_SECRET
        if (parentKey.toLowerCase() === "auth") {
          const lk = k.toLowerCase();
          if (lk === "frontend_auth_secret") {
            results[`FRONTEND_AUTH_SECRET`] = String(v);
            results[`AUTH_SECRET`] = String(v);
          }
        }
        // Map email.smtp.* to SMTP_* env keys
        if (parentKey.toLowerCase() === "email_smtp") {
          const lk = k.toLowerCase();
          if (lk === "from") {
            results["SMTP_FROM"] = String(v);
            results["SMTP_FROM_EMAIL"] = String(v);
            if (!results["SMTP_FROM_NAME"]) {
              results["SMTP_FROM_NAME"] = "SaaS Backend";
            }
          } else if (lk === "password") {
            results["SMTP_PASS"] = String(v);
          } else if (lk === "user") {
            results["SMTP_USER"] = String(v);
          } else if (lk === "host") {
            results["SMTP_HOST"] = String(v);
          } else if (lk === "port") {
            results["SMTP_PORT"] = String(v);
          }
          results[`SMTP_${k.toUpperCase()}`] = String(v);
        }
        // Map observability.* to OTEL_* env keys
        if (parentKey.toLowerCase() === "observability") {
          const lk = k.toLowerCase();
          if (lk === "otlp_endpoint") {
            results[`OTEL_EXPORTER_OTLP_ENDPOINT`] = String(v);
            results[`NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT`] = String(v);
          } else if (lk === "otlp_http_endpoint") {
            results[`OTEL_EXPORTER_OTLP_HTTP_ENDPOINT`] = String(v);
          } else if (lk === "service_version") {
            results[`OTEL_SERVICE_VERSION`] = String(v);
          } else if (lk === "otlp_headers") {
            results[`OTEL_EXPORTER_OTLP_HEADERS`] = String(v);
          } else if (
            lk === "otlp_ingestion_token" ||
            lk === "otel_ingestion_bearer_token"
          ) {
            results[`OTEL_INGESTION_BEARER_TOKEN`] = String(v);
            results[`NEXT_PUBLIC_OTEL_INGESTION_BEARER_TOKEN`] = String(v);
          } else if (lk === "service_name") {
            results[`OTEL_SERVICE_NAME`] = String(v);
            results[`NEXT_PUBLIC_OTEL_SERVICE_NAME`] = String(v);
          } else if (lk === "service_namespace") {
            results[`OTEL_SERVICE_NAMESPACE`] = String(v);
          } else if (lk === "metric_export_interval") {
            results[`OTEL_METRIC_EXPORT_INTERVAL`] = String(v);
          } else if (lk === "metric_export_timeout") {
            results[`OTEL_METRIC_EXPORT_TIMEOUT`] = String(v);
          } else if (lk === "traces_exporter") {
            results[`OTEL_TRACES_EXPORTER`] = String(v);
          } else if (lk === "metrics_exporter") {
            results[`OTEL_METRICS_EXPORTER`] = String(v);
          } else if (lk === "logs_exporter") {
            results[`OTEL_LOGS_EXPORTER`] = String(v);
          } else if (lk === "semconv_stability") {
            // The OTEL SDK reads OTEL_SEMCONV_STABILITY_OPT_IN, not OTEL_SEMCONV_STABILITY.
            results[`OTEL_SEMCONV_STABILITY_OPT_IN`] = String(v);
          } else if (lk === "protocol") {
            results[`OTEL_EXPORTER_OTLP_PROTOCOL`] = String(v);
            results[`NEXT_PUBLIC_OTEL_EXPORTER_OTLP_PROTOCOL`] = String(v);
          } else if (lk === "log_exporter_enabled") {
            results[`LOG_EXPORTER_ENABLED`] = String(v);
            results[`NEXT_PUBLIC_LOG_EXPORTER_ENABLED`] = String(v);
          } else if (lk === "log_exporter_type") {
            results[`LOG_EXPORTER_TYPE`] = String(v);
          } else if (lk === "log_collector_endpoint") {
            results[`LOG_COLLECTOR_ENDPOINT`] = String(v);
          } else if (lk === "log_collector_headers") {
            results[`LOG_COLLECTOR_HEADERS`] = String(v);
          } else if (lk === "enabled") {
            results[`OTEL_ENABLED`] = String(v);
            results[`NEXT_PUBLIC_OTEL_ENABLED`] = String(v);
          } else {
            results[`OTEL_${k.toUpperCase()}`] = String(v);
          }
        }
        // Map otel.* to OTEL_* env keys (and LOG_EXPORTER_ENABLED)
        if (parentKey.toLowerCase() === "otel") {
          const lk = k.toLowerCase();
          if (lk === "log_exporter_enabled") {
            results[`LOG_EXPORTER_ENABLED`] = String(v);
          }
        }
      }
    }
    return results;
  }
  return flatten(parsed);
}
