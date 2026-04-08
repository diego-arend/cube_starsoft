import { EntityManager, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { v7 as uuidv7 } from "uuid";
import { DocumentEmbeddingEntity } from "../entities/document-embedding.entity";
import { BaseRepository } from "./base.repository";

export const DOCUMENT_EMBEDDING_REPOSITORY = Symbol(
  "DOCUMENT_EMBEDDING_REPOSITORY"
);

export interface IDocumentEmbeddingRepository {
  save(
    data: Partial<DocumentEmbeddingEntity>,
    manager?: EntityManager
  ): Promise<DocumentEmbeddingEntity>;

  /**
   * Performs a nearest neighbor search using cosine distance (<=> operator in pgvector).
   * @param vector The query embedding vector as an array of numbers.
   * @param ownerId The ID of the user requesting the context.
   * @param agentId The ID of the agent requesting the context (optional).
   * @param limit Maximum number of results to return.
   * @returns List of chunks with their similarity distance.
   */
  searchSimilar(
    vector: number[],
    ownerId: string,
    agentId?: string,
    limit?: number
  ): Promise<Array<DocumentEmbeddingEntity & { distance: number }>>;

  findByDocumentId(documentId: string): Promise<DocumentEmbeddingEntity[]>;

  deleteByDocumentId(
    documentId: string,
    manager?: EntityManager
  ): Promise<void>;
}

export class DocumentEmbeddingRepository
  extends BaseRepository<DocumentEmbeddingEntity, DocumentEmbeddingEntity>
  implements IDocumentEmbeddingRepository
{
  constructor(
    @InjectRepository(DocumentEmbeddingEntity)
    repo: Repository<DocumentEmbeddingEntity>
  ) {
    super(repo);
  }

  /**
   * We override save to handle the vector type casting properly.
   * In pgvector, we can pass the array as a string format '[0.1, 0.2, ...]'
   */
  async save(
    data: Partial<DocumentEmbeddingEntity>,
    manager?: EntityManager
  ): Promise<DocumentEmbeddingEntity> {
    const repo = manager
      ? manager.getRepository(DocumentEmbeddingEntity)
      : this.repo;

    // If embedding is an array, we must convert it to pgvector format '[v1,v2,v3]'
    if (Array.isArray(data.embedding)) {
      const vectorStr = `[${data.embedding.join(",")}]`;

      // We use raw query for insert/update with vector to ensure correct casting
      const id = data.id || uuidv7();

      await repo.query(
        `INSERT INTO document_embeddings (id, document_id, embedding, content, metadata, created_at)
         VALUES ($1, $2, $3::vector, $4, $5, DEFAULT)
         ON CONFLICT (id) DO UPDATE SET
         embedding = $3::vector,
         content = $4,
         metadata = $5`,
        [
          id,
          data.documentId,
          vectorStr,
          data.content || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
        ]
      );

      return (await repo.findOneBy({ id: id as any }))!;
    }

    const targetRepo = manager
      ? manager.getRepository(DocumentEmbeddingEntity)
      : this.repo;
    return targetRepo.save(data as any) as Promise<DocumentEmbeddingEntity>;
  }

  async searchSimilar(
    vector: number[],
    ownerId: string,
    agentId?: string,
    limit: number = 10
  ): Promise<Array<DocumentEmbeddingEntity & { distance: number }>> {
    const vectorStr = `[${vector.join(",")}]`;

    // Base query components
    let query = `
      SELECT de.id, de.document_id, de.content, de.metadata, de.created_at, (de.embedding <=> $1::vector) AS distance
      FROM document_embeddings de
      JOIN documents d ON de.document_id = d.id
      WHERE (d.owner_id = $2 OR d.is_kb = true)
    `;
    const params: any[] = [vectorStr, ownerId];

    // Filter by agentId if provided
    if (agentId) {
      query += ` AND (d.agent_id = $3 OR d.agent_id IS NULL)`;
      params.push(agentId);
    } else {
      query += ` AND (d.agent_id IS NULL)`;
    }

    query += ` ORDER BY distance ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const results = await this.repo.query(query, params);

    return results as Array<DocumentEmbeddingEntity & { distance: number }>;
  }

  async findByDocumentId(
    documentId: string
  ): Promise<DocumentEmbeddingEntity[]> {
    return this.repo.find({ where: { documentId } });
  }

  async deleteByDocumentId(
    documentId: string,
    manager?: EntityManager
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(DocumentEmbeddingEntity)
      : this.repo;
    await repo.delete({ documentId });
  }
}
