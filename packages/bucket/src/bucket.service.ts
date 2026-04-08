import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { IBucketAdapter, BucketObjectInfo } from "./types";
import { BUCKET_CLIENT } from "./types";
import type { Env } from "@turborepo/config";
import fs from "fs";

@Injectable()
export class BucketService implements OnModuleInit {
  private readonly logger = new Logger(BucketService.name);

  constructor(
    @Inject(BUCKET_CLIENT) private readonly client: IBucketAdapter,
    private readonly env?: Env
  ) {}

  async onModuleInit() {
    const bucketName =
      this.client.getBucketName() || (this.env as any)?.S3_BUCKET;
    const endpoint = (this.env as any)?.S3_ENDPOINT;
    const region = (this.env as any)?.S3_REGION;
    const nodeEnv = (this.env as any)?.NODE_ENV;
    const createIfMissing = nodeEnv === "development" || nodeEnv === "test";

    try {
      await this.client.ensureBucketExists(createIfMissing);
      if (endpoint) {
        this.logger.log(
          `Connected to S3 bucket: ${bucketName} (endpoint: ${endpoint})`
        );
      } else {
        this.logger.log(
          `Connected to S3 bucket: ${bucketName} (region: ${region || "default"})`
        );
      }
    } catch (err: any) {
      if (endpoint) {
        this.logger.error(
          `S3 bucket '${bucketName}' not accessible at ${endpoint}: ${err.message}`
        );
      } else {
        this.logger.error(
          `S3 bucket '${bucketName}' not accessible in production: ${err.message}`
        );
      }
    }
  }

  async upload(
    key: string,
    body: Buffer | string,
    options?: { contentType?: string; metadata?: Record<string, string> }
  ) {
    // Defensive validation to catch incorrect call sites early and provide
    // diagnostics that do not include sensitive payloads.
    if (!key) {
      this.logger.error("Bucket.upload called without a key", {
        bodyType: Buffer.isBuffer(body) ? "Buffer" : typeof body,
        bodyLength: Buffer.isBuffer(body) ? body.length : undefined,
      });
      throw new Error("Bucket.upload called without a key");
    }

    try {
      // Log safe diagnostics about the upload call
      this.logger.debug("Calling client.upload", {
        key,
        bodyType: Buffer.isBuffer(body) ? "Buffer" : typeof body,
        contentType: options?.contentType,
      });

      const res = await this.client.upload({
        Key: key,
        Body: body,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
      });
      return { key: res.Key, etag: res.ETag };
    } catch (err: any) {
      const bucketName = this.env?.S3_BUCKET ?? "unknown";
      this.logger.error(
        `Bucket upload failed. bucket=${String(bucketName)} key=${key} error=${String(err)}`,
        err
      );
      // Re-throw a clearer error for upstream handlers; keep original message
      // so controllers can surface it if useful for debugging.
      throw err;
    }
  }

  async uploadFromFile(
    key: string,
    filePath: string,
    options?: { contentType?: string; metadata?: Record<string, string> }
  ) {
    const buffer = await fs.promises.readFile(filePath);
    return this.upload(key, buffer, options);
  }

  async download(key: string, range?: string) {
    return await this.client.getObject(key, range);
  }

  async downloadStream(key: string, range?: string) {
    return await this.client.getObjectStream(key, range);
  }

  async exists(key: string) {
    const head = await this.client.headObject(key);
    return head.exists;
  }

  // Compatibility wrappers to expose lower-level adapter methods when needed by callers
  async headObject(key: string) {
    return this.client.headObject(key);
  }

  async getObject(key: string, range?: string) {
    return this.client.getObject(key, range);
  }

  async getObjectStream(key: string, range?: string) {
    return this.client.getObjectStream(key, range);
  }

  async deleteObject(key: string) {
    return this.client.deleteObject(key);
  }

  async delete(key: string) {
    return await this.client.deleteObject(key);
  }

  async list(prefix?: string): Promise<BucketObjectInfo[]> {
    const items = await this.client.listObjects(prefix);
    return items.map((i) => ({
      key: i.Key,
      size: i.Size,
      lastModified: i.LastModified.toISOString(),
    }));
  }

  getPublicUrl(key: string): string {
    const endpoint = (this.env as any)?.S3_ENDPOINT;
    const bucket = (this.env as any)?.S3_BUCKET;

    if (!endpoint || !bucket) {
      // If we don't have enough config to build a public URL, we return the key
      // or a path that could be proxied. Given our recent refactor to use
      // backend proxy, this method should be used sparingly.
      return `/${bucket || "default"}/${key}`;
    }

    // For standard MinIO/S3 path-style:
    return `${endpoint}/${bucket}/${key}`;
  }
}
