import type pino from "pino";
import { z } from "zod";

export const ExporterTypeSchema = z.enum(["otlp", "loki", "http", "none"]);
export type ExporterType = z.infer<typeof ExporterTypeSchema>;

/**
 * Contrato de Dados (v1.0) para Logs de Requisição HTTP
 */
export const HttpLogContractSchema = z.object({
  "http.method": z
    .string()
    .describe("Método HTTP em caixa alta (ex: GET, POST)"),
  "http.url": z.string().describe("URL completa ou path"),
  "http.status_code": z.number().int().describe("Código de status HTTP"),
  "http.route": z
    .string()
    .optional()
    .describe("Template da rota (ex: /users/:id)"),
  "http.user_agent": z
    .string()
    .optional()
    .describe("User Agent do browser/client"),
  "http.client_ip": z.string().optional().describe("IP do originário"),
  "service.name": z.string().optional(),
  "deployment.environment": z.string().optional(),
  trace_id: z.string().optional(),
  span_id: z.string().optional(),
  duration: z.string().optional(),
  msg: z.string(),
});

export type HttpLogContract = z.infer<typeof HttpLogContractSchema>;

export interface LoggerOptions {
  level?: pino.LevelWithSilent;
  pretty?: boolean;
  serviceName?: string;
  env?: string;
  exporter?: ExporterType;
  exporterEndpoint?: string;
  exporterHeaders?: Record<string, string> | string;
  /** Optional destination stream – primarily for testing. Bypasses all
   *  automatic destination selection (NODE_ENV, pretty, OTel toggle). */
  dest?: pino.DestinationStream;
}

export type NestLoggerOptions = LoggerOptions;
