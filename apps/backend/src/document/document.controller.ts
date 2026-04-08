import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  Param,
  Res,
  Delete,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
  UseInterceptors,
  UseGuards,
} from "@nestjs/common";
import { RedisService } from "@turborepo/redis";
import { DocumentService } from "./document.service";
import { KnowledgeBaseService } from "./knowledge-base.service";
import { VectorizationService } from "./vectorization.service";
import {
  UploadSchema,
  DocumentPublicSchema,
  UserRole,
} from "@turborepo/database";
import { ZodSerializerInterceptor } from "../shared/interceptors/zod-serializer.interceptor";

import { Query } from "@nestjs/common";
import { ZodValidationPipe } from "../shared/pipes/zod-validation.pipe";
import {
  OffsetPaginationSchema,
  type OffsetPaginationDto,
  type DocumentPublicDto,
  type PaginatedResult,
} from "@turborepo/database";

import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from "@nestjs/swagger";
import Roles from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("documents")
@ApiTags("documents")
@UseGuards(RolesGuard)
// We reference the inline OpenAPI component examples from `openapi.ts` to
// provide richer documentation. SwaggerModule should merge these components
// at application initialization to make $ref links work globally.
export class DocumentController {
  private readonly logger = new Logger(DocumentController.name);

  constructor(
    private readonly svc: DocumentService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly vectorizationService: VectorizationService,
    private readonly redis: RedisService
  ) {}

  private async invalidateUserCache(ownerId: string) {
    try {
      const pattern = `*list_by_user/${ownerId}*`;
      await this.redis.invalidate(pattern);
      // Also invalidate the admin global KB listing cache
      await this.redis.invalidate(`*list_all_kb*`);
    } catch (e) {
      this.logger.error(
        "Failed to invalidate cache",
        e instanceof Error ? (e.stack as string) : String(e)
      );
    }
  }

  @Post("/upload")
  @ApiOperation({
    summary: "Upload PDF (server-mediated) and validate synchronously",
  })
  // Swagger: support both JSON (base64) and multipart/form-data (file upload)
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: { $ref: "#/components/schemas/UploadBody" } })
  @ApiResponse({
    status: 200,
    schema: { $ref: "#/components/schemas/UploadResponse" },
  })
  @ApiResponse({
    status: 400,
    schema: { $ref: "#/components/schemas/ErrorResponse" },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @UseInterceptors(new ZodSerializerInterceptor(DocumentPublicSchema))
  async upload(@Body() body: unknown, @Req() req: FastifyRequest) {
    try {
      // require authenticated user (owner inferred from token)
      const user = (
        req as FastifyRequest & {
          user?: { id?: string; role?: string };
        }
      ).user;
      const ownerId = user?.id as string;
      const userRole = user?.role;
      if (!ownerId) throw new UnauthorizedException();

      // Decide whether request is multipart before validating body
      const contentTypeHeader = String(
        (req as any)?.headers?.["content-type"] ?? ""
      ).toLowerCase();
      const isMultipart = contentTypeHeader.startsWith("multipart/form-data");

      // Support both request shapes: JSON with base64 payload, or
      // multipart/form-data with binary file field. For JSON requests we
      // validate the full body against UploadSchema. For multipart we
      // validate a constructed metadata object (file + optional fields).
      let filename: string | undefined = undefined;
      let contentType: string | undefined = undefined;
      let buffer: Buffer;
      let isKb = false;
      let agentId: string | undefined = undefined;

      // Robust isKb detection from query or body
      const queryIsKb = (req.query as any)?.isKb;
      if (queryIsKb === "true" || queryIsKb === true) isKb = true;

      if (isMultipart) {
        // parse multipart file with defensive checks for different fastify-multipart shapes
        const mp = await (req as any).file();
        if (!mp) {
          this.logger.warn("multipart request but no file parsed");
          throw new BadRequestException("Missing file in multipart request");
        }

        // If not set by query, try to get from multipart fields
        if (!isKb) {
          const fieldIsKb = mp.fields?.isKb?.value ?? (req.body as any)?.isKb;
          if (fieldIsKb === "true" || fieldIsKb === true) isKb = true;
        }

        // Get agentId from multipart fields
        agentId = mp.fields?.agentId?.value ?? (req.body as any)?.agentId;

        // Determine stream shape: some versions expose `file`, others `stream`,
        // or return the stream itself. Normalize to `fileStream`.
        const maybeFileStream = mp.file ?? mp.stream ?? mp;
        if (
          !maybeFileStream ||
          typeof maybeFileStream[Symbol.asyncIterator] !== "function"
        ) {
          this.logger.warn("unexpected multipart file shape", {
            hasFile: Boolean(mp.file),
            hasStream: Boolean(mp.stream),
          });
          throw new BadRequestException("Invalid multipart file format");
        }

        const chunks: Buffer[] = [];
        try {
          for await (const chunk of maybeFileStream as AsyncIterable<unknown>) {
            const chunkBuf: Buffer = Buffer.isBuffer(chunk)
              ? chunk
              : typeof chunk === "string"
                ? Buffer.from(chunk)
                : Buffer.from(chunk as Uint8Array);
            chunks.push(chunkBuf);
          }
        } catch (e: any) {
          this.logger.error("Error reading multipart stream", e);
          throw new BadRequestException("Failed to read uploaded file");
        }

        buffer = Buffer.concat(chunks);
        filename = mp.filename ?? "upload.pdf";
        contentType = mp.mimetype ?? "application/pdf";

        // validate metadata shape (UploadSchema supports multipart variant)
        const meta = {
          file: mp,
          filename,
          contentType,
          isKb,
          agentId,
        };
        const parsed = (UploadSchema as any).safeParse(meta);
        if (!parsed.success)
          throw new BadRequestException(parsed.error.format());

        isKb = parsed.data.isKb ?? isKb;
        agentId = parsed.data.agentId ?? agentId;
      } else {
        // JSON body path
        const parsed = (UploadSchema as any).safeParse(body);
        if (!parsed.success)
          throw new BadRequestException(parsed.error.format());
        const pb = parsed.data;
        filename = pb.filename;
        contentType = pb.contentType;
        buffer = Buffer.from(String(pb.dataBase64 ?? ""), "base64");
        isKb = pb.isKb ?? isKb;
        agentId = pb.agentId;
      }

      if (isKb && userRole !== UserRole.ADMIN) {
        throw new ForbiddenException(
          "Apenas administradores podem gerenciar Embeddings (KB)"
        );
      }

      const normalizedBuffer = Buffer.from(buffer);

      const res = await this.svc.uploadBuffer(
        normalizedBuffer,
        filename ?? "upload.pdf",
        contentType ?? "application/pdf",
        ownerId,
        isKb,
        agentId
      );

      // Invalidate cache for this user's document list
      await this.invalidateUserCache(ownerId);

      const createdAtDate =
        res.createdAt instanceof Date
          ? res.createdAt
          : new Date(String(res.createdAt));

      return {
        ...res,
        createdAt: createdAtDate.toISOString(),
      } as DocumentPublicDto;
    } catch (err: any) {
      this.logger.error("Upload handler error", {
        message: String(err),
        stack: err instanceof Error ? (err.stack as string) : undefined,
        headers: {
          "content-type": String((req as any)?.headers?.["content-type"]),
        },
      });
      throw err;
    }
  }

  /**
   * Stream a PDF to the caller. Response is a binary file with content-type
   * `application/pdf` and `content-disposition: attachment`.
   *
   * Possible errors:
   *  - 401 Unauthorized: missing/invalid JWT
   *  - 404 Not Found: document not found
   *  - 500 Internal Server Error: bucket streaming error
   */
  @Get(":id/download")
  @ApiOperation({ summary: "Download PDF document" })
  @ApiResponse({
    status: 200,
    content: {
      "application/pdf": { schema: { type: "string", format: "binary" } },
    },
  })
  @ApiResponse({
    status: 404,
    schema: { $ref: "#/components/schemas/ErrorResponse" },
  })
  async download(
    @Param("id") id: string,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply
  ) {
    const { stream, filename, contentType } =
      await this.svc.streamForDownload(id);
    res.header("content-type", contentType);
    res.header("content-disposition", `attachment; filename="${filename}"`);
    return res.send(stream as any);
  }

  /**
   * Delete a document owned by the authenticated user.
   *
   * Possible errors:
   *  - 401 Unauthorized: missing/invalid JWT
   *  - 404 Not Found: document not found
   *  - 400 Bad Request: not allowed (owner mismatch)
   *  - 500 Internal Server Error: bucket or DB failure
   */
  @Delete(":id")
  @ApiOperation({ summary: "Delete document" })
  @ApiResponse({
    status: 200,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/DeleteResponse" },
        examples: {
          Success: { $ref: "#/components/examples/DeleteResponseExample" },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
        examples: {
          NotAllowed: { $ref: "#/components/examples/ErrorExample_NotAllowed" },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
        examples: {
          NotFound: { $ref: "#/components/examples/ErrorExample_NotFound" },
        },
      },
    },
  })
  async delete(@Param("id") id: string, @Req() req: FastifyRequest) {
    const user = (req as FastifyRequest & { user?: { id?: string } }).user;
    const ownerId = user?.id as string;
    const r = await this.svc.deleteDocument(id, ownerId);

    // Invalidate cache for this user's document list
    this.logger.log(`Calling invalidateUserCache for ownerId: ${ownerId}`);
    await this.invalidateUserCache(ownerId);

    return r as unknown as { success: boolean };
  }

  @Get(":id/chunks")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Get document embeddings chunks" })
  @ApiResponse({ status: 200, description: "List of chunks" })
  async getChunks(@Param("id") id: string, @Req() req: FastifyRequest) {
    const user = (req as FastifyRequest & { user?: { id?: string } }).user;
    const ownerId = user?.id as string;
    if (!ownerId) throw new UnauthorizedException();

    // This endpoint is ADMIN-only (see @Roles decorator above).
    // Any admin may inspect chunks of any document in the KB.
    const doc = await this.svc.getDocumentById(id);
    if (!doc)
      throw new UnauthorizedException("Document not found or access denied");

    return this.knowledgeBaseService.getChunksByDocumentId(id);
  }

  @Get("/list_by_user/:userId")
  // @UseInterceptors(CacheInterceptor)
  // @CacheTTL(60000)
  @ApiOperation({ summary: "List documents belonging to a user" })
  @ApiResponse({
    status: 200,
    schema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/DocumentListItem" },
        },
        meta: {
          type: "object",
          properties: {
            total: { type: "number" },
            page: { type: "number" },
            limit: { type: "number" },
            pages: { type: "number" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    schema: { $ref: "#/components/schemas/ErrorResponse" },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @UseInterceptors(new ZodSerializerInterceptor(DocumentPublicSchema))
  async listByUser(
    @Param("userId") userId: string,
    @Query(new ZodValidationPipe(OffsetPaginationSchema as any))
    query: OffsetPaginationDto,
    @Req() req: FastifyRequest
  ) {
    const user = (
      req as FastifyRequest & { user?: { id?: string; role?: string } }
    ).user;
    const ownerId = user?.id as string;
    const userRole = user?.role;
    if (!ownerId) throw new UnauthorizedException();

    // Non-ADMIN users can only list their own documents
    if (userRole !== UserRole.ADMIN && ownerId !== userId) {
      throw new BadRequestException("Not allowed");
    }

    // ADMIN users listing KB documents receive ALL KB documents regardless of owner
    const isAdminViewingAllKb =
      userRole === UserRole.ADMIN && query.isKb === true;

    const cacheKey = isAdminViewingAllKb
      ? `documents:list_all_kb?page=${query.page}&limit=${query.limit}&q=${query.q || ""}&sort=${query.sort || ""}&order=${query.order || ""}`
      : `documents:list_by_user/${userId}?page=${query.page}&limit=${query.limit}&q=${query.q || ""}&sort=${query.sort || ""}&order=${query.order || ""}&isKb=${query.isKb}`;

    const cached =
      this.redis && typeof this.redis.get === "function"
        ? await this.redis.get(cacheKey)
        : null;
    if (cached) {
      return JSON.parse(cached) as PaginatedResult<DocumentPublicDto>;
    }

    const docs = isAdminViewingAllKb
      ? await this.svc.listAll(query)
      : await this.svc.listByUser(userId, query);

    if (this.redis && typeof this.redis.set === "function") {
      await this.redis.set(cacheKey, JSON.stringify(docs), 60); // 60 seconds TTL
    }
    return docs;
  }
}
