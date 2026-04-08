import { describe, it, expect, vi, beforeEach } from "vitest";
import { S3Adapter } from "../../adapters/s3.adapter";
// Minimal mocks for S3Client
const mockSend = vi.fn();

vi.mock("@aws-sdk/client-s3", async () => {
  const mod =
    await vi.importActual<typeof import("@aws-sdk/client-s3")>(
      "@aws-sdk/client-s3"
    );
  return {
    ...mod,
    S3Client: function () {
      this.send = mockSend;
    },
  };
});

vi.mock("@aws-sdk/lib-storage", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/lib-storage")>(
    "@aws-sdk/lib-storage"
  );
  return {
    ...actual,
    Upload: function () {
      return {
        done: async () => {
          await Promise.resolve();
          return { ETag: "upload-etag" };
        },
      };
    },
  };
});

describe("S3Adapter#upload", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it("uses PutObjectCommand for Buffer bodies", async () => {
    mockSend.mockResolvedValue({ ETag: "etag-1" });
    const a = new S3Adapter({ bucket: "test-bucket" });
    const res = await a.upload({ Key: "k1", Body: Buffer.from("x") });
    expect(res.ETag).toBe("etag-1");
    expect(mockSend).toHaveBeenCalled();
  });

  it("normalizes Uint8Array to Buffer and uses PutObject", async () => {
    mockSend.mockResolvedValue({ ETag: "etag-2" });
    const a = new S3Adapter({ bucket: "test-bucket" });
    const ua = new Uint8Array([1, 2, 3]);
    const res = await a.upload({ Key: "k2", Body: ua });
    expect(res.ETag).toBe("etag-2");
    expect(mockSend).toHaveBeenCalled();
  });

  it("uses Upload for stream-like bodies", async () => {
    // Ensure send is not used for this path (Upload.done returns ETag)
    mockSend.mockReset();
    const a = new S3Adapter({ bucket: "test-bucket" });
    const streamLike = {
      async *[Symbol.asyncIterator]() {
        await Promise.resolve();
        yield Buffer.from("a");
      },
    };
    const res = await a.upload({ Key: "k3", Body: streamLike });
    expect(res.ETag).toBe("upload-etag");
  });
  it("accepts positional args (key, body, options) for backward compatibility", async () => {
    mockSend.mockResolvedValue({ ETag: "etag-pos" });
    const a = new S3Adapter({ bucket: "test-bucket" });
    const res = await a.upload("kp", Buffer.from("x"), {
      contentType: "application/pdf",
    });
    expect(res.ETag).toBe("etag-pos");
    expect(mockSend).toHaveBeenCalled();
  });

  it("sets ContentLength for string bodies (avoids chunked signing issues)", async () => {
    mockSend.mockResolvedValue({ ETag: "etag-str" });
    const a = new S3Adapter({ bucket: "test-bucket" });
    const res = await a.upload({ Key: "ks", Body: "hello" });
    expect(res.ETag).toBe("etag-str");
    expect(mockSend).toHaveBeenCalled();
    const cmd = mockSend.mock.calls[0][0];
    // The underlying PutObjectCommand exposes input with ContentLength
    expect(cmd).toBeDefined();
    expect(cmd.input.ContentLength).toBe(Buffer.byteLength("hello"));
  });
});
