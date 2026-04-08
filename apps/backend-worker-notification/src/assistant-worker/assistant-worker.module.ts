import { DynamicModule, Module } from "@nestjs/common";
import {
  AssistantModule,
  AGENT_SERVICE,
  KNOWLEDGE_BASE_SERVICE,
} from "@turborepo/assistant";
import {
  DatabaseModule,
  AssistantConversationEntity,
  AssistantMessageEntity,
  AgentEntity,
  AgentRepository,
  DocumentEmbeddingEntity,
  DOCUMENT_EMBEDDING_REPOSITORY,
  getRepositoryToken,
} from "@turborepo/database";
import type {
  Repository,
  IDocumentEmbeddingRepository,
} from "@turborepo/database";
import { createEmbeddingsAdapter } from "@turborepo/llm";
import { typedEnv } from "../env";
import { AssistantQueryConsumer } from "./assistant-query.consumer";

@Module({})
export class AssistantWorkerModule {
  static forRoot(): DynamicModule {
    // Registers AgentEntity and DocumentEmbeddingEntity so that AGENT_SERVICE
    // and KNOWLEDGE_BASE_SERVICE factories (passed as extraProviders to
    // AssistantModule) can inject AgentRepository and DOCUMENT_EMBEDDING_REPOSITORY.
    // AssistantConversationEntity / AssistantMessageEntity are also included so
    // that a single forFeature call covers all worker entities — the duplicate
    // registration with AssistantModule.forRoot() is harmless because
    // DatabaseModule.forFeature has global:true (last write wins, same value).
    const dbFeature = DatabaseModule.forFeature([
      AssistantConversationEntity,
      AssistantMessageEntity,
      AgentEntity,
      DocumentEmbeddingEntity,
    ]);

    return {
      module: AssistantWorkerModule,
      imports: [
        dbFeature,
        AssistantModule.forRoot({
          extraProviders: [
            {
              provide: AGENT_SERVICE,
              useFactory: (repo: Repository<AgentEntity>) => {
                const agentRepo = new AgentRepository(repo);
                return {
                  findOne: async (id: string) => {
                    const agent = await agentRepo.findById(id);
                    if (!agent) throw new Error(`Agent not found: ${id}`);
                    return {
                      specialty: agent.specialty,
                      guardRails: agent.guardRails,
                    };
                  },
                };
              },
              inject: [getRepositoryToken(AgentEntity)],
            },
            {
              provide: KNOWLEDGE_BASE_SERVICE,
              useFactory: (embeddingRepo: IDocumentEmbeddingRepository) => {
                const embeddings = createEmbeddingsAdapter({
                  provider: "openai",
                  apiKey:
                    typedEnv.LLM_EMBEDDINGS_OPENAI_API_KEY ??
                    typedEnv.LLM_MULTIMODAL_OPENAI_API_KEY,
                  model:
                    typedEnv.LLM_EMBEDDINGS_MODEL ?? "text-embedding-3-small",
                  baseUrl:
                    typedEnv.LLM_EMBEDDINGS_BASE_URL ??
                    typedEnv.LLM_MULTIMODAL_BASE_URL,
                });
                return {
                  findRelevantContext: async (
                    query: string,
                    userId: string,
                    limit: number = 5,
                    agentId?: string
                  ): Promise<string> => {
                    try {
                      const vector = await embeddings.embedQuery(query);
                      const results = await embeddingRepo.searchSimilar(
                        vector,
                        userId,
                        agentId,
                        limit
                      );
                      if (results.length === 0) return "";
                      return results
                        .map((r) => r.content)
                        .filter(Boolean)
                        .join("\n\n---\n\n");
                    } catch {
                      return "";
                    }
                  },
                };
              },
              inject: [DOCUMENT_EMBEDDING_REPOSITORY],
            },
          ],
        }),
      ],
      providers: [AssistantQueryConsumer],
    };
  }
}
