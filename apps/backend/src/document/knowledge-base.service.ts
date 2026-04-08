import { Injectable, Logger, Inject } from "@nestjs/common";
import { DOCUMENT_EMBEDDING_REPOSITORY } from "@turborepo/database";
import type { IDocumentEmbeddingRepository } from "@turborepo/database";
import { EmbeddingsService } from "./embeddings.service";

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    @Inject(DOCUMENT_EMBEDDING_REPOSITORY)
    private readonly embeddingRepo: IDocumentEmbeddingRepository,
    private readonly embeddingsService: EmbeddingsService
  ) {}

  async findRelevantContext(
    query: string,
    ownerId: string,
    limit: number = 5,
    agentId?: string
  ): Promise<string> {
    this.logger.log(
      `Searching context for query: "${query}" (user: ${ownerId}, agent: ${agentId ?? "none"})`
    );

    try {
      const queryVector = await this.embeddingsService.embedQuery(query);
      const results = await this.embeddingRepo.searchSimilar(
        queryVector,
        ownerId,
        agentId,
        limit
      );

      if (results.length === 0) {
        this.logger.log("No relevant context found.");
        return "";
      }

      this.logger.log(`Found ${results.length} relevant chunks.`);

      return results
        .map((res) => res.content)
        .filter(Boolean)
        .join("\n\n---\n\n");
    } catch (error: any) {
      this.logger.error(`Error searching context: ${error.message}`);
      return "";
    }
  }

  async getChunksByDocumentId(documentId: string) {
    return this.embeddingRepo.findByDocumentId(documentId);
  }
}
