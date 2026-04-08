import { describe, it, expect, beforeEach, vi } from "vitest";
import { Readable } from "stream";
import { DocumentService } from "../../document.service";
import type { BucketService } from "@turborepo/bucket";
import type { IDocumentRepository } from "@turborepo/database";
import type { VectorizationService } from "../../vectorization.service";

vi.mock("@turborepo/bucket", () => ({
  BUCKET_CLIENT: Symbol("BUCKET_CLIENT"),
  BucketService: class {},
}));

describe("DocumentService", () => {
  let svc: DocumentService;
  let fakeBucket: any;
  let fakeRepo: any;
  let fakeVectorizationService: any;

  beforeEach(() => {
    fakeBucket = {
      headObject: vi.fn().mockResolvedValue({ exists: false }),
      getObjectStream: vi
        .fn()
        .mockResolvedValue(
          Readable.from([Buffer.from("%PDF-1.4\n")] as Buffer[])
        ),
      deleteObject: vi.fn().mockResolvedValue(undefined),
      upload: vi
        .fn()
        .mockResolvedValue({ key: "user1/test.pdf", etag: "etag" }),
    };

    fakeRepo = {
      findOneById: vi.fn().mockResolvedValue(null),
      save: vi.fn((d: any) => Promise.resolve({ id: "id", ...d })),
      findAllByOwner: vi.fn().mockResolvedValue([]),
      remove: vi.fn((e: any) => Promise.resolve(e)),
      findPublicByOwnerPaginated: vi.fn().mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, pages: 0 },
      }),
    };

    fakeVectorizationService = {
      vectorizeDocument: vi.fn().mockResolvedValue(undefined),
    };

    // instantiate service directly (no dynamic import)
    svc = new DocumentService(
      fakeBucket as unknown as BucketService,
      fakeBucket as unknown as BucketService,
      fakeRepo as unknown as IDocumentRepository,
      fakeVectorizationService as unknown as VectorizationService
    );
    vi.clearAllMocks();
  });

  it("uploadBuffer uploads when valid", async () => {
    const buf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(1000)]);
    const res = await svc.uploadBuffer(
      buf,
      "file.pdf",
      "application/pdf",
      "user1",
      true // isKb
    );
    expect(fakeBucket.upload).toHaveBeenCalled();
    expect(fakeVectorizationService.vectorizeDocument).toHaveBeenCalled();
    expect(res.id).toBe("id");
    expect(res.originalFilename).toBe("file.pdf");
    expect(res.isKb).toBe(true);
  });

  it("uploadBuffer skips vectorization when isKb is false", async () => {
    const buf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(1000)]);
    const res = await svc.uploadBuffer(
      buf,
      "file.pdf",
      "application/pdf",
      "user1",
      false
    );
    expect(fakeBucket.upload).toHaveBeenCalled();
    expect(fakeVectorizationService.vectorizeDocument).not.toHaveBeenCalled();
    expect(res.isKb).toBe(false);
  });

  it("uploadBuffer throws when too large", async () => {
    // instantiate a fresh service with small max size
    const svc2 = new DocumentService(
      fakeBucket as unknown as BucketService,
      fakeBucket as unknown as BucketService,
      fakeRepo as unknown as IDocumentRepository,
      fakeVectorizationService as unknown as VectorizationService,
      10 as number
    );
    const buf = Buffer.alloc(50);
    await expect(
      svc2.uploadBuffer(buf, "file.pdf", "application/pdf", "user1")
    ).rejects.toThrow("File too large");
  });

  it("uploadBuffer throws when invalid PDF", async () => {
    const buf = Buffer.from("NOT A PDF");
    await expect(
      svc.uploadBuffer(buf, "file.pdf", "application/pdf", "user1")
    ).rejects.toThrow("not a valid PDF");
    expect(fakeBucket.upload).not.toHaveBeenCalled();
  });

  it("listByUser returns paginated DTOs from repository", async () => {
    fakeRepo.findPublicByOwnerPaginated.mockResolvedValue({
      data: [
        {
          id: "d1",
          key: "user1/d1.pdf",
          ownerId: "user1",
          originalFilename: "a.pdf",
          contentType: "application/pdf",
          size: 123,
          isKb: true,
          metadata: {},
          createdAt: new Date().toISOString(),
          scanStatus: "clean",
        },
      ],
      meta: { total: 1, page: 1, limit: 20, pages: 1 },
    });

    const res = await svc.listByUser("user1", {
      page: 1,
      limit: 20,
      isKb: true,
    });
    expect(Array.isArray(res.data)).toBe(true);
    const item = res.data[0] as any;
    expect(item.id).toBe("d1");
    expect(item.isKb).toBe(true);
    expect(typeof item.size).toBe("number");
    expect(typeof item.createdAt).toBe("string");
    expect(res.meta.total).toBe(1);
    expect(fakeRepo.findPublicByOwnerPaginated).toHaveBeenCalledWith(
      "user1",
      expect.objectContaining({ isKb: true })
    );
  });

  it("uploadBuffer persists scanStatus as clean when present", async () => {
    const buf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(1000)]);
    const res = await svc.uploadBuffer(
      buf,
      "file.pdf",
      "application/pdf",
      "user1"
    );
    expect(res.scanStatus).toBe("clean");
  });

  it("deleteDocument removes from correct bucket and repo", async () => {
    const doc = { id: "d1", key: "u1/d1.pdf", ownerId: "u1", isKb: true };
    fakeRepo.findOneById.mockResolvedValue(doc);

    await svc.deleteDocument("d1", "u1");

    expect(fakeBucket.deleteObject).toHaveBeenCalledWith("u1/d1.pdf");
    expect(fakeRepo.remove).toHaveBeenCalledWith(doc);
  });

  it("streamForDownload streams from correct bucket", async () => {
    const doc = {
      id: "d1",
      key: "u1/d1.pdf",
      ownerId: "u1",
      isKb: true,
      originalFilename: "f.pdf",
      contentType: "app/pdf",
    };
    fakeRepo.findOneById.mockResolvedValue(doc);

    const res = await svc.streamForDownload("d1");
    expect(res.filename).toBe("f.pdf");
    expect(fakeBucket.getObjectStream).toHaveBeenCalledWith("u1/d1.pdf");
  });
});
