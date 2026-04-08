import type { Readable } from "stream";

export const BUCKET_CLIENT = Symbol("BUCKET_CLIENT");
export const EMBEDDINGS_BUCKET_CLIENT = Symbol("EMBEDDINGS_BUCKET_CLIENT");

export interface BucketObjectInfo {
  key: string;
  size: number;
  lastModified: string;
}

export interface IBucketAdapter {
  getBucketName(): string;

  upload(params: {
    Key: string;
    Body: Buffer | Readable | string;
    ContentType?: string;
    Metadata?: Record<string, string>;
  }): Promise<{ Key: string; ETag?: string }>;

  getObject(key: string, range?: string): Promise<Buffer>;
  getObjectStream(key: string, range?: string): Promise<Readable>;
  deleteObject(key: string): Promise<void>;
  listObjects(
    prefix?: string
  ): Promise<Array<{ Key: string; Size: number; LastModified: Date }>>;
  headObject(key: string): Promise<{
    exists: boolean;
    size?: number;
    contentType?: string;
    metadata?: Record<string, string>;
  }>;

  ensureBucketExists(createIfMissing?: boolean): Promise<boolean>;
}
