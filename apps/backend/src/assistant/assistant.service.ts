import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { trace, SpanStatusCode, context } from "@opentelemetry/api";
import { AssistantGraph, AssistantCompiledGraph } from "./langgraph.flow";
import { NestPinoLogger } from "@turborepo/logging";
import { createMultimodalAdapter, ChatModelLike } from "@turborepo/llm";
import { ConversationService } from "./conversation.service";
import { KnowledgeBaseService } from "../document/knowledge-base.service";
import { AgentService } from "../agent/agent.service";
import { Env } from "../env";

@Injectable()
export class AssistantService {
  private readonly TEMPERATURE = 1;
  private multimodalModel: ChatModelLike;

  constructor(
    private configService: ConfigService<Env>,
    private conversationService: ConversationService,
    private knowledgeBaseService: KnowledgeBaseService,
    private agentService: AgentService,
    private readonly logger: NestPinoLogger
  ) {
    const apiKey = this.configService.get<string>(
      "LLM_MULTIMODAL_OPENAI_API_KEY"
    );

    const modelName = this.configService.get<string>("LLM_MULTIMODAL_MODEL");
    const baseUrl = this.configService.get<string>("LLM_MULTIMODAL_BASE_URL");
    const provider = this.configService.get<string>("LLM_MULTIMODAL_PROVIDER");

    this.multimodalModel = createMultimodalAdapter({
      provider: provider!,
      apiKey: apiKey!,
      modelName: modelName!,
      baseUrl: baseUrl,
      temperature: this.TEMPERATURE,
    });
  }

  private async getGraphForAgent(
    agentId?: string
  ): Promise<AssistantCompiledGraph> {
    // Build a fresh graph on every call — no in-memory cache.
    // compile() is fast (pure graph structure, no I/O) and the agent
    // specialty/guardRails must always reflect the current DB state so that
    // all replicas serve the same system prompt without stale-cache divergence.
    const assistantGraph = new AssistantGraph(
      this.multimodalModel,
      this.conversationService,
      this.knowledgeBaseService,
      this.logger
    );

    if (agentId) {
      const agent = await this.agentService.findOne(agentId);
      assistantGraph.setSystemMessage(agent.specialty, agent.guardRails);
    } else {
      assistantGraph.setSystemMessage(
        "Você é um agente de suporte explicativo especializado.",
        ""
      );
    }

    return assistantGraph.createGraph();
  }

  private extractText(content: any): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      const textPart = content.find((p) => p.type === "text");
      if (textPart?.text) return String(textPart.text);
      // Fallback: finding first string in array if no explicit text part
      const firstString = content.find((p) => typeof p === "string");
      if (firstString) return String(firstString);
    }
    return "";
  }

  async *streamQuery(
    payload: {
      query?: string;
      agentId?: string;
    },
    sessionId: string,
    userId: string
  ) {
    const tracer = trace.getTracer("assistant-service");
    const span = tracer.startSpan("assistant.streamQuery");
    // Ensure we await something in this async generator to satisfy linting
    await Promise.resolve();

    // We use context.with to ensure the span is active for all logic within this generator
    // This is crucial for the Pino logger mixin to find the active span.
    const ctx = trace.setSpan(context.active(), span);

    try {
      yield* context.with(
        ctx,
        async function* (this: AssistantService) {
          this.logger.log(
            `Starting streamQuery for session ${sessionId} (User: ${userId})`,
            AssistantService.name
          );
          // 1. Load context/history
          const history = await this.conversationService.getHistory(sessionId);

          // 2. Prepare inputs for the graph
          const inputs = {
            messages: history,
            pendingQuery: payload.query,
          };

          this.logger.log(
            `Invoking graph stream with inputs: hasQuery=${!!payload.query}`,
            AssistantService.name
          );

          const graph = await this.getGraphForAgent(payload.agentId);
          const stream = await graph.stream(inputs, {
            configurable: {
              thread_id: sessionId,
              sessionId,
              userId,
              agentId: payload.agentId,
            },
            streamMode: "messages",
          });

          this.logger.log(
            `Stream object created for session ${sessionId}`,
            AssistantService.name
          );

          let isThinking = false;
          let sawAgentChunk = false;

          for await (const [message, metadata] of stream) {
            const nodeName = metadata.langgraph_node;
            const msgType = message.getType();

            // Debug to see exactly what we're receiving
            this.logger.debug(
              `Node: ${nodeName}, MsgType: ${msgType}, Class: ${message.constructor.name}, ContentLen: ${message.content?.length}`,
              AssistantService.name
            );

            // 3. Yield assistant response chunks from the 'agent' or 'greeting_handler' node
            if (nodeName === "agent" || nodeName === "greeting_handler") {
              const isChunk = message.constructor.name.includes("Chunk");

              if (msgType === "ai" && message.content) {
                if (isChunk) {
                  sawAgentChunk = true;
                  let content = this.extractText(message.content);

                  // Handle <think> tag state
                  if (content.includes("<think>")) {
                    isThinking = true;
                    // If there's content before <think>, we should yield it
                    const parts = content.split("<think>");
                    if (parts[0]) yield parts[0];
                    content = parts[1] || "";
                  }

                  if (isThinking) {
                    if (content.includes("</think>")) {
                      isThinking = false;
                      const parts = content.split("</think>");
                      if (parts[1]) yield parts[1];
                    }
                    // If we are still thinking, we just skip this content
                    continue;
                  }

                  yield content;
                } else {
                  if (!sawAgentChunk) {
                    let content = this.extractText(message.content);

                    if (content.includes("<think>")) {
                      content = content
                        .replace(/<think>[\s\S]*?<\/think>/g, "")
                        .trim();
                    }

                    if (content) {
                      yield content;
                    }
                  } else {
                    this.logger.debug(
                      "Skipping full AI message to avoid duplication",
                      AssistantService.name
                    );
                  }
                }
              }
            }
          }
        }.bind(this)
      );
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message:
          error instanceof Error ? error.message : "Error in streamQuery",
      });
      if (error instanceof Error) span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  async clearSessionCache(sessionId: string): Promise<void> {
    await this.conversationService.clearSessionCache(sessionId);
  }

  // Simple query for fallback HTTP
  async query(
    sessionId: string,
    query?: string,
    userId: string = "system",
    agentId?: string
  ): Promise<{
    userText: string;
    assistantResponse: string;
  }> {
    return await trace
      .getTracer("assistant-service")
      .startActiveSpan("assistant.query", async (span) => {
        try {
          const history = await this.conversationService.getHistory(sessionId);

          const inputs = {
            messages: history,
            pendingQuery: query,
          };

          const graph = await this.getGraphForAgent(agentId);
          const result = (await graph.invoke(inputs, {
            configurable: { thread_id: sessionId, sessionId, userId, agentId },
          })) as any;

          // Find the last assistant message
          const assistantMessages = (result.messages || []).filter(
            (m: any) => m.getType() === "ai"
          );

          // Find the last user message
          const userMessages = (result.messages || []).filter(
            (m: any) => m.getType() === "human"
          );

          const lastAssistantMessage =
            assistantMessages[assistantMessages.length - 1];
          const lastUserMessage = userMessages[userMessages.length - 1];

          return {
            userText: this.extractText(lastUserMessage?.content) || query || "",
            assistantResponse:
              this.extractText(lastAssistantMessage?.content) || "",
          };
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : "Error in query",
          });
          if (error instanceof Error) span.recordException(error);
          throw error;
        } finally {
          span.end();
        }
      });
  }
}
