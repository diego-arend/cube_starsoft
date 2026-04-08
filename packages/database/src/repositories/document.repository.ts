import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike, IsNull, Not } from "typeorm";
import { DocumentEntity } from "../entities/document.entity";
import { BaseRepository } from "./base.repository";

import { v4 as uuidv4 } from "uuid";

export const DOCUMENT_REPOSITORY = Symbol("DOCUMENT_REPOSITORY");

import type { DocumentPublicDto } from "../dto/document.dto";
import type { PaginationOptions, PaginatedResult } from "../pagination";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../pagination";

export interface IDocumentRepository {
  findOneById(id: string): Promise<DocumentEntity | null>;
  findAllByOwner(ownerId: string): Promise<DocumentEntity[]>;
  // Public-facing methods returning normalized DTOs for safe serialization
  findAllPublicByOwner(ownerId: string): Promise<DocumentPublicDto[]>;
  findOnePublicById(id: string): Promise<DocumentPublicDto | null>;
  // New: paginated public listing
  findPublicByOwnerPaginated(
    ownerId: string,
    opts: PaginationOptions
  ): Promise<PaginatedResult<DocumentPublicDto>>;
  // Admin: paginated listing of ALL documents (no owner filter)
  findPublicAllPaginated(
    opts: PaginationOptions
  ): Promise<PaginatedResult<DocumentPublicDto>>;
  save(data: Partial<DocumentEntity>): Promise<DocumentEntity>;
  remove(entity: DocumentEntity): Promise<DocumentEntity>;
}

export class DocumentRepository
  extends BaseRepository<DocumentEntity, DocumentEntity>
  implements IDocumentRepository
{
  constructor(
    @InjectRepository(DocumentEntity) repo: Repository<DocumentEntity>
  ) {
    super(repo);
  }

  async findOneById(id: string): Promise<DocumentEntity | null> {
    return super.findOneById(id);
  }

  async findAllByOwner(ownerId: string): Promise<DocumentEntity[]> {
    return this.repo.find({ where: { ownerId } });
  }

  async findAllPublicByOwner(ownerId: string): Promise<DocumentPublicDto[]> {
    const rows = await this.repo.find({ where: { ownerId } });
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      ownerId: r.ownerId,
      originalFilename: r.originalFilename,
      contentType: r.contentType,
      size: Number(r.size ?? 0),
      isKb: r.isKb,
      metadata: r.metadata ?? {},
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt ?? ""),
      scanStatus: r.scanStatus,
    }));
  }

  async findPublicByOwnerPaginated(
    ownerId: string,
    opts: PaginationOptions
  ): Promise<PaginatedResult<DocumentPublicDto>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? opts.take ?? DEFAULT_LIMIT;
    const take = Math.min(Math.max(1, Number(limit)), MAX_LIMIT);
    const skip = opts.skip ?? (page - 1) * take;

    const where: any[] = [];
    const baseWhere: any = { ownerId };

    if (typeof opts.isKb === "boolean") {
      baseWhere.isKb = opts.isKb;
    }

    if (opts.q) {
      // Search in originalFilename OR agent.name
      where.push(
        { ...baseWhere, originalFilename: ILike(`%${opts.q}%`) },
        {
          ...baseWhere,
          agentId: Not(IsNull()),
          agent: { name: ILike(`%${opts.q}%`) },
        }
      );
    } else {
      where.push(baseWhere);
    }

    const [rows, total] = await this.repo.findAndCount({
      where,
      skip,
      take,
      order: opts.order as any,
      relations: ["agent", "owner"],
    });

    const data = rows.map((r) => ({
      id: r.id,
      key: r.key,
      ownerId: r.ownerId,
      ownerEmail: r.owner?.email ?? null,
      originalFilename: r.originalFilename,
      contentType: r.contentType,
      size: Number(r.size ?? 0),
      isKb: r.isKb,
      agentId: r.agentId,
      agentName: r.agent?.name ?? null,
      metadata: r.metadata ?? {},
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt ?? ""),
      scanStatus: r.scanStatus,
    }));

    const pages = Math.max(1, Math.ceil(total / take));

    return {
      data,
      meta: { total, page, limit: take, pages },
    };
  }

  async findPublicAllPaginated(
    opts: PaginationOptions
  ): Promise<PaginatedResult<DocumentPublicDto>> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? opts.take ?? DEFAULT_LIMIT;
    const take = Math.min(Math.max(1, Number(limit)), MAX_LIMIT);
    const skip = opts.skip ?? (page - 1) * take;

    const baseWhere: any = {};

    if (typeof opts.isKb === "boolean") {
      baseWhere.isKb = opts.isKb;
    }

    const where: any[] = [];
    if (opts.q) {
      where.push(
        { ...baseWhere, originalFilename: ILike(`%${opts.q}%`) },
        {
          ...baseWhere,
          agentId: Not(IsNull()),
          agent: { name: ILike(`%${opts.q}%`) },
        }
      );
    } else {
      where.push(baseWhere);
    }

    const [rows, total] = await this.repo.findAndCount({
      where,
      skip,
      take,
      order: opts.order as any,
      relations: ["agent", "owner"],
    });

    const data = rows.map((r) => ({
      id: r.id,
      key: r.key,
      ownerId: r.ownerId,
      ownerEmail: r.owner?.email ?? null,
      originalFilename: r.originalFilename,
      contentType: r.contentType,
      size: Number(r.size ?? 0),
      isKb: r.isKb,
      agentId: r.agentId,
      agentName: r.agent?.name ?? null,
      metadata: r.metadata ?? {},
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt ?? ""),
      scanStatus: r.scanStatus,
    }));

    const pages = Math.max(1, Math.ceil(total / take));

    return {
      data,
      meta: { total, page, limit: take, pages },
    };
  }

  async findOnePublicById(id: string): Promise<DocumentPublicDto | null> {
    const r = await this.findOneById(id);
    if (!r) return null;
    return {
      id: r.id,
      key: r.key,
      ownerId: r.ownerId,
      originalFilename: r.originalFilename,
      contentType: r.contentType,
      size: Number(r.size ?? 0),
      isKb: r.isKb,
      metadata: r.metadata ?? {},
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt ?? ""),
      scanStatus: r.scanStatus,
    };
  }

  async save(data: Partial<DocumentEntity>): Promise<DocumentEntity> {
    const e = new DocumentEntity();
    if (data.key !== undefined) e.key = data.key;
    if (data.ownerId !== undefined) e.ownerId = data.ownerId;
    if (data.originalFilename !== undefined)
      e.originalFilename = data.originalFilename;
    if (data.contentType !== undefined) e.contentType = data.contentType;
    if (data.size !== undefined) e.size = data.size as any;
    if (data.metadata !== undefined) e.metadata = data.metadata;
    if (data.isKb !== undefined) e.isKb = data.isKb;
    if (data.agentId !== undefined) e.agentId = data.agentId;
    if (data["scanStatus"] !== undefined)
      e["scanStatus"] = data["scanStatus"] as any;

    function mapRowToEntity(row: any): DocumentEntity {
      // Normalize DB row (snake_case) to entity shape with proper types
      const out: any = {};
      out.id = row.id;
      out.key = row.key;
      out.ownerId = row.owner_id ?? row.ownerId;
      out.originalFilename = row.original_filename ?? row.originalFilename;
      out.contentType = row.content_type ?? row.contentType;
      out.size = row.size !== undefined ? Number(row.size) : row.size;
      out.isKb = row.is_kb ?? row.isKb;
      try {
        out.metadata =
          typeof row.metadata === "string"
            ? JSON.parse(row.metadata)
            : row.metadata;
      } catch {
        out.metadata = row.metadata;
      }
      out.scanStatus = row.scan_status ?? row.scanStatus;
      // createdAt returned as ISO string to satisfy the OpenAPI/Zod serializer
      if (row.created_at !== undefined && row.created_at !== null) {
        const d = new Date(row.created_at);
        out.createdAt = isNaN(d.getTime())
          ? String(row.created_at)
          : d.toISOString();
      } else if (row.createdAt !== undefined) {
        const d = new Date(row.createdAt);
        out.createdAt = isNaN(d.getTime())
          ? String(row.createdAt)
          : d.toISOString();
      }
      return out as DocumentEntity;
    }

    try {
      return await super.save(e as any);
    } catch (err: any) {
      // If this is a unique constraint violation (e.g. concurrent save
      // attempts for the same `key`) return the existing record instead of
      // throwing a hard exception.
      const msg = String(err?.message ?? err).toLowerCase();
      const code = err?.code ?? err?.errno ?? undefined;
      const isUniqueViolation =
        code === "23505" ||
        code === "SQLITE_CONSTRAINT" ||
        msg.includes("duplicate key") ||
        msg.includes("unique constraint") ||
        msg.includes("unique") ||
        msg.includes("constraint");

      if (isUniqueViolation && e.key) {
        try {
          const found = await this.repo.manager.query(
            `SELECT * FROM documents WHERE key = $1 LIMIT 1`,
            [e.key]
          );
          if (found && found[0]) return mapRowToEntity(found[0]);
        } catch (e2: any) {
          void e2; // ignore and fall through to other handlers
        }
      }

      // Fallback: if TypeORM metadata isn't available at runtime, perform a
      // raw INSERT using the repository's manager as a last-resort to avoid
      // hard failures during early bootstrap or misconfiguration. Also handle
      // unique-constraint collisions here by selecting the existing row.
      if (msg.includes('no metadata for "documententity"')) {
        const id = (e as any).id ?? uuidv4();
        const values = [
          id,
          e.key,
          e.ownerId,
          e.originalFilename,
          e.contentType,
          e.size ?? 0,
          JSON.stringify(e.metadata ?? {}),
          e.scanStatus ?? "pending",
          e.isKb ?? false,
        ];
        try {
          const row = await this.repo.manager.query(
            `INSERT INTO documents (id, key, owner_id, original_filename, content_type, size, metadata, scan_status, is_kb) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            values
          );
          return row && row[0] ? mapRowToEntity(row[0]) : e;
        } catch (e2: any) {
          const msg2 = String(e2?.message ?? e2).toLowerCase();
          const code2 = e2?.code ?? e2?.errno ?? undefined;
          const isUnique2 =
            code2 === "23505" ||
            code2 === "SQLITE_CONSTRAINT" ||
            msg2.includes("duplicate key") ||
            msg2.includes("unique constraint") ||
            msg2.includes("unique") ||
            msg2.includes("constraint");
          if (isUnique2 && e.key) {
            const found = await this.repo.manager.query(
              `SELECT * FROM documents WHERE key = $1 LIMIT 1`,
              [e.key]
            );
            if (found && found[0]) return mapRowToEntity(found[0]);
          }
          throw e2;
        }
      }
      throw err;
    }
  }

  async update(
    id: string,
    data: Partial<DocumentEntity>
  ): Promise<DocumentEntity> {
    const existing = await this.findOneById(id);
    if (!existing) throw new Error("Document not found");
    if (data.key !== undefined) existing.key = data.key;
    if (data.originalFilename !== undefined)
      existing.originalFilename = data.originalFilename;
    if (data.contentType !== undefined) existing.contentType = data.contentType;
    if (data.size !== undefined) existing.size = data.size as any;
    if (data.metadata !== undefined) existing.metadata = data.metadata;
    if (data.isKb !== undefined) existing.isKb = data.isKb;
    if ((data as any).scanStatus !== undefined)
      existing["scanStatus"] = (data as any).scanStatus;
    return this.repo.save(existing);
  }

  async remove(entity: DocumentEntity): Promise<DocumentEntity> {
    return super.remove(entity);
  }
}
