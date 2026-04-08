import { Writable } from "node:stream";
import pino from "pino";
import { trace, isSpanContextValid } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import type { LoggerOptions, HttpLogContract } from "./types";
import { HttpLogContractSchema } from "./types";

/**
 * Maps Pino numeric levels to OpenTelemetry SeverityNumbers.
 */
function mapPinoLevelToOTelSeverity(level: number): SeverityNumber {
  if (level <= 10) return SeverityNumber.TRACE;
  if (level <= 20) return SeverityNumber.DEBUG;
  if (level <= 30) return SeverityNumber.INFO;
  if (level <= 40) return SeverityNumber.WARN;
  if (level <= 50) return SeverityNumber.ERROR;
  return SeverityNumber.FATAL;
}

export type EnhancedLogger = pino.Logger & {
  /**
   * Envia um log de requisição HTTP validado pelo contrato v1.0
   */
  httpResponse: (data: HttpLogContract) => void;
};

export function createLogger(opts: LoggerOptions = {}): EnhancedLogger {
  const {
    level = "info",
    pretty = false,
    serviceName,
    dest: customDest,
  } = opts;

  const base = {
    "service.name": serviceName,
    "deployment.environment": process.env.NODE_ENV || "development",
  };

  const pinoOptions: pino.LoggerOptions = {
    level,
    base,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
    redact: {
      paths: [
        "password",
        "*.password",
        "token",
        "*.token",
        "accessToken",
        "*.accessToken",
        "refreshToken",
        "*.refreshToken",
        "secret",
        "*.secret",
        "authorization",
        "headers.authorization",
        "cookie",
        "headers.cookie",
        "oldPassword",
        "*.oldPassword",
        "newPassword",
        "*.newPassword",
        "confirmPassword",
        "*.confirmPassword",
      ],
      censor: "[REDACTED]",
    },
    mixin() {
      const span = trace.getActiveSpan();
      if (span) {
        const spanCtx = span.spanContext();
        // Robust check for valid span context to avoid logging zeros (trace-id=0000...)
        if (isSpanContextValid(spanCtx)) {
          return {
            trace_id: spanCtx.traceId,
            span_id: spanCtx.spanId,
            trace_flags: `0${spanCtx.traceFlags.toString(16)}`.slice(-2),
          };
        }
      }
      return {};
    },
  };

  // 1. Determine destination (Single or Multi-stream)
  const isOtelLogEnabled = process.env.LOG_EXPORTER_ENABLED === "true";
  const isTestEnv = process.env.NODE_ENV === "test";
  let destination: pino.DestinationStream | pino.LoggerOptions["transport"];

  if (customDest) {
    // Caller-supplied stream takes priority (used in tests to capture output).
    destination = customDest;
  } else if (level === "silent" || isTestEnv) {
    // In test environments (NODE_ENV=test) and for explicitly silent loggers,
    // use a synchronous no-op Writable so pino skips SonicBoom entirely.
    // SonicBoom wraps process.stdout with a setImmediate-based flush queue;
    // under concurrent vitest workers those pending callbacks keep the event
    // loop alive and cause intermittent 5s testTimeout failures.
    destination = new Writable({ write: (_chunk, _enc, cb) => cb() });
  } else if (pretty) {
    // Pretty printing (usually for local development)
    destination = pino.transport({
      target: "pino-pretty",
      options: { colorize: true },
    });
  } else if (isOtelLogEnabled) {
    // Multi-stream: Stdout + OpenTelemetry Log Bridge
    const otelStream: pino.DestinationStream = {
      write(msg: string) {
        try {
          const log = JSON.parse(msg);
          const otelLogger = logs.getLogger(serviceName || "default");

          otelLogger.emit({
            severityNumber: mapPinoLevelToOTelSeverity(log.level),
            severityText: (log.level >= 50 ? "ERROR" : "INFO").toUpperCase(),
            body: log.msg,
            attributes: {
              ...log,
              // Map pino context to OTel resource/attribute keys if needed
              "service.name": serviceName,
            },
            timestamp: log.time ? new Date(log.time).getTime() : Date.now(),
          });
        } catch {
          // Fallback to avoid breaking pino if OTel emit fails or JSON parse fails
        }
      },
    };

    // Note: pino.multistream expects an array of streams
    destination = pino.multistream([
      { stream: process.stdout },
      { stream: otelStream },
    ]);
  } else {
    // Default JSON to stdout
    destination = process.stdout;
  }

  const pinoLogger = pino(pinoOptions, destination as pino.DestinationStream);

  // Extende o pino com o método do contrato
  const logger = pinoLogger as EnhancedLogger;

  logger.httpResponse = (data: HttpLogContract) => {
    // Validação em runtime via Zod para garantir que o contrato não seja burlado
    const validatedData = HttpLogContractSchema.parse(data);
    logger.info(validatedData);
  };

  return logger;
}
