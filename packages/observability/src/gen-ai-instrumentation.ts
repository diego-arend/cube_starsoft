import { trace, SpanKind, SpanStatusCode, metrics } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";

export type GenAIOperation =
  | "embeddings"
  | "chat"
  | "text_completion"
  | "stt"
  | "tts"
  | "retrieval";

export interface RecordGenAITokensParams {
  operation: GenAIOperation;
  provider: string;
  requestModel: string;
  responseModel: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Extrai o hostname de uma URL base para uso no atributo server.address.
 */
export function resolveServerAddress(baseUrl?: string): string {
  if (!baseUrl) return "api.openai.com";
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return "api.openai.com";
  }
}

/**
 * Registra o uso de tokens no histograma gen_ai.client.token.usage
 * conforme a especificação OTel GenAI Semantic Conventions.
 *
 * Buckets: [1, 4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144, ...]
 */
export function recordGenAITokenUsage(params: RecordGenAITokensParams): void {
  const {
    operation,
    provider,
    requestModel,
    responseModel,
    inputTokens,
    outputTokens,
  } = params;

  const meter = metrics.getMeter("gen-ai-client");
  const hist = meter.createHistogram("gen_ai.client.token.usage", {
    description: "Number of input and output tokens used",
    unit: "{token}",
    advice: {
      explicitBucketBoundaries: [
        1, 4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304,
        16777216, 67108864,
      ],
    },
  });

  const baseLabels: Record<string, string> = {
    "gen_ai.operation.name": operation,
    "gen_ai.provider.name": provider,
    "gen_ai.request.model": requestModel,
    "gen_ai.response.model": responseModel,
  };

  if (inputTokens != null && inputTokens > 0) {
    hist.record(inputTokens, { ...baseLabels, "gen_ai.token.type": "input" });
  }
  if (outputTokens != null && outputTokens > 0) {
    hist.record(outputTokens, { ...baseLabels, "gen_ai.token.type": "output" });
  }
}

/**
 * Abre um span OTel com atributos gen_ai.* obrigatórios (nome canônico:
 * `{operation} {model}`) e registra a duração em
 * gen_ai.client.operation.duration ao final.
 *
 * Exemplo — embeddings:
 * ```ts
 * const data = await withGenAISpan("embeddings", "text-embedding-3-small", "openai", {
 *   "server.address": resolveServerAddress(baseUrl),
 * }, async (span) => {
 *   const res = await fetch(...);
 *   span.setAttribute("gen_ai.usage.input_tokens", res.usage.prompt_tokens);
 *   return res;
 * });
 * ```
 *
 * Buckets de duração: [0.01s → 81.92s] conforme especificação OTel GenAI v1.40.
 */
export function withGenAISpan<T>(
  operation: GenAIOperation,
  model: string,
  provider: string,
  attributes: Record<string, string | number>,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = trace.getTracer("gen-ai-client");
  const startMs = Date.now();
  const serverAddress =
    (attributes["server.address"] as string | undefined) ?? "api.openai.com";

  return tracer.startActiveSpan(
    `${operation} ${model}`,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        "gen_ai.operation.name": operation,
        "gen_ai.provider.name": provider,
        "gen_ai.request.model": model,
        "server.address": "api.openai.com",
        "server.port": 443,
        ...attributes,
      },
    },
    async (span) => {
      let errorType: string | undefined;
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err: unknown) {
        const error = err as Error;
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        errorType = error.constructor?.name ?? "Error";
        span.setAttribute("error.type", errorType);
        throw err;
      } finally {
        const durationSec = (Date.now() - startMs) / 1000;

        const metricAttrs: Record<string, string | number> = {
          "gen_ai.operation.name": operation,
          "gen_ai.provider.name": provider,
          "gen_ai.request.model": model,
          "server.address": serverAddress,
        };
        if (errorType) {
          metricAttrs["error.type"] = errorType;
        }

        metrics
          .getMeter("gen-ai-client")
          .createHistogram("gen_ai.client.operation.duration", {
            description: "GenAI client operation duration",
            unit: "s",
            advice: {
              explicitBucketBoundaries: [
                0.01, 0.02, 0.04, 0.08, 0.16, 0.32, 0.64, 1.28, 2.56, 5.12,
                10.24, 20.48, 40.96, 81.92,
              ],
            },
          })
          .record(durationSec, metricAttrs);

        span.end();
      }
    }
  );
}
