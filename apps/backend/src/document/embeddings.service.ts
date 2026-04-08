import { Injectable, Logger } from "@nestjs/common";
import { createEmbeddingsAdapter, EmbeddingsModelLike } from "@turborepo/llm";
import { typedEnv } from "../env";

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly embeddings: EmbeddingsModelLike;

  constructor() {
    const apiKey =
      typedEnv.LLM_EMBEDDINGS_OPENAI_API_KEY ||
      typedEnv.LLM_MULTIMODAL_OPENAI_API_KEY;
    const baseUrl =
      typedEnv.LLM_EMBEDDINGS_BASE_URL || typedEnv.LLM_MULTIMODAL_BASE_URL;
    const model = typedEnv.LLM_EMBEDDINGS_MODEL || "text-embedding-3-small";

    this.embeddings = createEmbeddingsAdapter({
      provider: "openai",
      apiKey: apiKey,
      model: model,
      baseUrl: baseUrl,
    });
  }

  async embedQuery(text: string): Promise<number[]> {
    try {
      this.logger.debug(`Embedding query: "${text}"`);
      return await this.embeddings.embedQuery(text);
    } catch (error: any) {
      this.logger.error(
        `Error embedding query: ${error.message}. Query: "${text}"`
      );
      throw error;
    }
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    try {
      return await this.embeddings.embedDocuments(texts);
    } catch (error: any) {
      this.logger.error(`Error embedding documents: ${error.message}`);
      throw error;
    }
  }
}
