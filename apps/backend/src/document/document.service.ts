import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Optional,
} from "@nestjs/common";
import { BUCKET_CLIENT, BucketService } from "@turborepo/bucket";
import { Inject } from "@nestjs/common";
import { DOCUMENT_REPOSITORY, DocumentEntity } from "@turborepo/database";
import type {
  IDocumentRepository,
  OffsetPaginationDto,
  PaginatedResult,
} from "@turborepo/database";
import type { Readable } from "stream";
import type { DocumentPublicDto } from "@turborepo/database";
import { v7 as uuidv7 } from "uuid";
import { VectorizationService } from "./vectorization.service";
import { KNOWLEDGE_BASE_BUCKET_SERVICE } from "./constants";

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB default

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  private readonly MAX_SIZE: number;

  constructor(
    @Inject(BUCKET_CLIENT) private readonly bucket: BucketService,
    @Inject(KNOWLEDGE_BASE_BUCKET_SERVICE)
    private readonly kbBucket: BucketService,
    @Inject(DOCUMENT_REPOSITORY) private readonly repo: IDocumentRepository,
    private readonly vectorizationService: VectorizationService,
    @Optional() maxSize?: number
  ) {
    this.MAX_SIZE = maxSize ?? DEFAULT_MAX_SIZE;
  }

  async readFirstBytes(stream: Readable, n: number) {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let read = 0;
      const onData = (chunk: unknown) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        chunks.push(buf);
        read += buf.length;
        if (read >= n) {
          stream.pause();
          cleanup();
          resolve(Buffer.concat(chunks).slice(0, n));
        }
      };
      const onEnd = () => {
        cleanup();
        resolve(Buffer.concat(chunks));
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      // Use explicit `any`-typed wrapper handlers to avoid unsafe-argument lint warnings
      const dataHandler = (c: any) => onData(c);
      const endHandler = () => onEnd();
      const errorHandler = (e: Error) => onError(e);
      function cleanup() {
        stream.removeListener("data", dataHandler);
        stream.removeListener("end", endHandler);
        stream.removeListener("error", errorHandler);
      }
      stream.on("data", dataHandler);
      stream.on("end", endHandler);
      stream.on("error", errorHandler);
    });
  }

  async getDocumentById(id: string): Promise<DocumentEntity | null> {
    return this.repo.findOneById(id);
  }

  async streamForDownload(documentId: string) {
    const doc = await this.repo.findOneById(documentId);
    if (!doc) throw new NotFoundException("Document not found");

    const targetBucket = doc.isKb ? this.kbBucket : this.bucket;

    // optionally could validate scan status before returning
    return {
      stream: await targetBucket.getObjectStream(doc.key),
      filename: doc.originalFilename,
      contentType: doc.contentType,
    };
  }

  // NOTE: virus scanning was removed in the refactor. Keep this space reserved
  // for a future synchronous or asynchronous scanning integration.

  async deleteDocument(documentId: string, ownerId: string) {
    const doc = await this.repo.findOneById(documentId);
    if (!doc) throw new NotFoundException("Document not found");
    if (doc.ownerId !== ownerId) throw new BadRequestException("Not allowed");

    const targetBucket = doc.isKb ? this.kbBucket : this.bucket;

    await targetBucket.deleteObject(doc.key);

    // If it's a Knowledge Base document, clean up the vectorized artifacts
    if (doc.isKb) {
      try {
        await Promise.all([
          this.kbBucket.deleteObject(`sources/${doc.id}.pdf`),
          this.kbBucket.deleteObject(`texts/${doc.id}.txt`),
        ]);
        this.logger.log(
          `Cleaned up vectorized artifacts for document ${doc.id}`
        );
      } catch (err) {
        // We log but don't fail the whole deletion if artifacts are missing or fail
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Failed to clean up some vectorized artifacts for ${doc.id}: ${errorMessage}`
        );
      }
    }

    await this.repo.remove(doc);
    return { success: true };
  }

  async listByUser(
    ownerId: string,
    opts?: OffsetPaginationDto
  ): Promise<PaginatedResult<DocumentPublicDto>> {
    // Validate sorting field in service-level (allowed sorts)
    const allowed = new Set(["createdAt", "id", "originalFilename"]);
    const order =
      opts?.sort && allowed.has(opts.sort)
        ? { [opts.sort]: opts.order ?? "DESC" }
        : { createdAt: "DESC" };

    const res = await this.repo.findPublicByOwnerPaginated(ownerId, {
      page: opts?.page,
      limit: opts?.limit,
      order: order as any,
      q: opts?.q,
      isKb: opts?.isKb,
    });

    return res;
  }

  async listAll(
    opts?: OffsetPaginationDto
  ): Promise<PaginatedResult<DocumentPublicDto>> {
    const allowed = new Set(["createdAt", "id", "originalFilename"]);
    const order =
      opts?.sort && allowed.has(opts.sort)
        ? { [opts.sort]: opts.order ?? "DESC" }
        : { createdAt: "DESC" };

    return this.repo.findPublicAllPaginated({
      page: opts?.page,
      limit: opts?.limit,
      order: order as any,
      q: opts?.q,
      isKb: opts?.isKb,
    });
  }

  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    contentType: string,
    ownerId: string,
    isKb = false,
    agentId?: string | null
  ) {
    // Sanitize filename: remove spaces, special chars, and prevent injection
    const sanitizedFilename = filename
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .replace(/[^a-zA-Z0-9._-]/g, "") // Remove non-alphanumeric chars except . _ -
      .replace(/\.{2,}/g, "."); // Prevent directory traversal (..)

    if (!sanitizedFilename || sanitizedFilename.length > 255) {
      throw new BadRequestException("Invalid filename");
    }

    // synchronous validations
    if (buffer.length > this.MAX_SIZE)
      throw new BadRequestException("File too large");
    if (contentType && contentType !== "application/pdf")
      throw new BadRequestException("Only application/pdf allowed");

    // check magic bytes
    const sig = buffer.slice(0, 16).toString("utf8");
    if (!sig.startsWith("%PDF-"))
      throw new BadRequestException("Uploaded file is not a valid PDF");

    // no automatic virus scanning is performed at this time (removed in refactor)

    const key = `${ownerId}/${uuidv7()}.pdf`;

    // defensive check & brief diagnostic log before upload
    if (!key) {
      this.logger.error("Generated upload key is empty", { ownerId });
      throw new Error("Upload key is missing");
    }
    this.logger.warn("Uploading document to bucket", {
      key,
      ownerId,
      size: buffer.length,
      isKb,
      agentId,
    });

    const targetBucket = isKb ? this.kbBucket : this.bucket;

    // upload to bucket only after passing checks
    await targetBucket.upload(key, buffer, {
      contentType: contentType,
      metadata: {} as any,
    });

    // persist metadata
    const entity = await this.repo.save({
      key,
      ownerId,
      originalFilename: sanitizedFilename,
      contentType,
      size: buffer.length as any,
      metadata: {},
      scanStatus: "clean",
      isKb,
      agentId,
    });

    // Start vectorization only for Knowledge Base documents
    // We await vectorization and let exceptions propagate to the controller
    // so that OpenAI API errors are treated as failures for the whole upload flow.
    if (isKb) {
      try {
        await this.vectorizationService.vectorizeDocument(entity, buffer);
      } catch (error: any) {
        this.logger.error(
          `Vectorization failed for document ${entity.id}: ${error.message}`
        );
        // If vectorization fails (e.g. OpenAI error), we clean up the document metadata and file
        try {
          await targetBucket.deleteObject(key);
          await this.repo.remove(entity);
        } catch (cleanupError: any) {
          this.logger.error(
            `Failed to cleanup after vectorization error: ${cleanupError.message}`
          );
        }
        throw error;
      }
    }

    return entity;
  }
}
