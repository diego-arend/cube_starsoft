import { describe, it, expect, vi } from "vitest";
import { AssistantGraph } from "../src/graph/langgraph.flow";

describe("AssistantGraph", () => {
  it("creates a compiled graph without error", () => {
    const modelMock = {
      invoke: vi.fn(),
      stream: vi.fn(),
    };

    const conversationServiceMock = {
      getHistory: vi.fn().mockResolvedValue([]),
      saveMessage: vi.fn().mockResolvedValue(undefined),
    };

    const graph = new AssistantGraph(
      modelMock as any,
      conversationServiceMock as any,
      undefined,
      undefined
    );

    graph.setSystemMessage("Especialista em suporte", "");

    const compiled = graph.createGraph();
    expect(compiled).toBeDefined();
    expect(typeof compiled.stream).toBe("function");
    expect(typeof compiled.invoke).toBe("function");
  });
});
