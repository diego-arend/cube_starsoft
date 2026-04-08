import { describe, it, expect, beforeEach, vi } from "vitest";
import { KnowledgeBaseService } from "../../knowledge-base.service";
import type { IDocumentEmbeddingRepository } from "@turborepo/database";
import type { EmbeddingsService } from "../../embeddings.service";

describe("KnowledgeBaseService", () => {
  let svc: KnowledgeBaseService;
  let fakeRepo: Partial<IDocumentEmbeddingRepository>;
  let fakeEmbeddings: Partial<EmbeddingsService>;

  beforeEach(() => {
    fakeRepo = {
      searchSimilar: vi
        .fn()
        .mockResolvedValue([{ content: "chunk 1" }, { content: "chunk 2" }]),
      findByDocumentId: vi.fn().mockResolvedValue([]),
    };
    fakeEmbeddings = {
      embedQuery: vi.fn().mockResolvedValue([0.1, 0.2]),
    };

    svc = new KnowledgeBaseService(
      fakeRepo as unknown as IDocumentEmbeddingRepository,
      fakeEmbeddings as unknown as EmbeddingsService
    );
    vi.clearAllMocks();
  });

  it("should return joined context when results found", async () => {
    const res = await svc.findRelevantContext("search query", "user-123");
    expect(res).toContain("chunk 1");
    expect(res).toContain("---");
    expect(res).toContain("chunk 2");
    expect(fakeEmbeddings.embedQuery).toHaveBeenCalledWith("search query");
    expect(fakeRepo.searchSimilar).toHaveBeenCalledWith(
      expect.any(Array),
      "user-123",
      undefined,
      expect.any(Number)
    );
  });

  it("should return empty string when no results found", async () => {
    (fakeRepo.searchSimilar as any).mockResolvedValue([]);
    const res = await svc.findRelevantContext("nothing", "user-123");
    expect(res).toBe("");
  });

  it("should handle errors gracefully", async () => {
    (fakeEmbeddings.embedQuery as any).mockRejectedValue(new Error("API fail"));
    const res = await svc.findRelevantContext("error test", "user-123");
    expect(res).toBe("");
  });

  it("should call findByDocumentId in getChunksByDocumentId", async () => {
    await svc.getChunksByDocumentId("doc-123");
    expect(fakeRepo.findByDocumentId).toHaveBeenCalledWith("doc-123");
  });
});
