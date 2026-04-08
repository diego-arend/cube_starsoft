import { EmbeddingsConfig, EmbeddingsConfigSchema } from "./schema";
import { createLogger } from "@turborepo/logging";
import {
  withGenAISpan,
  recordGenAITokenUsage,
  resolveServerAddress,
} from "@turborepo/observability";

export interface EmbeddingsModelLike {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

interface OpenAIEmbeddingItem {
  embedding: number[];
  index: number;
  object: string;
}

interface OpenAIEmbeddingsResponse {
  data: OpenAIEmbeddingItem[];
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export function createEmbeddingsAdapter(
  config: EmbeddingsConfig
): EmbeddingsModelLike {
  const logger = createLogger({ serviceName: "embeddings-provider" });
  const validatedConfig = EmbeddingsConfigSchema.parse(config);
  const { provider, apiKey, model, baseUrl } = validatedConfig;

  logger.info({ provider, model, baseUrl }, "Initializing Embeddings adapter");

  return {
    async embedQuery(text: string): Promise<number[]> {
      if (provider === "openai") {
        if (!apiKey)
          throw new Error(
            "Embeddings config error: apiKey is required for openai"
          );
        if (!baseUrl)
          throw new Error(
            "Embeddings config error: baseUrl is required for openai"
          );

        if (!text || text.trim().length === 0) {
          logger.warn(
            "Empty query passed to embedQuery, returning empty vector"
          );
          return new Array(1536).fill(0);
        }

        const url = baseUrl;

        return withGenAISpan(
          "embeddings",
          model,
          provider,
          {
            "server.address": resolveServerAddress(baseUrl),
            "gen_ai.request.encoding_formats": "float",
          },
          async (span) => {
            logger.debug(
              {
                url,
                model,
                textLength: text.length,
                preview: text.substring(0, 50),
              },
              "Sending request to OpenAI Embeddings"
            );

            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                input: text,
                model: model,
              }),
            });

            if (!response.ok) {
              const errorMsg = await response.text();
              logger.error(
                { status: response.status, url, model },
                `Embeddings OpenAI Error: ${errorMsg}`
              );
              throw new Error(
                `Embeddings OpenAI Error: ${response.status} - ${errorMsg}`
              );
            }

            const data = (await response.json()) as OpenAIEmbeddingsResponse;
            if (!data.data || data.data.length === 0 || !data.data[0]) {
              throw new Error("OpenAI Embeddings error: empty data returned");
            }

            span.setAttribute("gen_ai.response.model", data.model);
            span.setAttribute(
              "gen_ai.usage.input_tokens",
              data.usage.prompt_tokens
            );
            span.setAttribute(
              "gen_ai.embeddings.dimension.count",
              data.data[0].embedding.length
            );

            recordGenAITokenUsage({
              operation: "embeddings",
              provider,
              requestModel: model,
              responseModel: data.model,
              inputTokens: data.usage.prompt_tokens,
            });

            return data.data[0].embedding;
          }
        );
      }

      throw new Error(`Unsupported Embeddings provider: ${provider}`);
    },

    async embedDocuments(texts: string[]): Promise<number[][]> {
      if (provider === "openai") {
        if (!apiKey)
          throw new Error(
            "Embeddings config error: apiKey is required for openai"
          );
        if (!baseUrl)
          throw new Error(
            "Embeddings config error: baseUrl is required for openai"
          );

        if (!texts || texts.length === 0) {
          return [];
        }

        const url = baseUrl;

        return withGenAISpan(
          "embeddings",
          model,
          provider,
          {
            "server.address": resolveServerAddress(baseUrl),
            "gen_ai.request.encoding_formats": "float",
          },
          async (span) => {
            logger.debug(
              {
                url,
                model,
                count: texts.length,
                firstPreview: texts[0]?.substring(0, 50),
              },
              "Sending request to OpenAI Embeddings (batch)"
            );

            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                input: texts,
                model: model,
              }),
            });

            if (!response.ok) {
              const errorMsg = await response.text();
              logger.error(
                { status: response.status, url, model },
                `Embeddings OpenAI Error: ${errorMsg}`
              );
              throw new Error(
                `Embeddings OpenAI Error: ${response.status} - ${errorMsg}`
              );
            }

            const data = (await response.json()) as OpenAIEmbeddingsResponse;
            if (!data.data) {
              throw new Error(
                "OpenAI Embeddings error: no data field in response"
              );
            }

            span.setAttribute("gen_ai.response.model", data.model);
            span.setAttribute(
              "gen_ai.usage.input_tokens",
              data.usage.prompt_tokens
            );

            recordGenAITokenUsage({
              operation: "embeddings",
              provider,
              requestModel: model,
              responseModel: data.model,
              inputTokens: data.usage.prompt_tokens,
            });

            return data.data.map((item) => item.embedding);
          }
        );
      }

      throw new Error(`Unsupported Embeddings provider: ${provider}`);
    },
  };
}
