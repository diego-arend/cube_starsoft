import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "stream";
import { Upload } from "@aws-sdk/lib-storage";
import { IBucketAdapter } from "../types";
import { Logger } from "@nestjs/common";

export type S3AdapterOptions = {
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  bucket?: string;
};

export class S3Adapter implements IBucketAdapter {
  private client: S3Client;
  private bucket?: string;

  constructor(opts: S3AdapterOptions) {
    this.bucket = opts.bucket;
    // resolved bucket is available via typed env (no debug prints)

    const cfg: any = {
      region: opts.region,
      credentials: opts.accessKeyId
        ? {
            accessKeyId: opts.accessKeyId,
            secretAccessKey: opts.secretAccessKey,
          }
        : undefined,
    };
    if (opts.endpoint) {
      cfg.endpoint = opts.endpoint;
      cfg.forcePathStyle = opts.forcePathStyle ?? true;
    }
    this.client = new S3Client(cfg);
  }

  getBucketName(): string {
    return this.bucket || "";
  }

  /**
   * Ensure the configured bucket exists and is accessible. When `createIfMissing`
   * is true (useful for local MinIO) the adapter will attempt to create the
   * bucket if the HeadBucket check fails with a not-found error.
   */
  async ensureBucketExists(createIfMissing = false) {
    const bucket = this.bucket;
    // checking bucket existence (no debug prints)

    if (!bucket) {
      throw new Error("S3_BUCKET is not configured");
    }
    try {
      const head = new HeadBucketCommand({ Bucket: bucket });
      await this.client.send(head);
      return true;
    } catch (err: any) {
      const status = err?.$metadata?.httpStatusCode ?? err?.statusCode;
      // If bucket not found and we are allowed to create, attempt creation
      if (createIfMissing && (status === 404 || err?.name === "NotFound")) {
        const create = new CreateBucketCommand({ Bucket: bucket });
        await this.client.send(create);
        return true;
      }
      throw new Error(
        `S3 bucket '${bucket}' is not accessible: ${String(err)}`
      );
    }
  }

  // Supports backward-compatible calls:
  // - upload({ Key, Body, ContentType, Metadata })
  // - upload(key, body, options?)
  async upload(paramsOrKey: any, bodyArg?: any, optionsArg?: any) {
    const bucket = this.bucket;
    if (!bucket) throw new Error("S3_BUCKET is not configured");

    // normalize arguments to a single params object
    let params: any;
    if (
      paramsOrKey &&
      typeof paramsOrKey === "object" &&
      ("Key" in paramsOrKey || "Body" in paramsOrKey)
    ) {
      params = paramsOrKey;
    } else {
      // positional form: (key, body, options)
      params = {
        Key: paramsOrKey,
        Body: bodyArg,
        ContentType: optionsArg?.contentType,
        Metadata: optionsArg?.metadata,
      };
    }

    // Defensive checks and short diagnostics about incoming params
    if (!params || typeof params !== "object") {
      throw new Error("S3 upload called with invalid params");
    }
    const { Key, Body, ContentType, Metadata } = params;
    const logger = new Logger("S3Adapter");
    logger.warn("S3Adapter.upload called", {
      key: Key,
      bodyType:
        Body === undefined
          ? "undefined"
          : Buffer.isBuffer(Body)
            ? "Buffer"
            : typeof Body,
    });

    if (!Key) {
      throw new Error("S3 upload called without a Key");
    }

    if (Body === undefined || Body === null) {
      throw new Error(`S3 upload called for key=${Key} with empty Body`);
    }

    // Normalize typed buffers (ArrayBuffer / Uint8Array) to Node Buffer
    if (
      Body &&
      !(typeof Body === "string") &&
      !(Body instanceof Buffer) &&
      Body instanceof Uint8Array
    ) {
      params.Body = Buffer.from(Body);
    } else {
      params.Body = Body;
    }

    // Use the normalized body from params (may have been converted above)
    const body = params.Body;

    // If Body is a Buffer or string we can use PutObject and set ContentLength
    // which avoids chunked signing behavior that can cause signature mismatches
    // with some endpoints when the source length is unknown.
    if (Buffer.isBuffer(body) || typeof body === "string") {
      const putParams: any = {
        Bucket: bucket,
        Key,
        Body: body,
        ContentType,
        Metadata,
        // Ensure ContentLength is set for Buffer and string bodies to avoid
        // chunked transfer / signature mismatch issues with some endpoints.
        ContentLength: Buffer.isBuffer(body)
          ? body.length
          : typeof body === "string"
            ? Buffer.byteLength(body)
            : undefined,
      };
      const cmd = new PutObjectCommand(putParams);
      const res = await this.client.send(cmd);
      return { Key, ETag: (res as any).ETag };
    }

    // If Body is an object with a `.stream` function (some clients wrap streams)
    // prefer passing the inner stream to Upload. If `.stream` is a function call it.
    let bodyForUpload: any = body;
    try {
      if (body && typeof body.stream === "function") {
        bodyForUpload = body.stream();
      }
    } catch (e) {
      // ignore — fallback to original body
      void e;
      bodyForUpload = body;
    }

    // For streams or other unknown-length bodies use the high-level Upload
    // helper which performs multipart uploads and signs each part correctly.
    try {
      const uploader = new Upload({
        client: this.client,
        params: {
          Bucket: bucket,
          Key,
          Body: bodyForUpload,
          ContentType,
          Metadata,
        },
      });
      const res = await uploader.done();
      return { Key, ETag: (res as any).ETag };
    } catch (err: any) {
      // Surface a clearer error while avoiding dumping rich raw SDK internals
      // (which may include request/credential details). Keep status and message.
      const errMeta = err?.$metadata ?? {};
      const status = errMeta.httpStatusCode ?? errMeta.statusCode ?? "unknown";
      const message = err?.message ?? String(err);
      throw new Error(
        `S3 upload failed for key=${Key}: status=${status}, message=${String(message)}`
      );
    }
  }

  async getObject(key: string, range?: string) {
    const params: any = { Bucket: this.bucket, Key: key };
    if (range) params.Range = range;
    const cmd = new GetObjectCommand(params);
    const res = await this.client.send(cmd);
    const body = res.Body as Readable;
    return await this.streamToBuffer(body);
  }

  async getObjectStream(key: string, range?: string) {
    const params: any = { Bucket: this.bucket, Key: key };
    if (range) params.Range = range;
    const cmd = new GetObjectCommand(params);
    const res = await this.client.send(cmd);
    return res.Body as Readable;
  }

  async deleteObject(key: string) {
    const cmd = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.client.send(cmd);
  }

  async listObjects(prefix?: string) {
    const cmd = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    });
    const res = await this.client.send(cmd);
    const items = (res.Contents ?? [])
      .filter(
        (i): i is typeof i & { Key: string; LastModified: Date } =>
          i.Key !== undefined && i.LastModified !== undefined
      )
      .map((i) => ({
        Key: i.Key,
        Size: i.Size ?? 0,
        LastModified: i.LastModified,
      }));
    return items;
  }

  async headObject(key: string) {
    try {
      const cmd = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const res = await this.client.send(cmd);
      return {
        exists: true,
        size: res.ContentLength ?? undefined,
        contentType: res.ContentType ?? undefined,
        metadata: res.Metadata as any,
      };
    } catch {
      return { exists: false };
    }
  }

  private async streamToBuffer(stream: Readable) {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: any[] = [];
      stream.on("data", (c) =>
        chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
      );
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }
}
