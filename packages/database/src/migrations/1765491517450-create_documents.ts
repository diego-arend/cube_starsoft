import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDocuments1765491517450 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        -- Ensure extension for gen_random_uuid available if needed (documented in migration setup)
        key varchar NOT NULL UNIQUE,
        owner_id uuid NOT NULL,
        original_filename varchar NOT NULL,
        content_type varchar NOT NULL,
        size bigint NOT NULL,
        metadata jsonb,
        scan_status varchar NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents(owner_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS documents`);
  }
}
