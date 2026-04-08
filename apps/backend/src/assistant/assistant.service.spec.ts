import { describe, it, expect, vi } from "vitest";
import { AssistantService } from "./assistant.service";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(overrides: {
  stream?: () => AsyncIterable<any>;
  invoke?: () => Promise<any>;
}) {
  const svc = Object.create(AssistantService.prototype) as AssistantService;

  (svc as any).logger = { log: vi.fn(), debug: vi.fn(), error: vi.fn() };

  (svc as any).conversationService = {
    getHistory: vi.fn().mockResolvedValue([]),
    saveMessage: vi.fn().mockResolvedValue(undefined),
  };

  const graphMock = {
    stream: overrides.stream
      ? vi.fn().mockResolvedValue(overrides.stream())
      : vi.fn(),
    invoke: overrides.invoke
      ? vi.fn().mockImplementation(overrides.invoke)
      : vi.fn(),
  };

  (svc as any).graph = graphMock;
  // Mock getGraphForAgent so tests don't need graphMap / agentService
  (svc as any).getGraphForAgent = vi.fn().mockResolvedValue(graphMock);

  return svc;
}

// ---------------------------------------------------------------------------
// streamQuery — text-only
// ---------------------------------------------------------------------------

describe("AssistantService.streamQuery", () => {
  it("yields full AIMessage content when no streaming chunks are received", async () => {
    const svc = makeService({
      stream: async function* () {
        await Promise.resolve();
        yield [new AIMessage("Resposta completa"), { langgraph_node: "agent" }];
      },
    });

    const output: string[] = [];
    for await (const chunk of svc.streamQuery(
      { query: "Oi" },
      "session-1",
      "user-1"
    )) {
      output.push(String(chunk));
    }

    expect(output).toEqual(["Resposta completa"]);
  });

  it("prefers AIMessageChunk tokens over full messages", async () => {
    const svc = makeService({
      stream: async function* () {
        await Promise.resolve();
        yield [
          {
            content: "Parcial ",
            getType: () => "ai",
            constructor: { name: "AIMessageChunk" },
          },
          { langgraph_node: "agent" },
        ];
        // Full message that should be skipped because chunks were seen
        yield [new AIMessage("Resposta completa"), { langgraph_node: "agent" }];
      },
    });

    const output: string[] = [];
    for await (const chunk of svc.streamQuery(
      { query: "Oi" },
      "session-1",
      "user-1"
    )) {
      output.push(String(chunk));
    }

    expect(output).toEqual(["Parcial "]);
  });

  it("strips <think>…</think> blocks from the yielded output", async () => {
    const svc = makeService({
      stream: async function* () {
        await Promise.resolve();
        yield [
          new AIMessage("<think>raciocínio interno</think>Resposta visível"),
          { langgraph_node: "agent" },
        ];
      },
    });

    const output: string[] = [];
    for await (const chunk of svc.streamQuery(
      { query: "Oi" },
      "session-1",
      "user-1"
    )) {
      output.push(String(chunk));
    }

    const joined = output.join("");
    expect(joined).not.toContain("raciocínio interno");
    expect(joined).toContain("Resposta visível");
  });

  it("ignores messages from non-agent nodes", async () => {
    const svc = makeService({
      stream: async function* () {
        await Promise.resolve();
        yield [
          new AIMessage("Ignorar"),
          { langgraph_node: "retrieve_context" },
        ];
        yield [new AIMessage("Resposta"), { langgraph_node: "agent" }];
      },
    });

    const output: string[] = [];
    for await (const chunk of svc.streamQuery(
      { query: "Oi" },
      "session-1",
      "user-1"
    )) {
      output.push(String(chunk));
    }

    expect(output).toEqual(["Resposta"]);
  });
});

// ---------------------------------------------------------------------------
// query — HTTP fallback
// ---------------------------------------------------------------------------

describe("AssistantService.query", () => {
  it("returns userText and assistantResponse from graph result", async () => {
    const svc = makeService({
      invoke: async () => {
        await Promise.resolve();
        return {
          messages: [
            new HumanMessage("pergunta do usuário"),
            new AIMessage("resposta do assistente"),
          ],
        };
      },
    });

    const result = await svc.query(
      "session-1",
      "pergunta do usuário",
      "user-1"
    );

    expect(result.userText).toBe("pergunta do usuário");
    expect(result.assistantResponse).toBe("resposta do assistente");
  });

  it("returns empty assistantResponse when graph returns no messages", async () => {
    const svc = makeService({
      invoke: async () => {
        await Promise.resolve();
        return { messages: [] };
      },
    });

    const result = await svc.query("session-1", "oi", "user-1");

    expect(result.assistantResponse).toBe("");
  });

  it("propagates errors thrown by the graph", async () => {
    const svc = makeService({
      invoke: async () => {
        await Promise.resolve();
        throw new Error("LLM failure");
      },
    });

    await expect(svc.query("session-1", "oi", "user-1")).rejects.toThrow(
      "LLM failure"
    );
  });
});
