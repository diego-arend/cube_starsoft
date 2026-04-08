import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPgvectorSupport1769688633524 implements MigrationInterface {
  name = "AddPgvectorSupport1769688633524";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Enable pgvector extension
    // Note: On AWS Aurora, this requires the user to have rds_superuser role or
    // the extension to be allowed in the parameter group.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    // 2. Create document_embeddings table
    await queryRunner.query(`
      CREATE TABLE "document_embeddings" (
        "id" uuid PRIMARY KEY NOT NULL,
        "document_id" uuid NOT NULL,
        "embedding" vector(1536) NOT NULL,
        "content" text,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_document_embeddings_document" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE
      )
    `);

    // 3. Create HNSW index for efficient similarity search
    // We use cosine distance (vector_cosine_ops) as it is most common for LLM embeddings
    await queryRunner.query(`
      CREATE INDEX "IDX_document_embeddings_embedding" ON "document_embeddings" 
      USING hnsw (embedding vector_cosine_ops);
    `);

    // 4. Add index to document_id for faster lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_document_embeddings_document_id" ON "document_embeddings" ("document_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_document_embeddings_document_id"`);
    await queryRunner.query(`DROP INDEX "IDX_document_embeddings_embedding"`);
    await queryRunner.query(`DROP TABLE "document_embeddings"`);
    // We intentionally do not drop the extension to avoid affecting other tables or needing elevated privileges again
  }
}
