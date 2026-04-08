import { describe, it, expect, beforeEach, vi } from "vitest";
import { DocumentController } from "../../document.controller";
import type { DocumentService } from "../../document.service";
import type { KnowledgeBaseService } from "../../knowledge-base.service";
import type { VectorizationService } from "../../vectorization.service";
import type { RedisService } from "@turborepo/redis";
import type { OffsetPaginationDto } from "@turborepo/database";
import type { FastifyRequest } from "fastify";

function makeAsyncIterable(buffers: Buffer[]) {
  return {
    async *[Symbol.asyncIterator]() {
      await Promise.resolve();
      for (const b of buffers) yield b;
    },
  };
}

describe("DocumentController (unit)", () => {
  let ctrl: DocumentController;
  let svc: Partial<DocumentService>;
  let redis: Partial<RedisService>;
  let knowledgeBaseService: Partial<KnowledgeBaseService>;
  let vectorizationService: Partial<VectorizationService>;

  beforeEach(() => {
    svc = {
      uploadBuffer: vi.fn().mockResolvedValue({
        id: "id",
        key: "u1/id.pdf",
        ownerId: "u1",
        originalFilename: "uploaded.pdf",
        contentType: "application/pdf",
        size: 1234,
        metadata: {},
        createdAt: new Date().toISOString(),
        scanStatus: "clean",
      }),
      streamForDownload: vi.fn().mockResolvedValue({
        stream: { on: () => {} },
        filename: "a.pdf",
        contentType: "application/pdf",
      }),
      deleteDocument: vi.fn().mockResolvedValue({ success: true }),
      listByUser: vi.fn().mockResolvedValue({ data: [{ id: "doc-1" }] }),
      listAll: vi.fn().mockResolvedValue({ data: [], meta: {} }),
      getDocumentById: vi.fn().mockResolvedValue({ id: "doc-1" }),
    };
    redis = {
      keys: vi.fn().mockResolvedValue([]),
      del: vi.fn().mockResolvedValue(1),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };
    knowledgeBaseService = {
      getChunksByDocumentId: vi.fn().mockResolvedValue([]),
    };
    vectorizationService = {
      vectorizeDocument: vi.fn().mockResolvedValue(undefined),
    };
    ctrl = new DocumentController(
      svc as unknown as DocumentService,
      knowledgeBaseService as unknown as KnowledgeBaseService,
      vectorizationService as unknown as VectorizationService,
      redis as unknown as RedisService
    );
  });

  it("getChunks calls knowledgeBaseService", async () => {
    const res = await ctrl.getChunks("doc-1", {
      user: { id: "u1" },
    } as unknown as FastifyRequest);
    expect(knowledgeBaseService.getChunksByDocumentId).toHaveBeenCalledWith(
      "doc-1"
    );
    expect(res).toEqual([]);
  });

  it("upload calls service and returns metadata", async () => {
    const payload = {
      filename: "uploaded.pdf",
      dataBase64: Buffer.from("%PDF-1.4\n" + "\0".repeat(100)).toString(
        "base64"
      ),
      isKb: true,
    };
    const res = await ctrl.upload(payload, {
      user: { id: "u1", role: "ADMIN" },
    } as unknown as FastifyRequest);
    expect(svc.uploadBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      "uploaded.pdf",
      "application/pdf",
      "u1",
      true,
      undefined
    );
    expect(res.originalFilename).toBe("uploaded.pdf");
  });

  it("parses mp.file shape and calls uploadBuffer", async () => {
    const mp = {
      file: makeAsyncIterable([
        Buffer.from("%PDF-1.4\n"),
        Buffer.from("\0".repeat(10)),
      ]),
      filename: "f.pdf",
      mimetype: "application/pdf",
    };
    const req = {
      user: { id: "u1" },
      headers: { "content-type": "multipart/form-data; boundary=--xyz" },
      file: vi.fn(() => Promise.resolve(mp)),
    } as unknown as FastifyRequest;
    const res = await ctrl.upload({} as any, req);
    expect(svc.uploadBuffer).toHaveBeenCalled();
    expect(res.originalFilename).toBe("uploaded.pdf");
  });

  it("parses mp.stream shape and calls uploadBuffer", async () => {
    const mp = {
      stream: makeAsyncIterable([Buffer.from("%PDF-1.4\n")]),
      filename: "s.pdf",
      mimetype: "application/pdf",
    };
    const req = {
      user: { id: "u2" },
      headers: { "content-type": "multipart/form-data; boundary=--xyz" },
      file: vi.fn(() => Promise.resolve(mp)),
    } as unknown as FastifyRequest;
    const res = await ctrl.upload({} as any, req);
    expect(svc.uploadBuffer).toHaveBeenCalled();
    expect(res.originalFilename).toBe("uploaded.pdf");
  });

  it("rejects missing file in multipart", async () => {
    const req = {
      user: { id: "u1" },
      headers: { "content-type": "multipart/form-data; boundary=--xyz" },
      file: vi.fn(() => Promise.resolve(undefined)),
    } as unknown as FastifyRequest;
    await expect(ctrl.upload({} as any, req)).rejects.toThrow();
    expect(svc.uploadBuffer).not.toHaveBeenCalled();
  });

  it("rejects when unauthenticated", async () => {
    const req = {
      headers: { "content-type": "multipart/form-data; boundary=--xyz" },
    } as unknown as FastifyRequest;
    await expect(ctrl.upload({} as any, req)).rejects.toThrow();
    expect(svc.uploadBuffer).not.toHaveBeenCalled();
  });

  it("list_by_user returns user's documents when owner matches", async () => {
    (svc.listByUser as any) = vi.fn().mockResolvedValue({
      data: [
        {
          id: "d1",
          key: "u1/d1.pdf",
          ownerId: "u1",
          originalFilename: "a.pdf",
          contentType: "application/pdf",
          size: 100,
          metadata: {},
          createdAt: new Date().toISOString(),
          scanStatus: "clean",
        },
      ],
      meta: { total: 1, page: 1, limit: 20, pages: 1 },
    });
    const pagination: OffsetPaginationDto = { page: 1, limit: 20, isKb: true };
    // call via any to avoid type-safety noise from the validation pipe in unit test
    const res = await (ctrl as any).listByUser("u1", pagination, {
      user: { id: "u1" },
    } as unknown as FastifyRequest);

    // inspect mock call safely
    const listByUserMock = svc.listByUser as unknown as import("vitest").Mock;
    expect(listByUserMock).toHaveBeenCalled();
    const [owner, calledPagination] = listByUserMock.mock.calls[0] as [
      string,
      OffsetPaginationDto,
    ];
    expect(owner).toBe("u1");
    expect(calledPagination.page).toBe(1);
    expect(calledPagination.limit).toBe(20);
    expect(calledPagination.isKb).toBe(true);

    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data[0].id).toBe("d1");
    expect(res.meta.total).toBe(1);
  });

  it("list_by_user rejects when owner mismatch", async () => {
    (svc.listByUser as any) = vi.fn().mockResolvedValue([]);
    // cast the call to any to avoid TypeScript unsafe-argument checks in test
    await expect(
      (ctrl.listByUser as any)(
        "other",
        {} as unknown as OffsetPaginationDto,
        { user: { id: "u1" } } as unknown as FastifyRequest
      )
    ).rejects.toThrow();
  });
});
