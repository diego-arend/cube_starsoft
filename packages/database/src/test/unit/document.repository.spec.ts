import { describe, it, expect, vi, beforeEach } from "vitest";
import { DocumentRepository } from "../../repositories/document.repository";

describe("DocumentRepository fallback insert", () => {
  let mockRepo: any;
  let sut: DocumentRepository;

  beforeEach(() => {
    mockRepo = {
      save: vi
        .fn()
        .mockRejectedValue(
          new Error('No metadata for "DocumentEntity" was found.')
        ),
      manager: {
        query: vi.fn().mockResolvedValue([
          {
            id: "id",
            key: "k",
            owner_id: "o",
            original_filename: "f.pdf",
            content_type: "application/pdf",
            size: 100,
            metadata: "{}",
            scan_status: "clean",
          },
        ]),
      },
    };
    sut = new DocumentRepository(mockRepo);
  });

  it("falls back to raw insert when TypeORM metadata missing", async () => {
    const res = await sut.save({
      key: "k",
      ownerId: "o",
      originalFilename: "f.pdf",
      contentType: "application/pdf",
      size: 100,
      metadata: {},
    });
    expect(mockRepo.manager.query).toHaveBeenCalled();
    expect(res).toBeDefined();
    expect(res.key).toBe("k");
  });
});
