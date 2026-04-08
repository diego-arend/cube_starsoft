import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { EmbeddingsService } from "../../embeddings.service";

vi.stubGlobal("fetch", vi.fn());

describe("EmbeddingsService", () => {
  let svc: EmbeddingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new EmbeddingsService();
  });

  it("should embed a query correctly", async () => {
    const mockResponse = {
      data: [{ embedding: [0.1, 0.2] }],
      model: "text-embedding-3-small",
      usage: { prompt_tokens: 1, total_tokens: 1 },
    };

    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const res = await svc.embedQuery("test");
    expect(res).toEqual([0.1, 0.2]);
  });

  it("should embed documents correctly", async () => {
    const mockResponse = {
      data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }],
      model: "text-embedding-3-small",
      usage: { prompt_tokens: 2, total_tokens: 2 },
    };

    (fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const res = await svc.embedDocuments(["doc1", "doc2"]);
    expect(res).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });
});
