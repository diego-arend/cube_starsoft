import { Injectable, LoggerService, Provider } from "@nestjs/common";
import { createLogger, EnhancedLogger } from "../logger";
import type { NestLoggerOptions, HttpLogContract } from "../types";

import { HttpLogContractSchema } from "../types";

@Injectable()
export class NestPinoLogger implements LoggerService {
  private readonly logger: EnhancedLogger;

  constructor(opts?: NestLoggerOptions) {
    this.logger = createLogger(opts ?? {});
  }

  /**
   * Envia um log de requisição HTTP seguindo o contrato v1.0
   */
  httpResponse(data: HttpLogContract) {
    this.logger.httpResponse(data);
  }

  log(message: unknown, context?: string) {
    const msg: unknown = message;
    const meta: Record<string, unknown> = {};
    if (context) meta.context = context;

    // Detecção automática de contrato HTTP para garantir validação mesmo via .log()
    if (
      typeof msg === "object" &&
      msg !== null &&
      ("http.method" in msg || "http.url" in msg)
    ) {
      try {
        const validated = HttpLogContractSchema.parse({ ...meta, ...msg });
        this.logger.httpResponse(validated);
        return;
      } catch {
        // Se falhar a validação, segue para o log genérico (não é o contrato ideal)
      }
    }

    if (typeof msg === "string") {
      this.logger.info(meta, msg);
      return;
    }

    if (msg instanceof Error) {
      meta.err = msg;
      this.logger.info(meta, msg.message ?? String(msg));
      return;
    }

    if (typeof msg === "object" && msg !== null) {
      this.logger.info({ ...meta, ...msg });
      return;
    }

    this.logger.info(meta, String(msg));
  }

  error(message: unknown, trace?: string, context?: string) {
    const msg: unknown = message;
    const meta: Record<string, unknown> = {};
    if (context) meta.context = context;
    if (trace) meta.trace = trace;

    // Detecção automática de contrato HTTP em erros
    if (
      typeof msg === "object" &&
      msg !== null &&
      ("http.method" in msg || "http.url" in msg)
    ) {
      try {
        const validated = HttpLogContractSchema.parse({ ...meta, ...msg });
        this.logger.httpResponse(validated);
        return;
      } catch {
        // Fallback para log normal
      }
    }

    if (typeof msg === "string") {
      this.logger.error(meta, msg);
      return;
    }

    if (msg instanceof Error) {
      meta.err = msg;
      this.logger.error(meta, msg.stack ?? msg.message ?? String(msg));
      return;
    }

    if (typeof msg === "object" && msg !== null) {
      this.logger.error({ ...meta, ...msg });
      return;
    }

    this.logger.error(meta, String(msg));
  }

  warn(message: unknown, context?: string) {
    const msg: unknown = message;
    const meta: Record<string, unknown> = {};
    if (context) meta.context = context;

    if (typeof msg === "string") {
      this.logger.warn(meta, msg);
      return;
    }

    if (msg instanceof Error) {
      meta.err = msg;
      this.logger.warn(meta, msg.message ?? String(msg));
      return;
    }

    if (typeof msg === "object" && msg !== null) {
      this.logger.warn({ ...meta, ...msg });
      return;
    }

    this.logger.warn(meta, String(msg));
  }

  debug(message: unknown, context?: string) {
    const msg: unknown = message;
    const meta: Record<string, unknown> = {};
    if (context) meta.context = context;

    if (typeof msg === "string") {
      this.logger.debug(meta, msg);
      return;
    }

    if (msg instanceof Error) {
      meta.err = msg;
      this.logger.debug(meta, msg.message ?? String(msg));
      return;
    }

    if (typeof msg === "object" && msg !== null) {
      this.logger.debug({ ...meta, ...msg });
      return;
    }

    this.logger.debug(meta, String(msg));
  }

  verbose(message: unknown, context?: string) {
    const msg: unknown = message;
    const meta: Record<string, unknown> = {};
    if (context) meta.context = context;

    if (typeof msg === "string") {
      this.logger.trace(meta, msg);
      return;
    }

    if (msg instanceof Error) {
      meta.err = msg;
      this.logger.trace(meta, msg.message ?? String(msg));
      return;
    }

    if (typeof msg === "object" && msg !== null) {
      this.logger.trace({ ...meta, ...msg });
      return;
    }

    this.logger.trace(meta, String(msg));
  }
}

export const NestPinoLoggerProvider: Provider = {
  provide: NestPinoLogger,
  useFactory: () => new NestPinoLogger(),
};
