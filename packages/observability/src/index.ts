export * from "./gen-ai-instrumentation";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter as gRPCTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPTraceExporter as HTTPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { View } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core";
import { AmqplibInstrumentation } from "@opentelemetry/instrumentation-amqplib";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { propagation, isSpanContextValid, metrics } from "@opentelemetry/api";
import {
  W3CTraceContextPropagator,
  ParentBasedSampler,
  AlwaysOnSampler,
} from "@opentelemetry/core";
import type { ExportResult } from "@opentelemetry/core";
import type { SpanExporter, ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { randomUUID } from "node:crypto";
import type { Env } from "@turborepo/config/node";

// Enable new OpenTelemetry semantic conventions for HTTP
process.env.OTEL_SEMCONV_STABILITY_OPT_IN = "http,http/dup";
process.env.OTEL_NODE_RESOURCE_DETECTORS = "none";

const OTEL_INIT_KEY = Symbol.for("otel-initialized");
const DIAG_INIT_KEY = Symbol.for("otel-diag-initialized");

interface GlobalWithOtel {
  [OTEL_INIT_KEY]?: boolean;
  [DIAG_INIT_KEY]?: boolean;
}

/**
 * Filtro customizado para impedir o envio de spans sem trace-id válido.
 * Utilizado para reduzir o ruído de inicialização e instrumentações automáticas indesejadas.
 */
class FilteredSpanExporter implements SpanExporter {
  constructor(private readonly _baseExporter: SpanExporter) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    const filteredSpans = spans.filter((span) =>
      isSpanContextValid(span.spanContext())
    );
    this._baseExporter.export(filteredSpans, resultCallback);
  }

  shutdown(): Promise<void> {
    return this._baseExporter.shutdown();
  }

  forceFlush(): Promise<void> {
    return this._baseExporter.forceFlush
      ? this._baseExporter.forceFlush()
      : Promise.resolve();
  }
}

export function initObservability(config: Partial<Env>) {
  const globalObj = globalThis as unknown as GlobalWithOtel;

  if (globalObj[OTEL_INIT_KEY]) {
    return;
  }

  const isEnabled =
    config.OTEL_ENABLED === "true" || (config.OTEL_ENABLED as unknown) === true;
  if (!isEnabled) {
    return;
  }

  // Set the global initialization flag immediately
  globalObj[OTEL_INIT_KEY] = true;

  // Explicitly set the global propagator to W3C Trace Context
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  console.log(`Initializing Observability for ${config.OTEL_SERVICE_NAME}...`);

  const headers: Record<string, string> = {};
  if (config.OTEL_EXPORTER_OTLP_HEADERS) {
    config.OTEL_EXPORTER_OTLP_HEADERS.split(",").forEach((header) => {
      const [key, value] = header.split("=");
      if (key && value) {
        headers[key.trim()] = value.trim();
      }
    });
  }

  const protocol = config.OTEL_EXPORTER_OTLP_PROTOCOL || "grpc";
  const isHttp = protocol.includes("http");

  // Ensure default endpoint based on protocol
  const defaultEndpoint = isHttp
    ? "http://localhost:3201"
    : "http://localhost:9105";
  const endpoint = config.OTEL_EXPORTER_OTLP_ENDPOINT || defaultEndpoint;

  // Clean base endpoint if it's HTTP to avoid double appending /v1/xxx
  const baseEndpoint = isHttp
    ? endpoint.replace(/\/v1\/(traces|metrics|logs)$/, "")
    : endpoint;

  console.log(`[OTEL] Collector Endpoint (${protocol}): ${endpoint}`);

  if (config.OTEL_EXPORTER_OTLP_PROTOCOL) {
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL =
      config.OTEL_EXPORTER_OTLP_PROTOCOL;
  }

  const traceExporter = new FilteredSpanExporter(
    isHttp
      ? new HTTPTraceExporter({ url: `${baseEndpoint}/v1/traces`, headers })
      : new gRPCTraceExporter({ url: endpoint, headers })
  );

  const views = [
    // Rename http.server.request.duration to http_server_duration_milliseconds for contract compliance (v1.0)
    new View({
      meterName: "@opentelemetry/instrumentation-http",
      instrumentName: "http.server.request.duration",
      name: "http_server_duration_milliseconds",
    }),
  ];

  /* 
  Commenting out metricReader and related exporters to avoid conflict with process.env.OTEL_METRICS_EXPORTER="otlp" 
  and OTEL_LOGS_EXPORTER="otlp" which are set in the environment and handled by NodeSDK automatically.
  */

  const sdk = new NodeSDK({
    resource: Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]:
          config.OTEL_SERVICE_NAME || "unknown-service",
        [SemanticResourceAttributes.SERVICE_NAMESPACE]:
          config.OTEL_SERVICE_NAMESPACE || "default",
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
          config.NODE_ENV || "development",
        [SemanticResourceAttributes.SERVICE_VERSION]:
          config.OTEL_SERVICE_VERSION || "0.0.0",
        [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: randomUUID(), // Força um novo UUID v4 para cada instância do processo conforme contrato v1.0
      })
    ),
    sampler: new ParentBasedSampler({
      root: new AlwaysOnSampler(),
    }),
    autoDetectResources: false,
    textMapPropagator: new W3CTraceContextPropagator(),
    traceExporter,
    // metricReader,
    views,
    // logRecordProcessor,
    instrumentations: [
      new NestInstrumentation(),
      new AmqplibInstrumentation(),
      new PinoInstrumentation({
        logKeys: {
          traceId: "trace_id",
          spanId: "span_id",
          traceFlags: "trace_flags",
        },
      }),
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
        "@opentelemetry/instrumentation-dns": {
          enabled: false,
        },
        "@opentelemetry/instrumentation-net": {
          enabled: false,
        },
        "@opentelemetry/instrumentation-undici": {
          enabled: true,
          // Populate http.status_code on outgoing fetch() spans (Node 18+ built-in fetch
          // uses undici internally and requires this instrumentation to be captured).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          responseHook: (span: any, { response }: any) => {
            if (response?.statusCode) {
              span.setAttribute("http.status_code", response.statusCode);
              span.setAttribute(
                "http.status_code_family",
                `${Math.floor(response.statusCode / 100)}xx`
              );
            }
          },
        },
        "@opentelemetry/instrumentation-http": {
          enabled: true,
          ignoreIncomingRequestHook: (req: {
            url?: string;
            method?: string;
          }) => {
            const path = req.url?.split("?")[0] || "";
            // Always ignore health endpoints to reduce telemetry noise
            const isHealthOrMetrics =
              path === "/health" ||
              path === "/api/health" ||
              path === "/metrics" ||
              path.includes("/healthz") ||
              path.includes("/ready");

            const isCorsPreflight = req.method === "OPTIONS";
            const isStaticAsset =
              path.endsWith(".ico") ||
              path.endsWith(".js") ||
              path.endsWith(".css") ||
              path.endsWith(".png") ||
              path.endsWith(".jpg") ||
              path.endsWith(".svg") ||
              // Next.js internal paths — high volume, not useful for server metrics
              path.startsWith("/_next/static/") ||
              path.startsWith("/_next/image") ||
              path.startsWith("/_next/webpack-hmr") ||
              path.startsWith("/favicon");

            return isHealthOrMetrics || isCorsPreflight || isStaticAsset;
          },
          // Hook para garantir que os atributos 'http_status_code' e 'family' existam no span
          // conforme o contrato OTEL v1.0
          responseHook: (
            span,
            response: { statusCode?: number; status?: number }
          ) => {
            const statusCode = response.statusCode || response.status;
            if (statusCode) {
              const family = `${Math.floor(statusCode / 100)}xx`;
              span.setAttribute("http.status_code", statusCode);
              span.setAttribute("family", family);
            }
          },
          startIncomingSpanHook: (request) => {
            return {
              "http.method": request.method,
              "http.url": request.url,
            };
          },
        },
        "@opentelemetry/instrumentation-pino": {
          enabled: false, // We use a manual mixin in @turborepo/logging to have better control over trace context
        },
        "@opentelemetry/instrumentation-ioredis": {
          enabled: true,
        },
        "@opentelemetry/instrumentation-pg": {
          enabled: true,
        },
        "@opentelemetry/instrumentation-aws-sdk": {
          enabled: true,
          suppressInternalInstrumentation: true,
        },
      }),
    ],
  });

  console.log(`[OTEL] Starting SDK for ${config.OTEL_SERVICE_NAME}...`);
  sdk.start();
  console.log(`[OTEL] SDK started successfully.`);

  process.on("SIGTERM", () => {
    sdk
      .shutdown()
      .then(() => console.log("Tracing terminated"))
      .catch((error) => console.log("Error terminating tracing", error))
      .finally(() => process.exit(0));
  });
}

/**
 * Utilitário para métricas de Worker seguindo o contrato v1.0
 */
export function recordWorkerJob(status: "success" | "error") {
  const meter = metrics.getMeter("worker");
  const counter = meter.createCounter("worker_jobs_total", {
    description: "Total de jobs processados pelo worker",
  });
  counter.add(1, { status });
}
