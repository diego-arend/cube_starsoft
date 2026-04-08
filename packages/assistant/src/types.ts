/**
 * Minimal interface for an optional RAG provider.
 * Implement this interface in your KnowledgeBase service to enable
 * context retrieval in the AssistantGraph.
 */
export interface KnowledgeBaseService {
  findRelevantContext(
    query: string,
    userId: string,
    limit: number,
    agentId?: string
  ): Promise<string>;
}

/**
 * Minimal interface for an optional Agent provider.
 * Implement this interface in your Agent service to enable
 * per-agent system messages in the AssistantService.
 */
export interface AgentService {
  findOne(id: string): Promise<{ specialty: string; guardRails: string }>;
}

/**
 * Injection token for the optional KnowledgeBaseService.
 * Provide a value for this token via extraProviders in AssistantModule.forRoot()
 * to enable RAG (retrieval-augmented generation).
 */
export const KNOWLEDGE_BASE_SERVICE = Symbol("KNOWLEDGE_BASE_SERVICE");

/**
 * Injection token for the optional AgentService.
 * Provide a value for this token via extraProviders in AssistantModule.forRoot()
 * to enable per-agent system prompts.
 */
export const AGENT_SERVICE = Symbol("AGENT_SERVICE");
