import { describe, it, expect, beforeEach, vi } from "vitest";
import { BucketService } from "../../bucket.service";

import type { Readable } from "stream";

const fakeClient = {
  upload: vi.fn((params: any) => ({ Key: params.Key, ETag: "etag" })),
  getObject: vi.fn(() => Promise.resolve(Buffer.from("ok"))),
  getObjectStream: vi.fn(() =>
    Promise.resolve({ on: () => {} } as unknown as Readable)
  ),
  deleteObject: vi.fn(() => Promise.resolve()),
  listObjects: vi.fn(() =>
    Promise.resolve([{ Key: "a", Size: 1, LastModified: new Date() }])
  ),
  headObject: vi.fn(() => Promise.resolve({ exists: true })),
};

describe("BucketService", () => {
  let svc: BucketService;

  beforeEach(() => {
    svc = new BucketService(fakeClient as any);
  });

  it("uploads and returns key", async () => {
    const res = await svc.upload("k", Buffer.from("x"));
    expect(res.key).toBe("k");
  });

  it("downloads buffer", async () => {
    const b = await svc.download("k");
    expect(b).toBeInstanceOf(Buffer);
  });

  it("lists", async () => {
    const list = await svc.list();
    expect(list.length).toBeGreaterThan(0);
  });
});
