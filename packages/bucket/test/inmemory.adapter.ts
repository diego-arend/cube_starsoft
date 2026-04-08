/**
 * In-memory bucket adapter (for tests & local development only)
 * ------------------------------------------------------------------
 * This adapter provides a simple, deterministic in-process store that
 * implements the `IBucketAdapter` interface so unit tests and local
 * development can exercise uploads, downloads, listing, and deletion
 * without requiring a real S3/MinIO instance.
 *
 * Not intended for production use. This file lives under `test/` to make
 * it explicit that it's for tests only and not part of the public API.
 */
import { Readable } from "stream";
import { IBucketAdapter } from "../src/types";

export class InMemoryAdapter implements IBucketAdapter {
  private store = new Map<string, Buffer>();

  upload({ Key, Body }: any) {
    const buf = Buffer.isBuffer(Body) ? Body : Buffer.from(String(Body));
    this.store.set(Key, buf);
    return Promise.resolve({ Key, ETag: undefined });
  }

  getObject(key: string, range?: string) {
    const b = this.store.get(key);
    if (!b) return Promise.reject(new Error("Not found"));
    if (range) {
      // simple range parser for bytes=0-511
      const m = range.match(/bytes=(\d+)-(\d+)/);
      if (m) {
        const start = Number(m[1]);
        const end = Number(m[2]);
        return Promise.resolve(b.slice(start, end + 1));
      }
    }
    return Promise.resolve(b);
  }

  async getObjectStream(key: string, range?: string) {
    const b = await this.getObject(key, range);
    const s = new Readable();
    s.push(b);
    s.push(null);
    return s;
  }

  deleteObject(key: string) {
    this.store.delete(key);
    return Promise.resolve();
  }

  listObjects(prefix?: string) {
    const out: Array<{ Key: string; Size: number; LastModified: Date }> = [];
    for (const [k, v] of this.store.entries()) {
      if (!prefix || k.startsWith(prefix))
        out.push({ Key: k, Size: v.length, LastModified: new Date() });
    }
    return Promise.resolve(out);
  }

  headObject(key: string) {
    const b = this.store.get(key);
    return Promise.resolve({
      exists: Boolean(b),
      size: b?.length,
      metadata: {},
    });
  }
}
