import { describe, it, expect, vi } from "vitest";
import { AssistantService } from "../src/services/assistant.service";
import { AIMessage } from "@langchain/core/messages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(overrides: {
  stream?: () => AsyncIterable<unknown>;
  invoke?: () => Promise<unknown>;
}) {
  const svc = Object.create(AssistantService.prototype) as AssistantService;
  const svcMock = svc as unknown as Record<string, unknown>;

  svcMock.logger = { log: vi.fn(), debug: vi.fn(), error: vi.fn() };

  svcMock.conversationService = {
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

  svcMock.graph = graphMock;
  // Mock getGraphForAgent so tests don't need graphMap / agentService
  svcMock.getGraphForAgent = vi.fn().mockResolvedValue(graphMock);

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

    expect(output.join("")).not.toContain("raciocínio interno");
    expect(output.join("")).toContain("Resposta visível");
  });

  it("yields greeting_handler node content", async () => {
    const svc = makeService({
      stream: async function* () {
        await Promise.resolve();
        yield [
          new AIMessage("Olá! Como posso ajudar?"),
          { langgraph_node: "greeting_handler" },
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

    expect(output).toEqual(["Olá! Como posso ajudar?"]);
  });
});
