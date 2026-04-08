import { AssistantGraph } from "./langgraph.flow";
import { ConversationService } from "./conversation.service";
import { createMultimodalAdapter, ChatModelLike } from "@turborepo/llm";

// This is a minimal entry point for LangGraph Studio
// It initializes the graph using environment variables and mocks DB services

// Mock ConversationService to avoid DB errors in Studio
const mockConversationService = {
  saveMessage: (_s: string, _u: string, r: string, c: string) => {
    console.log(`[Studio Mock] Save Message: ${r} - ${c.substring(0, 50)}...`);
    return Promise.resolve({ id: "mock-msg-id" });
  },
  getLastAssistantMessage: () =>
    Promise.resolve({
      id: "mock-msg-id",
      content: "Mock response",
    }),
  getHistory: () => Promise.resolve([]),
} as unknown as ConversationService;

const multimodalModel: ChatModelLike = createMultimodalAdapter({
  provider: process.env.LLM_MULTIMODAL_PROVIDER || "openai",
  apiKey: process.env.LLM_MULTIMODAL_OPENAI_API_KEY || "mock",
  modelName: process.env.LLM_MULTIMODAL_MODEL || "gpt-4o",
  temperature: 1,
});

const assistantGraphInstance = new AssistantGraph(
  multimodalModel,
  mockConversationService
);

export const graph = assistantGraphInstance.createGraph();
