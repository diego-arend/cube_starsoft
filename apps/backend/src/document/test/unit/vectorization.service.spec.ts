import { describe, it, expect, beforeEach, vi } from "vitest";
import { VectorizationService } from "../../vectorization.service";
import type {
  IDocumentEmbeddingRepository,
  DocumentEntity,
} from "@turborepo/database";
import type { EmbeddingsService } from "../../embeddings.service";
import type { BucketService } from "@turborepo/bucket";
import * as pdfjs from "pdfjs-dist";

vi.mock("pdfjs-dist", () => ({
  getDocument: vi.fn(),
}));

describe("VectorizationService", () => {
  let svc: VectorizationService;
  let fakeRepo: Partial<IDocumentEmbeddingRepository>;
  let fakeEmbeddings: Partial<EmbeddingsService>;
  let fakeKbBucket: Partial<BucketService>;

  beforeEach(() => {
    fakeRepo = {
      save: vi.fn().mockResolvedValue({}),
      deleteByDocumentId: vi.fn().mockResolvedValue({}),
    };
    fakeEmbeddings = {
      embedDocuments: vi
        .fn()
        .mockImplementation((texts: string[]) =>
          Promise.resolve(texts.map(() => [0.1, 0.2, 0.3]))
        ),
    };
    fakeKbBucket = {
      upload: vi.fn().mockResolvedValue({}),
    };

    svc = new VectorizationService(
      fakeRepo as unknown as IDocumentEmbeddingRepository,
      fakeEmbeddings as unknown as EmbeddingsService,
      fakeKbBucket as unknown as BucketService
    );
    vi.clearAllMocks();
  });

  it("should vectorize a document correctly and upload to KB bucket", async () => {
    const document = { id: "doc-1", ownerId: "user-1" } as DocumentEntity;
    const buffer = Buffer.from("fake pdf content");

    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({
            items: [
              { str: "This is a test content that should be vectorized." },
            ],
          }),
        }),
      }),
    } as unknown as ReturnType<typeof pdfjs.getDocument>);

    await svc.vectorizeDocument(document, buffer);

    expect(pdfjs.getDocument).toHaveBeenCalled();
    // Should have uploaded source, full text, and chunks
    expect(fakeKbBucket.upload).toHaveBeenCalledWith(
      expect.stringContaining("sources/doc-1.pdf"),
      buffer,
      expect.anything()
    );
    expect(fakeKbBucket.upload).toHaveBeenCalledWith(
      expect.stringContaining("texts/doc-1.txt"),
      expect.stringContaining(
        "This is a test content that should be vectorized."
      ),
      expect.anything()
    );
    expect(fakeEmbeddings.embedDocuments).toHaveBeenCalled();
    expect(fakeRepo.save).toHaveBeenCalled();
  });

  it("should handle empty text extraction", async () => {
    const document = { id: "doc-1" } as DocumentEntity;
    const buffer = Buffer.from("empty pdf content");

    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({
            items: [],
          }),
        }),
      }),
    } as unknown as ReturnType<typeof pdfjs.getDocument>);

    await svc.vectorizeDocument(document, buffer);

    expect(pdfjs.getDocument).toHaveBeenCalled();
    expect(fakeEmbeddings.embedDocuments).not.toHaveBeenCalled();
    expect(fakeRepo.save).not.toHaveBeenCalled();
  });

  it("should throw and log error when vectorization fails", async () => {
    const document = { id: "doc-1" } as DocumentEntity;
    const buffer = Buffer.from("bad pdf");

    vi.mocked(pdfjs.getDocument).mockReturnValue({
      promise: Promise.reject(new Error("PDF failure")),
    } as unknown as ReturnType<typeof pdfjs.getDocument>);

    await expect(svc.vectorizeDocument(document, buffer)).rejects.toThrow(
      "PDF failure"
    );
  });
});
