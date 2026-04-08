import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { createEmbeddingsAdapter } from "./createEmbeddingsAdapter";

describe("createEmbeddingsAdapter (OpenAI)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("embedQuery returns the embedding vector", async () => {
    const mockResponse = {
      data: [{ embedding: [0.1, 0.2, 0.3], index: 0, object: "embedding" }],
      model: "text-embedding-3-small",
      object: "list",
      usage: { prompt_tokens: 5, total_tokens: 5 },
    };
    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const adapter = createEmbeddingsAdapter({
      provider: "openai",
      apiKey: "sk-test",
      model: "text-embedding-3-small",
      baseUrl: "https://api.openai.com/v1/embeddings",
    });

    const result = await adapter.embedQuery("hello world");
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("embedQuery returns empty vector for blank text", async () => {
    const adapter = createEmbeddingsAdapter({
      provider: "openai",
      apiKey: "sk-test",
      model: "text-embedding-3-small",
      baseUrl: "https://api.openai.com/v1/embeddings",
    });

    const result = await adapter.embedQuery("   ");
    expect(result).toHaveLength(1536);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("embedDocuments returns batch embedding vectors", async () => {
    const mockResponse = {
      data: [
        { embedding: [0.1, 0.2], index: 0, object: "embedding" },
        { embedding: [0.3, 0.4], index: 1, object: "embedding" },
      ],
      model: "text-embedding-3-small",
      object: "list",
      usage: { prompt_tokens: 10, total_tokens: 10 },
    };
    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const adapter = createEmbeddingsAdapter({
      provider: "openai",
      apiKey: "sk-test",
      model: "text-embedding-3-small",
      baseUrl: "https://api.openai.com/v1/embeddings",
    });

    const result = await adapter.embedDocuments(["hello", "world"]);
    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it("embedDocuments returns empty array for empty input", async () => {
    const adapter = createEmbeddingsAdapter({
      provider: "openai",
      apiKey: "sk-test",
      model: "text-embedding-3-small",
      baseUrl: "https://api.openai.com/v1/embeddings",
    });

    const result = await adapter.embedDocuments([]);
    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("embedQuery throws on non-ok HTTP response", async () => {
    (fetch as Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    const adapter = createEmbeddingsAdapter({
      provider: "openai",
      apiKey: "sk-bad",
      model: "text-embedding-3-small",
      baseUrl: "https://api.openai.com/v1/embeddings",
    });

    await expect(adapter.embedQuery("test")).rejects.toThrow(
      "Embeddings OpenAI Error: 401"
    );
  });

  it("throws for unsupported provider", async () => {
    const adapter = createEmbeddingsAdapter({
      provider: "local",
      model: "local-model",
    });

    await expect(adapter.embedQuery("test")).rejects.toThrow(
      "Unsupported Embeddings provider"
    );
  });
});
