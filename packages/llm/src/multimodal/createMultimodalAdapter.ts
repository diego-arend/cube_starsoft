import { ChatOpenAI } from "@langchain/openai";
import { ChatModelLike } from "./types";
import { MultimodalConfig, MultimodalConfigSchema } from "./schema";
import { createLogger } from "@turborepo/logging";
import {
  withGenAISpan,
  resolveServerAddress,
  recordGenAITokenUsage,
} from "@turborepo/observability";

export function createMultimodalAdapter(
  config: MultimodalConfig
): ChatModelLike {
  const logger = createLogger({ serviceName: "multimodal-provider" });

  // Validate config and throw if invalid (fail-fast)
  try {
    const validatedConfig = MultimodalConfigSchema.parse(config);

    const {
      provider,
      apiKey,
      modelName,
      baseUrl,
      temperature = 0.7,
      maxCompletionTokens,
      reasoningEffort,
    } = validatedConfig;

    // Basic provider detection
    const isOpenAI = provider === "openai";

    if (isOpenAI) {
      logger.info(
        { modelName, baseUrl, provider },
        "Initializing OpenAI Multimodal provider"
      );

      const openAIModel = new ChatOpenAI({
        apiKey,
        modelName,
        configuration: {
          baseURL: baseUrl,
          apiKey,
        },
        temperature,
        streaming: true,
        maxCompletionTokens,
        ...(reasoningEffort ? { reasoningEffort } : {}),
      });

      const spanAttrs: Record<string, string | number> = {
        "server.address": resolveServerAddress(baseUrl),
        "gen_ai.request.temperature": temperature ?? 0.7,
        "gen_ai.output.type": "text",
      };
      if (maxCompletionTokens != null) {
        spanAttrs["gen_ai.request.max_tokens"] = maxCompletionTokens;
      }

      const wrappedInvoke: ChatModelLike["invoke"] = (input, config) =>
        withGenAISpan("chat", modelName, provider, spanAttrs, async (span) => {
          const res = await openAIModel.invoke(input, config);

          const usageMeta = (
            res as {
              usage_metadata?: {
                input_tokens?: number;
                output_tokens?: number;
              };
            }
          ).usage_metadata;

          if (usageMeta) {
            if (usageMeta.input_tokens != null) {
              span.setAttribute(
                "gen_ai.usage.input_tokens",
                usageMeta.input_tokens
              );
            }
            if (usageMeta.output_tokens != null) {
              span.setAttribute(
                "gen_ai.usage.output_tokens",
                usageMeta.output_tokens
              );
            }
            recordGenAITokenUsage({
              operation: "chat",
              provider,
              requestModel: modelName,
              responseModel: modelName,
              inputTokens: usageMeta.input_tokens,
              outputTokens: usageMeta.output_tokens,
            });
          }

          return res;
        });

      return {
        invoke: wrappedInvoke,
        stream: openAIModel.stream.bind(openAIModel),
      };
    }

    throw new Error(`Unsupported Multimodal provider: ${provider}`);
  } catch (err) {
    logger.error({ err, config }, "Failed to initialize Multimodal provider");
    throw err;
  }
}
